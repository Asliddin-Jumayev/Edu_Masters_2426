import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, FileUp, Link2, MessageSquare, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Attachment, Attendance, BalanceTxn, Discount, Enrollment, Group, Invoice, Page, Payment, PaymentMethod, Session, Student } from '@/api/types'
import { EnrollDialog, GenerateInvoicesDialog, OnlineCheckoutDialog, PaymentDialog, SmsDialog } from '@/components/dialogs'
import { FormModal } from '@/components/resource'
import { Badge, Button, Confirm, DataTable, EmptyState, Money, Pager, Panel, Spinner, StatusBadge, Tabs } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { ATTENDANCE_STATUS, ENROLLMENT_STATUS, INVOICE_STATUS, O_DISCOUNT_TYPE, PAYMENT_STATUS, STUDENT_STATUS, TXN_LABEL } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fmtMoney, fmtMonth, fmtTime, fmtTs, fullName } from '@/lib/utils'
import { STUDENT_FIELDS } from './StudentsPage'

type Tab = 'overview' | 'invoices' | 'payments' | 'ledger' | 'discounts' | 'attendance' | 'files'
const SID = '/students/'

/* ============ Yozilishlar ============ */
function EnrollmentsTab({ s }: { s: Student }) {
  const me = useAuth((x) => x.me)
  const q = useGet<Page<Enrollment>>('/enrollments/', { student_id: s.id, limit: 100 })
  const group = useNames<Group>('/groups/', (g) => g.name)
  const [enroll, setEnroll] = useState(false)
  const [priceFor, setPriceFor] = useState<Enrollment | null>(null)
  const inv = ['/enrollments/', '/groups/', SID]
  const setStatus = useMut((v: { id: number; status: string }) => api.patch(`/enrollments/${v.id}/status`, { status: v.status }), { invalidate: inv, success: 'Holat o‘zgartirildi' })
  const setPrice = useMut((v: { id: number; price: string }) => api.patch(`/enrollments/${v.id}/price`, { price: v.price }), { invalidate: inv, success: 'Narx o‘zgartirildi', onSuccess: () => setPriceFor(null) })
  const mgr = can.manager(me)
  return (
    <Panel title="Guruhlar" flush actions={mgr && <Button variant="primary" size="sm" onClick={() => setEnroll(true)}><Plus className="size-4" />Guruhga yozish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(e) => e.id}
        columns={[
          { key: 'g', header: 'Guruh', cell: (e) => <Link className="font-medium text-brand hover:underline" to={`/groups/${e.group_id}`}>{group(e.group_id)}</Link> },
          { key: 'p', header: 'Oylik narx', cell: (e) => <Money value={e.price} />, align: 'right' },
          { key: 'j', header: 'Boshlagan', cell: (e) => fmtDate(e.joined_at) },
          { key: 'l', header: 'Chiqqan', cell: (e) => fmtDate(e.left_at) },
          { key: 's', header: 'Holat', cell: (e) => <StatusBadge map={ENROLLMENT_STATUS} value={e.status} /> },
          ...(mgr ? [{ key: 'a', header: '', align: 'right' as const, cell: (e: Enrollment) => (
            <div className="flex justify-end gap-1">
              {e.status === 'active' && <><Button size="sm" onClick={() => setStatus.mutate({ id: e.id, status: 'frozen' })}>Muzlatish</Button>
                <Button size="sm" onClick={() => setStatus.mutate({ id: e.id, status: 'completed' })}>Yakunlash</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setStatus.mutate({ id: e.id, status: 'dropped' })}>Chiqarish</Button></>}
              {e.status !== 'active' && <Button size="sm" onClick={() => setStatus.mutate({ id: e.id, status: 'active' })}>Qayta faollashtirish</Button>}
              <Button size="sm" variant="ghost" aria-label="Narxni o‘zgartirish" onClick={() => setPriceFor(e)}><Pencil className="size-4" /></Button>
            </div>) }] : []),
        ]} />
      <EnrollDialog open={enroll} onClose={() => setEnroll(false)} student={s} />
      <FormModal open={!!priceFor} onClose={() => setPriceFor(null)} mode="create" size="sm" title="Oylik narxni o‘zgartirish" submitLabel="Saqlash"
        description="Yangi narx faqat keyingi hisoblarga ta‘sir qiladi; yozilgan hisoblar o‘zgarmaydi."
        fields={[{ name: 'price', label: 'Yangi narx (so‘m)', type: 'money', required: true, default: priceFor?.price, span: 2 }]}
        submitting={setPrice.isPending} onSubmit={(p) => priceFor && setPrice.mutate({ id: priceFor.id, price: String(p.price) })} />
    </Panel>
  )
}

