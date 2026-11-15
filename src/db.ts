import audreyProgram from './programs/audrey.json';
import bonnieProgram from './programs/bonnie.json';
import danProgram from './programs/dan.json';
import { parseProgram, programStamp } from './program';
import type { ProfileId, Program, Session } from './types';
import { isProfileId, PROFILE_IDS } from './types';

const DB_NAME = 'spotter';
const DB_VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;
let current: IDBDatabase | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function open(): Promise<IDBDatabase> {
  if (current) return Promise.resolve(current);
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        opening = null;
        reject(new Error('This browser has no IndexedDB. Spotter needs it to keep the log on the device.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('programs')) db.createObjectStore('programs');
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        current = request.result;
        current.onversionchange = () => {
          current?.close();
          current = null;
          opening = null;
        };
        resolve(current);
      };
      request.onerror = () => {
        opening = null;
        reject(new Error('Could not open the on-device log. If this is a private window, open Spotter in a normal tab.'));
      };
    });
  }
  return opening;
}

function finish(transaction: IDBTransaction, action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Could not ${action}.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`Could not ${action}.`));
  });
}

async function read<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = fn(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not read the log.'));
  });
}

export async function getMeta(key: string): Promise<unknown> {
  const value = await read<unknown>('meta', (store) => store.get(key));
  return value ?? null;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await open();
  const transaction = db.transaction('meta', 'readwrite');
  transaction.objectStore('meta').put(clone(value), key);
  await finish(transaction, 'save');
}

export async function getActiveProfile(): Promise<ProfileId | null> {
  const value = await getMeta('activeProfile');
  return isProfileId(value) ? value : null;
}

export async function setActiveProfile(profile: ProfileId | null): Promise<void> {
  if (profile == null) {
    const db = await open();
    const transaction = db.transaction('meta', 'readwrite');
    transaction.objectStore('meta').delete('activeProfile');
    await finish(transaction, 'save');
    return;
  }
  await setMeta('activeProfile', profile);
}

export async function getLastBackup(): Promise<string | null> {
  const value = await getMeta('lastBackupAt');
  return typeof value === 'string' ? value : null;
}

export async function setLastBackup(iso: string): Promise<void> {
  await setMeta('lastBackupAt', iso);
}

export async function getSummaryAt(profile: ProfileId): Promise<string | null> {
  const value = await getMeta(`summaryAt:${profile}`);
  return typeof value === 'string' ? value : null;
}

export async function setSummaryAt(profile: ProfileId, iso: string): Promise<void> {
  await setMeta(`summaryAt:${profile}`, iso);
}

function fetchProgram(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  return fetch(url, { cache: 'no-store', signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function syncRepoPrograms(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await Promise.all(
    PROFILE_IDS.map(async (profile) => {
      try {
        const response = await fetchProgram(`${import.meta.env.BASE_URL}programs/${profile}.json`);
        if (!response.ok) return;
        const parsed = parseProgram(await response.json());
        if (!parsed.ok || parsed.value.profile !== profile) return;
        const current = await getProgram(profile);
        if (current && programStamp(current) === programStamp(parsed.value)) return;
        await putProgram(parsed.value);
      } catch {
        // Offline or a bad file: keep the program already stored.
      }
    }),
  );
}

export async function getProgram(profile: ProfileId): Promise<Program | null> {
  const value = await read<Program | undefined>('programs', (store) => store.get(profile));
  return value ?? null;
}

export async function putProgram(program: Program): Promise<void> {
  const db = await open();
  const transaction = db.transaction('programs', 'readwrite');
  transaction.objectStore('programs').put(clone(program), program.profile);
  await finish(transaction, 'save the program');
}

export async function listPrograms(): Promise<Program[]> {
  const programs: Program[] = [];
  for (const profile of PROFILE_IDS) {
    const program = await getProgram(profile);
    if (program) programs.push(program);
  }
  return programs;
}

export async function listSessions(profile?: ProfileId): Promise<Session[]> {
  const all = await read<Session[]>('sessions', (store) => store.getAll());
  const rows = (all ?? []).filter((session) => (profile ? session.profile === profile : true));
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function putSession(session: Session): Promise<void> {
  const db = await open();
  const transaction = db.transaction('sessions', 'readwrite');
  transaction.objectStore('sessions').put(clone(session));
  await finish(transaction, 'save the set');
}

export async function deleteSession(id: string): Promise<void> {
  const db = await open();
  const transaction = db.transaction('sessions', 'readwrite');
  transaction.objectStore('sessions').delete(id);
  await finish(transaction, 'delete the workout');
}

export async function ensureSeeded(): Promise<void> {
  const bundled: Record<ProfileId, unknown> = {
    dan: danProgram,
    bonnie: bonnieProgram,
    audrey: audreyProgram,
  };
  for (const profile of PROFILE_IDS) {
    if (await getProgram(profile)) continue;
    const parsed = parseProgram(bundled[profile]);
    if (!parsed.ok) throw new Error(`Built-in ${profile} program is invalid: ${parsed.errors.join(' ')}`);
    if (parsed.value.profile !== profile) throw new Error(`Built-in ${profile} program is for ${parsed.value.profile}.`);
    await putProgram(parsed.value);
  }
}

export async function wipeAll(): Promise<void> {
  const db = await open();
  const transaction = db.transaction(['meta', 'programs', 'sessions'], 'readwrite');
  transaction.objectStore('meta').clear();
  transaction.objectStore('programs').clear();
  transaction.objectStore('sessions').clear();
  await finish(transaction, 'clear the log');
  await ensureSeeded();
}

export async function replaceAll(input: {
  programs: Program[];
  sessions: Session[];
  activeProfile: ProfileId | null;
  lastBackupAt: string;
}): Promise<void> {
  const db = await open();
  const transaction = db.transaction(['meta', 'programs', 'sessions'], 'readwrite');
  const meta = transaction.objectStore('meta');
  const programs = transaction.objectStore('programs');
  const sessions = transaction.objectStore('sessions');
  meta.clear();
  programs.clear();
  sessions.clear();
  if (input.activeProfile) meta.put(input.activeProfile, 'activeProfile');
  meta.put(input.lastBackupAt, 'lastBackupAt');
  for (const program of input.programs) programs.put(clone(program), program.profile);
  for (const session of input.sessions) sessions.put(clone(session));
  await finish(transaction, 'restore the backup');
  await ensureSeeded();
}

export async function mergeBackup(input: { programs: Program[]; sessions: Session[] }): Promise<{
  addedSessions: number;
  programsAdded: ProfileId[];
  programsKept: ProfileId[];
}> {
  const programsAdded: ProfileId[] = [];
  const programsKept: ProfileId[] = [];
  for (const program of input.programs) {
    const existing = await getProgram(program.profile);
    if (existing) programsKept.push(program.profile);
    else {
      await putProgram(program);
      programsAdded.push(program.profile);
    }
  }
  const existingIds = new Set((await listSessions()).map((session) => session.id));
  let addedSessions = 0;
  for (const session of input.sessions) {
    if (existingIds.has(session.id)) continue;
    await putSession(session);
    addedSessions += 1;
  }
  return { addedSessions, programsAdded, programsKept };
}
