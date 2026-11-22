import { useEffect } from 'react';
import type { SkinfoldSite } from './metrics';

type Fold = 'vertical' | 'diagonal';
type Sex = 'male' | 'female';

const GUIDES: Record<
  SkinfoldSite,
  { name: string; fold: Fold; view: 'front' | 'back'; landmark: string; female?: string; maleMark: Mark; femaleMark?: Mark }
> = {
  chest: {
    name: 'Chest',
    fold: 'diagonal',
    view: 'front',
    landmark: 'Halfway from the front of the armpit to the nipple.',
    female: 'One-third of the way from the front of the armpit to the nipple.',
    maleMark: { x: 62, y: 86 },
    femaleMark: { x: 56, y: 78 },
  },
  midaxillary: {
    name: 'Midaxillary',
    fold: 'vertical',
    view: 'front',
    landmark: 'On the midaxillary line, level with the xiphoid.',
    maleMark: { x: 46, y: 108 },
  },
  triceps: {
    name: 'Triceps',
    fold: 'vertical',
    view: 'back',
    landmark: 'Back midline of the upper arm, midway from shoulder to elbow.',
    maleMark: { x: 36, y: 102 },
  },
  subscapular: {
    name: 'Subscapular',
    fold: 'diagonal',
    view: 'back',
    landmark: '1–2 cm below the bottom tip of the shoulder blade.',
    maleMark: { x: 64, y: 108 },
  },
  abdominal: {
    name: 'Abdominal',
    fold: 'vertical',
    view: 'front',
    landmark: '2 cm to the right of the navel.',
    maleMark: { x: 70, y: 128 },
  },
  suprailiac: {
    name: 'Suprailiac',
    fold: 'diagonal',
    view: 'front',
    landmark: 'Just above the iliac crest, on the anterior axillary line.',
    maleMark: { x: 52, y: 144 },
  },
  thigh: {
    name: 'Thigh',
    fold: 'vertical',
    view: 'front',
    landmark: 'Front midline of the thigh, midway from hip crease to kneecap.',
    maleMark: { x: 68, y: 186 },
  },
};

type Mark = { x: number; y: number };

export function SitePopup({ site, sex, onClose }: { site: SkinfoldSite; sex: Sex; onClose: () => void }) {
  const guide = GUIDES[site];
  const mark = sex === 'female' && guide.femaleMark ? guide.femaleMark : guide.maleMark;
  const landmark = sex === 'female' && guide.female ? guide.female : guide.landmark;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog site-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="icon-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="site-title">{guide.name}</h2>
        <Figure view={guide.view} mark={mark} fold={guide.fold} />
        <p>
          {guide.fold === 'vertical' ? 'Vertical' : 'Diagonal'} fold. {landmark}
        </p>
      </div>
    </div>
  );
}

function Figure({ view, mark, fold }: { view: 'front' | 'back'; mark: Mark; fold: Fold }) {
  const angle = fold === 'vertical' ? 90 : -42;
  return (
    <svg className="figure" viewBox="0 0 160 240" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="80" cy="28" r="16" />
        <path d="M80 44v8" />
        <path d="M50 64h60l10 26-8 46-16 16H64l-16-16-8-46z" />
        <path d="M50 68 32 88l-8 44 14 4 12-38" />
        <path d="M110 68l18 20 8 44-14 4-12-38" />
        <path d="M64 152l-8 64h18l8-48" />
        <path d="M96 152l8 64H86l-8-48" />
      </g>
      {view === 'back' && (
        <g fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55">
          <path d="M70 74 58 98l16 8" />
          <path d="M90 74l12 24-16 8" />
        </g>
      )}
      {view === 'front' && <circle cx="80" cy="128" r="2" fill="currentColor" stroke="none" />}
      <g transform={`translate(${mark.x} ${mark.y}) rotate(${angle})`}>
        <line x1="-11" y1="0" x2="11" y2="0" stroke="var(--sage)" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
