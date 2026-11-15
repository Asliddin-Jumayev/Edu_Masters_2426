import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, ClipboardCheck, Pencil, Plus, ReceiptText, Trash2, UserPlus } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Course, Employee, Exam, ExamResult, Group, Page, Room, Schedule, Session, Student } from '@/api/types'
import { EnrollDialog, GenerateInvoicesDialog } from '@/components/dialogs'
import { FormModal } from '@/components/resource'
import { Button, Confirm, DataTable, EmptyState, Field, Input, Modal, Money, Pager, Panel, Spinner, StatusBadge, Tabs, Badge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { GROUP_STATUS, O_EXAM_TYPE, SESSION_STATUS, WEEKDAYS, WEEKDAY_SHORT } from '@/lib/labels'
import { can, isTeacherOnly } from '@/lib/permissions'
import { fmtDate, fmtDT, fmtTime, fullName } from '@/lib/utils'
import { AttendanceDialog } from '@/features/lessons/AttendanceDialog'
import { GROUP_FIELDS } from './GroupsPage'

type Tab = 'students' | 'schedule' | 'sessions' | 'exams'

function StudentsTab({ g }: { g: Group }) {
  const me = useAuth((s) => s.me)
  const q = useGet<Student[]>(`/groups/${g.id}/students`)
  const [add, setAdd] = useState(false)
  const nav = useNavigate()
  return (
    <Panel title="O‘quvchilar" flush actions={can.manager(me) && g.current_students < g.max_students && <Button variant="primary" size="sm" onClick={() => setAdd(true)}><UserPlus className="size-4" />O‘quvchi qo‘shish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data ?? []} rowKey={(s) => s.id} onRowClick={(s) => nav(`/students/${s.id}`)}
        empty={<EmptyState title="Guruhda o‘quvchi yo‘q" />}
        columns={[
          { key: 'n', header: 'O‘quvchi', cell: (s) => <span className="font-medium">{fullName(s)}</span> },
          { key: 'p', header: 'Telefon', cell: (s) => s.phone ?? s.parent_phone ?? '—' },
          ...(can.finance(me) ? [{ key: 'b', header: 'Balans', align: 'right' as const, cell: (s: Student) => <Money value={s.balance} signed /> }] : []),
        ]} />
      <EnrollDialog open={add} onClose={() => setAdd(false)} group={g} />
    </Panel>
  )
}

function ScheduleTab({ g }: { g: Group }) {
  const me = useAuth((s) => s.me)
  const q = useGet<Schedule[]>(`/groups/${g.id}/schedules`)
  const room = useNames<Room>('/rooms/', (r) => r.name)
  const [form, setForm] = useState<{ row?: Schedule } | null>(null)
  const [del, setDel] = useState<Schedule | null>(null)
  const inv = [`/groups/${g.id}/schedules`]
  const save = useMut((p: Record<string, unknown>) => form?.row ? api.put(`/groups/${g.id}/schedules/${form.row.id}`, p) : api.post(`/groups/${g.id}/schedules`, p), { invalidate: inv, success: 'Jadval saqlandi', onSuccess: () => setForm(null) })
  const remove = useMut((id: number) => api.del(`/groups/${g.id}/schedules/${id}`), { invalidate: inv, success: 'Jadval o‘chirildi', onSuccess: () => setDel(null) })
  const mgr = can.manager(me)
  return (
    <Panel title="Haftalik dars jadvali" flush actions={mgr && <Button variant="primary" size="sm" onClick={() => setForm({})}><Plus className="size-4" />Dars kuni qo‘shish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data ?? []} rowKey={(s) => s.id}
        empty={<EmptyState title="Jadval kiritilmagan" hint="Avval haftalik kunlar va vaqtni kiriting, so‘ng ‘Darslar’ bo‘limida darslarni avtomatik yarating." />}
        columns={[
          { key: 'd', header: 'Kun', cell: (s) => <span className="font-medium">{WEEKDAYS.find((w) => w.value === s.weekday)?.label}</span> },
          { key: 't', header: 'Vaqt', cell: (s) => <span className="num">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span> },
          { key: 'r', header: 'Xona', cell: (s) => (s.room_id ? room(s.room_id) : <span className="text-muted">guruh xonasi</span>) },
          ...(mgr ? [{ key: 'a', header: '', align: 'right' as const, cell: (s: Schedule) => (
            <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" aria-label="Tahrirlash" onClick={() => setForm({ row: s })}><Pencil className="size-4" /></Button>
              <Button size="sm" variant="ghost" aria-label="O‘chirish" onClick={() => setDel(s)}><Trash2 className="size-4 text-danger" /></Button></div>) }] : []),
        ]} />
      <FormModal open={!!form} onClose={() => setForm(null)} mode={form?.row ? 'edit' : 'create'} size="sm" title={form?.row ? 'Jadvalni tahrirlash' : 'Dars kuni qo‘shish'}
        description="Xona yoki o‘qituvchi shu vaqtda band bo‘lsa, tizim ogohlantiradi." submitting={save.isPending} initial={form?.row as unknown as Record<string, unknown>} onSubmit={(p) => save.mutate(p)}
        fields={[
          { name: 'weekday', label: 'Hafta kuni', type: 'select', required: true, options: WEEKDAYS, span: 2 },
          { name: 'start_time', label: 'Boshlanishi', type: 'time', required: true }, { name: 'end_time', label: 'Tugashi', type: 'time', required: true },
          { name: 'room_id', label: 'Xona (ixtiyoriy)', type: 'select', clearable: true, emptyLabel: 'Guruh xonasi', span: 2, options: { endpoint: '/rooms/', params: { branch_id: g.branch_id }, label: (r: Room) => `${r.name} (${r.capacity})` } },
        ]} />
      <Confirm open={!!del} onClose={() => setDel(null)} danger loading={remove.isPending} title="Jadvalni o‘chirish?" confirmLabel="O‘chirish" message="Yaratilgan darslar saqlanib qoladi." onConfirm={() => del && remove.mutate(del.id)} />
    </Panel>
  )
}

function SessionsTab({ g }: { g: Group }) {
  const me = useAuth((s) => s.me)
  const [offset, setOffset] = useState(0)
  const q = useGet<Page<Session>>('/lesson-sessions/', { group_id: g.id, limit: 30, offset })
  const [gen, setGen] = useState(false)
  const [att, setAtt] = useState<Session | null>(null)
  const [genRes, setGenRes] = useState<{ created: number; skipped_existing: number; conflicts: string[] } | null>(null)
  const generate = useMut((p: Record<string, unknown>) => api.post<{ created: number; skipped_existing: number; conflicts: string[] }>('/lesson-sessions/generate', { group_id: g.id, ...p }),
    { invalidate: ['/lesson-sessions/'], onSuccess: (r) => { setGen(false); setGenRes(r) } })
  return (
    <Panel title="Darslar" flush actions={can.manager(me) && <Button size="sm" variant="primary" onClick={() => setGen(true)}><CalendarPlus className="size-4" />Jadval bo‘yicha yaratish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(s) => s.id}
        empty={<EmptyState title="Darslar yaratilmagan" hint="‘Jadval bo‘yicha yaratish’ tugmasi haftalik jadvaldan darslarni hosil qiladi." />}
        columns={[
          { key: 'd', header: 'Sana', cell: (s) => <span className="num font-medium">{fmtDate(s.date)}</span> },
          { key: 'w', header: 'Kun', cell: (s) => WEEKDAY_SHORT[new Date(s.date + 'T00:00').getDay() || 7] },
          { key: 't', header: 'Vaqt', cell: (s) => <span className="num">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span> },
          { key: 'm', header: 'Mavzu', cell: (s) => s.topic ?? <span className="text-muted">—</span> },
          { key: 's', header: 'Holat', cell: (s) => <StatusBadge map={SESSION_STATUS} value={s.status} /> },
          { key: 'a', header: '', align: 'right', cell: (s) => s.status !== 'cancelled' && <Button size="sm" onClick={() => setAtt(s)}><ClipboardCheck className="size-4" />Davomat</Button> },
        ]} />
      <Pager total={q.data?.total ?? 0} limit={30} offset={offset} onChange={setOffset} />
      <FormModal open={gen} onClose={() => setGen(false)} size="sm" title="Darslarni yaratish" submitLabel="Yaratish" submitting={generate.isPending}
        description="Sana berilmasa: guruh boshlanishidan 30 kun (yoki guruh tugash sanasigacha). Mavjud darslar qayta yaratilmaydi."
        fields={[{ name: 'date_from', label: 'Boshlanish', type: 'date' }, { name: 'date_to', label: 'Tugash', type: 'date' }]} onSubmit={(p) => generate.mutate(p)} />
      <Modal open={!!genRes} onClose={() => setGenRes(null)} size="sm" title="Natija" footer={<Button variant="primary" onClick={() => setGenRes(null)}>Tushunarli</Button>}>
        {genRes && <div className="space-y-2"><p><b>{genRes.created}</b> ta dars yaratildi, <b>{genRes.skipped_existing}</b> tasi avval mavjud edi.</p>
          {genRes.conflicts.length > 0 && <div className="rounded-md bg-warn-soft p-3 text-warn"><div className="mb-1 font-medium">{genRes.conflicts.length} ta to‘qnashuv o‘tkazib yuborildi:</div><ul className="list-disc pl-5 text-[13px]">{genRes.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}</div>}
      </Modal>
      <AttendanceDialog session={att} groupName={g.name} onClose={() => setAtt(null)} />
    </Panel>
  )
}

function ResultsDialog({ exam, group, onClose }: { exam: Exam | null; group: Group; onClose: () => void }) {
  const students = useGet<Student[]>(exam ? `/groups/${group.id}/students` : null)
  const results = useGet<ExamResult[]>(exam ? `/exams/${exam.id}/results` : null)
  const [vals, setVals] = useState<Record<number, string>>({})
  const [init, setInit] = useState<number | null>(null)
  if (exam && results.data && init !== exam.id) { setInit(exam.id); setVals(Object.fromEntries(results.data.map((r) => [r.student_id, String(Number(r.score))]))) }
  const save = useMut(() => api.put(`/exams/${exam!.id}/results`, { results: Object.entries(vals).filter(([, v]) => v !== '').map(([id, v]) => ({ student_id: Number(id), score: v })) }),
    { invalidate: ['/exams/'], success: 'Natijalar saqlandi', onSuccess: onClose })
  return (
    <Modal open={!!exam} onClose={() => { setInit(null); onClose() }} size="md" title={`Natijalar: ${exam?.title ?? ''}`}
      description={exam && `Maksimal ball: ${exam.max_score}, o‘tish balli: ${exam.passing_score}`}
      footer={<><Button onClick={onClose}>Yopish</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Saqlash</Button></>}>
      {!students.data ? <Spinner /> : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {students.data.map((s) => {
            const v = vals[s.id]
            const passed = v !== undefined && v !== '' && exam ? Number(v) >= exam.passing_score : null
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-medium">{fullName(s)}</span>
                <span className="flex items-center gap-2">
                  {passed !== null && <Badge tone={passed ? 'success' : 'danger'}>{passed ? 'O‘tdi' : 'O‘tmadi'}</Badge>}
                  <Input type="number" min={0} max={exam?.max_score} step="0.5" className="w-24 text-right" value={v ?? ''} onChange={(e) => setVals((p) => ({ ...p, [s.id]: e.target.value }))} aria-label={`${fullName(s)} bali`} />
                </span>
              </li>)
          })}
        </ul>
      )}
    </Modal>
  )
}

