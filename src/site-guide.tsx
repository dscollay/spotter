import { useEffect } from 'react';
import { Fold, FrontTorso, SideTorso, ThighFigure } from './body-figure';
import type { SkinfoldSite } from './metrics';

type FoldName = 'vertical' | 'diagonal';
type Sex = 'male' | 'female';

const GUIDES: Record<SkinfoldSite, { name: string; fold: FoldName; landmark: string; female?: string }> = {
  chest: {
    name: 'Chest',
    fold: 'diagonal',
    landmark: 'Half the distance between the anterior axillary line and the nipple.',
    female: 'One-third of the distance between the anterior axillary line and the nipple.',
  },
  midaxillary: {
    name: 'Midaxillary',
    fold: 'vertical',
    landmark: 'On the midaxillary line, level with the xiphoid process.',
  },
  triceps: {
    name: 'Triceps',
    fold: 'vertical',
    landmark: 'Posterior midline of the upper arm, midway between the acromion and the olecranon.',
  },
  subscapular: {
    name: 'Subscapular',
    fold: 'diagonal',
    landmark: '1–2 cm below the inferior angle of the scapula.',
  },
  abdominal: {
    name: 'Abdominal',
    fold: 'vertical',
    landmark: '2 cm to the right of the umbilicus.',
  },
  suprailiac: {
    name: 'Suprailiac',
    fold: 'diagonal',
    landmark: 'Immediately above the iliac crest, in the anterior axillary line.',
  },
  thigh: {
    name: 'Thigh',
    fold: 'vertical',
    landmark: 'Anterior midline, midway between the proximal patella and the inguinal crease.',
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
        <Fold x={92} y={176} angle={90} />
      </SideTorso>
    );
  }
  if (site === 'thigh') {
    return (
      <ThighFigure>
        <Fold x={90} y={160} angle={90} />
      </ThighFigure>
    );
  }
  return (
    <FrontTorso>
      {site === 'chest' && <ChestMark sex={sex} />}
      {site === 'abdominal' && (
        <>
          <Fold x={228} y={469} angle={90} />
        </>
      )}
    </FrontTorso>
  );
}

function ChestMark({ sex }: { sex: Sex }) {
  const axilla = { x: 150, y: 328 };
  const nipple = { x: 177, y: 342 };
  const t = sex === 'female' ? 1 / 3 : 1 / 2;
  return <Fold x={axilla.x + (nipple.x - axilla.x) * t} y={axilla.y + (nipple.y - axilla.y) * t} angle={32} />;
}
