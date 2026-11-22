import type { ReactNode } from 'react';
import { NHANES_FRONT } from './nhanes-front';

const ink = '#111';

/** The NHANES III front figure, with its own suprailiac hatch covered so each site can add its own mark. */
export function FrontTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 491 760" aria-hidden="true">
      <rect width="491" height="760" fill="#fff" />
      <path d={NHANES_FRONT} fill="none" stroke={ink} strokeWidth="1.15" />
      <rect x="122" y="410" width="36" height="60" fill="#fff" />
      {children}
    </svg>
  );
}

/** Side view with the arm raised. Chest faces left. Each stroke is separate so the outline stays a person. */
export function SideTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 200 400" aria-hidden="true">
      <rect width="200" height="400" fill="#fff" />
      <g fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="104" cy="46" rx="22" ry="26" />
        <path d="M82 48h12" />
        <path d="M96 70 L92 96" />
        <path d="M114 70 L120 96" />
        <path d="M92 96 C72 118 64 148 68 178 C72 214 70 260 66 320" />
        <path d="M120 96 C140 118 146 156 140 196 C134 246 136 286 128 320" />
        <path d="M86 112 C62 92 40 64 34 40" />
        <path d="M104 118 C82 96 60 72 54 46" />
        <path d="M34 40 L26 28 M34 40 L32 22 M34 40 L42 26" />
        <path d="M68 176h12" />
      </g>
      {children}
    </svg>
  );
}

/** Standing right thigh, inguinal crease at the top and patella at the knee. */
export function ThighFigure({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 180 320" aria-hidden="true">
      <rect width="180" height="320" fill="#fff" />
      <g fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 48c18-16 46-22 70-16 20 6 36 4 48-8" />
        <path d="M40 52c-4 40-2 90 4 140 4 36 6 70 8 92" />
        <path d="M128 40c6 40 4 90-2 140-4 36-6 70-8 92" />
        <path d="M52 284c10 16 28 24 46 22 18-2 34-12 42-24" />
        <ellipse cx="96" cy="286" rx="22" ry="12" />
      </g>
      {children}
    </svg>
  );
}

/** Short parallel strokes, the way the NHANES drawing marks a fold. */
export function Fold({ x, y, angle }: { x: number; y: number; angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * 9;
  const dy = Math.sin(rad) * 9;
  const ox = -Math.sin(rad) * 3.2;
  const oy = Math.cos(rad) * 3.2;
  return (
    <g stroke="#111" strokeWidth="1.7" strokeLinecap="round">
      {[-1, 0, 1].map((step) => (
        <line
          key={step}
          x1={x - dx + ox * step}
          y1={y - dy + oy * step}
          x2={x + dx + ox * step}
          y2={y + dy + oy * step}
        />
      ))}
    </g>
  );
}
