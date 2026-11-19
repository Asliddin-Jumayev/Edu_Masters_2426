import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { cn, fmtMoney } from '@/lib/utils'
import type { LabelMap, Tone } from '@/lib/labels'

/* ---------------- Button ---------------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mark'
const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold shadow-xs shadow-indigo-600/20 active:scale-[0.98]',
  secondary: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs font-medium',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-xs font-semibold',
  mark: 'marker font-semibold hover:brightness-95',
}
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} disabled={disabled || loading}
    className={cn('inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
      size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm', variants[variant], className)} {...p}>
    {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
    {children}
  </button>
))
Button.displayName = 'Button'

/* ---------------- Inputs ---------------- */
const inputCls = 'w-full rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 text-sm transition-all shadow-2xs'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(inputCls, 'h-9 py-0', className)} {...p} />
))
Input.displayName = 'Input'
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} rows={3} className={cn(inputCls, className)} {...p} />
))
Textarea.displayName = 'Textarea'
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(inputCls, 'h-9 py-0 pr-8 cursor-pointer', className)} {...p}>{children}</select>
))
Select.displayName = 'Select'

export function Field({ label, error, hint, children, className, required }: { label?: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-rose-500 font-medium">{error}</span>}
    </label>
  )
}

/* ---------------- Badge ---------------- */
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  brand: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  warn: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
  info: 'bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
}
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {tone === 'success' && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
      {tone === 'danger' && <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />}
      {tone === 'warn' && <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />}
      {children}
    </span>
  )
}
export function StatusBadge({ map, value }: { map: LabelMap; value?: string | null }) {
  if (!value) return <span className="text-muted">—</span>
  const m = map[value]
  return <Badge tone={m?.tone ?? 'neutral'}>{m?.label ?? value}</Badge>
}

/** Pul: manfiy = qizil ruchka (qarz), musbat = yashil (avans) */
export function Money({ value, signed, className }: { value?: string | number | null; signed?: boolean; className?: string }) {
  const n = Number(value ?? 0)
  return (
    <span className={cn('num whitespace-nowrap', n < 0 ? 'font-semibold text-danger' : signed && n > 0 ? 'text-success' : '', className)}>
      {signed && n > 0 ? '+' : ''}{fmtMoney(value)}
    </span>
  )
}

/* ---------------- Panel / Header / Stat ---------------- */
export function Panel({ title, actions, children, className, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn('rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-xs shadow-slate-200/50 dark:shadow-none transition-all', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <div className="px-5 py-4 transition-colors">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn('num mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted font-medium">{hint}</div>}
    </div>
  )
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('size-5 animate-spin text-muted', className)} aria-label="Yuklanmoqda" />

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
      <div className="font-display text-lg font-semibold">{title}</div>
      {hint && <p className="max-w-sm text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ---------------- Tabs / Segmented ---------------- */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="scroll-thin mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 font-medium transition-colors',
            value === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, tones: t }: { options: { value: T; label: string }[]; value?: T; onChange: (v: T) => void; tones?: Partial<Record<T, string>> }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('px-2.5 py-1.5 text-[13px] font-medium transition-colors', value === o.value ? (t?.[o.value] ?? 'bg-brand text-brand-fg') : 'bg-surface text-muted hover:bg-sunken')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Modal (native <dialog>: fokus tuzog'i va Esc tayyor) ---------------- */
const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: keyof typeof sizes
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }}
      className={cn('m-auto w-[calc(100%-1.5rem)] rounded-xl border border-line bg-surface p-0 shadow-2xl', sizes[size])}>
      {open && (
        <div className="flex max-h-[88vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-muted">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Yopish" className="rounded-md p-1 text-muted hover:bg-sunken hover:text-fg"><X className="size-5" /></button>
          </header>
          <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-sunken/50 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = 'Tasdiqlash', danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-muted">{message}</div>
    </Modal>
  )
}

/* ---------------- DataTable ---------------- */
export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; align?: 'right' | 'center' }
export function DataTable<T>({ columns, rows, loading, onRowClick, rowKey, empty }: {
  columns: Column<T>[]; rows: T[]; loading?: boolean; onRowClick?: (r: T) => void; rowKey: (r: T) => string | number; empty?: ReactNode
}) {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('whitespace-nowrap px-4 py-3 font-semibold', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {loading && rows.length === 0 && Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">{columns.map((c) => <td key={c.key} className="px-4 py-3.5"><div className="h-4 w-3/4 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" /></td>)}</tr>
          ))}
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn('transition-colors', onRowClick ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30')}>
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 align-middle text-sm text-slate-700 dark:text-slate-300', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (empty ?? <EmptyState title="Ma'lumot topilmadi" hint="Filtrlarni o'zgartirib ko'ring yoki yangi yozuv qo'shing." />)}
    </div>
  )
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return total > 0 ? <div className="px-4 py-2.5 text-[13px] text-muted">Jami: {total}</div> : null
  const from = offset + 1, to = Math.min(offset + limit, total)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] text-muted">
      <span className="num">{from}–{to} / {total}</span>
      <div className="flex gap-1">
        <Button size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} aria-label="Oldingi"><ChevronLeft className="size-4" /></Button>
        <Button size="sm" disabled={to >= total} onClick={() => onChange(offset + limit)} aria-label="Keyingi"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50">{children}</div>
}
