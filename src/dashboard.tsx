import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { formatClock, formatLoad, formatNumber, formatWhen, localDateISO, profileName } from './format';
import { activityTotals, deloadPhrase, inWeek, weekStart, weightForEstimate } from './metrics';
import { completedProgramSessions } from './program';
import { SitePopup } from './site-guide';
import {
  SKINFOLD_SITES,
  TAPE_SITES,
  bodyFatEstimate,
  checkDue,
  exerciseNames,
  familyWeek,
  parseGarminWeightCsv,
  personalBests,
  readiness,
  skinfoldSum,
  strengthSeries,
  waistHip,
  weighInId,
  withinRange,
  type SkinfoldSite,
  type TapeSite,
  type TrendRange,
} from './metrics';
import { Sparkline } from './spark';
import type { Activity, ProfileId, Program, Session, Skinfold, Tape, WeighIn } from './types';
import { PROFILE_IDS } from './types';

export type Household = {
  sessions: Session[];
  weights: WeighIn[];
  skinfolds: Skinfold[];
  tapes: Tape[];
  activities: Activity[];
};

export type Save = {
  weight: (row: WeighIn) => Promise<void>;
  deleteWeight: (id: string) => Promise<void>;
  skinfold: (row: Skinfold) => Promise<void>;
  deleteSkinfold: (id: string) => Promise<void>;
  tape: (row: Tape) => Promise<void>;
  deleteTape: (id: string) => Promise<void>;
  activity: (row: Activity) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
};

const RANGES: { id: TrendRange; label: string }[] = [
  { id: '4w', label: '4 weeks' },
  { id: '3m', label: '3 months' },
  { id: 'all', label: 'All time' },
];

