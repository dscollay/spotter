import { parseDay, parseProgram, type ParseResult } from './program';
import type { CheckIn, Day, Flag, ProfileId, Program, Session, SetLog, Unit } from './types';
import { FLAGS, isProfileId } from './types';

export type BackupData = {
  app: 'spotter';
  version: 1;
  exportedAt: string;
  activeProfile: ProfileId | null;
  programs: Program[];
  sessions: Session[];
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
  if (value.version !== 1) {
    return { ok: false, errors: [`This backup is version ${String(value.version)}. This app reads version 1.`] };
  }
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
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      app: 'spotter',
      version: 1,
      exportedAt: value.exportedAt,
      activeProfile: value.activeProfile ?? null,
      programs,
      sessions,
    },
  };
}

export function buildBackup(input: {
  exportedAt: string;
  activeProfile: ProfileId | null;
  programs: Program[];
  sessions: Session[];
}): BackupData {
  return {
    app: 'spotter',
    version: 1,
    exportedAt: input.exportedAt,
    activeProfile: input.activeProfile,
    programs: input.programs,
    sessions: input.sessions,
  };
}
