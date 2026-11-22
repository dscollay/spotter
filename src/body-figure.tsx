import type { ReactNode } from 'react';

const skin = '#d9c7b4';
const line = '#2a241e';

export function FrontTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 200 280" aria-hidden="true">
      <g fill={skin} stroke={line} strokeWidth="1.6" strokeLinejoin="round">
        <ellipse cx="100" cy="32" rx="20" ry="24" />
        <path d="M90 52c2 10 4 14 10 16 6-2 8-6 10-16" />
        <path d="M46 92c-14 6-24 22-26 48-2 20 4 36 14 42 6-16 8-34 14-48 4-10 8-16 12-20-6-8-10-16-14-22z" />
        <path d="M154 92c14 6 24 22 26 48 2 20-4 36-14 42-6-16-8-34-14-48-4-10-8-16-12-20 6-8 10-16 14-22z" />
        <path d="M62 86c8-16 22-24 38-24s30 8 38 24c10 8 22 14 28 28 4 18 2 48-6 78-6 22-16 40-28 48-8 6-16 8-32 8s-24-2-32-8c-12-8-22-26-28-48-8-30-10-60-6-78 6-14 18-20 28-28z" />
        <path d="M78 214c-6 18-8 36-6 58h22c2-20 4-38 8-52-8 0-16-2-24-6z" />
        <path d="M122 214c6 18 8 36 6 58h-22c-2-20-4-38-8-52 8 0 16-2 24-6z" />
      </g>
      <g fill="none" stroke={line} strokeWidth="1.2" opacity="0.55">
        <path d="M74 118c8 10 18 14 26 14" />
        <path d="M126 118c-8 10-18 14-26 14" />
        <path d="M58 206c14 10 28 14 42 14" />
        <path d="M142 206c-14 10-28 14-42 14" />
      </g>
      {children}
    </svg>
  );
}

export function SideTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 180 280" aria-hidden="true">
      <g fill={skin} stroke={line} strokeWidth="1.6" strokeLinejoin="round">
        <ellipse cx="78" cy="32" rx="22" ry="24" />
        <path d="M70 54c8 8 20 10 28 6 2 10-2 18-8 22-16 4-30 2-36-8 2-8 8-16 16-20z" />
        <path d="M58 84c-16 10-28 36-24 78 2 28 12 52 28 66 10 8 22 10 34 6 8-22 10-48 6-74-4-28-2-52 8-70 6-12 8-24 4-36-10 6-28 10-56 30z" />
        <path d="M96 96c16 8 28 20 30 40 2 16-4 28-16 34-4-16-6-30-4-46 2-10-2-20-10-28z" />
        <path d="M70 228c-4 16 0 32 10 46h28c2-16-2-32-8-46-8 4-20 4-30 0z" />
      </g>
      <path d="M86 150h18" stroke={line} strokeWidth="1.2" opacity="0.5" />
      {children}
    </svg>
  );
}

export function ThighFigure({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 160 240" aria-hidden="true">
      <g fill={skin} stroke={line} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M38 28c-8 20-10 48-6 84 4 40 12 78 22 100 8 6 20 8 32 4 12-16 20-52 24-92 4-36 2-70-8-92-8-6-24-10-40-8-10 0-18 2-24 4z" />
        <ellipse cx="78" cy="206" rx="22" ry="12" fill="#efe4d6" />
      </g>
      <path d="M36 36c20 8 40 10 62 4" fill="none" stroke={line} strokeWidth="1.2" opacity="0.55" />
      {children}
    </svg>
  );
}

export function Fold({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1f8f86" strokeWidth="5" strokeLinecap="round" />;
}

export function Guide({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6a5c4e" strokeWidth="1.4" strokeDasharray="3 3" />;
}

export function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="3.5" fill="#6a5c4e" stroke="none" />;
}