export function Dashboard({
  profile,
  program,
  household,
  defaults,
  save,
}: {
  profile: ProfileId;
  program: Program | null;
  household: Household;
  defaults: Record<ProfileId, number>;
  save: Save;
}) {
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<TrendRange>('4w');
  const tone = `who-${profile}`;
  const ready = readiness(household.sessions, profile, now);
  const sleepFrom = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const sleepTrend = household.sessions
    .filter((session) => {
      if (session.profile !== profile) return false;
      const time = new Date(session.startedAt).getTime();
      return time >= sleepFrom && time <= now.getTime() + 60_000;
    })
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => session.checkIn.sleep);
  const week = familyWeek(household, now);
  const showBody = profile !== 'audrey';
  const done = program
    ? completedProgramSessions(
        program,
        household.sessions.filter((session) => session.profile === profile),
      ).length
    : 0;
  const total = program?.sessions_before_new_program ?? 0;
  const phrase = program ? deloadPhrase(program, done) : null;
  return (
    <>
      <section className="card" id="block-progress">
        <p className="eyebrow">Block</p>
        {program ? (
          <>
            <p className={`big ${tone}`}>
              {done}
              <span> of {total}</span>
            </p>
            <p>
              Session {done} of {total}
            </p>
            {phrase && <p>{phrase}</p>}
            {done >= total && total > 0 && <p className="due">New program due</p>}
          </>
        ) : (
          <p>No program on this phone yet.</p>
        )}
      </section>
      <section className={ready.easeOff ? 'card ease-card' : 'card'} id="readiness">
        <p className="eyebrow">Readiness</p>
        {ready.count === 0 ? (
          <p>No check-ins in the last 7 days.</p>
        ) : (
          <>
            <p className={`big ${tone}`}>
              {formatNumber(Math.round((ready.sleep ?? 0) * 10) / 10)}
              <span> sleep</span>
            </p>
            <Sparkline values={sleepTrend} />
            <p className="muted">
              7-day average · energy {formatNumber(Math.round((ready.energy ?? 0) * 10) / 10)} · soreness{' '}
              {formatNumber(Math.round((ready.soreness ?? 0) * 10) / 10)} · {ready.count} check-ins
            </p>
            {ready.easeOff && <p className="due">Consider easing off</p>}
          </>
        )}
      </section>
      <section className="card" id="family-week">
        <p className="eyebrow">This week</p>
        {week.length === 0 ? (
          <p>No logs on this phone yet.</p>
        ) : (
          <ul className="plain">
            {week.map((row) => (
              <li key={row.profile}>
                <p>
                  <strong className={`who-${row.profile}`}>{profileName(row.profile)}</strong> · {row.strength} strength ·{' '}
                  {formatNumber(row.minutes)} min
                </p>
                <p className="muted">Guide {row.guide}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="choice range" role="group" aria-label="Trend range">
        {RANGES.map((item) => (
          <button key={item.id} type="button" className="secondary" aria-pressed={range === item.id} onClick={() => setRange(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {showBody && (
        <BodySection profile={profile} household={household} range={range} now={now} tone={tone} save={save} />
      )}
      <ActivitySummary profile={profile} household={household} defaults={defaults} range={range} now={now} />
      <StrengthSection profile={profile} sessions={household.sessions} range={range} now={now} tone={tone} />
      <BestsSection profile={profile} sessions={household.sessions} />
      <LogBook profile={profile} household={household} save={save} showBody={showBody} />
    </>
  );
}

function BodySection({
  profile,
  household,
  range,
  now,
  tone,
  save,
}: {
  profile: ProfileId;
  household: Household;
  range: TrendRange;
  now: Date;
  tone: string;
  save: Save;
}) {
  const mine = {
    weights: household.weights.filter((row) => row.profile === profile && withinRange(row.at, range, now)),
    skinfolds: household.skinfolds.filter((row) => row.profile === profile && withinRange(row.at, range, now)),
    tapes: household.tapes.filter((row) => row.profile === profile && withinRange(row.at, range, now)),
  };
  const latestWeight = newest(mine.weights);
  const latestFold = newest(mine.skinfolds);
  const latestTape = newest(mine.tapes);
  const foldSum = latestFold ? skinfoldSum(latestFold) : null;
  const fat = latestFold ? bodyFatEstimate(latestFold) : null;
  const ratio = latestTape ? waistHip(latestTape) : null;
  const other = profile === 'dan' ? 'bonnie' : 'dan';
  const otherWeight = newest(household.weights.filter((row) => row.profile === other));
  const otherFold = newest(household.skinfolds.filter((row) => row.profile === other));
  const otherTape = newest(household.tapes.filter((row) => row.profile === other));
  const skinfoldDue = checkDue(
    household.skinfolds.filter((row) => row.profile === profile).map((row) => row.at),
    now,
  );
  const tapeDue = checkDue(
    household.tapes.filter((row) => row.profile === profile).map((row) => row.at),
    now,
  );
  return (
    <section id="body-comp">
      <h2>Body</h2>
      {skinfoldDue && <p className="note">Skinfold check is due. About every 4 weeks.</p>}
      {tapeDue && <p className="note">Tape check is due. About every 4 weeks.</p>}
      <article className="card">
        <p className="eyebrow">Weight</p>
        <p className={`big ${tone}`}>
          {latestWeight ? formatNumber(latestWeight.kg) : '—'}
          <span> kg</span>
        </p>
        <Sparkline values={chronological(mine.weights).map((row) => row.kg)} />
        <EntryList
          rows={chronological(mine.weights)
            .reverse()
            .map((row) => ({
              id: row.id,
              label: `${formatNumber(row.kg)} kg · ${formatWhen(row.at)} ${formatClock(row.at)}`,
            }))}
          onDelete={save.deleteWeight}
        />
      </article>
      <article className="card">
        <p className="eyebrow">Skinfolds</p>
        <p className={`big ${tone}`}>
          {foldSum == null ? '—' : formatNumber(Math.round(foldSum * 10) / 10)}
          <span> mm</span>
        </p>
        <p className="muted">7-site sum</p>
        {fat != null && <p className="estimate">Estimate {formatNumber(fat)}% · Jackson-Pollock 7-site</p>}
        {latestFold && fat == null && <p className="muted">Add an age on the entry to show the Jackson-Pollock estimate.</p>}
        <Sparkline values={chronological(mine.skinfolds).map((row) => skinfoldSum(row))} />
        <EntryList
          rows={chronological(mine.skinfolds)
            .reverse()
            .map((row) => ({
              id: row.id,
              label: `${formatNumber(Math.round(skinfoldSum(row) * 10) / 10)} mm · ${formatWhen(row.at)}`,
            }))}
          onDelete={save.deleteSkinfold}
        />
      </article>
      <article className="card">
        <p className="eyebrow">Tape</p>
        <p className={`big ${tone}`}>
          {ratio == null ? '—' : formatNumber(ratio)}
          <span> waist / hip</span>
        </p>
        {latestTape && (
          <p className="muted">
            Waist {formatNumber(latestTape.waist)} cm · hips {formatNumber(latestTape.hips)} cm
          </p>
        )}
        <Sparkline values={chronological(mine.tapes).map((row) => row.waist)} />
        <EntryList
          rows={chronological(mine.tapes)
            .reverse()
            .map((row) => ({
              id: row.id,
              label: `Waist ${formatNumber(row.waist)} cm · ${formatWhen(row.at)}`,
            }))}
          onDelete={save.deleteTape}
        />
      </article>
      {(otherWeight || otherFold || otherTape) && (
        <article className="card">
          <p className="eyebrow">On this phone</p>
          <p>
            <strong className={`who-${other}`}>{profileName(other)}</strong>
          </p>
          {otherWeight && <p>{formatNumber(otherWeight.kg)} kg</p>}
          {otherFold && (
            <p>
              {formatNumber(Math.round(skinfoldSum(otherFold) * 10) / 10)} mm sum
              {bodyFatEstimate(otherFold) != null && (
                <span className="estimate"> · Estimate {formatNumber(bodyFatEstimate(otherFold) ?? 0)}%</span>
              )}
            </p>
          )}
          {otherTape && waistHip(otherTape) != null && <p>Waist / hip {formatNumber(waistHip(otherTape) ?? 0)}</p>}
        </article>
      )}
    </section>
  );
}

function ActivitySummary({
  profile,
  household,
  defaults,
  range,
  now,
}: {
  profile: ProfileId;
  household: Household;
  defaults: Record<ProfileId, number>;
  range: TrendRange;
  now: Date;
}) {
  const people = PROFILE_IDS.filter((id) => id === profile || household.activities.some((row) => row.profile === id));
  const rangeLabel = range === '4w' ? '4 weeks' : range === '3m' ? '3 months' : 'All time';
  const start = weekStart(now);
  return (
    <section className="card" id="activity-summary">
      <p className="eyebrow">Activity</p>
      {people.map((id) => {
        const kg = weightForEstimate(id, household.weights, defaults).kg;
        const week = activityTotals(household.activities, id, (row) => inWeek(row.date, start), kg);
        const span = activityTotals(household.activities, id, (row) => withinRange(row.date, range, now), kg);
        return (
          <div key={id}>
            <p>
              <strong className={`who-${id}`}>{profileName(id)}</strong>
            </p>
            <p>
              This week · {week.sessions} {week.sessions === 1 ? 'session' : 'sessions'} · {formatNumber(week.minutes)} min · estimate{' '}
              {formatNumber(week.kcal)} kcal
            </p>
            <p>
              {rangeLabel} · {span.sessions} {span.sessions === 1 ? 'session' : 'sessions'} · {formatNumber(span.minutes)} min · estimate{' '}
              {formatNumber(span.kcal)} kcal
            </p>
          </div>
        );
      })}
    </section>
  );
}

function StrengthSection({
  profile,
  sessions,
  range,
  now,
  tone,
}: {
  profile: ProfileId;
  sessions: Session[];
  range: TrendRange;
  now: Date;
  tone: string;
}) {
  const names = exerciseNames(sessions, profile);
  const [picked, setPicked] = useState('');
  const selected = names.includes(picked) ? picked : (names.find((name) => /deadlift/i.test(name)) ?? names[0] ?? '');
  const points = strengthSeries(sessions, profile, selected).filter((point) => withinRange(point.at, range, now));
  const latest = points.at(-1);
  const values = chartValues(points);
  return (
    <section className="card" id="strength-trend">
      <p className="eyebrow">Strength</p>
      {names.length === 0 ? (
        <p>No completed sets yet.</p>
      ) : (
        <>
          <label className="field">
            <span>Exercise</span>
            <select value={selected} onChange={(event) => setPicked(event.target.value)}>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className={`big ${tone}`}>{latest ? pointLabel(latest) : '—'}</p>
          <Sparkline values={values} />
        </>
      )}
    </section>
  );
}

function BestsSection({ profile, sessions }: { profile: ProfileId; sessions: Session[] }) {
  const bests = personalBests(sessions, profile).slice(0, 12);
  return (
    <section className="card" id="personal-bests">
      <p className="eyebrow">Personal bests</p>
      {bests.length === 0 ? (
        <p>No bests yet.</p>
      ) : (
        <ul className="plain">
          {bests.map((best) => (
            <li key={`${best.exercise}-${best.kind}-${best.unit ?? ''}`}>
              <p>
                {best.exercise} · {bestLabel(best)}
                {best.fresh && <span className="fresh"> · New</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function bestLabel(best: { kind: 'load' | 'reps' | 'hold'; value: number; unit?: 'kg' | 'lb' }): string {
  if (best.kind === 'load') return formatLoad(best.value, best.unit ?? 'kg');
  if (best.kind === 'hold') return `${formatNumber(best.value)} sec`;
  return `${formatNumber(best.value)} reps`;
}

function pointLabel(point: { load: number | null; unit: 'kg' | 'lb' | null; reps: number | null; workSec: number | null; bodyweight: boolean }): string {
  if (point.bodyweight || (point.load != null && point.load > 0)) {
    const load = formatLoad(point.load, point.unit ?? 'kg', point.bodyweight);
    if (load) return load;
  }
  if (point.workSec != null) return `${formatNumber(point.workSec)} sec`;
  if (point.reps != null) return `${formatNumber(point.reps)} reps`;
  return 'Logged';
}

function chartValues(points: { load: number | null; reps: number | null; workSec: number | null }[]): number[] {
  if (points.some((point) => (point.load ?? 0) > 0)) return points.map((point) => point.load ?? 0);
  if (points.some((point) => point.workSec != null)) return points.map((point) => point.workSec ?? 0);
  return points.map((point) => point.reps ?? 0);
}

function LogBook({ profile, household, save, showBody }: { profile: ProfileId; household: Household; save: Save; showBody: boolean }) {
  const logRef = useRef<HTMLDetailsElement>(null);
  const [note, setNote] = useState('');
  const [weightId, setWeightId] = useState<string | null>(null);
  const [weighedAt, setWeighedAt] = useState(localInput(new Date().toISOString()));
  const [kg, setKg] = useState('');
  const [foldId, setFoldId] = useState<string | null>(null);
  const [foldDate, setFoldDate] = useState(localDateISO());
  const [age, setAge] = useState('');
  const [sites, setSites] = useState<Record<SkinfoldSite, string>>(emptySites());
  const [tapeId, setTapeId] = useState<string | null>(null);
  const [tapeDate, setTapeDate] = useState(localDateISO());
  const [tape, setTape] = useState<Record<TapeSite, string>>(emptyTape());

  async function onWeight(event: FormEvent) {
    event.preventDefault();
    const amount = Number(kg);
    const at = new Date(weighedAt).toISOString();
    if (!weighedAt || !Number.isFinite(new Date(weighedAt).getTime()) || !Number.isFinite(amount) || amount <= 0) {
      setNote('Enter a time and a weight in kg.');
      return;
    }
    const id = weighInId(profile, at);
    if (weightId && weightId !== id) await save.deleteWeight(weightId);
    await save.weight({ id, profile, at, kg: Math.round(amount * 100) / 100 });
    setWeightId(null);
    setKg('');
    setNote('Weigh-in saved.');
  }

  async function onCsv(file: File) {
    const parsed = parseGarminWeightCsv(await file.text());
    if (parsed.error) {
      setNote(parsed.error);
      return;
    }
    let added = 0;
    let kept = 0;
    for (const row of parsed.rows) {
      const id = weighInId(profile, row.at);
      if (household.weights.some((item) => item.id === id)) kept += 1;
      else added += 1;
      await save.weight({ id, profile, at: row.at, kg: row.kg });
    }
    const unit = parsed.unit === 'lb' ? 'Pounds in the file were converted to kg. ' : '';
    setNote(`${unit}Imported ${added} weigh-in${added === 1 ? '' : 's'}. ${kept} already on this phone.`);
  }

  async function onFold(event: FormEvent) {
    event.preventDefault();
    const readings = {} as Record<SkinfoldSite, number>;
    for (const [site] of SKINFOLD_SITES) {
      const value = Number(sites[site]);
      if (!Number.isFinite(value) || value < 0) {
        setNote('Enter each skinfold site in mm.');
        return;
      }
      readings[site] = value;
    }
    const years = age.trim() === '' ? null : Number(age);
    if (years != null && (!Number.isInteger(years) || years < 1 || years > 120)) {
      setNote('Age needs to be a whole number, or leave it blank.');
      return;
    }
    const row: Skinfold = {
      id: foldId ?? crypto.randomUUID(),
      profile,
      at: noon(foldDate),
      age: years,
      ...readings,
    };
    await save.skinfold(row);
    setFoldId(null);
    setSites(emptySites());
    setAge('');
    setNote('Skinfolds saved.');
  }

  async function onTape(event: FormEvent) {
    event.preventDefault();
    const readings = {} as Record<TapeSite, number>;
    for (const [site] of TAPE_SITES) {
      const value = Number(tape[site]);
      if (!Number.isFinite(value) || value <= 0) {
        setNote('Enter each tape site in cm.');
        return;
      }
      readings[site] = value;
    }
    await save.tape({
      id: tapeId ?? crypto.randomUUID(),
      profile,
      at: noon(tapeDate),
      ...readings,
    });
    setTapeId(null);
    setTape(emptyTape());
    setNote('Tape saved.');
  }

  return (
    <details className="card" id="log-book" ref={logRef}>
      <summary>Add or edit an entry</summary>
      {note && <p className="ok">{note}</p>}
      {showBody && (
        <>
          <form onSubmit={(event) => void onWeight(event)}>
            <h3>Weight</h3>
            <Field label="Weighed at">
              <input type="datetime-local" value={weighedAt} onChange={(event) => setWeighedAt(event.target.value)} required />
            </Field>
            <Field label="Weight kg">
              <input inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} required />
            </Field>
            <button type="submit" className="primary">
              Save weigh-in
            </button>
            <Field label="Garmin weight CSV">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void onCsv(file);
                }}
              />
            </Field>
            <p className="muted">From Garmin Connect: Reports, Weight, Export. The same file can be imported again.</p>
            <EditRow
              rows={household.weights.filter((row) => row.profile === profile)}
              label={(row) => `${formatNumber(row.kg)} kg · ${formatWhen(row.at)}`}
              onEdit={(row) => {
                if (logRef.current) logRef.current.open = true;
                setWeightId(row.id);
                setWeighedAt(localInput(row.at));
                setKg(String(row.kg));
              }}
              onDelete={save.deleteWeight}
            />
          </form>
          <form onSubmit={(event) => void onFold(event)}>
            <h3>Skinfolds</h3>
            <Field label="Skinfold date">
              <input type="date" value={foldDate} onChange={(event) => setFoldDate(event.target.value)} required />
            </Field>
            <div className="sites">
              {SKINFOLD_SITES.map(([site, label]) => (
                <SiteField
                  key={site}
                  site={site}
                  label={label}
                  sex={profile === 'bonnie' ? 'female' : 'male'}
                  value={sites[site]}
                  onChange={(value) => setSites((current) => ({ ...current, [site]: value }))}
                />
              ))}
            </div>
            <Field label="Age for the estimate">
              <input inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} />
            </Field>
            <p className="muted">The sum in mm is the record. Percent is a Jackson-Pollock 7-site estimate and needs an age.</p>
            <button type="submit" className="primary">
              Save skinfolds
            </button>
            <EditRow
              rows={household.skinfolds.filter((row) => row.profile === profile)}
              label={(row) => `${formatNumber(Math.round(skinfoldSum(row) * 10) / 10)} mm · ${formatWhen(row.at)}`}
              onEdit={(row) => {
                if (logRef.current) logRef.current.open = true;
                setFoldId(row.id);
                setFoldDate(localDateISO(new Date(row.at)));
                setAge(row.age == null ? '' : String(row.age));
                setSites({
                  chest: String(row.chest),
                  midaxillary: String(row.midaxillary),
                  triceps: String(row.triceps),
                  subscapular: String(row.subscapular),
                  abdominal: String(row.abdominal),
                  suprailiac: String(row.suprailiac),
                  thigh: String(row.thigh),
                });
              }}
              onDelete={save.deleteSkinfold}
            />
          </form>
          <form onSubmit={(event) => void onTape(event)}>
            <h3>Tape</h3>
            <Field label="Tape date">
              <input type="date" value={tapeDate} onChange={(event) => setTapeDate(event.target.value)} required />
            </Field>
            <div className="sites">
              {TAPE_SITES.map(([site, label]) => (
                <Field key={site} label={`${label} cm`}>
                  <input inputMode="decimal" value={tape[site]} onChange={(event) => setTape((current) => ({ ...current, [site]: event.target.value }))} />
                </Field>
              ))}
            </div>
            <button type="submit" className="primary">
              Save tape
            </button>
            <EditRow
              rows={household.tapes.filter((row) => row.profile === profile)}
              label={(row) => `Waist ${formatNumber(row.waist)} cm · ${formatWhen(row.at)}`}
              onEdit={(row) => {
                if (logRef.current) logRef.current.open = true;
                setTapeId(row.id);
                setTapeDate(localDateISO(new Date(row.at)));
                setTape({
                  waist: String(row.waist),
                  hips: String(row.hips),
                  chest: String(row.chest),
                  arm: String(row.arm),
                  thigh: String(row.thigh),
                });
              }}
              onDelete={save.deleteTape}
            />
          </form>
        </>
      )}
    </details>
  );
}

function SiteField({
  site,
  label,
  sex,
  value,
  onChange,
}: {
  site: SkinfoldSite;
  label: string;
  sex: 'male' | 'female';
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = `site-${site}`;
  return (
    <div className="field">
      <span className="site-label">
        <label htmlFor={id}>{label} mm</label>
        <button type="button" className="info" aria-label={`${label} site`} onClick={() => setOpen(true)}>
          i
        </button>
      </span>
      <input id={id} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
      {open && <SitePopup site={site} sex={sex} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EntryList({ rows, onDelete }: { rows: { id: string; label: string }[]; onDelete: (id: string) => Promise<void> }) {
  if (rows.length === 0) return null;
  return (
    <ul className="plain">
      {rows.map((row) => (
        <li key={row.id} className="row">
          <p>{row.label}</p>
          <button type="button" className="text-button" onClick={() => void onDelete(row.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

function EditRow<T extends { id: string }>({
  rows,
  label,
  onEdit,
  onDelete,
}: {
  rows: T[];
  label: (row: T) => string;
  onEdit: (row: T) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className="plain">
      {rows.map((row) => (
        <li key={row.id} className="row">
          <p>{label(row)}</p>
          <span>
            <button type="button" className="text-button" onClick={() => onEdit(row)}>
              Edit
            </button>
            <button type="button" className="text-button" onClick={() => void onDelete(row.id)}>
              Delete
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function emptySites(): Record<SkinfoldSite, string> {
  return { chest: '', midaxillary: '', triceps: '', subscapular: '', abdominal: '', suprailiac: '', thigh: '' };
}

function emptyTape(): Record<TapeSite, string> {
  return { waist: '', hips: '', chest: '', arm: '', thigh: '' };
}

function noon(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, 12, 0, 0, 0).toISOString();
}

function localInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function newest<T extends { at: string }>(rows: T[]): T | null {
  return chronological(rows).at(-1) ?? null;
}

function chronological<T extends { at: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.at.localeCompare(b.at));
}

