import { parseDay, parseProgram, type ParseResult } from './program';
import type { Activity, ActivityKind, CheckIn, Day, Flag, ProfileId, Program, Session, SetLog, Skinfold, Tape, Unit, WeighIn } from './types';
import { ACTIVITY_KINDS, FLAGS, isProfileId } from './types';

export type BackupData = {
  app: 'spotter';
  version: 1 | 2;
  exportedAt: string;
  activeProfile: ProfileId | null;
  programs: Program[];
  sessions: Session[];
  weights: WeighIn[];
  skinfolds: Skinfold[];
  tapes: Tape[];
  activities: Activity[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isUnit(value: unknown): value is Unit {
  return value === 'kg' || value === 'lb';
}

function isFlag(value: unknown): value is Flag {
  return typeof value === 'string' && (FLAGS as readonly string[]).includes(value);
}

function parseSet(value: unknown, path: string, errors: string[]): SetLog | null {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const id = typeof value.id === 'string' ? value.id : '';
  const circuitIndex = value.circuitIndex;
  const round = value.round;
  const unit = isUnit(value.unit) ? value.unit : null;
  const load = value.load == null ? null : typeof value.load === 'number' ? value.load : undefined;
  const reps = value.reps == null ? null : typeof value.reps === 'number' ? value.reps : undefined;
  const workSec = value.workSec == null ? null : typeof value.workSec === 'number' ? value.workSec : undefined;
  const flag = value.flag == null ? null : isFlag(value.flag) ? value.flag : undefined;
  const made = !('made' in value) || value.made == null ? undefined : value.made === true || value.made === false ? value.made : 'bad';
  const note = typeof value.note === 'string' ? value.note : null;
  const loggedAt = isIso(value.loggedAt) ? value.loggedAt : null;
  if (
    !id ||
    typeof circuitIndex !== 'number' ||
    !Number.isInteger(circuitIndex) ||
    circuitIndex < 0 ||
    typeof value.circuitLabel !== 'string' ||
    typeof round !== 'number' ||
    !Number.isInteger(round) ||
    round < 1 ||
    typeof value.slot !== 'string' ||
    typeof value.exerciseName !== 'string' ||
    !value.exerciseName.trim() ||
    !unit ||
    load === undefined ||
    (load != null && (!Number.isFinite(load) || load < 0)) ||
    reps === undefined ||
    (reps != null && (!Number.isInteger(reps) || reps < 0)) ||
    note == null ||
    flag === undefined ||
    made === 'bad' ||
    workSec === undefined ||
    (workSec != null && (!Number.isInteger(workSec) || workSec <= 0)) ||
    !loggedAt
  ) {
    errors.push(`${path} is missing a load, reps, time, or other set field.`);
    return null;
  }
  const parsed: SetLog = {
    id,
    circuitIndex,
    circuitLabel: value.circuitLabel,
    round,
    slot: value.slot,
    exerciseName: value.exerciseName.trim(),
    unit,
    load,
    reps,
    note,
    flag,
    workSec,
    loggedAt,
  };
  if (made === true || made === false) parsed.made = made;
  return parsed;
}

function parseCheckIn(value: unknown, path: string, errors: string[]): CheckIn | null {
  if (!isObject(value)) {
    errors.push(`${path} must include sleep, energy, and soreness.`);
    return null;
  }
  const score = (key: keyof CheckIn) => {
    const scoreValue = value[key];
    return typeof scoreValue === 'number' && Number.isInteger(scoreValue) && scoreValue >= 1 && scoreValue <= 5;
  };
  if (!score('sleep') || !score('energy') || !score('soreness')) {
    errors.push(`${path} scores must be whole numbers from 1 to 5.`);
    return null;
  }
  return { sleep: value.sleep as number, energy: value.energy as number, soreness: value.soreness as number };
}

function parseSession(value: unknown, index: number): { session: Session | null; errors: string[] } {
  const errors: string[] = [];
  const path = `sessions[${index}]`;
  if (!isObject(value)) return { session: null, errors: [`${path} must be an object.`] };
  const dayErrors: string[] = [];
  const day = parseDay(value.day, `${path}.day`, dayErrors);
  const checkIn = parseCheckIn(value.checkIn, `${path}.checkIn`, errors);
  const sets: SetLog[] = [];
  if (!Array.isArray(value.sets)) errors.push(`${path}.sets must be a list.`);
  else {
    value.sets.forEach((set, setIndex) => {
      const parsed = parseSet(set, `${path}.sets[${setIndex}]`, errors);
      if (parsed) sets.push(parsed);
    });
  }
  const statusOk = value.status === 'in_progress' || value.status === 'completed';
  const finishedOk =
    (value.status === 'completed' && isIso(value.finishedAt) && typeof value.durationSec === 'number' && value.durationSec >= 0) ||
    (value.status === 'in_progress' && value.finishedAt == null && value.durationSec == null);
  if (
    typeof value.id !== 'string' ||
    !value.id ||
    !isProfileId(value.profile) ||
    typeof value.programName !== 'string' ||
    typeof value.programStartDate !== 'string' ||
    typeof value.dayName !== 'string' ||
    !day ||
    dayErrors.length ||
    !checkIn ||
    !isIso(value.startedAt) ||
    !statusOk ||
    !finishedOk ||
    typeof value.stepIndex !== 'number' ||
    !Number.isInteger(value.stepIndex) ||
    value.stepIndex < 0 ||
    typeof value.circuitsCompleted !== 'number' ||
    typeof value.circuitsPlanned !== 'number'
  ) {
    errors.push(...dayErrors);
    if (!errors.some((error) => error.startsWith(path))) errors.push(`${path} could not be read.`);
    return { session: null, errors };
  }
  const session: Session = {
    id: value.id,
    profile: value.profile,
    programName: value.programName,
    programStartDate: value.programStartDate,
    dayName: value.dayName,
    day: day as Day,
    checkIn,
    startedAt: value.startedAt,
    finishedAt: value.status === 'completed' ? (value.finishedAt as string) : null,
    durationSec: value.status === 'completed' ? (value.durationSec as number) : null,
    stepIndex: value.stepIndex,
    sets,
    circuitsCompleted: value.circuitsCompleted,
    circuitsPlanned: value.circuitsPlanned,
    status: value.status === 'completed' ? 'completed' : 'in_progress',
  };
  return { session, errors };
}

export function parseBackup(value: unknown): ParseResult<BackupData> {
  if (!isObject(value)) return { ok: false, errors: ['Backup must be a JSON object.'] };
  if (value.app !== 'spotter') {
    return { ok: false, errors: ['This is not a Spotter backup. Program files are imported from the Program tab.'] };
  }
  if (value.version !== 1 && value.version !== 2) {
    return { ok: false, errors: [`This backup is version ${String(value.version)}. This app reads version 1 and 2.`] };
  }
  const version = value.version;
  if (!isIso(value.exportedAt)) return { ok: false, errors: ['Backup exportedAt must be a date.'] };
  if (value.activeProfile != null && !isProfileId(value.activeProfile)) {
    return { ok: false, errors: ['Backup activeProfile must be dan, bonnie, audrey, or null.'] };
  }
  if (!Array.isArray(value.programs) || !Array.isArray(value.sessions)) {
    return { ok: false, errors: ['Backup needs a programs list and a sessions list.'] };
  }
  const errors: string[] = [];
  const programs: Program[] = [];
  const seenProfiles = new Set<string>();
  value.programs.forEach((program, index) => {
    const parsed = parseProgram(program);
    if (!parsed.ok) {
      errors.push(`programs[${index}]: ${parsed.errors[0] ?? 'invalid program'}`);
      return;
    }
    if (seenProfiles.has(parsed.value.profile)) errors.push(`Two programs are for ${parsed.value.profile}.`);
    seenProfiles.add(parsed.value.profile);
    programs.push(parsed.value);
  });
  const sessions: Session[] = [];
  const seenIds = new Set<string>();
  value.sessions.forEach((session, index) => {
    const parsed = parseSession(session, index);
    errors.push(...parsed.errors);
    if (!parsed.session) return;
    if (seenIds.has(parsed.session.id)) errors.push(`Two sessions share the id ${parsed.session.id}.`);
    seenIds.add(parsed.session.id);
    sessions.push(parsed.session);
  });
  const weights = parseRecords(value.weights, version, 'weights', errors, parseWeighIn);
  const skinfolds = parseRecords(value.skinfolds, version, 'skinfolds', errors, parseSkinfold);
  const tapes = parseRecords(value.tapes, version, 'tapes', errors, parseTape);
  const activities = parseRecords(value.activities, version, 'activities', errors, parseActivity);
  if (errors.length || !weights || !skinfolds || !tapes || !activities) return { ok: false, errors };
  return {
    ok: true,
    value: {
      app: 'spotter',
      version,
      exportedAt: value.exportedAt,
      activeProfile: value.activeProfile ?? null,
      programs,
      sessions,
      weights,
      skinfolds,
      tapes,
      activities,
    },
  };
}

function parseRecords<T extends { id: string }>(
  value: unknown,
  version: 1 | 2,
  key: string,
  errors: string[],
  parse: (row: unknown, path: string, errors: string[]) => T | null,
): T[] | null {
  if (value == null) {
    if (version === 1) return [];
    errors.push(`Backup ${key} list is missing.`);
    return null;
  }
  if (!Array.isArray(value)) {
    errors.push(`Backup ${key} must be a list.`);
    return null;
  }
  const rows: T[] = [];
  const seen = new Set<string>();
  value.forEach((row, index) => {
    const parsed = parse(row, `${key}[${index}]`, errors);
    if (!parsed) return;
    if (seen.has(parsed.id)) errors.push(`Two ${key} share the id ${parsed.id}.`);
    seen.add(parsed.id);
    rows.push(parsed);
  });
  return rows;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseWeighIn(value: unknown, path: string, errors: string[]): WeighIn | null {
  if (!isObject(value) || !isProfileId(value.profile) || typeof value.id !== 'string' || !value.id || !isIso(value.at)) {
    errors.push(`${path} is not a weigh-in.`);
    return null;
  }
  const kg = finiteNumber(value.kg);
  if (kg == null || kg <= 0) {
    errors.push(`${path} needs a weight in kg.`);
    return null;
  }
  return { id: value.id, profile: value.profile, at: value.at, kg };
}

function parseSkinfold(value: unknown, path: string, errors: string[]): Skinfold | null {
  if (!isObject(value) || !isProfileId(value.profile) || typeof value.id !== 'string' || !value.id || !isIso(value.at)) {
    errors.push(`${path} is not a skinfold entry.`);
    return null;
  }
  const sites = ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'] as const;
  const numbers = {} as Record<(typeof sites)[number], number>;
  for (const site of sites) {
    const reading = finiteNumber(value[site]);
    if (reading == null || reading < 0) {
      errors.push(`${path} needs ${site} in mm.`);
      return null;
    }
    numbers[site] = reading;
  }
  const age = value.age == null ? null : finiteNumber(value.age);
  if (age != null && (!Number.isInteger(age) || age < 1 || age > 120)) {
    errors.push(`${path} age must be a whole number when it is present.`);
    return null;
  }
  return { id: value.id, profile: value.profile, at: value.at, age, ...numbers };
}

function parseTape(value: unknown, path: string, errors: string[]): Tape | null {
  if (!isObject(value) || !isProfileId(value.profile) || typeof value.id !== 'string' || !value.id || !isIso(value.at)) {
    errors.push(`${path} is not a tape entry.`);
    return null;
  }
  const sites = ['waist', 'hips', 'chest', 'arm', 'thigh'] as const;
  const numbers = {} as Record<(typeof sites)[number], number>;
  for (const site of sites) {
    const reading = finiteNumber(value[site]);
    if (reading == null || reading <= 0) {
      errors.push(`${path} needs ${site} in cm.`);
      return null;
    }
    numbers[site] = reading;
  }
  return { id: value.id, profile: value.profile, at: value.at, ...numbers };
}

function parseActivity(value: unknown, path: string, errors: string[]): Activity | null {
  const kinds = ACTIVITY_KINDS as readonly string[];
  if (
    !isObject(value) ||
    !isProfileId(value.profile) ||
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    typeof value.kind !== 'string' ||
    !kinds.includes(value.kind)
  ) {
    errors.push(`${path} is not an activity.`);
    return null;
  }
  const minutes = finiteNumber(value.minutes);
  const distance = value.distanceKm == null ? null : finiteNumber(value.distanceKm);
  const incline = !('inclinePct' in value) || value.inclinePct == null ? null : finiteNumber(value.inclinePct);
  const heart = value.avgHr == null ? null : finiteNumber(value.avgHr);
  const effort = value.effort == null ? null : finiteNumber(value.effort);
  if (minutes == null || minutes <= 0) {
    errors.push(`${path} needs a duration in minutes.`);
    return null;
  }
  if (distance != null && distance < 0) {
    errors.push(`${path} distance must be in km.`);
    return null;
  }
  if (incline != null && (incline < 0 || incline > 40)) {
    errors.push(`${path} incline must be a percent from 0 to 40.`);
    return null;
  }
  if (heart != null && (!Number.isInteger(heart) || heart < 1 || heart > 250)) {
    errors.push(`${path} heart rate must be a whole number when it is present.`);
    return null;
  }
  if (effort != null && (!Number.isInteger(effort) || effort < 1 || effort > 10)) {
    errors.push(`${path} effort must be from 1 to 10 when it is present.`);
    return null;
  }
  return {
    id: value.id,
    profile: value.profile,
    date: value.date,
    kind: value.kind as ActivityKind,
    minutes,
    distanceKm: distance,
    inclinePct: incline,
    avgHr: heart,
    level: typeof value.level === 'string' ? value.level : '',
    effort,
    note: typeof value.note === 'string' ? value.note : '',
  };
}

export function buildBackup(input: {
  exportedAt: string;
  activeProfile: ProfileId | null;
  programs: Program[];
  sessions: Session[];
  weights: WeighIn[];
  skinfolds: Skinfold[];
  tapes: Tape[];
  activities: Activity[];
}): BackupData {
  return {
    app: 'spotter',
    version: 2,
    exportedAt: input.exportedAt,
    activeProfile: input.activeProfile,
    programs: input.programs,
    sessions: input.sessions,
    weights: input.weights,
    skinfolds: input.skinfolds,
    tapes: input.tapes,
    activities: input.activities,
  };
}
