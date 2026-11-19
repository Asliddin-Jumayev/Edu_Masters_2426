import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut, useOptions } from '@/api/hooks'
import type { Me, Page } from '@/api/types'
import { useAuth, useBranch } from '@/lib/auth'
import { useDebounce } from '@/lib/hooks'
import type { Opt } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Button, Confirm, DataTable, Field, Input, Modal, PageHeader, Pager, Panel, Select, Textarea, Toolbar, type Column } from './ui'

/* ============ Maydon va filtr ta'riflari ============ */
export type OptionsSpec = Opt[] | { endpoint: string; params?: Record<string, unknown>; label: (x: any) => string; value?: string } // eslint-disable-line @typescript-eslint/no-explicit-any

type DefaultFn = (c: { branchId: number | null; me?: Me }) => unknown
export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'number' | 'money' | 'date' | 'datetime' | 'time' | 'select' | 'checkbox' | 'textarea' | 'password' | 'tel' | 'email'
  required?: boolean
  options?: OptionsSpec
  hint?: string
  placeholder?: string
  createOnly?: boolean
  editOnly?: boolean
  clearable?: boolean
  span?: 1 | 2
  emptyLabel?: string
  default?: DefaultFn | string | number | boolean | null
}
export interface FilterDef { name: string; label: string; type: 'select' | 'checkbox' | 'date'; options?: OptionsSpec; emptyLabel?: string }

export function useResolved(spec?: OptionsSpec): Opt[] | undefined {
  const remote = spec && !Array.isArray(spec) ? spec : undefined
  const q = useOptions<Record<string, unknown>>(remote?.endpoint ?? null, remote?.params)
  return useMemo(() => {
    if (!spec) return undefined
    if (Array.isArray(spec)) return spec
    return (q.data ?? []).map((x) => ({ value: x[spec.value ?? 'id'] as string | number, label: spec.label(x) }))
  }, [spec, q.data])
}

/* ============ Forma maydoni ============ */
function FieldControl({ f, register, error }: { f: FieldDef; register: ReturnType<typeof useForm>['register']; error?: string }) {
  const opts = useResolved(f.options)
  const reg = register(f.name, { required: f.required ? "Majburiy maydon" : false })
  const common = { id: f.name, placeholder: f.placeholder, 'aria-invalid': !!error }
  let control: ReactNode
  switch (f.type) {
    case 'textarea': control = <Textarea {...common} {...reg} />; break
    case 'checkbox':
      return (
        <label className={cn('flex items-center gap-2 py-1', f.span === 2 && 'sm:col-span-2')}>
          <input type="checkbox" className="size-4 accent-[var(--brand)]" {...reg} />
          <span className="font-medium">{f.label}</span>
          {f.hint && <span className="text-xs text-muted">— {f.hint}</span>}
        </label>
      )
    case 'select':
      control = (
        <Select key={opts?.length ?? 0} {...common} {...reg}>
          <option value="">{f.emptyLabel ?? '— tanlang —'}</option>
          {(opts ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )
      break
    default: {
      const t = f.type === 'money' ? 'number' : f.type === 'datetime' ? 'datetime-local' : (f.type ?? 'text')
      control = <Input {...common} type={t} step={f.type === 'money' ? '0.01' : f.type === 'number' ? '1' : undefined} min={f.type === 'money' || f.type === 'number' ? 0 : undefined} {...reg} />
    }
  }
  return (
    <Field label={f.label} error={error} hint={f.hint} required={f.required} className={f.span === 2 ? 'sm:col-span-2' : ''}>{control}</Field>
  )
}

const isNumericSelect = (f: FieldDef) =>
  f.type === 'select' && (f.options ? (Array.isArray(f.options) ? typeof f.options[0]?.value === 'number' : true) : false)

function toInput(f: FieldDef, v: unknown): unknown {
  if (v === null || v === undefined) return f.type === 'checkbox' ? false : ''
  if (f.type === 'datetime') return String(v).slice(0, 16)
  if (f.type === 'time') return String(v).slice(0, 5)
  if (f.type === 'date') return String(v).slice(0, 10)
  if (f.type === 'select' || f.type === 'number') return String(v)
  return v
}

/** Forma qiymatlarini backendga mos JSON ga aylantiradi: bo'sh maydonlar tushirib qoldiriladi */
export function buildPayload(fields: FieldDef[], values: Record<string, unknown>, mode: 'create' | 'edit') {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if ((mode === 'edit' && f.createOnly) || (mode === 'create' && f.editOnly)) continue
    const v = values[f.name]
    if (f.type === 'checkbox') { out[f.name] = !!v; continue }
    if (v === '' || v === undefined || v === null) {
      if (mode === 'edit' && f.clearable) out[f.name] = null
      continue
    }
    if (f.type === 'number' || isNumericSelect(f)) out[f.name] = Number(v)
    else if (f.type === 'money') out[f.name] = String(v)
    else out[f.name] = typeof v === 'string' ? v.trim() : v
  }
  return out
}

export function EntityForm({ fields, initial, mode, onSubmit, onCancel, submitting, submitLabel }: {
  fields: FieldDef[]; initial?: Record<string, unknown> | null; mode: 'create' | 'edit'
  onSubmit: (payload: Record<string, unknown>) => void; onCancel: () => void; submitting?: boolean; submitLabel?: string
}) {
  const me = useAuth((s) => s.me)
  const branchId = useBranch((s) => s.branchId)
  const visible = fields.filter((f) => !(mode === 'edit' && f.createOnly) && !(mode === 'create' && f.editOnly))
  const defaults = useMemo(() => {
    const d: Record<string, unknown> = {}
    for (const f of visible) {
      const def = typeof f.default === 'function' ? f.default({ branchId, me }) : f.default
      d[f.name] = toInput(f, mode === 'edit' && initial ? initial[f.name] : def)
    }
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: defaults })
  return (
    <form onSubmit={handleSubmit((v) => onSubmit(buildPayload(fields, v, mode)))} noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((f) => <FieldControl key={f.name} f={f} register={register as never} error={errors[f.name]?.message as string | undefined} />)}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>Bekor qilish</Button>
        <Button type="submit" variant="primary" loading={submitting}>{submitLabel ?? (mode === 'create' ? "Qo'shish" : 'Saqlash')}</Button>
      </div>
    </form>
  )
}