/* ============ Hisoblar ============ */
function InvoicesTab({ s }: { s: Student }) {
  const me = useAuth((x) => x.me)
  const [offset, setOffset] = useState(0)
  const q = useGet<Page<Invoice>>('/invoices/', { student_id: s.id, limit: 20, offset })
  const [gen, setGen] = useState(false)
  const [cancelFor, setCancelFor] = useState<Invoice | null>(null)
  const cancel = useMut((v: { id: number; reason: string }) => api.post(`/invoices/${v.id}/cancel`, { reason: v.reason }), { invalidate: ['/invoices/', SID], success: 'Hisob bekor qilindi', onSuccess: () => setCancelFor(null) })
  return (
    <Panel title="Hisob-fakturalar" flush actions={can.finance(me) && <Button size="sm" onClick={() => setGen(true)}><Plus className="size-4" />Hisob yaratish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(i) => i.id}
        columns={[
          { key: 'm', header: 'Oy', cell: (i) => <span className="font-medium capitalize">{fmtMonth(i.period_month)}</span> },
          { key: 'a', header: 'Summa', cell: (i) => <Money value={i.amount} />, align: 'right' },
          { key: 'd', header: 'Chegirma', cell: (i) => (Number(i.discount_amount) ? <Money value={i.discount_amount} /> : '—'), align: 'right' },
          { key: 't', header: 'To‘lashi kerak', cell: (i) => <Money value={i.total} className="font-medium" />, align: 'right' },
          { key: 'p', header: 'To‘langan', cell: (i) => <Money value={i.paid_amount} />, align: 'right' },
          { key: 'due', header: 'Muddat', cell: (i) => fmtDate(i.due_date) },
          { key: 's', header: 'Holat', cell: (i) => <StatusBadge map={INVOICE_STATUS} value={i.status} /> },
          ...(can.accountant(me) ? [{ key: 'x', header: '', align: 'right' as const, cell: (i: Invoice) => i.status !== 'cancelled' && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelFor(i)}>Bekor qilish</Button> }] : []),
        ]} />
      <Pager total={q.data?.total ?? 0} limit={20} offset={offset} onChange={setOffset} />
      <GenerateInvoicesDialog open={gen} onClose={() => setGen(false)} studentId={s.id} />
      <FormModal open={!!cancelFor} onClose={() => setCancelFor(null)} size="sm" title="Hisobni bekor qilish" submitLabel="Bekor qilish"
        description="Hisob summasi o‘quvchi balansiga qaytariladi. Sabab audit jurnaliga yoziladi."
        fields={[{ name: 'reason', label: 'Sabab', required: true, span: 2 }]} submitting={cancel.isPending}
        onSubmit={(p) => cancelFor && cancel.mutate({ id: cancelFor.id, reason: String(p.reason) })} />
    </Panel>
  )
}

