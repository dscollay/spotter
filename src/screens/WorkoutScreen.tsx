import { useEffect, useRef, useState } from 'react';
import { beep, unlockAudio } from '../audio';
import { exerciseTarget, exerciseUnit, formatCheckIn, formatDuration, formatElapsed, formatFlag, formatNumber, formatSetSummary, repTarget } from '../format';
import { buildSteps, circuitsDone, latestSet, nextExercise, type ExerciseStep } from '../program';
import type { Exercise, Flag, Session, SetLog } from '../types';
import { FLAG_LABELS, FLAGS } from '../types';
import { armKeepAwake, releaseKeepAwake, type WakeStatus } from '../wake';
import { Dialog } from '../ui';

function elapsedSec(startedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export function WorkoutScreen({
  session,
  sessions,
  onSave,
  onDelete,
  onExit,
  onHistory,
}: {
  session: Session;
  sessions: Session[];
  onSave: (session: Session) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExit: () => void;
  onHistory: () => void;
}) {
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);
  const [clock, setClock] = useState(() => elapsedSec(session.startedAt));
  const [wake, setWake] = useState<WakeStatus | 'pending'>('pending');
  const steps = buildSteps(session.day);

  useEffect(() => {
    const id = window.setInterval(() => setClock(elapsedSec(session.startedAt)), 1000);
    return () => window.clearInterval(id);
  }, [session.startedAt]);

  useEffect(() => {
    let live = true;
    void armKeepAwake().then((status) => {
      if (live) setWake(status);
    });
    return () => {
      live = false;
      releaseKeepAwake();
    };
  }, []);

  async function finish() {
    const now = new Date().toISOString();
    await onSave({
      ...session,
      status: 'completed',
      finishedAt: now,
      durationSec: elapsedSec(session.startedAt),
      circuitsCompleted: circuitsDone(session.day, session.sets),
    });
    setConfirm(null);
  }

  if (session.status === 'completed') {
    return <Summary session={session} onHistory={onHistory} onExit={onExit} />;
  }

  const step = steps[session.stepIndex];
  const exerciseOrdinal = steps.slice(0, session.stepIndex + 1).filter((item) => item.kind === 'exercise').length;
  const exerciseTotal = steps.filter((item) => item.kind === 'exercise').length;

  async function commit(stepToLog: ExerciseStep, values: LogDraft) {
    const set: SetLog = {
      id: crypto.randomUUID(),
      circuitIndex: stepToLog.circuitIndex,
      circuitLabel: stepToLog.circuitLabel,
      round: stepToLog.round,
      slot: stepToLog.exercise.slot,
      exerciseName: stepToLog.exercise.name,
      unit: exerciseUnit(stepToLog.exercise),
      load: values.load,
      reps: values.reps,
      note: values.note,
      flag: values.flag,
      workSec: values.workSec,
      made: values.made,
      loggedAt: new Date().toISOString(),
    };
    const sets = [...session.sets, set];
    const nextIndex = session.stepIndex + 1;
    const done = nextIndex >= steps.length;
    const now = new Date().toISOString();
    await onSave({
      ...session,
      sets,
      stepIndex: done ? session.stepIndex : nextIndex,
      circuitsCompleted: circuitsDone(session.day, sets),
      status: done ? 'completed' : 'in_progress',
      finishedAt: done ? now : null,
      durationSec: done ? elapsedSec(session.startedAt) : null,
    });
  }

  async function advance() {
    const nextIndex = session.stepIndex + 1;
    if (nextIndex >= steps.length) {
      await finish();
      return;
    }
    await onSave({ ...session, stepIndex: nextIndex });
  }

  return (
    <>
      <div className="split workout-top">
        <p>
          {session.dayName} · {exerciseOrdinal} of {exerciseTotal}
        </p>
        <p>{formatElapsed(clock)}</p>
      </div>
      {wake !== 'on' && wake !== 'pending' && <p className="muted">{wakeMessage(wake)}</p>}
      {!step && (
        <section className="card">
          <h2>Nothing left in this workout</h2>
          <button type="button" className="primary" onClick={() => void finish()}>
            Finish workout
          </button>
        </section>
      )}
      {step?.kind === 'exercise' && (
        <SetLogger
          key={session.stepIndex}
          step={step}
          sessions={sessions}
          onLog={(values) => commit(step, values)}
          onExit={onExit}
          onFinish={() => setConfirm('finish')}
          onDiscard={() => setConfirm('discard')}
        />
      )}
      {step?.kind === 'rest' && (
        <>
          <RestTimer
            key={session.stepIndex}
            seconds={step.seconds}
            reason={step.reason}
            next={nextExercise(steps, session.stepIndex)}
            onDone={() => advance()}
          />
          <MoreActions onExit={onExit} onFinish={() => setConfirm('finish')} onDiscard={() => setConfirm('discard')} />
        </>
      )}
      {confirm === 'finish' && (
        <Dialog title="Finish this workout?" confirmLabel="Finish and save" onConfirm={() => void finish()} onCancel={() => setConfirm(null)}>
          <p>Sets you logged stay in history. Circuits you did not complete count as not done.</p>
        </Dialog>
      )}
      {confirm === 'discard' && (
        <Dialog
          title="Discard this workout?"
          confirmLabel="Delete it"
          danger
          onConfirm={() => void onDelete(session.id).then(onExit)}
          onCancel={() => setConfirm(null)}
        >
          <p>This deletes the check-in and any sets in this workout. It does not touch older sessions.</p>
        </Dialog>
      )}
    </>
  );
}

