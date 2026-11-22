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
 * The NHANES front figure from the waist down. The inguinal crease is at the
 * hip, and the thigh and the shin are about the same length. Subject's right
 * thigh is on the viewer's left.
 */
export function ThighFigure({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="30 500 430 930" aria-hidden="true">
      <rect x="30" y="500" width="430" height="930" fill="#fff" />
      <path d={NHANES_FRONT} fill="none" stroke={ink} strokeWidth="1.15" />
      <g fill="none" stroke={ink} strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round">
        <path d="M149 600 C148.2 620 146.5 676.7 144 720 C141.5 763.3 133.7 813.3 134 860 C134.3 906.7 142 966.7 146 1000 C150 1033.3 156 1050 158 1060" />
        <path d="M232 708 C229.3 733.3 220.7 811.3 216 860 C211.3 908.7 207 966.7 204 1000 C201 1033.3 199 1050 198 1060" />
        <path d="M156 618 C161.3 623.3 178.3 639.3 188 650 C197.7 660.7 206.7 672.3 214 682 C221.3 691.7 229 703.7 232 708" />
        <path d="M232 708 C233.7 712 239 726.7 242 732 C245 737.3 247.3 740 250 740 C252.7 740 255 737.3 258 732 C261 726.7 266.3 712 268 708" />
        <path d="M158 1060 C157.3 1066.7 150.3 1090.3 154 1100 C157.7 1109.7 171.3 1118 180 1118 C188.7 1118 203 1109.7 206 1100 C209 1090.3 199.3 1066.7 198 1060" />
        <path d="M158 1105 C157.3 1125.8 153 1185.8 154 1230 C155 1274.2 162.3 1346.7 164 1370" />
        <path d="M198 1105 C198.7 1125.8 204.3 1185.8 202 1230 C199.7 1274.2 187 1346.7 184 1370" />
        <path d="M164 1370 C162.7 1374.3 153.7 1390 156 1396 C158.3 1402 170.3 1406.7 178 1406 C185.7 1405.3 201 1398 202 1392 C203 1386 187 1373.7 184 1370" />
        <path d="M351 600 C351.8 620 353.5 676.7 356 720 C358.5 763.3 366.3 813.3 366 860 C365.7 906.7 358 966.7 354 1000 C350 1033.3 344 1050 342 1060" />
        <path d="M268 708 C270.7 733.3 279.3 811.3 284 860 C288.7 908.7 293 966.7 296 1000 C299 1033.3 301 1050 302 1060" />
        <path d="M344 618 C338.7 623.3 321.7 639.3 312 650 C302.3 660.7 293.3 672.3 286 682 C278.7 691.7 271 703.7 268 708" />
        <path d="M342 1060 C342.7 1066.7 349.7 1090.3 346 1100 C342.3 1109.7 328.7 1118 320 1118 C311.3 1118 297 1109.7 294 1100 C291 1090.3 300.7 1066.7 302 1060" />
        <path d="M342 1105 C342.7 1125.8 347 1185.8 346 1230 C345 1274.2 337.7 1346.7 336 1370" />
        <path d="M302 1105 C301.3 1125.8 295.7 1185.8 298 1230 C300.3 1274.2 313 1346.7 316 1370" />
        <path d="M336 1370 C337.3 1374.3 346.3 1390 344 1396 C341.7 1402 329.7 1406.7 322 1406 C314.3 1405.3 299 1398 298 1392 C297 1386 313 1373.7 316 1370" />
        <ellipse cx="180" cy="1026" rx="17" ry="27" />
        <ellipse cx="320" cy="1026" rx="17" ry="27" />
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