/* ============ To'lovlar ============ */
function PaymentsTab({ s }: { s: Student }) {
  const me = useAuth((x) => x.me)
  const [offset, setOffset] = useState(0)
  const q = useGet<Page<Payment>>('/payments/', { student_id: s.id, limit: 20, offset })
  const method = useNames<PaymentMethod>('/payment-methods/', (m) => m.name)
  const [pay, setPay] = useState(false)
  const [refundFor, setRefundFor] = useState<Payment | null>(null)
  const fin = ['/payments/', '/invoices/', SID]
  const refund = useMut((id: number) => api.post(`/payments/${id}/refund`), { invalidate: fin, success: 'To‘lov qaytarildi', onSuccess: () => setRefundFor(null) })
  const confirm = useMut((id: number) => api.post(`/payments/${id}/confirm`), { invalidate: fin, success: 'To‘lov tasdiqlandi' })
  const cancelLink = useMut((id: number) => api.post(`/payments/online/${id}/cancel`), { invalidate: fin, success: 'To‘lov havolasi bekor qilindi' })
  return (
    <Panel title="To‘lovlar" flush actions={can.finance(me) && <Button variant="primary" size="sm" onClick={() => setPay(true)}><Wallet className="size-4" />To‘lov qabul qilish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(p) => p.id}
        columns={[
          { key: 'd', header: 'Sana', cell: (p) => <span className="num">{fmtTs(p.paid_at)}</span> },
          { key: 'a', header: 'Summa', cell: (p) => <Money value={p.amount} className={p.is_refunded ? 'line-through opacity-60' : 'font-medium'} />, align: 'right' },
          { key: 'm', header: 'Usul', cell: (p) => method(p.method_id) },
          { key: 't', header: 'Tranzaksiya', cell: (p) => p.transaction_id ?? '—' },
          { key: 's', header: 'Holat', cell: (p) => p.is_refunded ? <Badge tone="danger">Qaytarilgan</Badge> : <StatusBadge map={PAYMENT_STATUS} value={p.status} /> },
          ...(can.finance(me) ? [{ key: 'x', header: '', align: 'right' as const, cell: (p: Payment) => (
            <div className="flex justify-end gap-1">
              {p.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => cancelLink.mutate(p.id)}>Havolani bekor qilish</Button>}
              {p.status === 'pending' && can.accountant(me) && <Button size="sm" onClick={() => confirm.mutate(p.id)}>Qo‘lda tasdiqlash</Button>}
              {p.status === 'completed' && !p.is_refunded && can.accountant(me) && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRefundFor(p)}>Qaytarish</Button>}
            </div>) }] : []),
        ]} />
      <Pager total={q.data?.total ?? 0} limit={20} offset={offset} onChange={setOffset} />
      <PaymentDialog open={pay} onClose={() => setPay(false)} student={s} />
      <Confirm open={!!refundFor} onClose={() => setRefundFor(null)} danger loading={refund.isPending} confirmLabel="Qaytarish" title="To‘lovni qaytarish?"
        message={<>{fmtMoney(refundFor?.amount)} o‘quvchi balansidan ayiriladi va hisoblar qayta taqsimlanadi.</>} onConfirm={() => refundFor && refund.mutate(refundFor.id)} />
    </Panel>
  )
}

/* ============ Balans tarixi ============ */
function LedgerTab({ s }: { s: Student }) {
  const me = useAuth((x) => x.me)
  const [offset, setOffset] = useState(0)
  const q = useGet<Page<BalanceTxn>>(`/students/${s.id}/balance`, { limit: 20, offset })
  const [adj, setAdj] = useState(false)
  const adjust = useMut((p: Record<string, unknown>) => api.post(`/students/${s.id}/balance/adjust`, p), { invalidate: [SID, '/invoices/'], success: 'Tuzatish kiritildi', onSuccess: () => setAdj(false) })
  return (
    <Panel title="Balans tarixi" flush actions={can.accountant(me) && <Button size="sm" onClick={() => setAdj(true)}>Tuzatish kiritish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(t) => t.id}
        columns={[
          { key: 'd', header: 'Sana', cell: (t) => <span className="num">{fmtTs(t.created_at)}</span> },
          { key: 't', header: 'Amal', cell: (t) => TXN_LABEL[t.type] ?? t.type },
          { key: 'a', header: 'Summa', cell: (t) => <Money value={t.amount} signed />, align: 'right' },
          { key: 'b', header: 'Qoldiq', cell: (t) => <Money value={t.balance_after} />, align: 'right' },
        ]} />
      <Pager total={q.data?.total ?? 0} limit={20} offset={offset} onChange={setOffset} />
      <FormModal open={adj} onClose={() => setAdj(false)} title="Balansga tuzatish kiritish" size="sm" submitLabel="Kiritish" submitting={adjust.isPending}
        description="Musbat summa balansni oshiradi (avans), manfiy — qarzni oshiradi. Sabab audit jurnaliga yoziladi."
        fields={[{ name: 'amount', label: 'Summa (+ yoki −)', required: true, span: 2, placeholder: '-50000' }, { name: 'reason', label: 'Sabab', required: true, span: 2 }]}
        onSubmit={(p) => adjust.mutate({ amount: String(p.amount), reason: p.reason })} />
    </Panel>
  )
}