/** Modal ichidagi tayyor forma (ixtiyoriy sahifalar uchun) */
export function FormModal({ open, onClose, title, fields, initial, mode = 'create', onSubmit, submitting, submitLabel, description, size }: {
  open: boolean; onClose: () => void; title: string; fields: FieldDef[]; initial?: Record<string, unknown> | null; mode?: 'create' | 'edit'
  onSubmit: (p: Record<string, unknown>) => void; submitting?: boolean; submitLabel?: string; description?: ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size={size}>
      <EntityForm fields={fields} initial={initial} mode={mode} onSubmit={onSubmit} onCancel={onClose} submitting={submitting} submitLabel={submitLabel} />
    </Modal>
  )
}

/* ============ Filtr boshqaruvi ============ */
export function FilterControl({ f, value, onChange }: { f: FilterDef; value: string; onChange: (v: string) => void }) {
  const opts = useResolved(f.options)
  if (f.type === 'checkbox') {
    return (
      <label className="flex items-center gap-1.5 text-[13px]">
        <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : '')} />{f.label}
      </label>
    )
  }
  if (f.type === 'date') return <Input type="date" aria-label={f.label} title={f.label} value={value} onChange={(e) => onChange(e.target.value)} className="w-auto" />
  return (
    <Select key={opts?.length ?? 0} aria-label={f.label} value={value} onChange={(e) => onChange(e.target.value)} className="w-auto min-w-36">
      <option value="">{f.emptyLabel ?? f.label}</option>
      {(opts ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  )
}

/* ============ Universal CRUD sahifa ============ */
export interface ResourceConfig<T extends { id: number }> {
  title: string
  subtitle?: string
  endpoint: string // oxirida "/" bilan: '/branches/'
  noun: string
  columns: Column<T>[]
  fields: FieldDef[]
  filters?: FilterDef[]
  defaultFilters?: Record<string, string>
  search?: string
  branchScoped?: boolean
  canCreate?: (me?: Me) => boolean
  canEdit?: (me?: Me, row?: T) => boolean
  canDelete?: (me?: Me, row?: T) => boolean
  deleteLabel?: string
  deleteHint?: string
  updateMethod?: 'put' | 'patch'
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => ReactNode
  extraParams?: Record<string, unknown>
  headerActions?: ReactNode
  pageSize?: number
  modalSize?: 'sm' | 'md' | 'lg'
  invalidate?: string[]
  createLabel?: string
  embedded?: boolean
}

export function ResourcePage<T extends { id: number }>(cfg: ResourceConfig<T>) {
  const me = useAuth((s) => s.me)
  const branchId = useBranch((s) => s.branchId)
  const [filters, setFilters] = useState<Record<string, string>>(cfg.defaultFilters ?? {})
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; row?: T } | null>(null)
  const [del, setDel] = useState<T | null>(null)
  const dq = useDebounce(q)
  const limit = cfg.pageSize ?? 50

  const query = useGet<Page<T> | T[]>(cfg.endpoint, {
    ...cfg.extraParams, ...filters, q: dq || undefined, branch_id: cfg.branchScoped ? branchId ?? undefined : undefined, limit, offset,
  })
  const rows = Array.isArray(query.data) ? query.data : query.data?.items ?? []
  const total = Array.isArray(query.data) ? rows.length : query.data?.total ?? 0

  const inv = [cfg.endpoint, ...(cfg.invalidate ?? [])]
  const save = useMut(
    (payload: Record<string, unknown>) => form?.mode === 'edit' && form.row
      ? (cfg.updateMethod === 'patch' ? api.patch : api.put)(`${cfg.endpoint}${form.row.id}`, payload)
      : api.post(cfg.endpoint, payload),
    { invalidate: inv, success: form?.mode === 'edit' ? "O'zgarishlar saqlandi" : `${cap(cfg.noun)} qo'shildi`, onSuccess: () => setForm(null) },
  )
  const remove = useMut((id: number) => api.del(`${cfg.endpoint}${id}`), { invalidate: inv, success: `${cap(cfg.noun)} ${cfg.deleteLabel === "O'chirish" || !cfg.deleteLabel ? "o'chirildi" : 'faolsizlantirildi'}`, onSuccess: () => setDel(null) })

  const canCreate = cfg.canCreate?.(me) ?? true
  const canEdit = (r: T) => cfg.canEdit?.(me, r) ?? true
  const canDelete = (r: T) => cfg.canDelete?.(me, r) ?? true
  const showActions = rows.some((r) => canEdit(r) || canDelete(r)) || !!cfg.rowActions

  const columns: Column<T>[] = showActions ? [...cfg.columns, {
    key: '_actions', header: '', align: 'right', className: 'w-px',
    cell: (r) => (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {cfg.rowActions?.(r)}
        {canEdit(r) && <Button variant="ghost" size="sm" aria-label="Tahrirlash" title="Tahrirlash" onClick={() => setForm({ mode: 'edit', row: r })} className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 rounded-lg p-1.5 h-8 w-8"><Pencil className="size-4" /></Button>}
        {canDelete(r) && <Button variant="ghost" size="sm" aria-label={cfg.deleteLabel ?? "O'chirish"} title={cfg.deleteLabel ?? "O'chirish"} onClick={() => setDel(r)} className="hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-500 hover:text-rose-600 rounded-lg p-1.5 h-8 w-8"><Trash2 className="size-4" /></Button>}
      </div>
    ),
  }] : cfg.columns

  const setFilter = (k: string, v: string) => { setFilters((p) => ({ ...p, [k]: v })); setOffset(0) }

  return (
    <>
      {(() => {
        const actions = <>{cfg.headerActions}{canCreate && <Button variant="primary" onClick={() => setForm({ mode: 'create' })}><Plus className="size-4" />{cfg.createLabel ?? `Yangi ${cfg.noun}`}</Button>}</>
        return cfg.embedded
          ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="max-w-2xl text-muted">{cfg.subtitle}</p><div className="flex gap-2">{actions}</div></div>
          : <PageHeader title={cfg.title} subtitle={cfg.subtitle} actions={actions} />
      })()}
      <Panel flush>
        {(cfg.search || cfg.filters?.length) && (
          <Toolbar>
            {cfg.search && (
              <div className="relative min-w-56 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" aria-hidden />
                <Input className="pl-8" placeholder={cfg.search} value={q} onChange={(e) => { setQ(e.target.value); setOffset(0) }} aria-label="Qidirish" />
              </div>
            )}
            {cfg.filters?.map((f) => <FilterControl key={f.name} f={f} value={filters[f.name] ?? ''} onChange={(v) => setFilter(f.name, v)} />)}
          </Toolbar>
        )}
        <DataTable columns={columns} rows={rows} loading={query.isLoading} rowKey={(r) => r.id} onRowClick={cfg.onRowClick} />
        {!Array.isArray(query.data) && query.data && <Pager total={total} limit={limit} offset={offset} onChange={setOffset} />}
      </Panel>

      <Modal open={!!form} onClose={() => setForm(null)} size={cfg.modalSize ?? 'md'}
        title={form?.mode === 'edit' ? `${cap(cfg.noun)}ni tahrirlash` : `Yangi ${cfg.noun}`}>
        {form && <EntityForm fields={cfg.fields} initial={form.row as unknown as Record<string, unknown>} mode={form.mode} onSubmit={(p) => save.mutate(p)} onCancel={() => setForm(null)} submitting={save.isPending} />}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)}
        title={`${cfg.deleteLabel ?? "O'chirish"}?`} confirmLabel={cfg.deleteLabel ?? "O'chirish"}
        message={cfg.deleteHint ?? "Bu amalni qaytarib bo'lmaydi."} />
    </>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
