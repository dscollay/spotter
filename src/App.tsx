import { useEffect, useState } from 'react';
import type { BackupData } from './backup';
import { CheckInScreen } from './screens/CheckInScreen';
import { DataScreen } from './screens/DataScreen';
import { HistoryScreen, SessionDetail } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProgramScreen } from './screens/ProgramScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import {
  deleteSession,
  ensureSeeded,
  getActiveProfile,
  getLastBackup,
  getProgram,
  listSessions,
  mergeBackup,
  putProgram,
  putSession,
  replaceAll,
  setActiveProfile,
  wipeAll,
} from './db';
import { profileName } from './format';
import { nextDayIndex } from './program';
import type { CheckIn, Day, ProfileId, Program, Session } from './types';
import { PROFILE_IDS, PROFILE_NAMES } from './types';
import { unlockAudio } from './audio';
import { armKeepAwake, bindWakeVideo, releaseKeepAwake, requestPersistentStorage, storageIsPersistent } from './wake';

type Screen =
  | { name: 'pick' }
  | { name: 'home' }
  | { name: 'checkin' }
  | { name: 'workout'; sessionId: string }
  | { name: 'history' }
  | { name: 'session'; sessionId: string }
  | { name: 'program' }
  | { name: 'data' };

export function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'pick' });
  const [exportText, setExportText] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await ensureSeeded();
        const [active, backupAt, storage] = await Promise.all([getActiveProfile(), getLastBackup(), storageIsPersistent()]);
        if (!live) return;
        setLastBackupAt(backupAt);
        setPersisted(storage);
        if (active) {
          setProfile(active);
          setProgram(await getProgram(active));
          setSessions(await listSessions(active));
          setScreen({ name: 'home' });
        }
        setReady(true);
      } catch (error) {
        if (!live) return;
        setBootError(error instanceof Error ? error.message : 'Could not open the log.');
      }
    })();
    const arm = () => {
      unlockAudio();
      void requestPersistentStorage().then((ok) => {
        if (live) setPersisted(ok);
      });
    };
    window.addEventListener('pointerdown', arm, { once: true });
    return () => {
      live = false;
      window.removeEventListener('pointerdown', arm);
    };
  }, []);

  async function loadProfile(next: ProfileId) {
    setProgram(await getProgram(next));
    setSessions(await listSessions(next));
    setLastBackupAt(await getLastBackup());
  }

  async function choose(next: ProfileId) {
    setActionError('');
    await setActiveProfile(next);
    setProfile(next);
    await loadProfile(next);
    setScreen({ name: 'home' });
    window.scrollTo(0, 0);
  }

  function openTab(name: 'home' | 'history' | 'program' | 'data') {
    setActionError('');
    if (!profile && name !== 'data') {
      setScreen({ name: 'pick' });
      return;
    }
    const next: Screen = { name };
    setScreen(next);
    window.scrollTo(0, 0);
  }

  async function remember(session: Session) {
    await putSession(session);
    setSessions((current) => {
      const index = current.findIndex((item) => item.id === session.id);
      const next = current.slice();
      if (index === -1) next.unshift(session);
      else next[index] = session;
      return next.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  }

  async function begin(checkIn: CheckIn) {
    if (!profile || !program) return;
    unlockAudio();
    void armKeepAwake();
    const day = program.days[nextDayIndex(program, sessions)];
    if (!day) return;
    const session: Session = {
      id: crypto.randomUUID(),
      profile,
      programName: program.program_name,
      programStartDate: program.start_date,
      dayName: day.name,
      day: JSON.parse(JSON.stringify(day)) as Day,
      checkIn,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationSec: null,
      stepIndex: 0,
      sets: [],
      circuitsCompleted: 0,
      circuitsPlanned: day.circuits.length,
      status: 'in_progress',
    };
    try {
      await remember(session);
      setScreen({ name: 'workout', sessionId: session.id });
      window.scrollTo(0, 0);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start the workout.');
    }
  }

  const activeSession =
    screen.name === 'workout' || screen.name === 'session' ? sessions.find((session) => session.id === screen.sessionId) : undefined;
  const showNav = screen.name !== 'pick' && screen.name !== 'workout' && screen.name !== 'checkin';
  const tab = screen.name === 'session' ? 'history' : screen.name;

  if (bootError) {
    return (
      <main className="app">
        <p className="wordmark">Spotter</p>
        <h1>Couldn't open the log</h1>
        <p className="error">{bootError}</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="app">
        <p className="wordmark">Spotter</p>
        <h1>Opening the log…</h1>
      </main>
    );
  }

  return (
    <>
      <video
        ref={bindWakeVideo}
        className="wake-video"
        src={`${import.meta.env.BASE_URL}silent.mp4`}
        muted
        playsInline
        loop
        preload="auto"
        aria-hidden="true"
      />
      <main className={showNav ? 'app' : 'app no-nav'} data-screen={screen.name}>
        {actionError && <p className="error">{actionError}</p>}
        {screen.name === 'pick' && <Picker onChoose={(id) => void choose(id)} />}
        {screen.name === 'home' && profile && (
          <HomeScreen
            profile={profile}
            program={program}
            sessions={sessions}
            lastBackupAt={lastBackupAt}
            onStart={() => {
              setScreen({ name: 'checkin' });
              window.scrollTo(0, 0);
            }}
            onResume={(id) => {
              setScreen({ name: 'workout', sessionId: id });
              window.scrollTo(0, 0);
            }}
            onDiscard={(id) => {
              void deleteSession(id)
                .then(() => setSessions((current) => current.filter((session) => session.id !== id)))
                .catch((error: unknown) => setActionError(error instanceof Error ? error.message : 'Could not discard that workout.'));
            }}
            onSwitch={() => {
              releaseKeepAwake();
              setScreen({ name: 'pick' });
            }}
            onBackup={() => openTab('data')}
          />
        )}
        {screen.name === 'checkin' && program && profile && (
          <CheckInScreen
            dayName={program.days[nextDayIndex(program, sessions)]?.name ?? 'workout'}
            warmup={program.days[nextDayIndex(program, sessions)]?.warmup}
            onBegin={(checkIn) => void begin(checkIn)}
            onBack={() => setScreen({ name: 'home' })}
          />
        )}
        {screen.name === 'workout' && activeSession && (
          <WorkoutScreen
            session={activeSession}
            sessions={sessions}
            onSave={remember}
            onDelete={async (id) => {
              await deleteSession(id);
              setSessions((current) => current.filter((session) => session.id !== id));
            }}
            onExit={() => {
              releaseKeepAwake();
              setScreen({ name: 'home' });
            }}
            onHistory={() => {
              releaseKeepAwake();
              setScreen({ name: 'history' });
            }}
          />
        )}
        {screen.name === 'workout' && !activeSession && (
          <section className="card">
            <h1>That workout isn't on this device</h1>
            <button type="button" className="primary" onClick={() => setScreen({ name: 'home' })}>
              Back home
            </button>
          </section>
        )}
        {screen.name === 'history' && profile && (
          <HistoryScreen
            profile={profile}
            sessions={sessions}
            onOpen={(id) => setScreen({ name: 'session', sessionId: id })}
            onResume={(id) => {
              unlockAudio();
              void armKeepAwake();
              setScreen({ name: 'workout', sessionId: id });
            }}
          />
        )}
        {screen.name === 'session' && activeSession && (
          <SessionDetail session={activeSession} onBack={() => setScreen({ name: 'history' })} />
        )}
        {screen.name === 'program' && profile && (
          <ProgramScreen
            profile={profile}
            program={program}
            onImport={async (next) => {
              await putProgram(next);
              await setActiveProfile(next.profile);
              setProfile(next.profile);
              await loadProfile(next.profile);
            }}
          />
        )}
        {screen.name === 'data' && (
          <DataScreen
            profile={profile}
            lastBackupAt={lastBackupAt}
            persisted={persisted}
            exportText={exportText}
            onExportText={(text) => {
              setExportText(text);
              void getLastBackup().then(setLastBackupAt);
            }}
            onPersisted={setPersisted}
            onReplaced={async (backup: BackupData) => {
              await replaceAll({
                programs: backup.programs,
                sessions: backup.sessions,
                activeProfile: backup.activeProfile,
                lastBackupAt: backup.exportedAt,
              });
              setLastBackupAt(backup.exportedAt);
              setProfile(backup.activeProfile);
              if (backup.activeProfile) await loadProfile(backup.activeProfile);
              else {
                setProgram(null);
                setSessions([]);
              }
            }}
            onMerged={async (backup) => {
              const result = await mergeBackup(backup);
              if (profile) await loadProfile(profile);
              const added = result.programsAdded.map((id) => profileName(id)).join(', ');
              const kept = result.programsKept.map((id) => profileName(id)).join(', ');
              return `Added ${result.addedSessions} workout${result.addedSessions === 1 ? '' : 's'}.${added ? ` Programs added: ${added}.` : ''}${kept ? ` Kept existing programs for ${kept}.` : ''}`;
            }}
            onWiped={async () => {
              await wipeAll();
              setProfile(null);
              setProgram(null);
              setSessions([]);
              setLastBackupAt(null);
            }}
          />
        )}
      </main>
      {showNav && (
        <nav className="nav" aria-label="Sections">
          {(
            [
              ['home', 'Today'],
              ['history', 'History'],
              ['program', 'Program'],
              ['data', 'Data'],
            ] as const
          ).map(([name, label]) => (
            <button key={name} type="button" aria-current={tab === name ? 'page' : undefined} onClick={() => openTab(name)}>
              {label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}

function Picker({ onChoose }: { onChoose: (profile: ProfileId) => void }) {
  return (
    <>
      <p className="wordmark">Spotter</p>
      <h1>Who's training?</h1>
      <p className="lede">Each person has a separate log. It stays on this phone.</p>
      <div className="people">
        {PROFILE_IDS.map((id) => (
          <button key={id} type="button" onClick={() => onChoose(id)}>
            <strong>{PROFILE_NAMES[id]}</strong>
            <span>{PROFILE_NAMES[id]}'s program and history</span>
          </button>
        ))}
      </div>
    </>
  );
}
