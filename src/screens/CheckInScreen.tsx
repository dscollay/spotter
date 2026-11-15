import { useState } from 'react';
import type { CheckIn } from '../types';

const SCALES: { key: keyof CheckIn; label: string; hint: string }[] = [
  { key: 'sleep', label: 'Sleep', hint: '1 poor, 5 great' },
  { key: 'energy', label: 'Energy', hint: '1 drained, 5 ready' },
  { key: 'soreness', label: 'Soreness', hint: '1 none, 5 a lot' },
];

export function CheckInScreen({
  dayName,
  warmup,
  onBegin,
  onBack,
}: {
  dayName: string;
  warmup?: string;
  onBegin: (checkIn: CheckIn) => void;
  onBack: () => void;
}) {
  const [scores, setScores] = useState<Partial<CheckIn>>({});
  const ready = scores.sleep != null && scores.energy != null && scores.soreness != null;
  return (
    <>
      <p className="wordmark">Spotter</p>
      <h1>Before {dayName}</h1>
      <p className="lede">A quick check-in, saved with this session.</p>
      {warmup && (
        <section className="soft">
          <p className="eyebrow">Warmup</p>
          <p>{warmup}</p>
        </section>
      )}
      {SCALES.map((scale) => (
        <fieldset className="field" key={scale.key}>
          <legend>
            <strong>{scale.label}</strong> <span className="muted">{scale.hint}</span>
          </legend>
          <div className="scale" role="group" aria-label={scale.label}>
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                aria-pressed={scores[scale.key] === score}
                onClick={() => setScores((current) => ({ ...current, [scale.key]: score }))}
              >
                {score}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="stack">
        <button
          type="button"
          className="primary"
          disabled={!ready}
          onClick={() => {
            if (!ready || scores.sleep == null || scores.energy == null || scores.soreness == null) return;
            onBegin({ sleep: scores.sleep, energy: scores.energy, soreness: scores.soreness });
          }}
        >
          Start workout
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          Not yet
        </button>
      </div>
    </>
  );
}
