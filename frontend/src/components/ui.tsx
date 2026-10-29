import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, X } from 'lucide-react'
import { cx } from '@/lib/format'

// ── brand mark ────────────────────────────────────────────────────────────
export function Mark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.2" y="2.2" width="15.6" height="15.6" />
      <path d="M2.2 8.2h15.6M8.2 2.2v15.6" />
    </svg>
  )
}

// ── buttons ───────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper border-ink hover:opacity-85',
  secondary: 'bg-transparent text-ink border-line hover:border-line-strong hover:bg-raised',
  ghost: 'bg-transparent text-muted border-transparent hover:text-ink hover:border-line',
  danger: 'bg-transparent text-alert border-alert/60 hover:bg-alert hover:text-paper hover:border-alert',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[10px]',
  md: 'h-9 px-3.5 text-[11px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 border font-mono font-medium uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center border border-transparent text-muted transition-colors hover:border-line hover:text-ink disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── text bits ─────────────────────────────────────────────────────────────
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('label', className)}>{children}</span>
}

export function Badge({
  children,
  tone = 'line',
  className,
}: {
  children: ReactNode
  tone?: 'line' | 'solid' | 'alert' | 'muted'
  className?: string
}) {
  const tones = {
    line: 'border-line text-muted',
    muted: 'border-transparent text-faint',
    solid: 'border-ink bg-ink text-paper',
    alert: 'border-alert/60 text-alert',
  }
  return (
    <span
      className={cx(
        'inline-flex h-[18px] items-center gap-1 border px-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border border-line px-1 py-px font-mono text-[10px] text-muted">{children}</kbd>
  )
}

export function Rule({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-line', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-3.5 animate-spin', className)} />
}

export function StatusDot({ tone = 'ok', pulse = false }: { tone?: 'ok' | 'warn' | 'alert'; pulse?: boolean }) {
  const tones = { ok: 'bg-ink', warn: 'bg-muted', alert: 'bg-alert' }
  return (
    <span className="relative inline-flex size-2">
      <span className={cx('size-2', tones[tone])} />
      {pulse && (
        <span className={cx('absolute inset-0 animate-ping opacity-40', tones[tone])} />
      )}
    </span>
  )
}

// ── layout bits ───────────────────────────────────────────────────────────
export function SectionHeader({
  index,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  index?: string
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        {(eyebrow || index) && (
          <div className="mb-2 flex items-center gap-2">
            {index && <span className="font-mono text-[10px] tracking-[0.16em] text-faint">{index}</span>}
            {eyebrow && <Label>{eyebrow}</Label>}
          </div>
        )}
        <h2 className="display text-[24px] text-ink">{title}</h2>
        {description && (
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string
  body?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 border border-dashed border-line px-8 py-16 text-center',
        className,
      )}
    >
      {icon && <div className="text-muted">{icon}</div>}
      <p className="serif text-[26px] leading-tight text-ink">{title}</p>
      {body && <p className="max-w-md text-[12.5px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function StackedBar({
  segments,
  className,
}: {
  segments: { value: number; label: string; tone?: number }[]
  className?: string
}) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1
  return (
    <div className={cx('flex h-2.5 w-full gap-px overflow-hidden border border-line', className)}>
      {segments.map((s, i) => (
        <div
          key={s.label}
          title={`${s.label}`}
          style={{
            width: `${(s.value / total) * 100}%`,
            opacity: s.tone ?? 1 - i * 0.11,
          }}
          className="h-full bg-ink"
        />
      ))}
    </div>
  )
}

export function Progress({
  value,
  indeterminate,
  className,
}: {
  value?: number
  indeterminate?: boolean
  className?: string
}) {
  return (
    <div className={cx('relative h-[3px] w-full overflow-hidden bg-line', className)}>
      {indeterminate ? (
        <div
          className="absolute inset-y-0 w-1/3 bg-ink"
          style={{ animation: 'nimbus-sweep 1.1s ease-in-out infinite' }}
        />
      ) : (
        <div
          className="h-full bg-ink transition-[width] duration-200 ease-out"
          style={{ width: `${Math.round(Math.min(1, Math.max(0, value ?? 0)) * 100)}%` }}
        />
      )}
    </div>
  )
}

// ── form controls ─────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {optional && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">optional</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block font-mono text-[10px] tracking-[0.04em] text-alert">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-faint">{hint}</span>
      )}
    </label>
  )
}

export function TextInput({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(
        'h-10 w-full border bg-transparent px-3 text-[13px] text-ink outline-none transition-colors',
        invalid ? 'border-alert/70' : 'border-line focus:border-ink',
        className,
      )}
      {...rest}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 border border-line p-3 text-left transition-colors hover:border-line-strong disabled:opacity-50"
    >
      <span
        className={cx(
          'mt-px flex size-4 shrink-0 items-center justify-center border',
          checked ? 'border-ink bg-ink text-paper' : 'border-line-strong text-transparent',
        )}
      >
        <Check className="size-3" strokeWidth={2.4} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] text-ink">{label}</span>
        {description && <span className="mt-1 block text-[11px] leading-relaxed text-muted">{description}</span>}
      </span>
    </button>
  )
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={cx('flex flex-wrap items-center gap-px', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cx(
            'inline-flex h-8 items-center gap-2 border px-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors',
            value === item.id
              ? 'border-ink bg-ink text-paper'
              : 'border-line text-muted hover:border-line-strong hover:text-ink',
          )}
        >
          {item.label}
          {item.count != null && (
            <span className={cx('font-mono text-[9px]', value === item.id ? 'text-paper/70' : 'text-faint')}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── modal ─────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-6 backdrop-blur-[2px]">
      <div
        className={cx('fade mt-[8vh] w-full border border-line bg-paper', width)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {eyebrow && <Label className="mb-1 block">{eyebrow}</Label>}
            <h3 className="display text-[19px]">{title}</h3>
            {description && <p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── toasts ────────────────────────────────────────────────────────────────
interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'default' | 'alert'
}

const ToastContext = createContext<(toast: Omit<Toast, 'id'>) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...toast, id }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed top-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cx(
                'rise border bg-paper px-3.5 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]',
                toast.tone === 'alert' ? 'border-alert/60' : 'border-line',
              )}
            >
              <p
                className={cx(
                  'font-mono text-[10px] font-medium uppercase tracking-[0.14em]',
                  toast.tone === 'alert' ? 'text-alert' : 'text-ink',
                )}
              >
                {toast.title}
              </p>
              {toast.body && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{toast.body}</p>}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
