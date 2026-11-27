import { getSummaryAt, getSummaryIds, setSummaryDelivery } from './db';
import { formatCheckIn, formatLoad, formatWhen, isBodyweightExercise, profileName } from './format';
import type { ProfileId, Session, SetLog } from './types';
import { FLAG_LABELS } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type CoachSet = {
  load: number | null;
  unit: SetLog['unit'];
  reps: number | null;
  workSec: number | null;
  made: boolean | null;
  flag: SetLog['flag'];
  note: string;
  bodyweight?: boolean;
};

export type CoachSummary = {
  profile: ProfileId;
  name: string;
  from: string;
  to: string;
  sessions: {
    startedAt: string;
    day: string;
    checkIn: Session['checkIn'];
    exercises: { name: string; sets: CoachSet[] }[];
  }[];
};

type CoachCursor = { at: string | null; ids: string[] };

const cursors = new Map<ProfileId, CoachCursor>();

export async function loadCoachCursor(profile: ProfileId): Promise<void> {
  const [at, ids] = await Promise.all([getSummaryAt(profile), getSummaryIds(profile)]);
  cursors.set(profile, { at, ids });
}

function instant(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function completedAt(session: Session): number | null {
  return instant(session.finishedAt ?? session.startedAt);
}

export function sessionsForCoachPacket(
  sessions: Session[],
  from: string | null,
  deliveredIds: readonly string[] = [],
  now = Date.now(),
): { from: string; sessions: Session[] } {
  const delivered = new Set(deliveredIds);
  const weekAgo = now - WEEK_MS;
  const cursor = instant(from);
  const fromMs = cursor ?? weekAgo;
  const pending = sessions.filter((session) => session.status === 'completed' && !delivered.has(session.id));
  const since = (start: number) =>
    pending.filter((session) => {
      const time = completedAt(session);
      return time != null && time >= start;
    });
  let chosen = since(fromMs);
  let windowFrom = fromMs;
  if (chosen.length === 0 && cursor != null) {
    // A cancelled or failed send used to stamp "now" and the next packet started there.
    // Pull back completed sessions that stamp jumped over, when this phone has no record of sending them.
    const skipped = pending.filter((session) => {
      const time = completedAt(session);
      return time != null && time >= weekAgo && time < fromMs;
    });
    if (skipped.length > 0) {
      chosen = skipped;
      windowFrom = weekAgo;
    }
  }
  chosen.sort((a, b) => (completedAt(a) ?? 0) - (completedAt(b) ?? 0) || a.startedAt.localeCompare(b.startedAt));
  return { from: new Date(windowFrom).toISOString(), sessions: chosen };
}

export function shareFailure(error: unknown): 'cancelled' | 'undelivered' {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'AbortError' || name === 'InvalidStateError') return 'cancelled';
  return 'undelivered';
}

export function buildCoachSummary(
  profile: ProfileId,
  sessions: Session[],
  from: string,
  now = new Date(),
  deliveredIds: readonly string[] = [],
): CoachSummary {
  const packet = sessionsForCoachPacket(sessions, from, deliveredIds, now.getTime());
  return {
    profile,
    name: profileName(profile),
    from: packet.from,
    to: now.toISOString(),
    sessions: packet.sessions.map((session) => ({
      startedAt: session.startedAt,
      day: session.dayName,
      checkIn: session.checkIn,
      exercises: groupSets(session.sets, session.day),
    })),
  };
}

function groupSets(sets: SetLog[], day: Session['day']): { name: string; sets: CoachSet[] }[] {
  const groups: { name: string; sets: CoachSet[] }[] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    const item: CoachSet = {
      load: set.load,
      unit: set.unit,
      reps: set.reps,
      workSec: set.workSec,
      made: set.made ?? null,
      flag: set.flag,
      note: set.note,
      bodyweight: isBodyweightExercise(day, set.exerciseName),
    };
    if (last && last.name === set.exerciseName) last.sets.push(item);
    else groups.push({ name: set.exerciseName, sets: [item] });
  }
  return groups;
}

export function renderCoachText(summary: CoachSummary): string {
  const lines = [`${summary.name}`, `Since ${formatWhen(summary.from)}`, `${summary.sessions.length} sessions`];
  if (summary.sessions.length === 0) lines.push('No sessions.');
  for (const session of summary.sessions) {
    lines.push('', `${formatWhen(session.startedAt)} · ${session.day}`, formatCheckIn(session.checkIn));
    for (const exercise of session.exercises) {
      lines.push(exercise.name);
      for (const set of exercise.sets) lines.push(...setLines(set));
    }
  }
  return lines.join('\n');
}

function setLines(set: CoachSet): string[] {
  const weight = formatLoad(set.load, set.unit, Boolean(set.bodyweight)) || 'no weight';
  let result = weight;
  if (set.reps != null && set.workSec == null) {
    const mark = set.made === false ? 'missed' : set.made === true ? 'ticked' : 'logged';
    result = `${weight} × ${set.reps} ${mark}`;
  } else if (set.workSec != null) {
    const mark = set.made === false ? 'failed' : set.made === true ? 'made' : 'logged';
    result = `${weight} · ${set.workSec}s ${mark}`;
  } else if (set.made === false) {
    result = `${weight} failed`;
  }
  const lines = [`  ${result}`];
  if (set.flag) lines.push(`  flag: ${FLAG_LABELS[set.flag]}`);
  if (set.note) lines.push(`  note: ${set.note}`);
  return lines;
}

export function sendCoachSummary(profile: ProfileId, sessions: Session[]): Promise<'sent' | 'saved' | 'cancelled'> {
  const cursor = cursors.get(profile) ?? { at: null, ids: [] };
  const now = new Date();
  const packet = sessionsForCoachPacket(sessions, cursor.at, cursor.ids, now.getTime());
  const summary = buildCoachSummary(profile, sessions, cursor.at ?? packet.from, now, cursor.ids);
  const text = renderCoachText(summary);
  const json = JSON.stringify(summary, null, 2);
  const fileName = `spotter-${profile}.json`;
  const payload = `${text}\n\n${json}`;
  const sessionIds = packet.sessions.map((session) => session.id);

  const delivered = async () => {
    if (sessionIds.length === 0) return;
    const ids = [...new Set([...cursor.ids, ...sessionIds])];
    try {
      await setSummaryDelivery(profile, summary.to, ids);
      cursors.set(profile, { at: summary.to, ids });
    } catch {
      // The packet already left. Leave the window open so the next send still includes it.
    }
  };

  if (typeof navigator.share === 'function') {
    try {
      const file = new File([json], fileName, { type: 'application/json' });
      const data: ShareData = { title: `Spotter · ${summary.name}`, text };
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
      else data.text = payload;
      // Share has to run in this turn. An await before it drops the tap on iOS and the call is rejected.
      return navigator.share(data).then(
        () => delivered().then(() => 'sent' as const),
        (error: unknown) => (shareFailure(error) === 'cancelled' ? 'cancelled' : copyAndDownload(payload, json, fileName).then(() => 'saved' as const)),
      );
    } catch (error) {
      if (shareFailure(error) === 'cancelled') return Promise.resolve('cancelled');
      return copyAndDownload(payload, json, fileName).then(() => 'saved');
    }
  }

  return copyAndDownload(payload, json, fileName).then(() => delivered().then(() => 'saved' as const));
}

async function copyAndDownload(payload: string, json: string, fileName: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(payload);
  } catch {
    // The download below still gives them the JSON.
  }
  download(json, fileName);
}

function download(json: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
