import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { GripVertical, ListChecks, MessageSquare, Phone, Plus, Search, UserCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut, useOptions } from '@/api/hooks'
import type { Course, Employee, Group, Lead, LeadActivity, LeadSource, LeadStatus, Page, Student, Trial } from '@/api/types'
import { SmsDialog } from '@/components/dialogs'
import { FormModal, type FieldDef } from '@/components/resource'
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Select, Spinner } from '@/components/ui'
import { useAuth, useBranch } from '@/lib/auth'
import { useDebounce, useNames } from '@/lib/hooks'
import { ACTIVITY_LABEL, O_ACTIVITY, O_PRIORITY } from '@/lib/labels'
import { cn, fmtDate, fmtDT, fmtTs, fullName } from '@/lib/utils'

const SOURCES = { endpoint: '/lead-sources/', label: (s: LeadSource) => s.name }
const COURSES = { endpoint: '/courses/', params: { is_active: true }, label: (c: Course) => c.name }
const STAFF = { endpoint: '/employees/', params: { is_active: true }, label: (e: Employee) => fullName(e) }

const LEAD_FIELDS: FieldDef[] = [
  { name: 'branch_id', label: 'Filial', type: 'select', required: true, createOnly: true, options: { endpoint: '/branches/', params: { is_active: true }, label: (b: { name: string }) => b.name }, default: ({ branchId, me }) => branchId ?? me?.branch_id },
  { name: 'first_name', label: 'Ism', required: true }, { name: 'last_name', label: 'Familiya', clearable: true },
  { name: 'phone', label: 'Telefon', type: 'tel', required: true, placeholder: '+998 90 123 45 67' },
  { name: 'source_id', label: 'Manba', type: 'select', clearable: true, options: SOURCES, emptyLabel: '— noma‘lum —' },
  { name: 'course_id', label: 'Qiziqqan kurs', type: 'select', clearable: true, options: COURSES, emptyLabel: '— noma‘lum —' },
  { name: 'assigned_to', label: 'Mas‘ul xodim', type: 'select', clearable: true, options: STAFF, emptyLabel: '— biriktirilmagan —' },
  { name: 'comment', label: 'Izoh', type: 'textarea', clearable: true, span: 2 },
]

