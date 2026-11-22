import { useMemo, useState, type FormEvent } from 'react';
import type { Household } from '../dashboard';
import { formatNumber, localDateISO, profileName } from '../format';
import { kcalEstimate, weightForEstimate, type WeightSource } from '../metrics';
import type { Activity, ActivityKind, ProfileId } from '../types';
import { ACTIVITY_KINDS, ACTIVITY_LABELS } from '../types';

export function ActivityScreen({
  profile,
  household,
  defaults,
  onSave,
  onDelete,
  onDefault,
  onSwitch,
}: {
  profile: ProfileId;
  household: Household;
  defaults: Record<ProfileId, number>;
  onSave: (row: Activity) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDefault: (kg: number) => Promise<void>;
  onSwitch: () => void;
}) {
  const weight = weightForEstimate(profile, household.weights, defaults);
  const [kind, setKind] = useState<ActivityKind>('treadmill');
  const [date, setDate] = useState(localDateISO());
  const [minutes, setMinutes] = useState('');
  const [distance, setDistance] = useState('');
  const [incline, setIncline] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [fallback, setFallback] = useState(String(defaults[profile]));
  const [note, setNote] = useState('');
  const rows = useMemo(
    () => household.activities.filter((row) => row.profile === profile).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [household.activities, profile],
  );
  const draft = draftEffort(kind, minutes, distance, incline);
  const preview = draft ? kcalEstimate(draft, weight.kg) : null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) {
      setNote('Enter the minutes. Distance and incline are optional.');
      return;
    }
    const existing = editing ? rows.find((row) => row.id === editing) : undefined;
    await onSave({
      id: editing ?? crypto.randomUUID(),
      profile,
      date,
      kind,
      minutes: draft.minutes,
      distanceKm: draft.distanceKm ?? null,
      inclinePct: draft.inclinePct ?? null,
      avgHr: existing?.avgHr ?? null,
      level: existing?.level ?? '',
      effort: existing?.effort ?? null,
      note: existing?.note ?? '',
    });
    setEditing(null);
    setMinutes('');
    setDistance('');
    setIncline('');
    setNote('Activity saved.');
  }

  return (
    <>
      <p className="wordmark brand">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={36} height={36} />
        Spotter
      </p>
      <div className="profile-row">
        <h1>{profileName(profile)}</h1>
        <button type="button" className="secondary compact" onClick={onSwitch}>
          Switch
        </button>
      </div>
      <section className="card" id="activity-tab">
        <p className="eyebrow">Activity</p>
        <WeightLine
          weight={weight}
          fallback={fallback}
          onFallback={setFallback}
          onSave={async () => {
            const kg = Number(fallback);
            if (!Number.isFinite(kg) || kg <= 0) {
              setNote('Enter a weight in kg.');
              return;
            }
            await onDefault(Math.round(kg * 10) / 10);
            setNote('Default weight saved.');
          }}
        />
        <form onSubmit={(event) => void save(event)}>
          <label className="field">
            <span>Type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as ActivityKind)}>
              {ACTIVITY_KINDS.map((id) => (
                <option key={id} value={id}>
                  {ACTIVITY_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="field">
            <span>Minutes</span>
            <input inputMode="decimal" value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
          </label>
          <label className="field">
            <span>Distance km</span>
            <input inputMode="decimal" value={distance} onChange={(event) => setDistance(event.target.value)} />
          </label>
          <label className="field">
            <span>Incline %</span>
            <input inputMode="decimal" value={incline} onChange={(event) => setIncline(event.target.value)} />
          </label>
          {preview != null && (
            <p className="estimate" id="kcal-preview">
              Estimate {formatNumber(preview)} kcal
              {draft && draft.inclinePct != null && draft.distanceKm != null && (kind === 'treadmill' || kind === 'walk' || kind === 'run')
                ? ' · ACSM'
                : ''}
            </p>
          )}
          <button type="submit" className="primary">
            Save activity
          </button>
        </form>
        {note && <p className="ok">{note}</p>}
        <ul className="plain">
          {rows.map((row) => (
            <li key={row.id} className="row">
              <p>
                {ACTIVITY_LABELS[row.kind]} · {formatNumber(row.minutes)} min · estimate {formatNumber(kcalEstimate(row, weight.kg))} kcal
              </p>
              <span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setEditing(row.id);
                    setKind(row.kind);
                    setDate(row.date);
                    setMinutes(String(row.minutes));
                    setDistance(row.distanceKm == null ? '' : String(row.distanceKm));
                    setIncline(row.inclinePct == null ? '' : String(row.inclinePct));
                  }}
                >
                  Edit
                </button>
                <button type="button" className="text-button" onClick={() => void onDelete(row.id)}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function WeightLine({
  weight,
  fallback,
  onFallback,
  onSave,
}: {
  weight: WeightSource;
  fallback: string;
  onFallback: (value: string) => void;
  onSave: () => Promise<void>;
}) {
  if (weight.source === 'weigh-in') {
    return <p className="muted">Using last weigh-in, {formatNumber(weight.kg)} kg. The calorie number is an estimate.</p>;
  }
  return (
    <div>
      <p className="muted">No weigh-in on this phone. Using {formatNumber(weight.kg)} kg as the default. The calorie number is an estimate.</p>
      <label className="field">
        <span>Default weight kg</span>
        <input inputMode="decimal" value={fallback} onChange={(event) => onFallback(event.target.value)} />
      </label>
      <button type="button" className="secondary" onClick={() => void onSave()}>
        Save default weight
      </button>
    </div>
  );
}

function draftEffort(kind: ActivityKind, minutes: string, distance: string, incline: string) {
  const duration = Number(minutes);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const km = distance.trim() === '' ? null : Number(distance);
  const grade = incline.trim() === '' ? null : Number(incline);
  if (km != null && (!Number.isFinite(km) || km < 0)) return null;
  if (grade != null && (!Number.isFinite(grade) || grade < 0 || grade > 40)) return null;
  return { kind, minutes: duration, distanceKm: km, inclinePct: grade };
}