/* ============ Chegirmalar ============ */
function DiscountsTab({ s }: { s: Student }) {
  const q = useGet<Discount[]>('/discounts/', { student_id: s.id })
  const enr = useGet<Page<Enrollment>>('/enrollments/', { student_id: s.id, limit: 100 })
  const group = useNames<Group>('/groups/', (g) => g.name)
  const [add, setAdd] = useState(false)
  const [delFor, setDelFor] = useState<Discount | null>(null)
  const create = useMut((p: Record<string, unknown>) => api.post('/discounts/', { ...p, student_id: s.id }), { invalidate: ['/discounts/'], success: 'Chegirma qo‘shildi', onSuccess: () => setAdd(false) })
  const del = useMut((id: number) => api.del(`/discounts/${id}`), { invalidate: ['/discounts/'], success: 'Chegirma o‘chirildi', onSuccess: () => setDelFor(null) })
  return (
    <Panel title="Chegirmalar" flush actions={<Button size="sm" onClick={() => setAdd(true)}><Plus className="size-4" />Chegirma qo‘shish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data ?? []} rowKey={(d) => d.id}
        empty={<EmptyState title="Chegirma yo‘q" hint="Chegirma har oylik hisob yozilganda avtomatik qo‘llanadi." />}
        columns={[
          { key: 'v', header: 'Chegirma', cell: (d) => <span className="font-medium">{d.type === 'percent' ? `${Number(d.value)}%` : fmtMoney(d.value)}</span> },
          { key: 'e', header: 'Qaysi guruhga', cell: (d) => (d.enrollment_id ? group(enr.data?.items.find((e) => e.id === d.enrollment_id)?.group_id) : 'Hamma guruhga') },
          { key: 'r', header: 'Sabab', cell: (d) => d.reason ?? '—' },
          { key: 'f', header: 'Amal qilish muddati', cell: (d) => `${fmtDate(d.valid_from)} — ${d.valid_to ? fmtDate(d.valid_to) : 'muddatsiz'}` },
          { key: 'x', header: '', align: 'right', cell: (d) => <Button size="sm" variant="ghost" aria-label="O‘chirish" onClick={() => setDelFor(d)}><Trash2 className="size-4 text-danger" /></Button> },
        ]} />
      <FormModal open={add} onClose={() => setAdd(false)} title="Chegirma qo‘shish" submitting={create.isPending}
        description="Yozilgan hisoblar o‘zgarmaydi: chegirma keyingi hisoblarga qo‘llanadi."
        fields={[
          { name: 'type', label: 'Turi', type: 'select', options: O_DISCOUNT_TYPE, required: true, default: 'percent' },
          { name: 'value', label: 'Qiymati', type: 'money', required: true, hint: 'Foiz yoki so‘m' },
          { name: 'enrollment_id', label: 'Qaysi guruhga', type: 'select', emptyLabel: 'Hamma guruhga', options: (enr.data?.items ?? []).filter((e) => e.status === 'active').map((e) => ({ value: e.id, label: group(e.group_id) })), span: 2 },
          { name: 'reason', label: 'Sabab', span: 2, placeholder: 'Aka-uka, ijtimoiy…' },
          { name: 'valid_from', label: 'Boshlanishi', type: 'date', default: () => new Date().toISOString().slice(0, 10) },
          { name: 'valid_to', label: 'Tugashi', type: 'date', hint: 'Bo‘sh = muddatsiz' },
        ]} onSubmit={(p) => create.mutate(p)} />
      <Confirm open={!!delFor} onClose={() => setDelFor(null)} danger loading={del.isPending} confirmLabel="O‘chirish" title="Chegirmani o‘chirish?"
        message="Yozilgan hisoblar o‘zgarmaydi, faqat kelgusi hisoblarga qo‘llanmaydi." onConfirm={() => delFor && del.mutate(delFor.id)} />
    </Panel>
  )
}

