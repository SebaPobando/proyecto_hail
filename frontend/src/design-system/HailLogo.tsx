import { useId } from 'react';

/**
 * Logo de Hail.
 * Isotipo: una "H" cuyo travesaño es una señal (pulso de telemetría), sobre el
 * degradado naranja de PROYEC. Logotipo: letras geométricas de trazo recto.
 *
 * - variant "full": isotipo + palabra HAIL (+ lema opcional)
 * - variant "mark": solo isotipo (avatares, favicon, menú colapsado)
 * - tone "dark": letras blancas para fondos de marca; "light": letras azules para fondos claros
 */
type Props = {
  variant?: 'full' | 'mark';
  tone?: 'dark' | 'light';
  tagline?: string;
  height?: number;
  className?: string;
  title?: string;
};

// Letras de 40 unidades de alto y trazo de 10, con esquinas en chaflán.
const WORDMARK = {
  H: 'M0 0H10V15H26V0H36V40H26V25H10V40H0Z',
  A: 'M0 40V8L8 0H36V40H26V28H10V40ZM10 10V18H26V10Z',
  I: 'M0 0H10V40H0Z',
  L: 'M0 0H10V30H32V40H0Z',
};
const LETTERS: [keyof typeof WORDMARK, number][] = [['H', 0], ['A', 42], ['I', 84], ['L', 100]];

export function HailMark({ size = 40, title = 'Hail' }: { size?: number; title?: string }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fa3d15" />
          <stop offset="1" stopColor="#f78c1e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="10" fill={`url(#${id}-accent)`} />
      <path d="M14 11v26M34 11v26" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M14 24h5l3-6 4 12 3-6h5"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HailLogo({ variant = 'full', tone = 'light', tagline, height = 40, className, title = 'Hail' }: Props) {
  if (variant === 'mark') return <HailMark size={height} title={title} />;
  const ink = tone === 'dark' ? '#ffffff' : '#005cbd';
  const shadow = tone === 'dark' ? '#000e8b' : '#a9cbf0';
  return (
    <span className={['hail-logo', className].filter(Boolean).join(' ')} style={{ height, gap: Math.round(height * 0.24) }}>
      <HailMark size={height} title={title} />
      <span className="hail-logo-text">
        <svg viewBox="0 0 136 44" height={height * 0.62} aria-hidden="true">
          <g transform="translate(3 3)" fill={shadow}>
            {LETTERS.map(([letter, x]) => <path key={letter} d={WORDMARK[letter]} transform={`translate(${x} 0)`} fillRule="evenodd" />)}
          </g>
          <g fill={ink}>
            {LETTERS.map(([letter, x]) => <path key={letter} d={WORDMARK[letter]} transform={`translate(${x} 0)`} fillRule="evenodd" />)}
          </g>
        </svg>
        {tagline && <span className="hail-logo-tagline">{tagline}</span>}
      </span>
    </span>
  );
}
