import { isBodyweightExercise } from './format';
import type { Activity, ProfileId, Program, Session, Skinfold, Tape, Unit, WeighIn } from './types';
import { PROFILE_IDS } from './types';

export const SKINFOLD_SITES = [
  ['chest', 'Chest'],
  ['midaxillary', 'Midaxillary'],
  ['triceps', 'Triceps'],
  ['subscapular', 'Subscapular'],
  ['abdominal', 'Abdominal'],
  ['suprailiac', 'Suprailiac'],
  ['thigh', 'Thigh'],
] as const;

export type SkinfoldSite = (typeof SKINFOLD_SITES)[number][0];

export const TAPE_SITES = [
  ['waist', 'Waist'],
  ['hips', 'Hips'],
  ['chest', 'Chest'],
  ['arm', 'Arm'],
  ['thigh', 'Thigh'],
] as const;

export type TapeSite = (typeof TAPE_SITES)[number][0];

/** Display guides only. They do not schedule or change a session. */
export const WEEK_GUIDE: Record<ProfileId, string> = {
  dan: '5',
  bonnie: '3–5',
  audrey: '2–3',
};

/**
 * Ease-off is a soft note only. It never edits the program or the session.
 * Among check-ins in the last 7 days, with at least 2 of them:
 * ease off when mean sleep is 2.5 or lower, mean energy is 2.5 or lower,
 * or mean soreness is 4 or higher.
 * Scales stay 1–5: sleep 1 poor–5 great, energy 1 drained–5 ready, soreness 1 none–5 a lot.
 */
export const READINESS_THRESHOLD = {
  minCheckIns: 2,
  windowDays: 7,
  sleepAtOrBelow: 2.5,
  energyAtOrBelow: 2.5,
  sorenessAtOrAbove: 4,
} as const;

export type TrendRange = '4w' | '3m' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

export function weekStart(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = start.getDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - delta);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function instant(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
  }
  return new Date(value).getTime();
}

export function inWeek(value: string, start: Date): boolean {
  const time = instant(value);
  if (!Number.isFinite(time)) return false;
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return time >= start.getTime() && time < end.getTime();
}

export function withinRange(value: string, range: TrendRange, now: Date): boolean {
  if (range === 'all') return true;
  const time = instant(value);
  if (!Number.isFinite(time)) return false;
  const days = range === '4w' ? 28 : 92;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return time >= now.getTime() - days * DAY_MS && time < end;
}

export function skinfoldSum(row: Pick<Skinfold, SkinfoldSite>): number {
  return SKINFOLD_SITES.reduce((total, [site]) => total + row[site], 0);
}

export function bodyFatEstimate(row: Skinfold): number | null {
  if (row.age == null) return null;
  const sex = row.profile === 'dan' ? 'male' : row.profile === 'bonnie' ? 'female' : null;
  if (!sex) return null;
  const sum = skinfoldSum(row);
  const density =
    sex === 'male'
      ? 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * row.age
      : 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * row.age;
  if (density <= 0) return null;
  const percent = 495 / density - 450;
  if (!Number.isFinite(percent)) return null;
  return Math.round(percent * 10) / 10;
}

export function waistHip(row: Pick<Tape, 'waist' | 'hips'>): number | null {
  if (row.hips <= 0) return null;
  return Math.round((row.waist / row.hips) * 100) / 100;
}

export function checkDue(dates: string[], now: Date): boolean {
  if (dates.length === 0) return true;
  const latest = Math.max(...dates.map((date) => instant(date)));
  if (!Number.isFinite(latest)) return true;
  return now.getTime() - latest >= 28 * DAY_MS;
}

export type DeloadWindow = { from: number; to: number };

/**
 * Session-based deload. Day.deload is ignored: those days are reused every session.
 * Prefer deload_from_session when a future program includes it.
 * Otherwise read a session range from progression_rule when the text marks it as a
 * deload or easier stretch, or when the range ends on the block length.
 */
export function deloadWindow(program: Program): DeloadWindow | null {
  const block = program.sessions_before_new_program;
  if (program.deload_from_session != null) {
    const from = program.deload_from_session;
    if (from >= 1 && from <= block) return { from, to: block };
    return null;
  }
  const text = program.progression_rule ?? '';
  const match = text.match(/sessions?\s+(\d+)\s*(?:–|—|-|to)\s*(\d+)/i);
  if (!match || match.index == null) return null;
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (from < 1 || to < from || to > block) return null;
  const around = text.slice(Math.max(0, match.index - 12), match.index + match[0].length + 60);
  const labelled = /deload|easier|lighter/i.test(around);
  const endsTheBlock = to === block && from > 1;
  if (!labelled && !endsTheBlock) return null;
  return { from, to };
}

export function deloadPhrase(program: Program, completed: number): string | null {
  const window = deloadWindow(program);
  if (!window) return null;
  const upcoming = completed + 1;
  if (upcoming > window.to) return null;
  if (upcoming >= window.from) return 'Deload this session';
  return `Deload in ${window.from - upcoming}`;
}

