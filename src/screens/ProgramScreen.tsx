import { useState } from 'react';
import { prescriptionLine, profileName } from '../format';
import { parseProgram } from '../program';
import type { ProfileId, Program } from '../types';
import { Dialog, FileButton } from '../ui';

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    return { ok: false, error: `That is not valid JSON (${message}).` };
  }
}

export function ProgramScreen({
  profile,
  program,
  onImport,
}: {
  profile: ProfileId;
  program: Program | null;
  onImport: (program: Program) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<Program | null>(null);

  async function consider(value: unknown) {
    setMessage('');
    if (value && typeof value === 'object' && !Array.isArray(value) && (value as { app?: unknown }).app === 'spotter') {
      setErrors(['That looks like a full data backup. Use Data → Import backup.']);
      setPending(null);
      return;
    }
    const parsed = parseProgram(value);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setPending(null);
      return;
    }
    setErrors([]);
    setPending(parsed.value);
  }

  async function readFile(file: File) {
    if (file.size > 2_000_000) {
      setErrors(['That file is over 2 MB. A program JSON is small.']);
      return;
    }
    const parsed = parseJson(await file.text());
    if (!parsed.ok) {
      setErrors([parsed.error]);
      return;
    }
    await consider(parsed.value);
  }

  return (
    <>
      <p className="wordmark">Spotter</p>
      <h1>{profileName(profile)}'s program</h1>
      {program ? (
        <section className="card">
          <p className="eyebrow">{program.program_name}</p>
          <p>Starts {program.start_date}</p>
          <p>{program.sessions_before_new_program} sessions before a new program</p>
          {program.progression_rule && <p>{program.progression_rule}</p>}
          {program.days.map((day, dayIndex) => (
            <div key={`${day.name}-${dayIndex}`}>
              <h3>
                {day.name}
                {day.deload ? ' · deload' : ''}
              </h3>
              {day.warmup && <p className="muted">{day.warmup}</p>}
              {day.circuits.map((circuit, circuitIndex) => (
                <div key={`${circuit.label}-${circuitIndex}`}>
                  <p>
                    Circuit {circuit.label.toUpperCase()} · {circuit.rounds} rounds · {circuit.rest_between_rounds_sec}s between rounds
                  </p>
                  <ul className="list">
                    {circuit.exercises.map((exercise) => (
                      <li key={exercise.slot}>
                        <strong>
                          {exercise.slot.toUpperCase()} {exercise.name}
                        </strong>
                        <div>{prescriptionLine(exercise)}</div>
                        {exercise.notes && <div className="muted">{exercise.notes}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      ) : (
        <section className="card">
          <p>No program stored for {profileName(profile)}.</p>
        </section>
      )}
      <section className="card">
        <h2>Import a program</h2>
        <p className="muted">Paste the coach's JSON or choose a file. Unknown fields are ignored. The profile inside the file decides who it belongs to.</p>
        <div className="stack">
          <FileButton label="Choose program file" accept="application/json,.json" onFile={(file) => void readFile(file)} />
          <label className="field">
            <span>Or paste JSON</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const parsed = parseJson(text);
              if (!parsed.ok) {
                setErrors([parsed.error]);
                setMessage('');
                return;
              }
              void consider(parsed.value);
            }}
          >
            Check pasted program
          </button>
        </div>
        {errors.length > 0 && (
          <div className="error" role="alert">
            <strong>This program needs a fix.</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {message && <p className="ok">{message}</p>}
      </section>
      {pending && (
        <Dialog
          title={`Replace ${profileName(pending.profile)}'s program?`}
          confirmLabel="Save program"
          onConfirm={() => {
            const next = pending;
            setPending(null);
            void onImport(next).then(() => {
              setMessage(`Saved “${next.program_name}” for ${profileName(next.profile)}. Past sessions stay in History.`);
              setText('');
            });
          }}
          onCancel={() => setPending(null)}
        >
          <p>
            {pending.program_name} · starts {pending.start_date} · {pending.days.length} days. Logged sessions stay in History.
          </p>
        </Dialog>
      )}
    </>
  );
}
