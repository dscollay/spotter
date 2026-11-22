import type { ReactNode } from 'react';
import { NHANES_ARM } from './nhanes-arm';
import { NHANES_FRONT } from './nhanes-front';

const ink = '#1a1a1a';
const mark = '#1f8f86';

/** NHANES III Exhibit 3-10, with the printed suprailiac hatch removed from the tracing. */
export function FrontTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 491 760" aria-hidden="true">
      <rect width="491" height="760" fill="#fff" />
      <path d={NHANES_FRONT} fill="none" stroke={ink} strokeWidth="1.15" />
      {children}
    </svg>
  );
}

/** The same front figure with the right arm raised, so the midaxillary line is clear. */
export function ArmRaised({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 491 760" aria-hidden="true">
      <rect width="491" height="760" fill="#fff" />
      <path d={NHANES_ARM} fill="none" stroke={ink} strokeWidth="1.15" />
      {children}
    </svg>
  );
}

/**
 * The NHANES front figure from the waist down, with the legs continued in the
 * same line weight. Subject's right thigh is on the viewer's left.
 */
export function ThighFigure({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 400 491 700" aria-hidden="true">
      <rect x="0" y="400" width="491" height="700" fill="#fff" />
      <path d={NHANES_FRONT} fill="none" stroke={ink} strokeWidth="1.15" />
      <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M149 520 C148.5 540 147.5 600 146 640 C144.5 680 139.7 716.7 140 760 C140.3 803.3 145.3 856.7 148 900 C150.7 943.3 154.7 1000 156 1020" />
        <path d="M214 760 C212 780 205 836.7 202 880 C199 923.3 197 996.7 196 1020" />
        <path d="M351 520 C351.5 540 352.5 600 354 640 C355.5 680 360.3 716.7 360 760 C359.7 803.3 354.7 856.7 352 900 C349.3 943.3 345.3 1000 344 1020" />
        <path d="M286 760 C288 780 295 836.7 298 880 C301 923.3 303 996.7 304 1020" />
        <path d="M158 650 C161.7 648.3 173 636.7 180 640 C187 643.3 194.3 651.7 200 670 C205.7 688.3 211.7 736.7 214 750" />
        <path d="M342 650 C338.3 648.3 327 636.7 320 640 C313 643.3 305.7 651.7 300 670 C294.3 688.3 288.3 736.7 286 750" />
        <path d="M214 760 C216.7 766.7 224 791.3 230 800 C236 808.7 243.3 812 250 812 C256.7 812 264 808.7 270 800 C276 791.3 283.3 766.7 286 760" />
        <path d="M156 1020 C155 1025.8 146.7 1046.3 150 1055 C153.3 1063.7 167.3 1072 176 1072 C184.7 1072 198.7 1063.7 202 1055 C205.3 1046.3 197 1025.8 196 1020" />
        <path d="M344 1020 C345 1025.8 353.3 1046.3 350 1055 C346.7 1063.7 332.7 1072 324 1072 C315.3 1072 301.3 1063.7 298 1055 C294.7 1046.3 303 1025.8 304 1020" />
        <ellipse cx="176" cy="1004" rx="16" ry="22" />
        <ellipse cx="324" cy="1004" rx="16" ry="22" />
      </g>
      {children}
    </svg>
  );
}

/** One thick dash, plus a ring, so the site stays obvious at phone size. */
export function Fold({ x, y, angle, size = 1 }: { x: number; y: number; angle: number; size?: number }) {
  const rad = (angle * Math.PI) / 180;
  const len = 18 * size;
  const dx = Math.cos(rad) * len;
  const dy = Math.sin(rad) * len;
  const sw = 8 * size;
  return (
    <g>
      <circle cx={x} cy={y} r={13 * size} fill="#fff" stroke={mark} strokeWidth={sw * 0.7} />
      <line
        x1={x - dx}
        y1={y - dy}
        x2={x + dx}
        y2={y + dy}
        stroke={mark}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </g>
  );
}
