import type { Exercise, Flag, Session, SetLog, Unit } from './types';
import { FLAG_LABELS, PROFILE_NAMES } from './types';

export function profileName(id: string): string {
  if (id === 'dan' || id === 'bonnie' || id === 'audrey') return PROFILE_NAMES[id];
  return id;
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function localDateISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now - then) / (24 * 60 * 60 * 1000);
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return 'In progress';
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole} sec`;
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  if (minutes < 60) return remain ? `${minutes} min ${remain} sec` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const left = minutes % 60;
  return left ? `${hours} h ${left} min` : `${hours} h`;
}

export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export function prescriptionLine(exercise: Exercise): string {
  const bits = [`${exercise.sets} ${exercise.sets === 1 ? 'set' : 'sets'}`];
  if (exercise.work_sec != null) bits.push(`${exercise.work_sec} sec`);
  else if (exercise.reps) bits.push(`${exercise.reps} reps`);
  if (exercise.load) bits.push(exercise.load);
  if (exercise.rpe != null) bits.push(`RPE ${formatNumber(exercise.rpe)}`);
  if (exercise.tempo) bits.push(`tempo ${exercise.tempo}`);
  return bits.join(' · ');
}

export function exerciseUnit(exercise: Exercise): Unit {
  return exercise.unit ?? 'kg';
}

export function formatSetSummary(set: SetLog): string {
  let main = 'Logged';
  if (set.load != null && set.reps != null) main = `${formatNumber(set.load)} ${set.unit} × ${set.reps}`;
  else if (set.load != null) main = `${formatNumber(set.load)} ${set.unit}`;
  else if (set.reps != null) main = `${set.reps} reps`;
  if (set.workSec != null) main = main === 'Logged' ? `${set.workSec}s` : `${main} · ${set.workSec}s`;
  return main;
}

export function formatFlag(flag: Flag | null): string {
  return flag ? FLAG_LABELS[flag] : '';
}

export function formatLastWhen(session: Session, set: SetLog): string {
  const started = new Date(session.startedAt);
  const sameDay = !Number.isNaN(started.getTime()) && started.toDateString() === new Date().toDateString();
  const when = sameDay ? 'Today' : formatWhen(session.startedAt);
  return `${when} · ${session.dayName} · round ${set.round}`;
}

export function formatCheckIn(checkIn: { sleep: number; energy: number; soreness: number }): string {
  return `Sleep ${checkIn.sleep} · Energy ${checkIn.energy} · Soreness ${checkIn.soreness}`;
}

export function backupIsStale(iso: string | null, now = Date.now()): boolean {
  const age = daysSince(iso, now);
  return age == null || age > 7;
}
