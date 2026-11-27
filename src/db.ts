import audreyProgram from './programs/audrey.json' with { type: 'json' };
import bonnieProgram from './programs/bonnie.json' with { type: 'json' };
import danProgram from './programs/dan.json' with { type: 'json' };
import { DEFAULT_WEIGHT_KG } from './metrics';
import { parseProgram, programStamp } from './program';
import type { Activity, ProfileId, Program, Session, Skinfold, Tape, WeighIn } from './types';
import { isProfileId, PROFILE_IDS } from './types';

const DB_NAME = 'spotter';
const DB_VERSION = 2;
const ALL_STORES = ['meta', 'programs', 'sessions', 'weights', 'skinfolds', 'tapes', 'activities'] as const;

let opening: Promise<IDBDatabase> | null = null;
let current: IDBDatabase | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function release(db: IDBDatabase) {
  if (current !== db) return;
  current = null;
  opening = null;
}

function closing(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidStateError';
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
        if (!db.objectStoreNames.contains('weights')) db.createObjectStore('weights', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('skinfolds')) db.createObjectStore('skinfolds', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tapes')) db.createObjectStore('tapes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('activities')) db.createObjectStore('activities', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          release(db);
          db.close();
        };
        db.onclose = () => release(db);
        current = db;
        resolve(db);
      };
      request.onerror = () => {
        opening = null;
        reject(new Error('Could not open the on-device log. If this is a private window, open Spotter in a normal tab.'));
      };
    });
  }
  return opening;
}

async function access(storeNames: string | string[], mode: IDBTransactionMode): Promise<IDBTransaction> {
  const db = await open();
  try {
    return db.transaction(storeNames, mode);
  } catch (error) {
    if (!closing(error)) throw error;
    release(db);
    try {
      db.close();
    } catch {
      // Safari already started closing this connection.
    }
    const again = await open();
    return again.transaction(storeNames, mode);
  }
}

