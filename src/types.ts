export const PROFILE_IDS = ['dan', 'bonnie', 'audrey'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export const PROFILE_NAMES: Record<ProfileId, string> = {
  dan: 'Dan',
  bonnie: 'Bonnie',
  audrey: 'Audrey',
};

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as readonly string[]).includes(value);
}

export type Unit = 'kg' | 'lb';

export const FLAGS = ['painful', 'too_easy', 'too_hard'] as const;
export type Flag = (typeof FLAGS)[number];

export const FLAG_LABELS: Record<Flag, string> = {
  painful: 'Painful',
  too_easy: 'Too easy',
  too_hard: 'Too hard',
};

export type Exercise = {
  slot: string;
  name: string;
  sets: number;
  reps: string | null;
  work_sec: number | null;
  load?: string;
  unit?: Unit;
  rpe?: number;
  tempo?: string;
  rest_sec?: number;
  video_url?: string;
  notes?: string;
  /** Missing or false means one timed block or one rep target, as before. */
  per_side?: boolean;
};

export type Circuit = {
  label: string;
  rounds: number;
  rest_between_rounds_sec: number;
  exercises: Exercise[];
};

export type Day = {
  name: string;
  warmup?: string;
  deload?: boolean;
  circuits: Circuit[];
};

export type Program = {
  profile: ProfileId;
  program_name: string;
  start_date: string;
  sessions_before_new_program: number;
  days: Day[];
  progression_rule?: string;
  /** Optional future field. Not written into the shipped program files. */
  deload_from_session?: number;
};

export type WeighIn = {
  id: string;
  profile: ProfileId;
  at: string;
  kg: number;
};

export type Skinfold = {
  id: string;
  profile: ProfileId;
  at: string;
  age: number | null;
  chest: number;
  midaxillary: number;
  triceps: number;
  subscapular: number;
  abdominal: number;
  suprailiac: number;
  thigh: number;
};

export type Tape = {
  id: string;
  profile: ProfileId;
  at: string;
  waist: number;
  hips: number;
  chest: number;
  arm: number;
  thigh: number;
};

export const ACTIVITY_KINDS = ['bike', 'treadmill', 'walk', 'golf', 'garden', 'other'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  bike: 'Stationary bike',
  treadmill: 'Treadmill',
  walk: 'Walk',
  golf: 'Golf walked',
  garden: 'Gardening or yard work',
  other: 'Other',
};

export type Activity = {
  id: string;
  profile: ProfileId;
  date: string;
  kind: ActivityKind;
  minutes: number;
  distanceKm: number | null;
  avgHr: number | null;
  level: string;
  effort: number | null;
  note: string;
};

export type CheckIn = {
  sleep: number;
  energy: number;
  soreness: number;
};

export type SetLog = {
  id: string;
  circuitIndex: number;
  circuitLabel: string;
  round: number;
  slot: string;
  exerciseName: string;
  unit: Unit;
  load: number | null;
  reps: number | null;
  note: string;
  flag: Flag | null;
  workSec: number | null;
  /** Present on sets logged after v1. Older logs omit it. */
  made?: boolean;
  loggedAt: string;
};

export type Session = {
  id: string;
  profile: ProfileId;
  programName: string;
  programStartDate: string;
  dayName: string;
  day: Day;
  checkIn: CheckIn;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  stepIndex: number;
  sets: SetLog[];
  circuitsCompleted: number;
  circuitsPlanned: number;
  status: 'in_progress' | 'completed';
};