function ExamsTab({ g }: { g: Group }) {
  const me = useAuth((s) => s.me)
  const q = useGet<Page<Exam>>('/exams/', { group_id: g.id, limit: 50 })
  const [add, setAdd] = useState(false)
  const [res, setRes] = useState<Exam | null>(null)
  const create = useMut((p: Record<string, unknown>) => api.post('/exams/', { ...p, group_id: g.id }), { invalidate: ['/exams/'], success: 'Imtihon qo‘shildi', onSuccess: () => setAdd(false) })
  return (
    <Panel title="Imtihonlar" flush actions={can.academic(me) && <Button size="sm" variant="primary" onClick={() => setAdd(true)}><Plus className="size-4" />Imtihon qo‘shish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(e) => e.id}
        empty={<EmptyState title="Imtihon yo‘q" hint="Sertifikat berish uchun ‘Yakuniy’ turdagi imtihon natijalari kerak bo‘ladi." />}
        columns={[
          { key: 't', header: 'Imtihon', cell: (e) => <span className="font-medium">{e.title}</span> },
          { key: 'y', header: 'Turi', cell: (e) => O_EXAM_TYPE.find((o) => o.value === e.type)?.label },
          { key: 'm', header: 'Ball', cell: (e) => `${e.passing_score} / ${e.max_score}`, align: 'right' },
          { key: 'h', header: 'Sana', cell: (e) => fmtDT(e.held_at) },
          { key: 'a', header: '', align: 'right', cell: (e) => <Button size="sm" onClick={() => setRes(e)}>Natijalar</Button> },
        ]} />
      <FormModal open={add} onClose={() => setAdd(false)} title="Imtihon qo‘shish" submitting={create.isPending} onSubmit={(p) => create.mutate(p)}
        fields={[
          { name: 'title', label: 'Nomi', required: true, span: 2 }, { name: 'type', label: 'Turi', type: 'select', options: O_EXAM_TYPE, default: 'quiz' },
          { name: 'held_at', label: 'O‘tkazilgan vaqt', type: 'datetime' },
          { name: 'max_score', label: 'Maksimal ball', type: 'number', required: true, default: 100 }, { name: 'passing_score', label: 'O‘tish balli', type: 'number', required: true, default: 60 },
        ]} />
      <ResultsDialog exam={res} group={g} onClose={() => setRes(null)} />
    </Panel>
  )
}