function finish(transaction: IDBTransaction, action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`Could not ${action}.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`Could not ${action}.`));
  });
}

async function read<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const transaction = await access(storeName, 'readonly');
  return new Promise((resolve, reject) => {
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
  const transaction = await access('meta', 'readwrite');
  transaction.objectStore('meta').put(clone(value), key);
  await finish(transaction, 'save');
}

export async function getActiveProfile(): Promise<ProfileId | null> {
  const value = await getMeta('activeProfile');
  return isProfileId(value) ? value : null;
}

export async function setActiveProfile(profile: ProfileId | null): Promise<void> {
  if (profile == null) {
    const transaction = await access('meta', 'readwrite');
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

export async function getDefaultWeights(): Promise<Record<ProfileId, number>> {
  const value = await getMeta('defaultWeights');
  const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const weights = { ...DEFAULT_WEIGHT_KG };
  for (const id of PROFILE_IDS) {
    const kg = stored[id];
    if (typeof kg === 'number' && Number.isFinite(kg) && kg > 0) weights[id] = kg;
  }
  return weights;
}

export async function setDefaultWeight(profile: ProfileId, kg: number): Promise<void> {
  const weights = await getDefaultWeights();
  weights[profile] = kg;
  await setMeta('defaultWeights', weights);
}

export async function getSummaryAt(profile: ProfileId): Promise<string | null> {
  const value = await getMeta(`summaryAt:${profile}`);
  return typeof value === 'string' ? value : null;
}

export async function setSummaryAt(profile: ProfileId, iso: string): Promise<void> {
  await setMeta(`summaryAt:${profile}`, iso);
}

export async function getSummaryIds(profile: ProfileId): Promise<string[]> {
  const value = await getMeta(`summaryIds:${profile}`);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export async function setSummaryDelivery(profile: ProfileId, at: string, ids: string[]): Promise<void> {
  const transaction = await access('meta', 'readwrite');
  const store = transaction.objectStore('meta');
  store.put(at, `summaryAt:${profile}`);
  store.put(clone(ids), `summaryIds:${profile}`);
  await finish(transaction, 'save');
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
  const transaction = await access('programs', 'readwrite');
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
  const transaction = await access('sessions', 'readwrite');
  transaction.objectStore('sessions').put(clone(session));
  await finish(transaction, 'save the set');
}

export async function deleteSession(id: string): Promise<void> {
  const transaction = await access('sessions', 'readwrite');
  transaction.objectStore('sessions').delete(id);
  await finish(transaction, 'delete the workout');
}

async function listStored<T>(store: string): Promise<T[]> {
  const all = await read<T[]>(store, (objectStore) => objectStore.getAll());
  return all ?? [];
}

async function putStored(store: string, row: { id: string }, label: string): Promise<void> {
  const transaction = await access(store, 'readwrite');
  transaction.objectStore(store).put(clone(row));
  await finish(transaction, label);
}

async function deleteStored(store: string, id: string, label: string): Promise<void> {
  const transaction = await access(store, 'readwrite');
  transaction.objectStore(store).delete(id);
  await finish(transaction, label);
}

export async function listWeights(): Promise<WeighIn[]> {
  const rows = await listStored<WeighIn>('weights');
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

export async function putWeight(row: WeighIn): Promise<void> {
  await putStored('weights', row, 'save the weigh-in');
}

export async function deleteWeight(id: string): Promise<void> {
  await deleteStored('weights', id, 'delete the weigh-in');
}

export async function listSkinfolds(): Promise<Skinfold[]> {
  const rows = await listStored<Skinfold>('skinfolds');
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

export async function putSkinfold(row: Skinfold): Promise<void> {
  await putStored('skinfolds', row, 'save the skinfolds');
}

export async function deleteSkinfold(id: string): Promise<void> {
  await deleteStored('skinfolds', id, 'delete the skinfolds');
}

export async function listTapes(): Promise<Tape[]> {
  const rows = await listStored<Tape>('tapes');
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

export async function putTape(row: Tape): Promise<void> {
  await putStored('tapes', row, 'save the tape');
}

export async function deleteTape(id: string): Promise<void> {
  await deleteStored('tapes', id, 'delete the tape');
}

export async function listActivities(): Promise<Activity[]> {
  const rows = await listStored<Activity>('activities');
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export async function putActivity(row: Activity): Promise<void> {
  await putStored('activities', row, 'save the activity');
}

export async function deleteActivity(id: string): Promise<void> {
  await deleteStored('activities', id, 'delete the activity');
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
  const transaction = await access([...ALL_STORES], 'readwrite');
  for (const name of ALL_STORES) transaction.objectStore(name).clear();
  await finish(transaction, 'clear the log');
  await ensureSeeded();
}

export async function replaceAll(input: {
  programs: Program[];
  sessions: Session[];
  weights: WeighIn[];
  skinfolds: Skinfold[];
  tapes: Tape[];
  activities: Activity[];
  activeProfile: ProfileId | null;
  lastBackupAt: string;
}): Promise<void> {
  const transaction = await access([...ALL_STORES], 'readwrite');
  const meta = transaction.objectStore('meta');
  const programs = transaction.objectStore('programs');
  const sessions = transaction.objectStore('sessions');
  const weights = transaction.objectStore('weights');
  const skinfolds = transaction.objectStore('skinfolds');
  const tapes = transaction.objectStore('tapes');
  const activities = transaction.objectStore('activities');
  for (const name of ALL_STORES) transaction.objectStore(name).clear();
  if (input.activeProfile) meta.put(input.activeProfile, 'activeProfile');
  meta.put(input.lastBackupAt, 'lastBackupAt');
  for (const program of input.programs) programs.put(clone(program), program.profile);
  for (const session of input.sessions) sessions.put(clone(session));
  for (const row of input.weights) weights.put(clone(row));
  for (const row of input.skinfolds) skinfolds.put(clone(row));
  for (const row of input.tapes) tapes.put(clone(row));
  for (const row of input.activities) activities.put(clone(row));
  await finish(transaction, 'restore the backup');
  await ensureSeeded();
}

export async function mergeBackup(input: {
  programs: Program[];
  sessions: Session[];
  weights: WeighIn[];
  skinfolds: Skinfold[];
  tapes: Tape[];
  activities: Activity[];
}): Promise<{
  addedSessions: number;
  addedRecords: number;
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
  let addedRecords = 0;
  addedRecords += await mergeRows(input.weights, listWeights, putWeight);
  addedRecords += await mergeRows(input.skinfolds, listSkinfolds, putSkinfold);
  addedRecords += await mergeRows(input.tapes, listTapes, putTape);
  addedRecords += await mergeRows(input.activities, listActivities, putActivity);
  return { addedSessions, addedRecords, programsAdded, programsKept };
}

async function mergeRows<T extends { id: string }>(
  incoming: T[],
  list: () => Promise<T[]>,
  put: (row: T) => Promise<void>,
): Promise<number> {
  const existing = new Set((await list()).map((row) => row.id));
  let added = 0;
  for (const row of incoming) {
    if (existing.has(row.id)) continue;
    await put(row);
    added += 1;
  }
  return added;
}
