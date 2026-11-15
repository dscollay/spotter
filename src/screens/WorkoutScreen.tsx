import { useEffect, useRef, useState } from 'react';
import { audioArmed, beep, unlockAudio } from '../audio';
import { exerciseUnit, formatCheckIn, formatDuration, formatElapsed, formatFlag, formatLastWhen, formatSetSummary, prescriptionLine } from '../format';
import { buildSteps, circuitsDone, latestSet, type ExerciseStep, type Step } from '../program';
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
      workSec: stepToLog.exercise.work_sec,
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
      <div className="split">
        <p className="wordmark">Spotter</p>
        <p className="muted">{formatElapsed(clock)}</p>
      </div>
      <p className="muted">
        {session.dayName} · {exerciseOrdinal} of {exerciseTotal} exercises
      </p>
      <p className="muted">{wakeMessage(wake)}</p>
      {!step && (
        <section className="card">
          <h2>Nothing left in this workout</h2>
          <button type="button" className="primary" onClick={() => void finish()}>
            Finish workout
          </button>
        </section>
      )}
      {step?.kind === 'exercise' && (
        <ExerciseCard
          key={session.stepIndex}
          step={step}
          next={steps[session.stepIndex + 1]}
          sessions={sessions}
          onLog={(values) => commit(step, values)}
        />
      )}
      {step?.kind === 'rest' && (
        <RestTimer key={session.stepIndex} seconds={step.seconds} reason={step.reason} onDone={() => advance()} />
      )}
      <div className="dock">
        <button type="button" className="secondary" onClick={onExit}>
          Save and exit
        </button>
        <button type="button" className="ghost" onClick={() => setConfirm('finish')}>
          Finish workout
        </button>
        <button type="button" className="ghost" onClick={() => setConfirm('discard')}>
          Discard workout
        </button>
      </div>
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

function ExerciseCard({
  step,
  next,
  sessions,
  onLog,
}: {
  step: ExerciseStep;
  next: Step | undefined;
  sessions: Session[];
  onLog: (values: LogDraft) => Promise<void>;
}) {
  const exercise = step.exercise;
  const previous = latestSet(sessions, exercise.name);
  const unit = exerciseUnit(exercise);
  return (
    <section className="card">
      <p className="eyebrow">
        Circuit {step.circuitLabel.toUpperCase()} · Round {step.round} of {step.rounds}
      </p>
      <p className="slot">{exercise.slot.toUpperCase()}</p>
      <h2 className="exercise-name">{exercise.name}</h2>
      <p>{prescriptionLine(exercise)}</p>
      {exercise.notes && <p className="notes">{exercise.notes}</p>}
      {!exercise.unit && <p className="muted">No unit on this exercise. Load is logged as {unit}.</p>}
      <div className="last">
        <p className="eyebrow">Last time</p>
        {previous ? (
          <>
            <p>
              <strong>{formatSetSummary(previous.set)}</strong>
            </p>
            <p>{formatLastWhen(previous.session, previous.set)}</p>
            {previous.set.note && <p>“{previous.set.note}”</p>}
            {previous.set.flag && <p>{formatFlag(previous.set.flag)}</p>}
          </>
        ) : (
          <p>No log yet.</p>
        )}
      </div>
      {exercise.work_sec != null && <WorkTimer seconds={exercise.work_sec} />}
      {exercise.video_url && (
        <p>
          <a className="secondary" href={exercise.video_url} target="_blank" rel="noopener noreferrer">
            Play video
          </a>
        </p>
      )}
      {next?.kind === 'rest' && <p className="muted">Next is a {next.seconds}s rest. It waits until you tap Start.</p>}
      <LogForm exercise={exercise} onLog={onLog} />
    </section>
  );
}

type LogDraft = { load: number | null; reps: number | null; note: string; flag: Flag | null };

function LogForm({ exercise, onLog }: { exercise: Exercise; onLog: (values: LogDraft) => Promise<void> }) {
  const [load, setLoad] = useState('');
  const [reps, setReps] = useState('');
  const [note, setNote] = useState('');
  const [flag, setFlag] = useState<Flag | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const unit = exerciseUnit(exercise);
  const timed = exercise.work_sec != null;

  async function submit() {
    if (pending) return;
    const parsedLoad = parseDecimal(load);
    const parsedReps = parseWhole(reps);
    if (Number.isNaN(parsedLoad)) {
      setError('Enter load as a number, like 12 or 12.5.');
      return;
    }
    if (parsedLoad != null && parsedLoad > 2000) {
      setError('That load looks off. Check the number.');
      return;
    }
    if (Number.isNaN(parsedReps)) {
      setError('Enter reps as a whole number.');
      return;
    }
    if (!timed && parsedReps == null) {
      setError('Enter the reps you did.');
      return;
    }
    if (parsedReps != null && parsedReps > 500) {
      setError('That rep count looks off. Check the number.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await onLog({ load: parsedLoad, reps: parsedReps, note: note.trim(), flag });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that set.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="field">
        <span>Load ({unit})</span>
        <input id="load" inputMode="decimal" autoComplete="off" value={load} onChange={(event) => setLoad(event.target.value)} />
      </label>
      <label className="field">
        <span>{timed ? 'Reps, if you counted' : 'Reps'}</span>
        <input id="reps" inputMode="numeric" autoComplete="off" value={reps} onChange={(event) => setReps(event.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <input id="note" maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="field">
        <span className="field-label">Flag</span>
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
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Saving…' : 'Log set'}
      </button>
    </form>
  );
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

function WorkTimer({ seconds }: { seconds: number }) {
  const timer = useCountdown(seconds);
  return (
    <div className={timer.flash ? 'timer flash' : 'timer'}>
      <p className="eyebrow">Work</p>
      <p className="timer-num">{timer.display}</p>
      <BeepRow timer={timer} />
      {timer.done && <p>Time's up. Log the set.</p>}
      {!timer.running && !timer.done && (
        <button type="button" className="primary" onClick={timer.start}>
          Start timer
        </button>
      )}
      {timer.running && !timer.beeping && <p>Going</p>}
      <p className="muted">{audioArmed() ? 'Beeps are armed.' : 'Tap Start to arm the beeps.'}</p>
    </div>
  );
}

function RestTimer({ seconds, reason, onDone }: { seconds: number; reason: string; onDone: () => void | Promise<void> }) {
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
        <p className="muted">{audioArmed() ? 'Beeps are armed.' : 'Tap Start to arm the beeps.'}</p>
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
  running: boolean;
  done: boolean;
  flash: boolean;
  beeping: boolean;
  start: () => void;
};

function useCountdown(seconds: number): Countdown {
  const [left, setLeft] = useState(seconds * 1000);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState(false);
  const leftRef = useRef(seconds * 1000);
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
        setRunning(false);
        setDone(true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  const display = Math.ceil(left / 1000);
  return {
    display,
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
