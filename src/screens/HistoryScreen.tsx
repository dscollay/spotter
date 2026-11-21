import { formatCheckIn, formatDuration, formatFlag, formatSetSummary, formatWhen, isBodyweightExercise, profileName } from '../format';
import type { ProfileId, Session } from '../types';

export function HistoryScreen({
  profile,
  sessions,
  onOpen,
  onResume,
}: {
  profile: ProfileId;
  sessions: Session[];
  onOpen: (id: string) => void;
  onResume: (id: string) => void;
}) {
  return (
    <>
      <p className="wordmark">Spotter</p>
      <h1>{profileName(profile)}'s history</h1>
      {sessions.length === 0 && (
        <section className="card">
          <p>No workouts yet.</p>
        </section>
      )}
      <div className="session-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => (session.status === 'in_progress' ? onResume(session.id) : onOpen(session.id))}
          >
            <strong>
              {formatWhen(session.startedAt)} · {session.dayName}
            </strong>
            <span>
              {session.status === 'in_progress'
                ? 'In progress'
                : `${formatDuration(session.durationSec)} · ${session.circuitsCompleted}/${session.circuitsPlanned} circuits`}
            </span>
            <span>{formatCheckIn(session.checkIn)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function SessionDetail({ session, onBack }: { session: Session; onBack: () => void }) {
  return (
    <>
      <p className="wordmark">Spotter</p>
      <button type="button" className="secondary" onClick={onBack}>
        Back to history
      </button>
      <h1>
        {session.dayName}
      </h1>
      <p className="muted">
        {formatWhen(session.startedAt)} · {session.programName}
      </p>
      <section className="card">
        <p>{formatDuration(session.durationSec)}</p>
        <p>
          {session.circuitsCompleted} of {session.circuitsPlanned} circuits
        </p>
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
              <div>{formatSetSummary(set, isBodyweightExercise(session.day, set.exerciseName))}</div>
              {set.note && <div>“{set.note}”</div>}
              {set.flag && <div>{formatFlag(set.flag)}</div>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
