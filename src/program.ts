import type { Day, Exercise, Program, Session, SetLog, Unit } from './types';
import { isProfileId } from './types';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const MAX_ERRORS = 30;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function push(errors: string[], message: string) {
  if (errors.length < MAX_ERRORS) errors.push(message);
}

function objectAt(value: unknown, path: string, errors: string[]): Record<string, unknown> | null {
  if (!isObject(value)) {
    push(errors, `${path} must be an object.`);
    return null;
  }
  return value;
}

function reqString(obj: Record<string, unknown>, key: string, path: string, errors: string[]): string | null {
  const full = `${path}.${key}`;
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    push(errors, `${full} must be a non-empty string.`);
    return null;
  }
  return value.trim();
}

function optString(obj: Record<string, unknown>, key: string, path: string, errors: string[]): string | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  if (typeof obj[key] !== 'string') {
    push(errors, `${path}.${key} must be a string when it is present.`);
    return undefined;
  }
  const trimmed = obj[key].trim();
  return trimmed ? trimmed : undefined;
}

function optStringOrFiniteNumber(obj: Record<string, unknown>, key: string, path: string, errors: string[]): string | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') {
    push(errors, `${path}.${key} must be a string when it is present.`);
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function reqInt(obj: Record<string, unknown>, key: string, path: string, errors: string[], min: number): number | null {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    const bound = min > 0 ? ` of at least ${min}` : ' of 0 or more';
    push(errors, `${path}.${key} must be a whole number${bound}.`);
    return null;
  }
  return value;
}

function optInt(obj: Record<string, unknown>, key: string, path: string, errors: string[], min: number): number | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    push(errors, `${path}.${key} must be a whole number of at least ${min}.`);
    return undefined;
  }
  return value;
}

function optNumber(obj: Record<string, unknown>, key: string, path: string, errors: string[]): number | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    push(errors, `${path}.${key} must be a number when it is present.`);
    return undefined;
  }
  return value;
}

function optBool(obj: Record<string, unknown>, key: string, path: string, errors: string[]): boolean | undefined {
  if (!(key in obj) || obj[key] == null) return undefined;
  if (typeof obj[key] !== 'boolean') {
    push(errors, `${path}.${key} must be true or false when it is present.`);
    return undefined;
  }
  return obj[key];
}

function optUnit(obj: Record<string, unknown>, path: string, errors: string[]): Unit | undefined {
  if (!('unit' in obj) || obj.unit == null) return undefined;
  if (obj.unit !== 'kg' && obj.unit !== 'lb') {
    push(errors, `${path}.unit must be "kg" or "lb".`);
    return undefined;
  }
  return obj.unit;
}

function reqDate(value: string | null, path: string, errors: string[]): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    push(errors, `${path} must be a date like 2026-11-16.`);
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    push(errors, `${path} is not a real calendar date.`);
    return null;
  }
  return value;
}

