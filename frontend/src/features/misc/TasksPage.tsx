import { useEffect, useState } from 'react'
import { Check, Circle, Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useMut } from '@/api/hooks'
import type { Employee, Task } from '@/api/types'
import { LeadPicker, StudentName, StudentPicker } from '@/components/pickers'
import { ResourcePage } from '@/components/resource'
import { Button, Field, Input, Modal, Segmented, Select, StatusBadge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { O_PRIORITY, PRIORITY } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { cn, fmtDT, fullName } from '@/lib/utils'
import type { Student } from '@/api/types'

const STAFF = { endpoint: '/employees/', params: { is_active: true }, label: (e: Employee) => fullName(e) }

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useAuth((s) => s.me)
  const mgr = can.manager(me)
  const [kind, setKind] = useState<'student' | 'lead'>('student')
  const [st, setSt] = useState<Student | null>(null)
  const [lead, setLead] = useState<{ id: number; first_name: string; last_name: string | null; phone: string } | null>(null)
  const [title, setTitle] = useState(''); const [priority, setPriority] = useState('medium'); const [due, setDue] = useState(''); const [assignee, setAssignee] = useState('')
  useEffect(() => { if (open) { setKind('student'); setSt(null); setLead(null); setTitle(''); setPriority('medium'); setDue(''); setAssignee('') } }, [open])
  const staff = useNames<Employee>(mgr ? '/employees/' : null, (e) => fullName(e))
  void staff
  const create = useMut(() => api.post('/tasks/', { title, priority, due_at: due || undefined, assigned_to: assignee ? Number(assignee) : undefined, student_id: kind === 'student' ? st?.id : undefined, lead_id: kind === 'lead' ? lead?.id : undefined }),
    { invalidate: ['/tasks/'], success: 'Vazifa qo‘shildi', onSuccess: onClose })
  const target = kind === 'student' ? st : lead
  return (
    <Modal open={open} onClose={onClose} title="Yangi vazifa" footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" disabled={!title.trim() || !target} loading={create.isPending} onClick={() => create.mutate(undefined)}>Qo‘shish</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vazifa" required className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ota-onasiga qo‘ng‘iroq qilish" /></Field>
        {mgr && <div className="sm:col-span-2"><div className="mb-1 text-[13px] font-medium">Kimga bog‘liq</div><Segmented options={[{ value: 'student', label: 'O‘quvchi' }, { value: 'lead', label: 'Lid' }]} value={kind} onChange={setKind} /></div>}
        <div className="sm:col-span-2">{kind === 'student' ? <StudentPicker value={st} onChange={setSt} /> : <LeadPicker value={lead} onChange={setLead} />}</div>
        <Field label="Muhimligi"><Select value={priority} onChange={(e) => setPriority(e.target.value)}>{O_PRIORITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        <Field label="Muddat"><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        {mgr && <Field label="Mas‘ul" className="sm:col-span-2"><AssigneeSelect value={assignee} onChange={setAssignee} /></Field>}
      </div>
    </Modal>
  )
}

function AssigneeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [opts, setOpts] = useState<Employee[]>([])
  useEffect(() => { void api.list<Employee>(STAFF.endpoint, { ...STAFF.params, limit: 200 }).then(setOpts).catch(() => undefined) }, [])
  return <Select value={value} onChange={(e) => onChange(e.target.value)}><option value="">O‘zim</option>{opts.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</Select>
}

export default function TasksPage() {
  const me = useAuth((s) => s.me)
  const [create, setCreate] = useState(false)
  const staff = useNames<Employee>(can.finance(me) ? '/employees/' : null, (e) => fullName(e))
  const toggle = useMut((t: Task) => api.patch(`/tasks/${t.id}/complete`, undefined, { done: !t.completed_at }), { invalidate: ['/tasks/'], silent: false })
  return (
    <>
      <ResourcePage<Task>
        title="Vazifalar" subtitle={can.manager(me) ? 'Barcha vazifalar. Boshqa xodimga ham vazifa biriktirishingiz mumkin.' : 'Sizga biriktirilgan vazifalar'} endpoint="/tasks/" noun="vazifa" pageSize={30}
        defaultFilters={{ completed: 'false' }} canCreate={() => false} modalSize="sm"
        headerActions={<Button variant="primary" onClick={() => setCreate(true)}><Plus className="size-4" />Yangi vazifa</Button>}
        filters={[
          { name: 'completed', label: 'Holat', type: 'select', emptyLabel: 'Hammasi', options: [{ value: 'false', label: 'Ochiq' }, { value: 'true', label: 'Bajarilgan' }] },
          { name: 'overdue', label: 'Muddati o‘tganlar', type: 'checkbox' },
          ...(can.manager(me) ? [{ name: 'assigned_to', label: 'Mas‘ul', type: 'select' as const, emptyLabel: 'Barcha xodimlar', options: STAFF }] : []),
        ]}
        columns={[
          { key: 'c', header: '', className: 'w-10', cell: (t) => (
            <button onClick={(e) => { e.stopPropagation(); toggle.mutate(t) }} aria-label={t.completed_at ? 'Qayta ochish' : 'Bajarildi'} className={cn('grid size-6 place-items-center rounded-full border', t.completed_at ? 'border-success bg-success text-white' : 'border-line text-transparent hover:border-success hover:text-success')}>
              {t.completed_at ? <Check className="size-4" /> : <Circle className="size-4 opacity-0" />}</button>) },
          { key: 't', header: 'Vazifa', cell: (t) => <span className={cn('font-medium', t.completed_at && 'text-muted line-through')}>{t.title}</span> },
          { key: 'o', header: 'Bog‘liq', cell: (t) => (t.student_id ? <StudentName id={t.student_id} /> : t.lead_id ? <span className="text-muted">Lid #{t.lead_id}</span> : '—') },
          ...(can.manager(me) ? [{ key: 'a', header: 'Mas‘ul', cell: (t: Task) => staff(t.assigned_to) }] : []),
          { key: 'p', header: 'Muhimligi', cell: (t) => <StatusBadge map={PRIORITY} value={t.priority} /> },
          { key: 'd', header: 'Muddat', cell: (t) => <span className={cn('num', !t.completed_at && t.due_at && new Date(t.due_at) < new Date() && 'font-medium text-danger')}>{t.due_at ? fmtDT(t.due_at) : '—'}</span> },
        ]}
        fields={[
          { name: 'title', label: 'Vazifa', required: true, span: 2 }, { name: 'priority', label: 'Muhimligi', type: 'select', options: O_PRIORITY },
          { name: 'due_at', label: 'Muddat', type: 'datetime', clearable: true },
          ...(can.manager(me) ? [{ name: 'assigned_to', label: 'Mas‘ul', type: 'select' as const, options: STAFF, span: 2 as const }] : []),
        ]}
      />
      <CreateDialog open={create} onClose={() => setCreate(false)} />
    </>
  )
}
