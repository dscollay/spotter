import type { ReactNode } from 'react';

const ink = '#1c1408';

/** Lean front view shared by the chest and abdominal sites. */
export function FrontTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 200 340" aria-hidden="true">
      <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="100" cy="30" rx="15" ry="18" />
        <path d="M92 46 L88 64 M108 46 L112 64" />
        <path d="M90 64 C62 70 38 84 28 104 C22 122 32 142 44 158 C54 172 66 184 74 198 C78 214 70 230 66 248 L78 318" />
        <path d="M110 64 C138 70 162 84 172 104 C178 122 168 142 156 158 C146 172 134 184 126 198 C122 214 130 230 134 248 L122 318" />
        <path d="M92 308 C96 292 100 280 100 272 C100 280 104 292 108 308" />
        <path d="M32 112 C20 140 18 176 26 206 M46 120 C36 146 36 176 44 204" />
        <path d="M168 112 C180 140 182 176 174 206 M154 120 C164 146 164 176 156 204" />
        <path d="M74 132 C84 144 92 146 100 140" />
        <path d="M126 132 C116 144 108 146 100 140" />
        <path d="M76 198 C88 206 112 206 124 198" />
      </g>
      {children}
    </svg>
  );
}

/** Side view, chest to the left. The teal mark is the midaxillary fold. */
export function SideTorso({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 160 340" aria-hidden="true">
      <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="74" cy="30" rx="17" ry="19" />
        <path d="M62 46 C70 58 86 60 94 50" />
        <path d="M58 70 C40 92 36 124 42 156 C48 186 54 206 60 228 C66 258 64 292 58 320" />
        <path d="M86 64 C108 78 116 108 112 142 C108 176 104 214 98 246 C94 278 96 304 92 320" />
        <path d="M98 92 C114 104 122 124 118 146" />
      </g>
      {children}
    </svg>
  );
}

export function ThighFigure({ children }: { children?: ReactNode }) {
  return (
    <svg className="figure" viewBox="0 0 140 270" aria-hidden="true">
      <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 28 C28 48 30 90 36 130 C42 176 44 210 48 232" />
        <path d="M100 24 C114 46 112 90 106 130 C100 176 98 210 94 232" />
        <path d="M48 232 C56 248 84 248 94 232" />
        <ellipse cx="71" cy="236" rx="16" ry="9" />
        <path d="M42 36 C58 46 86 46 102 32" />
      </g>
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
  return <circle cx={x} cy={y} r="3.2" fill="#6a5c4e" stroke="none" />;
}