function parseExercise(value: unknown, path: string, errors: string[]): Exercise | null {
  const obj = objectAt(value, path, errors);
  if (!obj) return null;
  const slot = reqString(obj, 'slot', path, errors);
  const name = reqString(obj, 'name', path, errors);
  const sets = reqInt(obj, 'sets', path, errors, 1);
  const hasReps = 'reps' in obj && obj.reps != null;
  const hasWork = 'work_sec' in obj && obj.work_sec != null;
  let reps: string | null = null;
  let work: number | null = null;
  if (hasReps && hasWork) {
    push(errors, `${path}: set reps or work_sec, and set the other to null.`);
  } else if (!hasReps && !hasWork) {
    push(errors, `${path}: set reps or work_sec, and set the other to null.`);
  } else if (hasReps) {
    if (typeof obj.reps === 'number' && Number.isFinite(obj.reps)) {
      reps = String(obj.reps);
    } else if (typeof obj.reps !== 'string' || obj.reps.trim() === '') {
      push(errors, `${path}.reps must be a string such as "8-10".`);
    } else {
      reps = obj.reps.trim();
    }
  } else if (typeof obj.work_sec !== 'number' || !Number.isInteger(obj.work_sec) || obj.work_sec <= 0) {
    push(errors, `${path}.work_sec must be a positive whole number of seconds.`);
  } else {
    work = obj.work_sec;
  }
  const video = optString(obj, 'video_url', path, errors);
  if (video && !/^https?:\/\//i.test(video)) {
    push(errors, `${path}.video_url must start with http:// or https://.`);
  }
  if (!slot || !name || sets == null || (reps == null && work == null)) return null;
  const exercise: Exercise = { slot, name, sets, reps, work_sec: work };
  const load = optStringOrFiniteNumber(obj, 'load', path, errors);
  const unit = optUnit(obj, path, errors);
  const rpe = optNumber(obj, 'rpe', path, errors);
  const tempo = optString(obj, 'tempo', path, errors);
  const rest = optInt(obj, 'rest_sec', path, errors, 0);
  const notes = optString(obj, 'notes', path, errors);
  if (load) exercise.load = load;
  if (unit) exercise.unit = unit;
  if (rpe != null) exercise.rpe = rpe;
  if (tempo) exercise.tempo = tempo;
  if (rest != null) exercise.rest_sec = rest;
  if (video && /^https?:\/\//i.test(video)) exercise.video_url = video;
  if (notes) exercise.notes = notes;
  return exercise;
}

export function parseDay(value: unknown, path: string, errors: string[]): Day | null {
  const obj = objectAt(value, path, errors);
  if (!obj) return null;
  const name = reqString(obj, 'name', path, errors);
  const warmup = optString(obj, 'warmup', path, errors);
  const deload = optBool(obj, 'deload', path, errors);
  if (!Array.isArray(obj.circuits) || obj.circuits.length === 0) {
    push(errors, `${path}.circuits must be a non-empty list.`);
    return null;
  }
  const circuits = obj.circuits.map((circuit, index) => {
    const circuitPath = `${path}.circuits[${index}]`;
    const circuitObj = objectAt(circuit, circuitPath, errors);
    if (!circuitObj) return null;
    const label = reqString(circuitObj, 'label', circuitPath, errors);
    const rounds = reqInt(circuitObj, 'rounds', circuitPath, errors, 1);
    const restBetween = reqInt(circuitObj, 'rest_between_rounds_sec', circuitPath, errors, 0);
    if (!Array.isArray(circuitObj.exercises) || circuitObj.exercises.length === 0) {
      push(errors, `${circuitPath}.exercises must be a non-empty list.`);
      return null;
    }
    const exercises = circuitObj.exercises.map((exercise, exerciseIndex) =>
      parseExercise(exercise, `${circuitPath}.exercises[${exerciseIndex}]`, errors),
    );
    if (!label || rounds == null || restBetween == null || exercises.some((exercise) => !exercise)) return null;
    return {
      label,
      rounds,
      rest_between_rounds_sec: restBetween,
      exercises: exercises.filter((exercise): exercise is Exercise => exercise != null),
    };
  });
  if (!name || circuits.some((circuit) => !circuit)) return null;
  const day: Day = {
    name,
    circuits: circuits.filter((circuit): circuit is NonNullable<typeof circuit> => circuit != null),
  };
  if (warmup) day.warmup = warmup;
  if (deload != null) day.deload = deload;
  return day;
}

export function parseProgram(value: unknown): ParseResult<Program> {
  const errors: string[] = [];
  const obj = objectAt(value, 'program', errors);
  if (!obj) return { ok: false, errors };
  if (!isProfileId(obj.profile)) {
    push(errors, 'profile must be "dan", "bonnie", or "audrey".');
  }
  const programName = reqString(obj, 'program_name', 'program', errors);
  const start = reqDate(typeof obj.start_date === 'string' ? obj.start_date : null, 'program.start_date', errors);
  const sessions = reqInt(obj, 'sessions_before_new_program', 'program', errors, 0);
  const progression = optString(obj, 'progression_rule', 'program', errors);
  if (!Array.isArray(obj.days) || obj.days.length === 0) {
    push(errors, 'program.days must be a non-empty list.');
  }
  const days = Array.isArray(obj.days) ? obj.days.map((day, index) => parseDay(day, `program.days[${index}]`, errors)) : [];
  if (errors.length >= MAX_ERRORS) {
    errors.push('Stopped after 30 problems. Fix those and import again.');
  }
  if (
    errors.length > 0 ||
    !isProfileId(obj.profile) ||
    !programName ||
    !start ||
    sessions == null ||
    days.length === 0 ||
    days.some((day) => !day)
  ) {
    return { ok: false, errors: errors.length ? errors : ['Program could not be read.'] };
  }
  const program: Program = {
    profile: obj.profile,
    program_name: programName,
    start_date: start,
    sessions_before_new_program: sessions,
    days: days.filter((day): day is Day => day != null),
  };
  if (progression) program.progression_rule = progression;
  return { ok: true, value: program };
}

export type ExerciseStep = {
  kind: 'exercise';
  circuitIndex: number;
  circuitLabel: string;
  round: number;
  rounds: number;
  exerciseIndex: number;
  exercise: Exercise;
};

export type RestStep = {
  kind: 'rest';
  seconds: number;
  reason: string;
};

export type Step = ExerciseStep | RestStep;

export function buildSteps(day: Day): Step[] {
  const steps: Step[] = [];
  day.circuits.forEach((circuit, circuitIndex) => {
    for (let round = 1; round <= circuit.rounds; round += 1) {
      circuit.exercises.forEach((exercise, exerciseIndex) => {
        const lastInRound = exerciseIndex === circuit.exercises.length - 1;
        const lastRound = round === circuit.rounds;
        steps.push({
          kind: 'exercise',
          circuitIndex,
          circuitLabel: circuit.label,
          round,
          rounds: circuit.rounds,
          exerciseIndex,
          exercise,
        });
        const restSec = exercise.rest_sec ?? 0;
        let rest = 0;
        let reason = '';
        if (!lastInRound) {
          rest = restSec;
          reason = `Rest after ${exercise.slot.toUpperCase()}`;
        } else if (!lastRound) {
          rest = circuit.rest_between_rounds_sec > 0 ? circuit.rest_between_rounds_sec : restSec;
          reason =
            circuit.rest_between_rounds_sec > 0
              ? `Rest before round ${round + 1}`
              : `Rest after ${exercise.slot.toUpperCase()}`;
        }
        if (rest > 0) steps.push({ kind: 'rest', seconds: rest, reason });
      });
    }
  });
  return steps;
}

export function programStamp(program: Program): string {
  let hash = 0x811c9dc5;
  const text = JSON.stringify(program);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${program.program_name}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function circuitsDone(day: Day, sets: SetLog[]): number {
  return day.circuits.filter((circuit, circuitIndex) => {
    const need = circuit.rounds * circuit.exercises.length;
    const have = sets.filter((set) => set.circuitIndex === circuitIndex).length;
    return have >= need;
  }).length;
}

export function completedProgramSessions(program: Program, sessions: Session[]): Session[] {
  return sessions.filter(
    (session) =>
      session.status === 'completed' &&
      session.programName === program.program_name &&
      session.programStartDate === program.start_date,
  );
}

export function nextDayIndex(program: Program, sessions: Session[]): number {
  const done = completedProgramSessions(program, sessions).length;
  return done % program.days.length;
}

export function latestSet(sessions: Session[], exerciseName: string): { set: SetLog; session: Session } | null {
  const name = exerciseName.trim().toLowerCase();
  let best: { set: SetLog; session: Session } | null = null;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.exerciseName.trim().toLowerCase() !== name) continue;
      if (!best || set.loggedAt > best.set.loggedAt) best = { set, session };
    }
  }
  return best;
}