export default function GroupDetail() {
  const { id } = useParams()
  const gid = Number(id)
  const me = useAuth((s) => s.me)
  const q = useGet<Group>(`/groups/${gid}`)
  const course = useNames<Course>('/courses/', (c) => c.name)
  const teacher = useNames<Employee>(can.finance(me) ? '/employees/' : null, (e) => fullName(e), { role: 'teacher' })
  const room = useNames<Room>('/rooms/', (r) => r.name)
  const [tab, setTab] = useState<Tab>('students')
  const [edit, setEdit] = useState(false)
  const [inv, setInv] = useState(false)
  const update = useMut((p: Record<string, unknown>) => api.put(`/groups/${gid}`, p), { invalidate: ['/groups/'], success: 'Guruh yangilandi', onSuccess: () => setEdit(false) })
  if (q.isLoading) return <div className="grid place-items-center py-24"><Spinner className="size-7" /></div>
  if (!q.data) return <EmptyState title="Guruh topilmadi" action={<Link to="/groups" className="text-brand underline">Guruhlar</Link>} />
  const g = q.data
  return (
    <>
      <div className="mb-1 text-[13px] text-muted"><Link to="/groups" className="hover:underline">Guruhlar</Link> / {g.name}</div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-tight">{g.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <StatusBadge map={GROUP_STATUS} value={g.status} /><span>{course(g.course_id)}</span>
            {g.teacher_id && <span>O‘qituvchi: {teacher(g.teacher_id)}</span>}{g.room_id && <span>Xona: {room(g.room_id)}</span>}
            <span>{g.current_students}/{g.max_students} o‘quvchi</span>{g.start_date && <span>{fmtDate(g.start_date)} — {fmtDate(g.end_date)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {can.finance(me) && <Button onClick={() => setInv(true)}><ReceiptText className="size-4" />Oylik hisob</Button>}
          {can.manager(me) && <Button onClick={() => setEdit(true)}><Pencil className="size-4" />Tahrirlash</Button>}
        </div>
      </div>
      <Tabs tabs={[{ id: 'students', label: 'O‘quvchilar' }, { id: 'schedule', label: 'Jadval' }, { id: 'sessions', label: 'Darslar' }, { id: 'exams', label: 'Imtihonlar' }] as { id: Tab; label: string }[]} value={tab} onChange={setTab} />
      {tab === 'students' && <StudentsTab g={g} />}{tab === 'schedule' && <ScheduleTab g={g} />}
      {tab === 'sessions' && <SessionsTab g={g} />}{tab === 'exams' && <ExamsTab g={g} />}
      <FormModal open={edit} onClose={() => setEdit(false)} mode="edit" size="lg" title="Guruhni tahrirlash" fields={GROUP_FIELDS} initial={g as unknown as Record<string, unknown>} submitting={update.isPending} onSubmit={(p) => update.mutate(p)} />
      <GenerateInvoicesDialog open={inv} onClose={() => setInv(false)} groupId={g.id} />
      {isTeacherOnly(me) && null}
    </>
  )
}
export { Field }