/* ============ Davomat ============ */
function AttendanceTab({ s }: { s: Student }) {
  const q = useQuery({
    queryKey: ['/attendance-view', s.id],
    queryFn: async () => {
      const att = await api.list<Attendance>('/attendances/', { student_id: s.id, limit: 200 })
      const enr = await api.list<Enrollment>('/enrollments/', { student_id: s.id, limit: 100 })
      const groupIds = [...new Set(enr.map((e) => e.group_id))]
      const sessions = (await Promise.all(groupIds.map((g) => api.list<Session>('/lesson-sessions/', { group_id: g, limit: 200 })))).flat()
      const byId = new Map(sessions.map((x) => [x.id, x]))
      return att.map((a) => ({ a, s: byId.get(a.session_id) })).sort((x, y) => (y.s?.date ?? '').localeCompare(x.s?.date ?? ''))
    },
  })
  const group = useNames<Group>('/groups/', (g) => g.name)
  const rows = q.data ?? []
  const count = (st: string) => rows.filter((r) => r.a.status === st).length
  const attended = count('present') + count('late')
  return (
    <Panel title="Davomat" flush actions={rows.length > 0 && <span className="text-[13px] text-muted">Qatnashgan: <b className="text-fg">{Math.round((attended * 100) / rows.length)}%</b> · Kelmagan: <b className="text-danger">{count('absent')}</b></span>}>
      <DataTable loading={q.isLoading} rows={rows} rowKey={(r) => r.a.id}
        columns={[
          { key: 'd', header: 'Sana', cell: (r) => fmtDate(r.s?.date) },
          { key: 't', header: 'Vaqt', cell: (r) => (r.s ? `${fmtTime(r.s.start_time)}–${fmtTime(r.s.end_time)}` : '—') },
          { key: 'g', header: 'Guruh', cell: (r) => group(r.s?.group_id) },
          { key: 's', header: 'Holat', cell: (r) => <StatusBadge map={ATTENDANCE_STATUS} value={r.a.status} /> },
          { key: 'n', header: 'Izoh', cell: (r) => r.a.note ?? '—' },
        ]} />
    </Panel>
  )
}

/* ============ Fayllar ============ */
function FilesTab({ s }: { s: Student }) {
  const q = useGet<Attachment[]>('/attachments/', { entity_type: 'student', entity_id: s.id })
  const input = useRef<HTMLInputElement>(null)
  const up = useMut((f: File) => { const fd = new FormData(); fd.append('entity_type', 'student'); fd.append('entity_id', String(s.id)); fd.append('file', f); return api.upload('/attachments/', fd) }, { invalidate: ['/attachments/'], success: 'Fayl yuklandi' })
  const del = useMut((id: number) => api.del(`/attachments/${id}`), { invalidate: ['/attachments/'], success: 'Fayl o‘chirildi' })
  return (
    <Panel title="Fayllar" flush actions={<>
      <input ref={input} type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = '' }} />
      <Button size="sm" loading={up.isPending} onClick={() => input.current?.click()}><FileUp className="size-4" />Fayl yuklash</Button></>}>
      <DataTable loading={q.isLoading} rows={q.data ?? []} rowKey={(a) => a.id}
        empty={<EmptyState title="Fayl yo‘q" hint="Shartnoma, pasport nusxasi, rasm (PDF, Word, Excel, JPG, PNG — 10 MB gacha)." />}
        columns={[
          { key: 'n', header: 'Fayl', cell: (a) => <span className="font-medium">{a.file_name}</span> },
          { key: 'd', header: 'Yuklangan', cell: (a) => fmtTs(a.created_at) },
          { key: 'x', header: '', align: 'right', cell: (a) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" aria-label="Yuklab olish" onClick={() => api.download(`/attachments/${a.id}/download`, a.file_name)}><Download className="size-4" /></Button>
              <Button size="sm" variant="ghost" aria-label="O‘chirish" onClick={() => del.mutate(a.id)}><Trash2 className="size-4 text-danger" /></Button>
            </div>) },
        ]} />
    </Panel>
  )
}

