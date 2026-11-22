import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBackup, parseBackup } from '../src/backup.ts';
import { exerciseTarget, formatLoad, prescriptionLine } from '../src/format.ts';
import {
  bodyFatEstimate,
  deloadPhrase,
  parseGarminWeightCsv,
  readiness,
  skinfoldSum,
  weekStart,
  withinRange,
} from '../src/metrics.ts';
import { buildSteps, latestSet, nextDayIndex, nextExercise, parseProgram } from '../src/program.ts';
import type { Program, Session, Skinfold } from '../src/types.ts';

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../src/programs/${name}.json`, import.meta.url), 'utf8'));
}

const people = ['bonnie', 'dan', 'audrey'] as const;
const programs = new Map<string, Program>();

for (const person of people) {
  const parsed = parseProgram(readJson(person));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.errors.join('\n'));
  if (!parsed.ok) continue;
  assert.equal(parsed.value.profile, person);
  assert.equal(parsed.value.program_name.startsWith('placeholder'), true);
  assert.equal(parsed.value.days.length >= 2, true);
  programs.set(person, parsed.value);
}

const bonnie = structuredClone(readJson('bonnie')) as Record<string, unknown>;
bonnie.coach_note = 'ignore me';
const withExtra = parseProgram(bonnie);
assert.equal(withExtra.ok, true);
if (withExtra.ok) assert.equal('coach_note' in withExtra.value, false);

const both = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
both.days[0].circuits[0].exercises[0].reps = '8';
both.days[0].circuits[0].exercises[0].work_sec = 20;
const bothResult = parseProgram(both);
assert.equal(bothResult.ok, false);
if (!bothResult.ok) assert.match(bothResult.errors.join('\n'), /reps or work_sec/);

const neither = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
neither.days[0].circuits[0].exercises[0].reps = null;
neither.days[0].circuits[0].exercises[0].work_sec = null;
const neitherResult = parseProgram(neither);
assert.equal(neitherResult.ok, false);

const badProfile = structuredClone(readJson('bonnie')) as Record<string, unknown>;
badProfile.profile = 'Bonnie';
const badProfileResult = parseProgram(badProfile);
assert.equal(badProfileResult.ok, false);
if (!badProfileResult.ok) assert.match(badProfileResult.errors.join('\n'), /dan/);

const badVideo = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
badVideo.days[0].circuits[0].exercises[1].video_url = 'javascript:alert(1)';
const badVideoResult = parseProgram(badVideo);
assert.equal(badVideoResult.ok, false);

const numeric = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
numeric.days[0].circuits[0].exercises[0].reps = 8;
numeric.days[0].circuits[0].exercises[0].load = 12.5;
const numericResult = parseProgram(numeric);
assert.equal(numericResult.ok, true, numericResult.ok ? '' : numericResult.errors.join('\n'));
if (numericResult.ok) {
  const exercise = numericResult.value.days[0].circuits[0].exercises[0];
  assert.equal(exercise.reps, '8');
  assert.equal(exercise.load, '12.5');
  assert.equal(prescriptionLine(exercise), '2 sets · 8 reps · 12.5 kg · RPE 6 · tempo 3010');
}

const labeled = programs.get('bonnie')?.days[0].circuits[0].exercises[0];
assert.ok(labeled);
assert.equal(labeled.per_side, undefined);
assert.equal(prescriptionLine(labeled), '2 sets · 8 reps · BW · RPE 6 · tempo 3010');

const sided = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
sided.days[0].circuits[0].exercises[0].per_side = true;
const sidedResult = parseProgram(sided);
assert.equal(sidedResult.ok, true, sidedResult.ok ? '' : sidedResult.errors.join('\n'));
if (sidedResult.ok) {
  const exercise = sidedResult.value.days[0].circuits[0].exercises[0];
  assert.equal(exercise.per_side, true);
  assert.equal(prescriptionLine(exercise), '2 sets · 8 each side · BW · RPE 6 · tempo 3010');
}

const badSide = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
badSide.days[0].circuits[0].exercises[0].per_side = 'yes';
const badSideResult = parseProgram(badSide);
assert.equal(badSideResult.ok, false);
if (!badSideResult.ok) assert.match(badSideResult.errors.join('\n'), /true or false/);

for (const person of people) {
  const file = JSON.parse(readFileSync(new URL(`../programs/${person}.json`, import.meta.url), 'utf8')) as unknown;
  const parsed = parseProgram(file);
  assert.equal(parsed.ok, true, parsed.ok ? '' : `${person}: ${parsed.errors.join('\n')}`);
}
const shippedBonnie = parseProgram(JSON.parse(readFileSync(new URL('../programs/bonnie.json', import.meta.url), 'utf8')));
assert.equal(shippedBonnie.ok, true);
if (shippedBonnie.ok) {
  const lunge = shippedBonnie.value.days[0].circuits[0].exercises[0];
  const hinge = shippedBonnie.value.days[1].circuits[0].exercises[0];
  assert.equal(lunge.name, 'Dumbbell reverse lunge');
  assert.equal(lunge.per_side, true);
  assert.equal(lunge.work_sec, 45);
  assert.equal(hinge.name, 'Dumbbell Romanian deadlift');
  assert.equal(hinge.per_side, undefined);
  assert.equal(hinge.work_sec, 45);
}
const shippedDan = parseProgram(JSON.parse(readFileSync(new URL('../programs/dan.json', import.meta.url), 'utf8')));
assert.equal(shippedDan.ok, true);
if (shippedDan.ok) {
  const dayA = shippedDan.value.days[0];
  const stepUp = shippedDan.value.days[1].circuits[0].exercises[0];
  const deadlift = dayA.circuits[0].exercises[0];
  const facePull = dayA.circuits[0].exercises[3];
  assert.equal(dayA.circuits.length, 1);
  assert.equal(dayA.circuits[0].rounds, 4);
  assert.equal(dayA.circuits[0].rest_between_rounds_sec, 120);
  assert.equal(stepUp.name, 'Barbell step-up');
  assert.equal(stepUp.per_side, true);
  assert.equal(stepUp.reps, '8');
  assert.equal(deadlift.name, 'Barbell deadlift');
  assert.equal(prescriptionLine(deadlift).includes('95 kg'), true);
  assert.equal(facePull.name, 'Cable rope face pull');
  assert.equal(facePull.unit, 'lb');
  assert.equal(prescriptionLine(facePull).includes('35 lb'), true);
  assert.equal(prescriptionLine(facePull).includes('kg'), false);
  const steps = buildSteps(dayA);
  const slots = steps.filter((step) => step.kind === 'exercise').map((step) => step.exercise.slot);
  assert.deepEqual(slots, ['A1', 'A2', 'A3', 'A4', 'A1', 'A2', 'A3', 'A4', 'A1', 'A2', 'A3', 'A4', 'A1', 'A2', 'A3', 'A4']);
  const rests = steps.filter((step) => step.kind === 'rest');
  assert.equal(rests[0].kind === 'rest' && rests[0].seconds === 60 && rests[0].reason, 'Rest after A1');
  assert.equal(rests[1].kind === 'rest' && rests[1].seconds, 45);
  assert.equal(rests[2].kind === 'rest' && rests[2].seconds, 45);
  assert.equal(rests[3].kind === 'rest' && rests[3].seconds === 120 && rests[3].reason, 'Rest before round 2');
  assert.equal(steps.at(-1)?.kind, 'exercise');
  const afterDeadlift = steps.findIndex((step) => step.kind === 'rest');
  const bench = nextExercise(steps, afterDeadlift);
  assert.equal(bench?.name, 'Dumbbell bench press');
  assert.equal(exerciseTarget(bench!), '5 reps · 25 kg');
  const beforeRound2 = steps.findIndex((step) => step.kind === 'rest' && step.reason === 'Rest before round 2');
  assert.equal(nextExercise(steps, beforeRound2)?.name, 'Barbell deadlift');
  assert.equal(exerciseTarget(nextExercise(steps, beforeRound2)!), '5 reps · 95 kg');
  const facePullRest = steps.findIndex((step) => step.kind === 'rest' && step.reason === 'Rest after A3');
  assert.equal(nextExercise(steps, facePullRest)?.name, 'Cable rope face pull');
  assert.equal(exerciseTarget(nextExercise(steps, facePullRest)!), '12 reps · 35 lb');
  assert.equal(exerciseTarget(stepUp), '8 each side · 50 kg');
  assert.equal(nextExercise(steps, steps.length - 1), null);
}
if (shippedBonnie.ok) {
  const dayA = shippedBonnie.value.days[0];
  const hold = dayA.circuits[0].exercises[2];
  const row = dayA.circuits[0].exercises[3];
  assert.equal(dayA.name, 'Day A - Lunge, Press, Bridge, Row');
  assert.equal(hold.name, 'Glute bridge hold');
  assert.equal(hold.work_sec, 45);
  assert.equal(hold.per_side, undefined);
  assert.equal(row.name, 'Standing one-arm cable row');
  assert.equal(row.unit, 'lb');
  assert.equal(prescriptionLine(row).includes('15 lb'), true);
  assert.equal(prescriptionLine(dayA.circuits[0].exercises[0]).includes('4 kg'), true);
  const bonnieSteps = buildSteps(dayA);
  const afterLunge = bonnieSteps.findIndex((step) => step.kind === 'rest');
  const press = nextExercise(bonnieSteps, afterLunge);
  assert.equal(press?.name, 'Bench-elevated press-up');
  assert.equal(exerciseTarget(press!), '45 sec · BW');
  assert.equal(formatLoad(0, 'kg'), 'BW');
  assert.equal(formatLoad(10, 'kg', true), 'BW + 10 kg');
  assert.equal(formatLoad(25, 'kg'), '25 kg');
  assert.equal(formatLoad(35, 'lb'), '35 lb');
  assert.equal(nextExercise(bonnieSteps, bonnieSteps.length - 1), null);
}

const history = [
  {
    sets: [
      { exerciseName: 'Barbell bench press', slot: 'A3', load: 62.5, unit: 'kg', loggedAt: '2026-11-16T08:20:00.000Z' },
      { exerciseName: 'Barbell deadlift', slot: 'A3', load: 100, unit: 'kg', loggedAt: '2026-11-16T08:10:00.000Z' },
    ],
  },
] as Session[];
assert.equal(latestSet(history, 'Dumbbell bench press'), null);
assert.equal(latestSet(history, 'Barbell deadlift')?.set.load, 100);
assert.equal(latestSet(history, 'Barbell deadlift')?.set.unit, 'kg');

const zeroLoad = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
zeroLoad.days[0].circuits[0].exercises[0].reps = 5;
zeroLoad.days[0].circuits[0].exercises[0].load = 0;
const zeroLoadResult = parseProgram(zeroLoad);
assert.equal(zeroLoadResult.ok, true, zeroLoadResult.ok ? '' : zeroLoadResult.errors.join('\n'));
if (zeroLoadResult.ok) assert.equal(zeroLoadResult.value.days[0].circuits[0].exercises[0].load, '0');

const badReps = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
badReps.days[0].circuits[0].exercises[0].reps = true;
const badRepsResult = parseProgram(badReps);
assert.equal(badRepsResult.ok, false);
if (!badRepsResult.ok) assert.match(badRepsResult.errors.join('\n'), /reps must be a string/);

const badLoad = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
badLoad.days[0].circuits[0].exercises[0].load = Number.POSITIVE_INFINITY;
const badLoadResult = parseProgram(badLoad);
assert.equal(badLoadResult.ok, false);
if (!badLoadResult.ok) assert.match(badLoadResult.errors.join('\n'), /load must be a string/);

const bonnieProgram = programs.get('bonnie');
assert.ok(bonnieProgram);
const steps = buildSteps(bonnieProgram.days[0]);
const exerciseSteps = steps.filter((step) => step.kind === 'exercise');
const restSteps = steps.filter((step) => step.kind === 'rest');
assert.equal(exerciseSteps.length, 4);
assert.equal(restSteps.length, 3);
assert.equal(restSteps[0].kind === 'rest' && restSteps[0].seconds, 8);
assert.equal(restSteps[1].kind === 'rest' && restSteps[1].reason.includes('round 2'), true);
assert.equal(steps.at(-1)?.kind, 'exercise');

const bare = {
  status: 'completed',
  programName: bonnieProgram.program_name,
  programStartDate: bonnieProgram.start_date,
} as Session;
assert.equal(nextDayIndex(bonnieProgram, []), 0);
assert.equal(nextDayIndex(bonnieProgram, [bare]), 1);
assert.equal(nextDayIndex(bonnieProgram, [bare, { ...bare }]), 0);

const backup = parseBackup({
  app: 'spotter',
  version: 1,
  exportedAt: '2026-11-15T12:00:00.000Z',
  activeProfile: 'bonnie',
  programs: [bonnieProgram],
  sessions: [
    {
      id: 's1',
      profile: 'bonnie',
      programName: bonnieProgram.program_name,
      programStartDate: bonnieProgram.start_date,
      dayName: 'day 1',
      day: bonnieProgram.days[0],
      checkIn: { sleep: 4, energy: 3, soreness: 2 },
      startedAt: '2026-11-15T12:00:00.000Z',
      finishedAt: '2026-11-15T12:20:00.000Z',
      durationSec: 1200,
      stepIndex: 1,
      sets: [
        {
          id: 'set1',
          circuitIndex: 0,
          circuitLabel: 'a',
          round: 1,
          slot: 'a1',
          exerciseName: 'placeholder squat',
          unit: 'kg',
          load: 20,
          reps: 8,
          note: 'easy',
          flag: 'too_easy',
          workSec: null,
          loggedAt: '2026-11-15T12:05:00.000Z',
        },
      ],
      circuitsCompleted: 0,
      circuitsPlanned: 1,
      status: 'completed',
    },
  ],
});
assert.equal(backup.ok, true, backup.ok ? '' : backup.errors.join('\n'));
if (backup.ok) assert.equal(backup.value.sessions[0].sets[0].made, undefined);
const withResult = structuredClone(backup.ok ? backup.value : null);
if (withResult) {
  withResult.sessions[0].sets[0].made = false;
  const reread = parseBackup(withResult);
  assert.equal(reread.ok, true, reread.ok ? '' : reread.errors.join('\n'));
  if (reread.ok) assert.equal(reread.value.sessions[0].sets[0].made, false);
}
const badResult = structuredClone(backup.ok ? backup.value : null);
if (badResult) {
  badResult.sessions[0].sets[0].made = 'nope';
  const rejected = parseBackup(badResult);
  assert.equal(rejected.ok, false);
}

const notBackup = parseBackup({ profile: 'bonnie', days: [] });
assert.equal(notBackup.ok, false);
if (backup.ok) {
  assert.equal(backup.value.version, 1);
  assert.equal(backup.value.weights.length, 0);
  assert.equal(backup.value.activities.length, 0);
}

const exported = buildBackup({
  exportedAt: '2026-11-21T08:00:00.000Z',
  activeProfile: 'dan',
  programs: [],
  sessions: [],
  weights: [{ id: 'dan:1', profile: 'dan', at: '2026-11-21T08:00:00.000Z', kg: 82.4 }],
  skinfolds: [],
  tapes: [],
  activities: [
    {
      id: 'golf',
      profile: 'dan',
      date: '2026-11-21',
      kind: 'golf',
      minutes: 180,
      distanceKm: null,
      avgHr: null,
      level: '',
      effort: 4,
      note: '',
    },
  ],
});
const roundTrip = parseBackup(exported);
assert.equal(roundTrip.ok, true, roundTrip.ok ? '' : roundTrip.errors.join('\n'));
if (roundTrip.ok) {
  assert.equal(roundTrip.value.version, 2);
  assert.equal(roundTrip.value.weights[0].kg, 82.4);
  assert.equal(roundTrip.value.activities[0].kind, 'golf');
}

function readRepoProgram(name: string): Program {
  const parsed = parseProgram(JSON.parse(readFileSync(new URL(`../programs/${name}.json`, import.meta.url), 'utf8')));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.errors.join('\n'));
  if (!parsed.ok) throw new Error(name);
  return parsed.value;
}

const danBlock = readRepoProgram('dan');
const bonnieBlock = readRepoProgram('bonnie');
const audreyBlock = readRepoProgram('audrey');
assert.equal(danBlock.days.every((day) => day.deload !== true), true);
assert.equal(bonnieBlock.days.every((day) => day.deload !== true), true);
assert.equal(deloadPhrase(danBlock, 0), 'Deload in 15');
assert.equal(deloadPhrase(danBlock, 14), 'Deload in 1');
assert.equal(deloadPhrase(danBlock, 15), 'Deload this session');
assert.equal(deloadPhrase(danBlock, 17), 'Deload this session');
assert.equal(deloadPhrase(danBlock, 18), null);
assert.equal(deloadPhrase(bonnieBlock, 0), 'Deload in 15');
assert.equal(deloadPhrase(audreyBlock, 0), null);
const flagged = structuredClone(audreyBlock);
flagged.days[0].deload = true;
assert.equal(deloadPhrase(flagged, 0), null);
flagged.deload_from_session = 10;
assert.equal(deloadPhrase(flagged, 0), 'Deload in 9');
assert.equal(deloadPhrase(flagged, 9), 'Deload this session');

const fold = {
  id: 'fold',
  profile: 'dan',
  at: '2026-11-21T12:00:00.000Z',
  age: 30,
  chest: 10,
  midaxillary: 10,
  triceps: 10,
  subscapular: 10,
  abdominal: 20,
  suprailiac: 10,
  thigh: 10,
} as Skinfold;
assert.equal(skinfoldSum(fold), 80);
assert.equal(bodyFatEstimate(fold), 11.7);
assert.equal(bodyFatEstimate({ ...fold, profile: 'bonnie' }), 17.4);
assert.equal(bodyFatEstimate({ ...fold, age: null }), null);
assert.equal(bodyFatEstimate({ ...fold, profile: 'audrey' }), null);

const garmin = parseGarminWeightCsv(`Body
Time,Weight,BMI
2026-11-01 07:15:00,82.4,25
2026-11-01 21:05:00,81.9,24.8
2026-11-01 21:05:00,81.9,24.8
`);
assert.equal(garmin.error, null);
assert.equal(garmin.unit, 'kg');
assert.equal(garmin.rows.length, 2);
assert.equal(garmin.rows[0].kg, 82.4);
assert.equal(garmin.rows[1].kg, 81.9);
assert.notEqual(garmin.rows[0].at, garmin.rows[1].at);
const again = parseGarminWeightCsv(`Time,Weight
2026-11-01 07:15:00,82.4
2026-11-01 21:05:00,81.9
`);
assert.equal(again.rows[0].at, garmin.rows[0].at);
const pounds = parseGarminWeightCsv('Date,Weight (lbs)\n11/01/2026 8:00 AM,180\n');
assert.equal(pounds.unit, 'lb');
assert.equal(pounds.rows.length, 1);
assert.equal(pounds.rows[0].kg, 81.65);
assert.equal(parseGarminWeightCsv('hello').error != null, true);

const monday = weekStart(new Date(2026, 10, 21, 15, 30));
assert.equal(monday.getFullYear(), 2026);
assert.equal(monday.getMonth(), 10);
assert.equal(monday.getDate(), 16);
assert.equal(weekStart(new Date(2026, 10, 22, 9)).getDate(), 16);
const earlyMorning = new Date(2026, 10, 22, 3, 18);
assert.equal(withinRange('2026-11-22', '4w', earlyMorning), true);
assert.equal(withinRange(new Date(2026, 10, 22, 12).toISOString(), '4w', earlyMorning), true);
assert.equal(withinRange('2026-01-01', '4w', earlyMorning), false);

const now = new Date('2026-11-21T12:00:00.000Z');
const low = [
  { profile: 'dan', startedAt: '2026-11-21T08:00:00.000Z', checkIn: { sleep: 2, energy: 4, soreness: 2 } },
  { profile: 'dan', startedAt: '2026-11-20T08:00:00.000Z', checkIn: { sleep: 2, energy: 4, soreness: 2 } },
] as Session[];
assert.equal(readiness(low, 'dan', now).easeOff, true);
assert.equal(readiness(low.slice(0, 1), 'dan', now).easeOff, false);
const fine = [
  { profile: 'dan', startedAt: '2026-11-21T08:00:00.000Z', checkIn: { sleep: 4, energy: 4, soreness: 2 } },
  { profile: 'dan', startedAt: '2026-11-20T08:00:00.000Z', checkIn: { sleep: 4, energy: 4, soreness: 2 } },
] as Session[];
assert.equal(readiness(fine, 'dan', now).easeOff, false);
const sore = [
  { profile: 'dan', startedAt: '2026-11-21T08:00:00.000Z', checkIn: { sleep: 4, energy: 4, soreness: 4 } },
  { profile: 'dan', startedAt: '2026-11-20T08:00:00.000Z', checkIn: { sleep: 4, energy: 4, soreness: 4 } },
] as Session[];
assert.equal(readiness(sore, 'dan', now).easeOff, true);

console.log('program checks passed');