/* ---------------- Lid kartochkasi (modal) ---------------- */
function LeadModal({ lead, onClose, onConvert, onLost }: { lead: Lead | null; onClose: () => void; onConvert: (l: Lead) => void; onLost: (l: Lead) => void }) {
  const [edit, setEdit] = useState(false)
  const [sms, setSms] = useState(false)
  const [task, setTask] = useState(false)
  const [trial, setTrial] = useState(false)
  const id = lead?.id
  const acts = useGet<LeadActivity[]>(id ? `/leads/${id}/activities` : null)
  const trials = useGet<Trial[]>(id ? '/trial-lessons/' : null, { lead_id: id })
  const source = useNames<LeadSource>('/lead-sources/', (s) => s.name)
  const course = useNames<Course>('/courses/', (c) => c.name)
  const staff = useNames<Employee>('/employees/', (e) => fullName(e))
  const group = useNames<Group>('/groups/', (g) => g.name)
  const [actType, setActType] = useState('call')
  const [actResult, setActResult] = useState('')
  const [actNote, setActNote] = useState('')
  const addAct = useMut(() => api.post(`/leads/${id}/activities`, { type: actType, result: actResult || undefined, note: actNote || undefined }),
    { invalidate: [`/leads/${id}/activities`], success: 'Qayd qo‘shildi', onSuccess: () => { setActResult(''); setActNote('') } })
  const update = useMut((p: Record<string, unknown>) => api.put(`/leads/${id}`, p), { invalidate: ['/leads/'], success: 'Saqlandi', onSuccess: () => setEdit(false) })
  const addTask = useMut((p: Record<string, unknown>) => api.post('/tasks/', { ...p, lead_id: id }), { invalidate: ['/tasks/'], success: 'Vazifa qo‘shildi', onSuccess: () => setTask(false) })
  const addTrial = useMut((p: Record<string, unknown>) => api.post('/trial-lessons/', { ...p, lead_id: id }), { invalidate: ['/trial-lessons/'], success: 'Sinov darsi belgilandi', onSuccess: () => setTrial(false) })
  const trialResult = useMut((v: { id: number; attended: boolean }) => api.patch(`/trial-lessons/${v.id}/result`, { attended: v.attended }), { invalidate: ['/trial-lessons/'], success: 'Natija saqlandi' })
  if (!lead) return <Modal open={false} onClose={onClose} title="" children={null} />
  const done = !!lead.student_id
  return (
    <>
      <Modal open onClose={onClose} size="lg" title={fullName(lead)} description={<a className="inline-flex items-center gap-1 text-brand hover:underline" href={`tel:${lead.phone}`}><Phone className="size-3.5" />{lead.phone}</a>}
        footer={<>
          <Button onClick={() => setEdit(true)}>Tahrirlash</Button>
          <Button onClick={() => setSms(true)}><MessageSquare className="size-4" />SMS</Button>
          <Button onClick={() => setTask(true)}><ListChecks className="size-4" />Vazifa</Button>
          {!done && <Button onClick={() => onLost(lead)} className="text-danger">Yo‘qotildi</Button>}
          {!done && <Button variant="mark" onClick={() => onConvert(lead)}><UserCheck className="size-4" />O‘quvchiga aylantirish</Button>}
        </>}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {[['Manba', source(lead.source_id)], ['Kurs', lead.course_id ? course(lead.course_id) : '—'], ['Mas‘ul', lead.assigned_to ? staff(lead.assigned_to) : '—'], ['Qo‘shilgan', fmtTs(lead.created_at)]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
        </dl>
        {lead.comment && <p className="mt-3 rounded-md bg-sunken px-3 py-2 text-[13px]">{lead.comment}</p>}
        {lead.lost_reason && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">Yo‘qotilish sababi: {lead.lost_reason}</p>}
        {done && <p className="mt-3 rounded-md bg-success-soft px-3 py-2 text-[13px] text-success">O‘quvchiga aylantirilgan (#{lead.student_id})</p>}

        <h3 className="font-display mt-6 mb-2 text-lg font-semibold">Faoliyat tarixi</h3>
        <div className="mb-3 grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
          <Select value={actType} onChange={(e) => setActType(e.target.value)} aria-label="Turi">{O_ACTIVITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
          <div className="grid gap-2 sm:grid-cols-2"><Input placeholder="Natija (qiziqdi, o‘ylab ko‘radi…)" value={actResult} onChange={(e) => setActResult(e.target.value)} /><Input placeholder="Izoh" value={actNote} onChange={(e) => setActNote(e.target.value)} /></div>
          <Button variant="primary" loading={addAct.isPending} onClick={() => addAct.mutate(undefined)}>Qo‘shish</Button>
        </div>
        {acts.isLoading ? <Spinner /> : (acts.data ?? []).length === 0 ? <p className="text-muted">Hali qayd yo‘q.</p> : (
          <ol className="relative space-y-3 border-l border-line pl-4">
            {acts.data!.map((a) => (
              <li key={a.id}><span className="absolute -left-1 mt-1.5 size-2 rounded-full bg-brand" />
                <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{ACTIVITY_LABEL[a.type] ?? a.type}</Badge>{a.result && <span className="font-medium">{a.result}</span>}<span className="text-xs text-muted">{fmtTs(a.created_at)} · {staff(a.employee_id)}</span></div>
                {a.note && <p className="mt-0.5 text-[13px] text-muted">{a.note}</p>}</li>))}
          </ol>
        )}

        <div className="mt-6 mb-2 flex items-center justify-between"><h3 className="font-display text-lg font-semibold">Sinov darslari</h3>{!done && <Button size="sm" onClick={() => setTrial(true)}><Plus className="size-4" />Sinov darsiga yozish</Button>}</div>
        {(trials.data ?? []).length === 0 ? <p className="text-muted">Sinov darsi belgilanmagan.</p> : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {trials.data!.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span><b>{group(t.group_id)}</b> · {fmtDT(t.scheduled_at)}</span>
                {t.attended === null ? <span className="flex gap-1"><Button size="sm" onClick={() => trialResult.mutate({ id: t.id, attended: true })}>Keldi</Button><Button size="sm" variant="ghost" onClick={() => trialResult.mutate({ id: t.id, attended: false })}>Kelmadi</Button></span>
                  : <Badge tone={t.attended ? 'success' : 'danger'}>{t.attended ? 'Keldi' : 'Kelmadi'}</Badge>}
              </li>))}
          </ul>
        )}
      </Modal>
      <FormModal open={edit} onClose={() => setEdit(false)} mode="edit" size="lg" title="Lidni tahrirlash" fields={LEAD_FIELDS} initial={lead as unknown as Record<string, unknown>} submitting={update.isPending} onSubmit={(p) => update.mutate(p)} />
      <SmsDialog open={sms} onClose={() => setSms(false)} lead={lead} />
      <FormModal open={task} onClose={() => setTask(false)} size="sm" title="Vazifa qo‘shish" submitting={addTask.isPending} onSubmit={(p) => addTask.mutate(p)}
        fields={[{ name: 'title', label: 'Vazifa', required: true, span: 2, placeholder: 'Qayta qo‘ng‘iroq qilish' }, { name: 'priority', label: 'Muhimligi', type: 'select', options: O_PRIORITY, default: 'medium' }, { name: 'due_at', label: 'Muddat', type: 'datetime' },
          { name: 'assigned_to', label: 'Mas‘ul', type: 'select', options: STAFF, emptyLabel: 'O‘zim', span: 2 }]} />
      <FormModal open={trial} onClose={() => setTrial(false)} size="sm" title="Sinov darsiga yozish" submitting={addTrial.isPending} onSubmit={(p) => addTrial.mutate(p)}
        fields={[{ name: 'group_id', label: 'Guruh', type: 'select', required: true, span: 2, options: { endpoint: '/groups/', params: { branch_id: lead.branch_id }, label: (g: Group) => g.name } }, { name: 'scheduled_at', label: 'Sana va vaqt', type: 'datetime', required: true, span: 2 }]} />
    </>
  )
}

/* ---------------- Doska ---------------- */
export default function LeadsPage() {
  const nav = useNavigate()
  const me = useAuth((s) => s.me)
  const branchId = useBranch((s) => s.branchId)
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')
  const dq = useDebounce(q)
  const statuses = useGet<LeadStatus[]>('/lead-statuses/')
  const leads = useGet<Page<Lead>>('/leads/', { limit: 200, q: dq || undefined, source_id: source || undefined, branch_id: branchId ?? undefined })
  const sources = useOptions<LeadSource>('/lead-sources/')
  const staff = useNames<Employee>('/employees/', (e) => fullName(e))
  const sourceName = useNames<LeadSource>('/lead-sources/', (s) => s.name)
  const [create, setCreate] = useState(false)
  const [open, setOpen] = useState<Lead | null>(null)
  const [lostFor, setLostFor] = useState<{ lead: Lead; status: LeadStatus } | null>(null)
  const [convertFor, setConvertFor] = useState<Lead | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const inv = ['/leads/', '/students/', '/reports/']
  const createLead = useMut((p: Record<string, unknown>) => api.post('/leads/', p), { invalidate: inv, success: 'Lid qo‘shildi', onSuccess: () => setCreate(false) })
  const move = useMut((v: { id: number; status_id: number; lost_reason?: string }) => api.patch(`/leads/${v.id}/status`, { status_id: v.status_id, lost_reason: v.lost_reason }),
    { invalidate: inv, success: 'Bosqich o‘zgartirildi', onSuccess: () => { setLostFor(null); setOpen(null) } })
  const convert = useMut((v: { id: number; p: Record<string, unknown> }) => api.post<Student>(`/leads/${v.id}/convert`, v.p), {
    invalidate: [...inv, '/groups/', '/enrollments/'], onSuccess: (s) => { setConvertFor(null); setOpen(null); toast.success('Lid o‘quvchiga aylantirildi'); nav(`/students/${s.id}`) } })

  const cols = [...(statuses.data ?? [])].sort((a, b) => a.position - b.position)
  const items = leads.data?.items ?? []
  const lostStatus = cols.find((c) => c.is_lost)

  function drop(col: LeadStatus) {
    const lead = items.find((l) => l.id === dragId)
    setOver(null); setDragId(null)
    if (!lead || lead.status_id === col.id) return
    if (lead.student_id) return void toast.error('Bu lid allaqachon o‘quvchiga aylantirilgan')
    if (col.is_won) return setConvertFor(lead)
    if (col.is_lost) return setLostFor({ lead, status: col })
    move.mutate({ id: lead.id, status_id: col.id })
  }

  return (
    <>
      <PageHeader title="Lidlar" subtitle="Qiziqqan odamlar voronkasi. Kartani bosqichlar orasida sudrab o‘tkazing."
        actions={<Button variant="primary" onClick={() => setCreate(true)}><Plus className="size-4" />Yangi lid</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" aria-hidden /><Input className="pl-8" placeholder="Ism yoki telefon" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" /></div>
        <Select className="w-auto min-w-40" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Manba"><option value="">Barcha manbalar</option>{sources.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </div>
      {statuses.isLoading || leads.isLoading ? <div className="py-20 text-center"><Spinner className="size-7" /></div> : cols.length === 0 ? (
        <EmptyState title="Lid bosqichlari sozlanmagan" hint="Sozlamalar → Ma‘lumotnomalar → Lid bosqichlari" />
      ) : (
        <div className="scroll-thin -mx-3 flex gap-3 overflow-x-auto px-3 pb-4 sm:-mx-6 sm:px-6">
          {cols.map((c) => {
            const list = items.filter((l) => l.status_id === c.id)
            return (
              <section key={c.id} aria-label={c.name} onDragOver={(e) => { e.preventDefault(); setOver(c.id) }} onDragLeave={() => setOver((o) => (o === c.id ? null : o))} onDrop={() => drop(c)}
                className={cn('flex max-h-[calc(100vh-15rem)] w-72 shrink-0 flex-col rounded-lg border bg-sunken/70 transition-colors', over === c.id ? 'border-brand bg-brand-soft/60' : 'border-line')}>
                <header className={cn('flex items-center justify-between rounded-t-lg border-t-[3px] px-3 py-2.5', c.is_won ? 'border-success' : c.is_lost ? 'border-danger' : 'border-brand')}>
                  <h2 className="font-display font-semibold">{c.name}</h2><Badge>{list.length}</Badge>
                </header>
                <ul className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {list.map((l) => (
                    <li key={l.id} draggable={!l.student_id} onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(l.id)); setDragId(l.id) }} onDragEnd={() => { setDragId(null); setOver(null) }}
                      className={cn('group rounded-md border border-line bg-surface p-3 shadow-sm', dragId === l.id && 'opacity-40', !l.student_id && 'cursor-grab active:cursor-grabbing')}>
                      <div className="flex items-start justify-between gap-1">
                        <button onClick={() => setOpen(l)} className="text-left font-medium hover:text-brand hover:underline">{fullName(l)}</button>
                        {!l.student_id && <GripVertical className="mt-0.5 size-4 shrink-0 text-muted/50" aria-hidden />}
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">{l.phone}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {l.source_id && <Badge>{sourceName(l.source_id)}</Badge>}<span>{fmtDate(l.created_at)}</span>{l.assigned_to && <span>· {staff(l.assigned_to)}</span>}
                      </div>
                      {!l.student_id && (
                        <Select aria-label="Bosqichni o‘zgartirish" value={l.status_id} className="mt-2 h-7 text-xs" onChange={(e) => { const col = cols.find((x) => x.id === Number(e.target.value)); if (!col) return
                          if (col.is_won) setConvertFor(l); else if (col.is_lost) setLostFor({ lead: l, status: col }); else move.mutate({ id: l.id, status_id: col.id }) }}>
                          {cols.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </Select>
                      )}
                    </li>
                  ))}
                  {list.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">Bo‘sh</li>}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <FormModal open={create} onClose={() => setCreate(false)} size="lg" title="Yangi lid" fields={LEAD_FIELDS} submitting={createLead.isPending} onSubmit={(p) => createLead.mutate(p)} />
      <LeadModal lead={open} onClose={() => setOpen(null)} onConvert={(l) => setConvertFor(l)} onLost={(l) => lostStatus && setLostFor({ lead: l, status: lostStatus })} />
      <FormModal open={!!lostFor} onClose={() => setLostFor(null)} size="sm" title="Lid yo‘qotildi" submitLabel="Saqlash" submitting={move.isPending}
        description={lostFor && `${fullName(lostFor.lead)} — sababni yozib qo‘ying, keyin tahlil qilish oson bo‘ladi.`}
        fields={[{ name: 'lost_reason', label: 'Sabab', required: true, span: 2, placeholder: 'Qimmat, uzoq, boshqa markazni tanladi…' }]}
        onSubmit={(p) => lostFor && move.mutate({ id: lostFor.lead.id, status_id: lostFor.status.id, lost_reason: String(p.lost_reason) })} />
      <FormModal open={!!convertFor} onClose={() => setConvertFor(null)} size="md" title="O‘quvchiga aylantirish" submitLabel="Aylantirish" submitting={convert.isPending}
        description={convertFor && `${fullName(convertFor)} o‘quvchilar ro‘yxatiga qo‘shiladi. Guruh tanlasangiz, darhol yoziladi.`}
        initial={null}
        fields={[
          ...(convertFor && !convertFor.last_name ? [{ name: 'last_name', label: 'Familiya', required: true } as FieldDef] : []),
          { name: 'parent_phone', label: 'Ota-ona telefoni', type: 'tel' }, { name: 'birth_date', label: 'Tug‘ilgan sana', type: 'date' },
          { name: 'group_id', label: 'Guruh (ixtiyoriy)', type: 'select', span: 2, emptyLabel: 'Hozircha guruhsiz', options: { endpoint: '/groups/', params: { branch_id: convertFor?.branch_id }, label: (g: Group) => `${g.name} (${g.current_students}/${g.max_students})` } },
          { name: 'price', label: 'Oylik narx (ixtiyoriy)', type: 'money', span: 2 },
        ]}
        onSubmit={(p) => convertFor && convert.mutate({ id: convertFor.id, p })} />
      {me && null}
    </>
  )
}
