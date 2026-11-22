import { useState } from 'react';
import { buildBackup, parseBackup, type BackupData } from '../backup';
import { listActivities, listPrograms, listSessions, listSkinfolds, listTapes, listWeights, setLastBackup } from '../db';
import { formatWhen, localDateISO, profileName } from '../format';
import type { ProfileId } from '../types';
import { PROFILE_IDS } from '../types';
import { Dialog, FileButton } from '../ui';
import { requestPersistentStorage } from '../wake';

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    return { ok: false, error: `That is not valid JSON (${message}).` };
  }
}

export function DataScreen({
  profile,
  lastBackupAt,
  persisted,
  exportText,
  onExportText,
  onPersisted,
  onReplaced,
  onMerged,
  onWiped,
}: {
  profile: ProfileId | null;
  lastBackupAt: string | null;
  persisted: boolean | null;
  exportText: string;
  onExportText: (text: string) => void;
  onPersisted: (value: boolean) => void;
  onReplaced: (backup: BackupData) => Promise<void>;
  onMerged: (backup: BackupData) => Promise<string>;
  onWiped: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<BackupData | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  async function exportBackup() {
    const exportedAt = new Date().toISOString();
    const [programs, sessions, weights, skinfolds, tapes, activities] = await Promise.all([
      listPrograms(),
      listSessions(),
      listWeights(),
      listSkinfolds(),
      listTapes(),
      listActivities(),
    ]);
    const active = profile;
    const backup = buildBackup({ exportedAt, activeProfile: active, programs, sessions, weights, skinfolds, tapes, activities });
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spotter-backup-${localDateISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    await setLastBackup(exportedAt);
    onExportText(json);
    setMessage(`Backup downloaded. Last backup: ${formatWhen(exportedAt)}. If the file didn't stick, copy the text below.`);
    setErrors([]);
  }

  async function stage(value: unknown) {
    setMessage('');
    if (value && typeof value === 'object' && !Array.isArray(value) && 'days' in value && (value as { app?: unknown }).app !== 'spotter') {
      setErrors(['That looks like a program file. Use Program → Import program.']);
      setPending(null);
      return;
    }
    const parsed = parseBackup(value);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setPending(null);
      return;
    }
    setErrors([]);
    setPending(parsed.value);
  }

  async function readFile(file: File) {
    if (file.size > 20_000_000) {
      setErrors(['That file is over 20 MB. Spotter backups are small JSON files.']);
      return;
    }
    const parsed = parseJson(await file.text());
    if (!parsed.ok) {
      setErrors([parsed.error]);
      return;
    }
    await stage(parsed.value);
  }

  const lines = pending
    ? PROFILE_IDS.map((id) => {
        const workouts = pending.sessions.filter((session) => session.profile === id).length;
        const program = pending.programs.find((item) => item.profile === id);
        const weights = pending.weights.filter((row) => row.profile === id).length;
        const activities = pending.activities.filter((row) => row.profile === id).length;
        const workoutsLabel = `${workouts} workout${workouts === 1 ? '' : 's'}`;
        const programLabel = program ? `program “${program.program_name}”` : 'no program';
        return `${profileName(id)}: ${workoutsLabel}, ${weights} weigh-ins, ${activities} activities, ${programLabel}`;
      })
    : [];

  return (
    <>
      <p className="wordmark">Spotter</p>
      <h1>Data on this device</h1>
      <p className="lede">The log for Dan, Bonnie, and Audrey stays in this browser. Nothing is sent to a server.</p>
      <section className="card">
        <h2>Storage</h2>
        <p>
          {persisted === true
            ? 'The browser said it will try to keep this data.'
            : persisted === false
              ? 'The browser has not granted persistent storage. Back up regularly.'
              : 'Persistent storage is not available in this browser. Back up regularly.'}
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            void requestPersistentStorage().then((ok) => onPersisted(ok));
          }}
        >
          Ask to keep storage
        </button>
      </section>
      <section className="card">
        <h2>Backup</h2>
        <p>{lastBackupAt ? `Last backup: ${formatWhen(lastBackupAt)}.` : 'Last backup: never.'}</p>
        <button type="button" className="primary" onClick={() => void exportBackup()}>
          Export backup
        </button>
        {exportText && (
          <label className="field">
            <span>Backup file text</span>
            <textarea readOnly value={exportText} spellCheck={false} />
          </label>
        )}
      </section>
      <section className="card">
        <h2>Import backup</h2>
        <div className="choice">
          <button type="button" className="secondary" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
            Merge
          </button>
          <button type="button" className="secondary" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
            Replace
          </button>
        </div>
        <p className="muted">
          {mode === 'merge'
            ? 'Adds workouts whose ids are not already here. If this device already has a program for someone, that program stays.'
            : 'Deletes the log on this device, then loads the backup.'}
        </p>
        <div className="stack">
          <FileButton label="Choose backup file" accept="application/json,.json" onFile={(file) => void readFile(file)} />
          <label className="field">
            <span>Or paste backup JSON</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const source = text.trim() || exportText;
              const parsed = parseJson(source);
              if (!parsed.ok) {
                setErrors([source ? parsed.error : 'Choose a file or paste a backup first.']);
                return;
              }
              void stage(parsed.value);
            }}
          >
            Check backup
          </button>
        </div>
        {errors.length > 0 && (
          <div className="error" role="alert">
            <strong>This backup was not imported.</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {message && <p className="ok">{message}</p>}
      </section>
      {!standalone && (
        <section className="card install">
          <h2>Install</h2>
          <p>On iPhone, open this in Safari, tap Share, then Add to Home Screen. On Android, use Chrome's Install app or Add to Home screen.</p>
        </section>
      )}
      <section className="card">
        <h2>Delete</h2>
        <p>Removes every profile's program and workouts from this device. Placeholders come back so the app can open. A backup file is the way to undo it.</p>
        <button type="button" className="danger" onClick={() => setConfirmWipe(true)}>
          Delete all data
        </button>
      </section>
      {pending && (
        <Dialog
          title={mode === 'replace' ? 'Replace all data with this backup?' : 'Merge this backup?'}
          confirmLabel={mode === 'replace' ? 'Replace data' : 'Merge data'}
          danger={mode === 'replace'}
          onConfirm={() => {
            const backup = pending;
            setPending(null);
            if (mode === 'replace') {
              void onReplaced(backup).then(() => {
                setMessage(`Restored backup from ${formatWhen(backup.exportedAt)}.\n${lines.join('\n')}`);
                setText('');
              });
            } else {
              void onMerged(backup).then((summary) => {
                setMessage(summary);
                setText('');
              });
            }
          }}
          onCancel={() => setPending(null)}
        >
          <p>Exported {formatWhen(pending.exportedAt)}.</p>
          <ul className="list">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Dialog>
      )}
      {confirmWipe && (
        <Dialog
          title="Delete all Spotter data on this device?"
          confirmLabel="Delete everything"
          danger
          onConfirm={() => {
            setConfirmWipe(false);
            void onWiped().then(() => setMessage('Saved log deleted. Import a backup to bring it back.'));
          }}
          onCancel={() => setConfirmWipe(false)}
        >
          <p>Programs and workouts for Dan, Bonnie, and Audrey will be removed from this browser.</p>
        </Dialog>
      )}
    </>
  );
}
