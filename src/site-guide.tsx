import { useEffect } from 'react';
import { Dot, Fold, FrontTorso, Guide, SideTorso, ThighFigure } from './body-figure';
import type { SkinfoldSite } from './metrics';

type FoldName = 'vertical' | 'diagonal';
type Sex = 'male' | 'female';

const GUIDES: Record<SkinfoldSite, { name: string; fold: FoldName; landmark: string; female?: string }> = {
  chest: {
    name: 'Chest',
    fold: 'diagonal',
    landmark: 'Halfway from the front of the armpit to the nipple.',
    female: 'One-third of the way from the front of the armpit to the nipple.',
  },
  midaxillary: {
    name: 'Midaxillary',
    fold: 'vertical',
    landmark: 'On the midaxillary line, level with the xiphoid.',
  },
  triceps: {
    name: 'Triceps',
    fold: 'vertical',
    landmark: 'Back midline of the upper arm, midway from shoulder to elbow.',
  },
  subscapular: {
    name: 'Subscapular',
    fold: 'diagonal',
    landmark: '1–2 cm below the bottom tip of the shoulder blade.',
  },
  abdominal: {
    name: 'Abdominal',
    fold: 'vertical',
    landmark: '2 cm to the right of the navel.',
  },
  suprailiac: {
    name: 'Suprailiac',
    fold: 'diagonal',
    landmark: 'Just above the iliac crest, on the anterior axillary line.',
  },
  thigh: {
    name: 'Thigh',
    fold: 'vertical',
    landmark: 'Front midline of the thigh, midway from hip crease to kneecap.',
  },
};

const PHOTOS: Partial<Record<SkinfoldSite, { file: string; credit: string }>> = {
  triceps: {
    file: 'skinfolds/triceps.jpg',
    credit: 'NHANES Anthropometry Procedures Manual, 2007, Exhibit 3-13. Public domain, CDC.',
  },
  subscapular: {
    file: 'skinfolds/subscapular.jpg',
    credit: 'NHANES Anthropometry Procedures Manual, 2007, Exhibit 3-16. Public domain, CDC.',
  },
  suprailiac: {
    file: 'skinfolds/suprailiac.jpg',
    credit: 'NHANES III Anthropometry Manual, 1988, Exhibit 3-10. Public domain, CDC.',
  },
};

export function SitePopup({ site, sex, onClose }: { site: SkinfoldSite; sex: Sex; onClose: () => void }) {
  const guide = GUIDES[site];
  const photo = PHOTOS[site];
  const landmark = sex === 'female' && guide.female ? guide.female : guide.landmark;
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop site-backdrop" onClick={onClose}>
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
        {photo ? (
          <img className="site-photo" src={`${import.meta.env.BASE_URL}${photo.file}`} alt="" />
        ) : (
          <SiteFigure site={site} sex={sex} />
        )}
        <p>
          {guide.fold === 'vertical' ? 'Vertical' : 'Diagonal'} fold. {landmark}
        </p>
        {photo && <p className="credit">{photo.credit}</p>}
      </div>
    </div>
  );
}

function SiteFigure({ site, sex }: { site: SkinfoldSite; sex: Sex }) {
  if (site === 'midaxillary') {
    return (
      <SideTorso>
        <Fold x1={78} y1={148} x2={78} y2={178} />
      </SideTorso>
    );
  }
  if (site === 'thigh') {
    return (
      <ThighFigure>
        <Guide x1={71} y1={44} x2={71} y2={228} />
        <Fold x1={71} y1={120} x2={71} y2={150} />
        <Dot x={71} y={236} />
      </ThighFigure>
    );
  }
  return (
    <FrontTorso>
      {site === 'chest' && <ChestMark sex={sex} />}
      {site === 'abdominal' && (
        <>
          <Dot x={100} y={214} />
          <Fold x1={88} y1={200} x2={88} y2={228} />
        </>
      )}
    </FrontTorso>
  );
}

function ChestMark({ sex }: { sex: Sex }) {
  const axilla = { x: 46, y: 150 };
  const nipple = { x: 78, y: 168 };
  const t = sex === 'female' ? 1 / 3 : 1 / 2;
  const x = axilla.x + (nipple.x - axilla.x) * t;
  const y = axilla.y + (nipple.y - axilla.y) * t;
  const dx = 12;
  const dy = 10;
  return (
    <>
      <Guide x1={axilla.x} y1={axilla.y} x2={nipple.x} y2={nipple.y} />
      <Dot x={nipple.x} y={nipple.y} />
      <Fold x1={x - dx} y1={y - dy} x2={x + dx} y2={y + dy} />
    </>
  );
}