export type Readiness = {
  count: number;
  sleep: number | null;
  energy: number | null;
  soreness: number | null;
  easeOff: boolean;
};

export function readiness(sessions: Session[], profile: ProfileId, now: Date): Readiness {
  const from = now.getTime() - READINESS_THRESHOLD.windowDays * DAY_MS;
  const rows = sessions.filter((session) => {
    if (session.profile !== profile || !session.checkIn) return false;
    const time = instant(session.startedAt);
    return time >= from && time <= now.getTime() + 60_000;
  });
  if (rows.length === 0) return { count: 0, sleep: null, energy: null, soreness: null, easeOff: false };
  const mean = (key: 'sleep' | 'energy' | 'soreness') => rows.reduce((total, session) => total + session.checkIn[key], 0) / rows.length;
  const sleep = mean('sleep');
  const energy = mean('energy');
  const soreness = mean('soreness');
  const easeOff =
    rows.length >= READINESS_THRESHOLD.minCheckIns &&
    (sleep <= READINESS_THRESHOLD.sleepAtOrBelow ||
      energy <= READINESS_THRESHOLD.energyAtOrBelow ||
      soreness >= READINESS_THRESHOLD.sorenessAtOrAbove);
  return { count: rows.length, sleep, energy, soreness, easeOff };
}

export type FamilyRow = {
  profile: ProfileId;
  strength: number;
  minutes: number;
  guide: string;
};

export function profilesOnDevice(input: {
  sessions: { profile: ProfileId }[];
  weights: { profile: ProfileId }[];
  skinfolds: { profile: ProfileId }[];
  tapes: { profile: ProfileId }[];
  activities: { profile: ProfileId }[];
}): ProfileId[] {
  const present = new Set<ProfileId>();
  for (const row of [...input.sessions, ...input.weights, ...input.skinfolds, ...input.tapes, ...input.activities]) {
    present.add(row.profile);
  }
  return PROFILE_IDS.filter((id) => present.has(id));
}

export function familyWeek(
  input: {
    sessions: Session[];
    activities: Activity[];
    weights: WeighIn[];
    skinfolds: Skinfold[];
    tapes: Tape[];
  },
  now: Date,
): FamilyRow[] {
  const start = weekStart(now);
  return profilesOnDevice(input).map((profile) => ({
    profile,
    strength: input.sessions.filter(
      (session) => session.profile === profile && session.status === 'completed' && inWeek(session.startedAt, start),
    ).length,
    minutes: input.activities
      .filter((activity) => activity.profile === profile && inWeek(activity.date, start))
      .reduce((total, activity) => total + activity.minutes, 0),
    guide: WEEK_GUIDE[profile],
  }));
}