/* ============ Sahifa ============ */
export default function StudentDetail() {
  const { id } = useParams()
  const sid = Number(id)
  const nav = useNavigate()
  const me = useAuth((x) => x.me)
  const q = useGet<Student>(`/students/${sid}`)
  const [tab, setTab] = useState<Tab>('overview')
  const [pay, setPay] = useState(false)
  const [online, setOnline] = useState(false)
  const [sms, setSms] = useState(false)
  const [edit, setEdit] = useState(false)
  const update = useMut((p: Record<string, unknown>) => api.put(`/students/${sid}`, p), { invalidate: [SID], success: 'O‘zgarishlar saqlandi', onSuccess: () => setEdit(false) })

  if (q.isLoading) return <div className="grid place-items-center py-24"><Spinner className="size-7" /></div>
  if (q.error || !q.data) return <EmptyState title="O‘quvchi topilmadi" hint="Ruxsatingiz yo‘q yoki o‘quvchi mavjud emas." action={<Button onClick={() => nav('/students')}>Ro‘yxatga qaytish</Button>} />
  const s = q.data
  const fin = can.finance(me)
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Guruhlar' },
    ...(fin ? [{ id: 'invoices' as Tab, label: 'Hisoblar' }, { id: 'payments' as Tab, label: 'To‘lovlar' }, { id: 'ledger' as Tab, label: 'Balans tarixi' }, { id: 'discounts' as Tab, label: 'Chegirmalar' }] : []),
    { id: 'attendance', label: 'Davomat' },
    ...(can.manager(me) || can.accountant(me) ? [{ id: 'files' as Tab, label: 'Fayllar' }] : []),
  ]
  const bal = Number(s.balance)
  return (
    <>
      <div className="mb-1 text-[13px] text-muted"><Link to="/students" className="hover:underline">O‘quvchilar</Link> / {fullName(s)}</div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold leading-tight">{fullName(s)}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <StatusBadge map={STUDENT_STATUS} value={s.status} />
            {s.phone && <span>{s.phone}</span>}{s.parent_phone && <span>Ota-ona: {s.parent_phone}</span>}{s.birth_date && <span>{fmtDate(s.birth_date)}</span>}
          </div>
        </div>
        {fin && (
          <div className="min-w-48 rounded-lg border border-line bg-surface px-4 py-3 text-right">
            <div className="text-[13px] text-muted">{bal < 0 ? 'Qarzdorlik' : bal > 0 ? 'Avans (oldindan to‘lov)' : 'Balans'}</div>
            <div className={`font-display num text-[28px] font-semibold leading-tight ${bal < 0 ? 'text-danger' : bal > 0 ? 'text-success' : ''}`}>{fmtMoney(Math.abs(bal))}</div>
          </div>
        )}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {fin && <Button variant="mark" onClick={() => setPay(true)}><Wallet className="size-4" />To‘lov qabul qilish</Button>}
        {fin && <Button onClick={() => setOnline(true)}><Link2 className="size-4" />Onlayn to‘lov havolasi</Button>}
        {fin && <Button onClick={() => setSms(true)}><MessageSquare className="size-4" />SMS</Button>}
        {can.manager(me) && <Button onClick={() => setEdit(true)}><Pencil className="size-4" />Tahrirlash</Button>}
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && <EnrollmentsTab s={s} />}
      {tab === 'invoices' && <InvoicesTab s={s} />}
      {tab === 'payments' && <PaymentsTab s={s} />}
      {tab === 'ledger' && <LedgerTab s={s} />}
      {tab === 'discounts' && <DiscountsTab s={s} />}
      {tab === 'attendance' && <AttendanceTab s={s} />}
      {tab === 'files' && <FilesTab s={s} />}
      <PaymentDialog open={pay} onClose={() => setPay(false)} student={s} />
      <OnlineCheckoutDialog open={online} onClose={() => setOnline(false)} student={s} />
      <SmsDialog open={sms} onClose={() => setSms(false)} student={s} />
      <FormModal open={edit} onClose={() => setEdit(false)} mode="edit" size="lg" title="O‘quvchini tahrirlash" fields={STUDENT_FIELDS}
        initial={s as unknown as Record<string, unknown>} submitting={update.isPending} onSubmit={(p) => update.mutate(p)} />
    </>
  )
}
