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
        <Fold x1={92} y1={132} x2={92} y2={162} />
      </SideTorso>
    );
  }
  if (site === 'thigh') {
    return (
      <ThighFigure>
        <Guide x1={78} y1={40} x2={78} y2={200} />
        <Fold x1={78} y1={108} x2={78} y2={138} />
        <Dot x={78} y={206} />
      </ThighFigure>
    );
  }
  return (
    <FrontTorso>
      {site === 'chest' && <ChestMark sex={sex} />}
      {site === 'abdominal' && (
        <>
          <Dot x={100} y={178} />
          <Fold x1={86} y1={164} x2={86} y2={194} />
        </>
      )}
      {site === 'suprailiac' && (
        <>
          <Guide x1={52} y1={200} x2={86} y2={214} />
          <Fold x1={58} y1={188} x2={78} y2={204} />
        </>
      )}
    </FrontTorso>
  );
}

function ChestMark({ sex }: { sex: Sex }) {
  const axilla = { x: 58, y: 112 };
  const nipple = { x: 82, y: 138 };
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
