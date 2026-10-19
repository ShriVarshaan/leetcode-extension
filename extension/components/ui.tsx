import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-on-accent font-semibold shadow-sm hover:brightness-110 active:brightness-95',
  secondary: 'border border-line bg-raised text-fg hover:border-subtle hover:bg-line/60 active:bg-line',
  ghost: 'text-muted hover:bg-raised hover:text-fg active:bg-line',
  danger: 'bg-bad text-white font-semibold shadow-sm hover:brightness-110 active:brightness-95',
  'danger-outline': 'border border-bad/50 text-bad hover:bg-bad/10 active:bg-bad/20',
} as const;

const BUTTON_SIZES = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm' } as const;

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS; size?: keyof typeof BUTTON_SIZES }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    />
  );
}

export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition duration-200 hover:bg-raised hover:text-fg active:scale-95 active:bg-line ${className}`}
    />
  );
}

export function Card(props: { title: string; description?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{props.title}</h2>
          {props.description && <p className="mt-1 text-sm leading-relaxed text-muted">{props.description}</p>}
        </div>
        {props.aside}
      </div>
      <div className="mt-6">{props.children}</div>
    </section>
  );
}

export function Toggle(props: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium">{props.label}</span>
        {props.hint && <span className="mt-0.5 block text-xs text-muted">{props.hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-line transition duration-200 peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-1 after:left-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition after:duration-200 peer-checked:after:translate-x-5" />
    </label>
  );
}

export const inputClass =
  'mt-2 block h-10 w-full rounded-lg border border-line bg-page px-3 text-sm text-fg transition duration-200 placeholder:text-muted hover:border-subtle focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none';

export function Notice({ kind, children }: { kind: 'ok' | 'error' | 'warn'; children: ReactNode }) {
  const styles = {
    ok: 'border-ok/30 bg-ok/10 text-ok',
    error: 'border-bad/30 bg-bad/10 text-bad',
    warn: 'border-warn/30 bg-warn/10 text-warn',
  };
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${styles[kind]}`}>
      {children}
    </p>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`h-4 w-4 animate-spin ${className}`} />;
}

export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return <img src="/icon/128.png" alt="" className={className} />;
}
