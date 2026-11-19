import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
};
export function Button({ variant = 'primary', size = 'md', block, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('ds-button', `ds-button--${variant}`, size !== 'md' && `ds-button--${size}`, block && 'ds-button--block', className)}
      {...rest}
    />
  );
}

export function Card({ accent, className, ...rest }: HTMLAttributes<HTMLElement> & { accent?: boolean }) {
  return <section className={cx('ds-card', accent && 'ds-card--accent', className)} {...rest} />;
}

/** Estados de proceso y de datos. Siempre llevan texto: el color nunca es la única señal. */
export type StatusTone = 'ok' | 'stopped' | 'warning' | 'critical' | 'info' | 'simulated' | 'stale';
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cx('ds-badge', tone !== 'stopped' && `ds-badge--${tone}`)}>{children}</span>;
}

export function Alert({ tone = 'info', children, role }: { tone?: 'info' | 'warning' | 'critical' | 'success'; children: ReactNode; role?: 'alert' | 'status' }) {
  return <div className={cx('ds-alert', `ds-alert--${tone}`)} role={role ?? (tone === 'critical' ? 'alert' : 'status')}>{children}</div>;
}

export function Kpi({ label, value, unit, caption }: { label: string; value: ReactNode; unit?: string; caption?: string }) {
  return (
    <div className="ds-kpi">
      <span className="ds-kpi-label">{label}</span>
      <strong className="ds-kpi-value">{value}{unit && <span className="ds-kpi-unit">{unit}</span>}</strong>
      {caption && <small className="ds-kpi-caption">{caption}</small>}
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };
export function Field({ label, hint, error, className, ...input }: FieldProps) {
  return (
    <label className={cx('ds-field', className)}>
      {label}
      <input className="ds-input" aria-invalid={error ? true : undefined} {...input} />
      {hint && !error && <span className="ds-field-hint">{hint}</span>}
      {error && <span className="ds-field-error">{error}</span>}
    </label>
  );
}

export function AccentRule() {
  return <hr className="ds-accent-rule" />;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="ds-eyebrow">{children}</p>;
}
