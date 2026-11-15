import { getSummaryAt, setSummaryAt } from './db';
import { formatCheckIn, formatNumber, formatWhen, profileName } from './format';
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

export async function summaryWindow(profile: ProfileId, now = Date.now()): Promise<string> {
  const last = await getSummaryAt(profile);
  if (last) return last;
  return new Date(now - WEEK_MS).toISOString();
}

export function buildCoachSummary(profile: ProfileId, sessions: Session[], from: string, now = new Date()): CoachSummary {
  const included = sessions
    .filter((session) => session.status === 'completed' && session.startedAt >= from)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return {
    profile,
    name: profileName(profile),
    from,
    to: now.toISOString(),
    sessions: included.map((session) => ({
      startedAt: session.startedAt,
      day: session.dayName,
      checkIn: session.checkIn,
      exercises: groupSets(session.sets),
    })),
  };
}

function groupSets(sets: SetLog[]): { name: string; sets: CoachSet[] }[] {
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
  const weight = set.load != null ? `${formatNumber(set.load)} ${set.unit}` : 'no weight';
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

export async function sendCoachSummary(profile: ProfileId, sessions: Session[]): Promise<'sent' | 'saved' | 'cancelled'> {
  const from = await summaryWindow(profile);
  const summary = buildCoachSummary(profile, sessions, from);
  const text = renderCoachText(summary);
  const json = JSON.stringify(summary, null, 2);
  const fileName = `spotter-${profile}.json`;
  const payload = `${text}\n\n${json}`;
  try {
    if (typeof navigator.share === 'function') {
      const file = new File([json], fileName, { type: 'application/json' });
      const data: ShareData = { title: `Spotter · ${summary.name}`, text };
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
      else data.text = payload;
      await navigator.share(data);
      await setSummaryAt(profile, new Date().toISOString());
      return 'sent';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(payload);
  } catch {
    // The download below still gives them the JSON.
  }
  download(json, fileName);
  await setSummaryAt(profile, new Date().toISOString());
  return 'saved';
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