function wakeMessage(wake: WakeStatus | 'pending'): string {
  if (wake === 'on') return 'Screen stays on while you train.';
  if (wake === 'fallback') return 'Trying to keep the screen on. If it sleeps, turn off auto-lock.';
  if (wake === 'unavailable') return "This browser won't hold the screen awake. Turn off auto-lock for the session.";
  return 'Keeping the screen on…';
}

type LogDraft = {
  load: number | null;
  reps: number | null;
  workSec: number | null;
  note: string;
  flag: Flag | null;
  made: boolean;
};

function SetLogger({
  step,
  sessions,
  onLog,
  onExit,
  onFinish,
  onDiscard,
}: {
  step: ExerciseStep;
  sessions: Session[];
  onLog: (values: LogDraft) => Promise<void>;
  onExit: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const exercise = step.exercise;
  const previous = latestSet(sessions, exercise.name);
  const unit = exerciseUnit(exercise);
  const timed = exercise.work_sec != null;
  const target = exercise.reps ? repTarget(exercise.reps) : null;
  const tickLabel = exercise.per_side && exercise.reps ? `${exercise.reps} each side` : (target?.label ?? exercise.reps);
  const [load, setLoad] = useState(() => initialLoad(exercise, previous, unit));
  const [note, setNote] = useState('');
  const [flag, setFlag] = useState<Flag | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ask, setAsk] = useState<'reps' | 'time' | null>(null);
  const [actual, setActual] = useState('');
  const timer = useCountdown(exercise.work_sec ?? 0, Boolean(exercise.per_side));

  async function save(values: Omit<LogDraft, 'load' | 'note' | 'flag'> & { load?: number | null }) {
    if (pending) return;
    const parsedLoad = parseDecimal(load);
    if (Number.isNaN(parsedLoad) || (parsedLoad != null && parsedLoad > 2000)) {
      setError(Number.isNaN(parsedLoad) ? 'Enter the weight as a number.' : 'That weight looks off.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await onLog({
        load: parsedLoad,
        reps: values.reps,
        workSec: values.workSec,
        note: note.trim(),
        flag,
        made: values.made,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that set.');
      setPending(false);
    }
  }

  function adjustLoad(delta: number) {
    const current = parseDecimal(load);
    const base = current == null || Number.isNaN(current) ? 0 : current;
    const next = Math.round((base + delta) * 1000) / 1000;
    setLoad(formatNumber(Math.max(0, next)));
  }

  return (
    <section className="focus">
      <p className="where">
        {exercise.slot.toUpperCase()} · round {step.round} of {step.rounds}
      </p>
      <h1>{exercise.name}</h1>
      {exercise.notes && <p className="cue">{exercise.notes}</p>}
      <p className="last-line">{previous ? `Last time ${formatSetSummary(previous.set)}` : 'No log yet'}</p>
      {timed && exercise.work_sec != null && (
        <div className={timer.flash ? 'timer flash' : 'timer'}>
          <p className="timer-num">{timer.display}</p>
          {timer.label && <p>{timer.label}</p>}
          <BeepRow timer={timer} />
        </div>
      )}
      <label className="field weight">
        <span>Weight ({unit})</span>
        <input id="load" inputMode="decimal" autoComplete="off" value={load} onChange={(event) => setLoad(event.target.value)} />
      </label>
      {unit === 'lb' && (
        <div className="choice">
          <button type="button" className="secondary" onClick={() => adjustLoad(-5)}>
            −5 lb
          </button>
          <button type="button" className="secondary" onClick={() => adjustLoad(5)}>
            +5 lb
          </button>
        </div>
      )}
      <label className="field">
        <span>Note</span>
        <input id="note" maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {timed ? (
        <>
          {!timer.running && !timer.done && (
            <button type="button" className="primary" onClick={timer.start}>
              Start
            </button>
          )}
          {timer.done && (
            <button
              type="button"
              className="primary tick"
              disabled={pending}
              onClick={() => void save({ reps: null, workSec: exercise.work_sec, made: true })}
            >
              Done
            </button>
          )}
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setActual('');
              setError('');
              setAsk('time');
            }}
          >
            Didn't make the time
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="primary tick"
            disabled={pending || !target}
            onClick={() => void save({ reps: target?.count ?? null, workSec: null, made: true })}
          >
            {tickLabel}
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setActual('');
              setError('');
              setAsk('reps');
            }}
          >
            Missed reps
          </button>
        </>
      )}
      <details className="more">
        <summary>More</summary>
        {exercise.video_url && (
          <a className="secondary" href={exercise.video_url} target="_blank" rel="noopener noreferrer">
            Play video
          </a>
        )}
        <div className="flags">
          {FLAGS.map((item) => (
            <button
              key={item}
              type="button"
              data-flag={item}
              aria-pressed={flag === item}
              onClick={() => setFlag((current) => (current === item ? null : item))}
            >
              {FLAG_LABELS[item]}
            </button>
          ))}
        </div>
        <MoreActions onExit={onExit} onFinish={onFinish} onDiscard={onDiscard} />
      </details>
      {ask === 'reps' && (
        <Dialog title="Missed reps" confirmLabel="Save reps" onConfirm={() => void saveMiss()} onCancel={() => setAsk(null)}>
          <label className="field">
            <span>Reps completed</span>
            <input id="missed-reps" inputMode="numeric" value={actual} onChange={(event) => setActual(event.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
        </Dialog>
      )}
      {ask === 'time' && (
        <Dialog
          title="Didn't make the time"
          confirmLabel="Save"
          onConfirm={() => void saveShort()}
          onCancel={() => setAsk(null)}
        >
          <label className="field">
            <span>Seconds you managed, if you counted</span>
            <input id="seconds-done" inputMode="numeric" value={actual} onChange={(event) => setActual(event.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
        </Dialog>
      )}
    </section>
  );

  async function saveMiss() {
    const reps = parseWhole(actual);
    if (reps == null || Number.isNaN(reps) || reps > 500) {
      setError(reps == null ? 'Enter how many reps you completed.' : 'Enter a whole number of reps.');
      return;
    }
    setAsk(null);
    await save({ reps, workSec: null, made: false });
  }

  async function saveShort() {
    const seconds = parseWhole(actual);
    if (Number.isNaN(seconds) || (seconds != null && seconds > 3600)) {
      setError('Enter the seconds as a whole number.');
      return;
    }
    setAsk(null);
    await save({ reps: null, workSec: seconds && seconds > 0 ? seconds : null, made: false });
  }
}

function MoreActions({ onExit, onFinish, onDiscard }: { onExit: () => void; onFinish: () => void; onDiscard: () => void }) {
  return (
    <div className="stack">
      <button type="button" className="secondary" onClick={onExit}>
        Save and exit
      </button>
      <button type="button" className="ghost" onClick={onFinish}>
        Finish workout
      </button>
      <button type="button" className="ghost" onClick={onDiscard}>
        Discard workout
      </button>
    </div>
  );
}

function initialLoad(exercise: ExerciseStep['exercise'], previous: { set: SetLog } | null, unit: SetLog['unit']): string {
  if (previous?.set.load != null && previous.set.unit === unit) return formatNumber(previous.set.load);
  if (unit === 'lb' && exercise.load && /^-?\d+(?:\.\d+)?$/.test(exercise.load)) return formatNumber(Number(exercise.load));
  return '';
}

function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}

function parseWhole(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return Number.NaN;
  return Number(text);
}

function RestTimer({
  seconds,
  reason,
  next,
  onDone,
}: {
  seconds: number;
  reason: string;
  next: Exercise | null;
  onDone: () => void | Promise<void>;
}) {
  const timer = useCountdown(seconds);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const sent = useRef(false);
  async function go() {
    if (sent.current) return;
    sent.current = true;
    try {
      await onDone();
    } catch {
      sent.current = false;
    }
  }
  useEffect(() => {
    if (!timer.done || sent.current) return;
    sent.current = true;
    const id = window.setTimeout(() => {
      void Promise.resolve(doneRef.current()).catch(() => {
        sent.current = false;
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [timer.done]);
  return (
    <section className="card">
      <p className="eyebrow">Rest</p>
      <h2>{reason}</h2>
      {next && (
        <p className="muted next-up">
          Next exercise · {next.name}
          {exerciseTarget(next) ? ` · ${exerciseTarget(next)}` : ''}
        </p>
      )}
      <div className={timer.flash ? 'timer flash' : 'timer'}>
        <p className="timer-num">{timer.display}</p>
        <BeepRow timer={timer} />
        {timer.done && <p>Rest done.</p>}
        {!timer.running && !timer.done && (
          <button type="button" className="primary" onClick={timer.start}>
            Start rest
          </button>
        )}
        {timer.running && !timer.beeping && <p>Going</p>}
      </div>
      <button type="button" className="secondary" onClick={go}>
        Skip rest
      </button>
    </section>
  );
}

function BeepRow({ timer }: { timer: Countdown }) {
  return (
    <>
      {timer.beeping && <p className="beep-banner">Beep</p>}
      <ul className="pips" aria-hidden="true">
        {[5, 4, 3, 2, 1].map((sec) => (
          <li key={sec} className={timer.display <= sec && (timer.running || timer.done) && timer.display > 0 ? 'on' : ''} />
        ))}
      </ul>
    </>
  );
}

type Countdown = {
  display: number;
  label: string;
  running: boolean;
  done: boolean;
  flash: boolean;
  beeping: boolean;
  start: () => void;
};

const SIDE_GAP_SEC = 5;

function useCountdown(seconds: number, perSide = false): Countdown {
  const plan = useRef(perSide ? [seconds, SIDE_GAP_SEC, seconds] : [seconds]);
  const labels = useRef(perSide ? ['', 'switch sides', ''] : ['']);
  const index = useRef(0);
  const [left, setLeft] = useState(plan.current[0] * 1000);
  const [label, setLabel] = useState(labels.current[0]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState(false);
  const leftRef = useRef(plan.current[0] * 1000);
  const endRef = useRef(0);
  const beeped = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const ms = Math.max(0, endRef.current - Date.now());
      leftRef.current = ms;
      setLeft(ms);
      const sec = Math.ceil(ms / 1000);
      if (sec >= 1 && sec <= 5 && !beeped.current.has(sec)) {
        beeped.current.add(sec);
        beep(sec === 1 ? 990 : 880, 0.12);
        setFlash(true);
        window.setTimeout(() => setFlash(false), 180);
      }
      if (ms <= 0) {
        if (!beeped.current.has(0)) {
          beeped.current.add(0);
          beep(520, 0.28);
          setFlash(true);
        }
        const next = index.current + 1;
        if (next < plan.current.length) {
          index.current = next;
          const nextMs = plan.current[next] * 1000;
          beeped.current = new Set();
          leftRef.current = nextMs;
          endRef.current = Date.now() + nextMs;
          setLeft(nextMs);
          setLabel(labels.current[next]);
          return;
        }
        setRunning(false);
        setDone(true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  const display = Math.ceil(left / 1000);
  return {
    display,
    label,
    running,
    done,
    flash,
    beeping: running && display <= 5 && display > 0,
    start: () => {
      if (running || done) return;
      unlockAudio();
      endRef.current = Date.now() + leftRef.current;
      setRunning(true);
    },
  };
}

function Summary({ session, onHistory, onExit }: { session: Session; onHistory: () => void; onExit: () => void }) {
  const complete = session.circuitsPlanned > 0 && session.circuitsCompleted >= session.circuitsPlanned;
  return (
    <>
      <p className="wordmark">Spotter</p>
      <h1>{complete ? `${session.dayName} complete` : `${session.dayName} saved`}</h1>
      <section className="card">
        <p>{formatDuration(session.durationSec)}</p>
        <p>
          {session.circuitsCompleted} of {session.circuitsPlanned} circuits
        </p>
        <p>{session.sets.length} sets</p>
        <p>{formatCheckIn(session.checkIn)}</p>
      </section>
      <section className="card">
        <h2>Sets</h2>
        {session.sets.length === 0 && <p>No sets logged.</p>}
        <ul className="list">
          {session.sets.map((set) => (
            <li key={set.id}>
              <strong>
                {set.slot.toUpperCase()} · Round {set.round} · {set.exerciseName}
              </strong>
              <div>{formatSetSummary(set)}</div>
              {set.note && <div>“{set.note}”</div>}
              {set.flag && <div>{formatFlag(set.flag)}</div>}
            </li>
          ))}
        </ul>
      </section>
      <div className="stack">
        <button type="button" className="primary" onClick={onHistory}>
          See history
        </button>
        <button type="button" className="secondary" onClick={onExit}>
          Back home
        </button>
      </div>
    </>
  );
}
