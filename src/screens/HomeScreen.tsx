import { useState } from 'react';
import { Dashboard, type Household, type Save } from '../dashboard';
import { backupIsStale, formatWhen, profileName } from '../format';
import { deloadPhrase } from '../metrics';
import { completedProgramSessions, nextDayIndex } from '../program';
import { sendCoachSummary } from '../summary';
import type { ProfileId, Program, Session } from '../types';
import { Dialog } from '../ui';
import { armKeepAwake } from '../wake';
import { unlockAudio } from '../audio';

export function HomeScreen({
  profile,
  program,
  sessions,
  lastBackupAt,
  onStart,
  onResume,
  onDiscard,
  onSwitch,
  onBackup,
  household,
  save,
}: {
  profile: ProfileId;
  program: Program | null;
  sessions: Session[];
  lastBackupAt: string | null;
  onStart: () => void;
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  onSwitch: () => void;
  onBackup: () => void;
  household: Household;
  save: Save;
}) {
  const name = profileName(profile);
  const inProgress = sessions.find((session) => session.status === 'in_progress');
  const stale = backupIsStale(lastBackupAt);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState('');
  return (
    <>
      <p className="wordmark brand">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={36} height={36} />
        Spotter
      </p>
      <div className="profile-row">
        <h1>{name}</h1>
        <button type="button" className="secondary compact" onClick={onSwitch}>
          Switch
        </button>
      </div>
      <p className="muted">{name}'s workout starts here. The week below includes anyone already saved on this phone.</p>
      {stale && (
        <div className="banner">
          <p>
            {lastBackupAt
              ? `Last backup was ${formatWhen(lastBackupAt)}. Export a new one so a cleared browser doesn't take the log with it.`
              : "No backup yet. Export one so a cleared browser doesn't take the log with it."}
          </p>
          <button type="button" className="primary" onClick={onBackup}>
            Back up
          </button>
        </div>
      )}
      {!program && (
        <section className="card">
          <h2>No program yet</h2>
          <p>Import the coach's JSON from the Program tab.</p>
        </section>
      )}
      {program && (
        <ProgramHero
          program={program}
          sessions={sessions}
          inProgress={inProgress}
          onStart={onStart}
          onResume={(id) => {
            unlockAudio();
            void armKeepAwake();
            onResume(id);
          }}
          onDiscard={setDiscardId}
        />
      )}
      <Dashboard profile={profile} household={household} save={save} />
      <button
        type="button"
        className="secondary"
        onClick={() => {
          void sendCoachSummary(profile, sessions).then((result) => {
            if (result === 'cancelled') return;
            setCoachNote(result === 'sent' ? 'Sent to the share sheet.' : 'Copied the summary and downloaded the JSON.');
          });
        }}
      >
        Send to coach
      </button>
      {coachNote && <p className="ok">{coachNote}</p>}
      {discardId && (
        <Dialog
          title="Discard this workout?"
          confirmLabel="Delete it"
          danger
          onConfirm={() => {
            const id = discardId;
            setDiscardId(null);
            onDiscard(id);
          }}
          onCancel={() => setDiscardId(null)}
        >
          <p>This deletes the check-in and any sets in this workout. Older sessions stay.</p>
        </Dialog>
      )}
    </>
  );
}

function ProgramHero({
  program,
  sessions,
  inProgress,
  onStart,
  onResume,
  onDiscard,
}: {
  program: Program;
  sessions: Session[];
  inProgress: Session | undefined;
  onStart: () => void;
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const done = completedProgramSessions(program, sessions).length;
  const total = program.sessions_before_new_program;
  const phrase = deloadPhrase(program, done);
  const day = program.days[nextDayIndex(program, sessions)];
  const width = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <section className="card">
      <p className="eyebrow">{program.program_name}</p>
      <p>
        Session {done} of {total}
      </p>
      {phrase && <p>{phrase}</p>}
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      {done >= total && total > 0 && <p className="due">New program due</p>}
      {inProgress ? (
        <>
          <p className="eyebrow">In progress</p>
          <h2>{inProgress.dayName}</h2>
          <div className="stack">
            <button type="button" className="primary" onClick={() => onResume(inProgress.id)}>
              Resume workout
            </button>
            <button type="button" className="ghost" onClick={() => onDiscard(inProgress.id)}>
              Discard this workout
            </button>
          </div>
        </>
      ) : (
        day && (
          <>
            <p className="eyebrow">Next up</p>
            <h2>{day.name}</h2>
            {day.warmup && <p>{day.warmup}</p>}
            <ul className="preview">
              {day.circuits.map((circuit, index) => (
                <li key={`${circuit.label}-${index}`}>
                  Circuit {circuit.label.toUpperCase()} · {circuit.rounds} rounds · {circuit.exercises.map((exercise) => exercise.name).join(', ')}
                </li>
              ))}
            </ul>
            <button type="button" className="primary" onClick={onStart}>
              Start {day.name}
            </button>
          </>
        )
      )}
      {program.progression_rule && <p className="muted">{program.progression_rule}</p>}
    </section>
  );
}
