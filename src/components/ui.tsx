import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' }) {
  const base = {
    primary: 'btn btn-primary',
    outline: 'btn btn-outline',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
  }[variant]
  return <button className={`${base} ${className}`} {...props} />
}

export function LinkButton({
  to,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  className?: string
  children: ReactNode
}) {
  const base = {
    primary: 'btn btn-primary',
    outline: 'btn btn-outline',
    ghost: 'btn btn-ghost',
    danger: 'btn btn-danger',
  }[variant]
  return (
    <a href={`#${to}`} className={`${base} ${className}`}>
      {children}
    </a>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`badge ${className}`}>{children}</span>
}

export function Spinner({ label = 'جاري التحميل…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
      <span
        aria-hidden
        className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-border border-t-primary"
      />
      <span>{label}</span>
    </div>
  )
}

export function ProgressBar({
  value,
  className = '',
  label,
}: {
  value: number
  className?: string
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={className}>
      {label ? (
        <div className="mb-1 flex justify-between text-xs font-bold text-muted-foreground">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="cursor-pointer rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p role="alert" className="mt-1 text-xs font-bold text-destructive">{error}</p> : null}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="font-bold">{title}</p>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-6 sm:gap-3">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground sm:mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}