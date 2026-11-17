import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBackup } from '../src/backup.ts';
import { prescriptionLine } from '../src/format.ts';
import { buildSteps, nextDayIndex, parseProgram } from '../src/program.ts';
import type { Program, Session } from '../src/types.ts';

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
assert.equal(prescriptionLine(labeled), '2 sets · 8 reps · bodyweight · RPE 6 · tempo 3010');

const sided = structuredClone(readJson('bonnie')) as {
  days: { circuits: { exercises: Record<string, unknown>[] }[] }[];
};
sided.days[0].circuits[0].exercises[0].per_side = true;
const sidedResult = parseProgram(sided);
assert.equal(sidedResult.ok, true, sidedResult.ok ? '' : sidedResult.errors.join('\n'));
if (sidedResult.ok) {
  const exercise = sidedResult.value.days[0].circuits[0].exercises[0];
  assert.equal(exercise.per_side, true);
  assert.equal(prescriptionLine(exercise), '2 sets · 8 each side · bodyweight · RPE 6 · tempo 3010');
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
  const stepUp = shippedDan.value.days[1].circuits[0].exercises[0];
  const deadlift = shippedDan.value.days[0].circuits[0].exercises[0];
  assert.equal(stepUp.name, 'Barbell step-up');
  assert.equal(stepUp.per_side, true);
  assert.equal(stepUp.reps, '8');
  assert.equal(deadlift.per_side, undefined);
}

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

console.log('program checks passed');