export function exerciseNames(sessions: Session[], profile: ProfileId): string[] {
  const seen = new Map<string, string>();
  for (const session of sessions) {
    if (session.profile !== profile || session.status !== 'completed') continue;
    for (const set of session.sets) {
      const key = set.exerciseName.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, set.exerciseName.trim());
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export type StrengthPoint = {
  at: string;
  load: number | null;
  unit: Unit | null;
  reps: number | null;
  workSec: number | null;
  bodyweight: boolean;
};

export function strengthSeries(sessions: Session[], profile: ProfileId, name: string): StrengthPoint[] {
  const key = name.trim().toLowerCase();
  return sessions
    .filter((session) => session.profile === profile && session.status === 'completed')
    .filter((session) => session.sets.some((set) => set.exerciseName.trim().toLowerCase() === key))
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const sets = session.sets.filter((set) => set.exerciseName.trim().toLowerCase() === key);
      const loaded = sets.filter((set) => set.load != null && set.load > 0);
      const best =
        loaded.slice().sort((a, b) => (b.load ?? 0) - (a.load ?? 0))[0] ??
        sets.slice().sort((a, b) => (b.workSec ?? 0) - (a.workSec ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
      return {
        at: session.startedAt,
        load: best?.load ?? null,
        unit: best?.unit ?? null,
        reps: best?.reps ?? null,
        workSec: best?.workSec ?? null,
        bodyweight: isBodyweightExercise(session.day, name),
      };
    });
}

export type PersonalBest = {
  exercise: string;
  kind: 'load' | 'reps' | 'hold';
  value: number;
  unit?: Unit;
  at: string;
  fresh: boolean;
};

export function personalBests(sessions: Session[], profile: ProfileId): PersonalBest[] {
  const completed = sessions
    .filter((session) => session.profile === profile && session.status === 'completed')
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  type Mark = { value: number; at: string; sessionId: string; improved: boolean };
  type Acc = {
    name: string;
    load: Map<Unit, Mark>;
    reps: Mark | null;
    hold: Mark | null;
    latestSessionId: string;
  };
  const byName = new Map<string, Acc>();
  for (const session of completed) {
    for (const set of session.sets) {
      const key = set.exerciseName.trim().toLowerCase();
      if (!key) continue;
      let acc = byName.get(key);
      if (!acc) {
        acc = { name: set.exerciseName.trim(), load: new Map(), reps: null, hold: null, latestSessionId: session.id };
        byName.set(key, acc);
      }
      acc.latestSessionId = session.id;
      acc.name = set.exerciseName.trim();
      if (set.load != null && set.load > 0) {
        const prev = acc.load.get(set.unit);
        if (!prev || set.load > prev.value) {
          acc.load.set(set.unit, { value: set.load, at: set.loggedAt, sessionId: session.id, improved: Boolean(prev) });
        }
      }
      if (set.reps != null && set.reps > 0 && (!acc.reps || set.reps > acc.reps.value)) {
        acc.reps = { value: set.reps, at: set.loggedAt, sessionId: session.id, improved: Boolean(acc.reps) };
      }
      if (set.workSec != null && set.workSec > 0 && (!acc.hold || set.workSec > acc.hold.value)) {
        acc.hold = { value: set.workSec, at: set.loggedAt, sessionId: session.id, improved: Boolean(acc.hold) };
      }
    }
  }
  const marks: PersonalBest[] = [];
  for (const acc of byName.values()) {
    for (const [unit, best] of acc.load) {
      marks.push({
        exercise: acc.name,
        kind: 'load',
        value: best.value,
        unit,
        at: best.at,
        fresh: best.improved && best.sessionId === acc.latestSessionId,
      });
    }
    if (acc.reps) {
      marks.push({
        exercise: acc.name,
        kind: 'reps',
        value: acc.reps.value,
        at: acc.reps.at,
        fresh: acc.reps.improved && acc.reps.sessionId === acc.latestSessionId,
      });
    }
    if (acc.hold) {
      marks.push({
        exercise: acc.name,
        kind: 'hold',
        value: acc.hold.value,
        at: acc.hold.at,
        fresh: acc.hold.improved && acc.hold.sessionId === acc.latestSessionId,
      });
    }
  }
  return marks.sort((a, b) => Number(b.fresh) - Number(a.fresh) || b.at.localeCompare(a.at) || a.exercise.localeCompare(b.exercise));
}

export type GarminRow = { at: string; kg: number };

/**
 * Garmin Connect weight CSV, detected from the header rather than a fixed layout.
 * A header row needs a time/date/timestamp column and a weight column.
 * Pounds in the weight header (lb, lbs, pounds) convert to kg; kg or no unit stays kg.
 * The timestamp is the identity. Same calendar day with different times stays as two rows.
 * Rows that share a timestamp collapse to the last one in the file.
 */
export function parseGarminWeightCsv(text: string): { rows: GarminRow[]; skipped: number; unit: 'kg' | 'lb' | null; error: string | null } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let header: string[] | null = null;
  let headerAt = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    const cells = splitCsv(lines[index]);
    const hasWeight = cells.some((cell) => /weight/i.test(cell) && !/change|goal/i.test(cell));
    const hasWhen = cells.some((cell) => /time|date|timestamp/i.test(cell));
    if (hasWeight && hasWhen) {
      header = cells;
      headerAt = index;
      break;
    }
  }
  if (!header) return { rows: [], skipped: 0, unit: null, error: 'No date and weight columns found in that file.' };
  const timeCol = header.findIndex((cell) => /time|date|timestamp/i.test(cell));
  const weightCol = header.findIndex((cell) => /weight/i.test(cell) && !/change|goal/i.test(cell));
  const weightHeader = header[weightCol] ?? '';
  const unit: 'kg' | 'lb' = /\b(lb|lbs|pounds)\b/i.test(weightHeader) ? 'lb' : 'kg';
  const byTime = new Map<string, GarminRow>();
  let skipped = 0;
  for (const line of lines.slice(headerAt + 1)) {
    if (!line.trim()) continue;
    const cells = splitCsv(line);
    const at = parseGarminTime(cells[timeCol] ?? '');
    const raw = Number((cells[weightCol] ?? '').replace(/,/g, ''));
    if (!at || !Number.isFinite(raw) || raw <= 0) {
      skipped += 1;
      continue;
    }
    const kg = Math.round((unit === 'lb' ? raw * 0.45359237 : raw) * 100) / 100;
    byTime.set(at, { at, kg });
  }
  if (byTime.size === 0) return { rows: [], skipped, unit, error: 'No weigh-ins could be read from that file.' };
  return { rows: [...byTime.values()], skipped, unit, error: null };
}

export function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else quoted = false;
      } else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      cells.push(current.trim());
      current = '';
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseGarminTime(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    const time = Date.parse(text);
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4] ?? 12),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (!us) return null;
  let hour = Number(us[4] ?? 12);
  const ampm = us[7]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  if (!us[4]) hour = 12;
  const date = new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]), hour, Number(us[5] ?? 0), Number(us[6] ?? 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function weighInId(profile: ProfileId, at: string): string {
  return `${profile}:${at}`;
}
