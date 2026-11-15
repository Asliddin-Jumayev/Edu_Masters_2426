import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useGet, useMut, useOptions } from '@/api/hooks'
import type { Checkout, Group, Invoice, Lead, Page, PaymentMethod, SmsTemplate, Student } from '@/api/types'
import { StudentPicker } from '@/components/pickers'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { useBranch } from '@/lib/auth'
import { fmtMonth, fmtMoney, monthInputToDate, thisMonthInput } from '@/lib/utils'

const FIN = ['/payments/', '/invoices/', '/students/', '/reports/']

/* ---------------- To'lov qabul qilish ---------------- */
export function PaymentDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student?: Student | null }) {
  const [st, setSt] = useState<Student | null>(student ?? null)
  const [methodId, setMethodId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [txn, setTxn] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => { if (open) { setSt(student ?? null); setMethodId(''); setInvoiceId(''); setAmount(''); setTxn(''); setNote('') } }, [open, student])
  const methods = useOptions<PaymentMethod>(open ? '/payment-methods/' : null)
  const invoices = useGet<Page<Invoice>>(open && st ? '/invoices/' : null, { student_id: st?.id, limit: 100 })
  const method = methods.data?.find((m) => String(m.id) === methodId)
  const open_inv = (invoices.data?.items ?? []).filter((i) => !['paid', 'cancelled'].includes(i.status))
  const pay = useMut(() => api.post('/payments/', {
    student_id: st!.id, method_id: Number(methodId), amount, invoice_id: invoiceId ? Number(invoiceId) : undefined,
    transaction_id: txn || undefined, note: note || undefined,
  }), { invalidate: FIN, success: "To'lov qabul qilindi", onSuccess: onClose })
  const ok = !!st && !!methodId && Number(amount) > 0 && (!method?.is_online || !!txn)
  return (
    <Modal open={open} onClose={onClose} title="To‘lov qabul qilish" description={st ? `Joriy balans: ${fmtMoney(st.balance)}` : undefined}
      footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" disabled={!ok} loading={pay.isPending} onClick={() => pay.mutate(undefined)}>To‘lovni saqlash</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{student ? null : <StudentPicker value={st} onChange={setSt} />}</div>
        <Field label="To‘lov usuli" required><Select value={methodId} onChange={(e) => setMethodId(e.target.value)}><option value="">— tanlang —</option>{methods.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Summa (so‘m)" required><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Qaysi hisobga" hint="Tanlanmasa — eng eski qarzdan boshlab avtomatik yopiladi" className="sm:col-span-2">
          <Select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={!st}>
            <option value="">Avtomatik (eng eski hisobdan)</option>
            {open_inv.map((i) => <option key={i.id} value={i.id}>{fmtMonth(i.period_month)} — qoldiq {fmtMoney(Number(i.total) - Number(i.paid_amount))}</option>)}
          </Select>
        </Field>
        {method?.is_online && <Field label="Tranzaksiya raqami" required className="sm:col-span-2"><Input value={txn} onChange={(e) => setTxn(e.target.value)} /></Field>}
        <Field label="Izoh" className="sm:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/* ---------------- Guruhga yozish ---------------- */
export function EnrollDialog({ open, onClose, student, group }: { open: boolean; onClose: () => void; student?: Student | null; group?: Group | null }) {
  const [st, setSt] = useState<Student | null>(student ?? null)
  const [groupId, setGroupId] = useState(group ? String(group.id) : '')
  const [price, setPrice] = useState('')
  const [joined, setJoined] = useState('')
  useEffect(() => { if (open) { setSt(student ?? null); setGroupId(group ? String(group.id) : ''); setPrice(''); setJoined('') } }, [open, student, group])
  const branch = student?.branch_id ?? st?.branch_id
  const groups = useOptions<Group>(open && !group ? '/groups/' : null, { branch_id: branch })
  const choices = (groups.data ?? []).filter((g) => g.status === 'planned' || g.status === 'active')
  const enroll = useMut(() => api.post('/enrollments/', { student_id: st!.id, group_id: Number(groupId), price: price || undefined, joined_at: joined || undefined }),
    { invalidate: ['/enrollments/', '/groups/', '/students/'], success: 'O‘quvchi guruhga yozildi', onSuccess: onClose })
  return (
    <Modal open={open} onClose={onClose} title="Guruhga yozish" description="Narx kiritilmasa guruh yoki kurs narxi olinadi."
      footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" disabled={!st || !groupId} loading={enroll.isPending} onClick={() => enroll.mutate(undefined)}>Yozish</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{student ? null : <StudentPicker value={st} onChange={setSt} />}</div>
        {!group && (
          <Field label="Guruh" required className="sm:col-span-2">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">— tanlang —</option>
              {choices.map((g) => <option key={g.id} value={g.id} disabled={g.current_students >= g.max_students}>{g.name} ({g.current_students}/{g.max_students}){g.current_students >= g.max_students ? ' — to‘lgan' : ''}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Oylik narx (ixtiyoriy)"><Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Boshlanish sanasi"><Input type="date" value={joined} onChange={(e) => setJoined(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/* ---------------- Oylik hisoblarni yaratish ---------------- */
export function GenerateInvoicesDialog({ open, onClose, groupId, studentId }: { open: boolean; onClose: () => void; groupId?: number; studentId?: number }) {
  const branchId = useBranch((s) => s.branchId)
  const [month, setMonth] = useState(thisMonthInput())
  const gen = useMut(() => api.post<{ created: number; skipped_existing: number }>('/invoices/generate', {
    period_month: monthInputToDate(month), group_id: groupId, student_id: studentId, branch_id: groupId || studentId ? undefined : branchId ?? undefined }),
    { invalidate: FIN, onSuccess: (r) => { onClose(); import('sonner').then(({ toast }) => toast.success(`${r.created} ta hisob yaratildi, ${r.skipped_existing} tasi avval yozilgan edi`)) } })
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Oylik hisoblarni yaratish"
      description="Faol yozilishlar uchun tanlangan oyga hisob yoziladi (chegirmalar hisobga olinadi). Qayta bosilsa dublikat bo‘lmaydi."
      footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" loading={gen.isPending} onClick={() => gen.mutate(undefined)}>Yaratish</Button></>}>
      <Field label="Oy"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
      <p className="mt-3 text-[13px] text-muted">Doirasi: {studentId ? 'shu o‘quvchi' : groupId ? 'shu guruh' : branchId ? 'tanlangan filial' : 'barcha ruxsat etilgan filiallar'}</p>
    </Modal>
  )
}

/* ---------------- SMS yuborish ---------------- */
export function SmsDialog({ open, onClose, student, lead }: { open: boolean; onClose: () => void; student?: Student | null; lead?: Lead | null }) {
  const [tpl, setTpl] = useState('')
  const [body, setBody] = useState('')
  const [to, setTo] = useState('auto')
  useEffect(() => { if (open) { setTpl(''); setBody(''); setTo('auto') } }, [open])
  const templates = useOptions<SmsTemplate>(open ? '/sms-templates/' : null)
  const send = useMut(() => api.post('/sms/send', { student_id: student?.id, lead_id: lead?.id, to, template_code: tpl || undefined, body: tpl ? undefined : body }),
    { invalidate: ['/sms/'], success: 'SMS yuborildi', onSuccess: onClose })
  const name = student ? `${student.first_name} ${student.last_name}` : lead?.first_name
  return (
    <Modal open={open} onClose={onClose} size="md" title="SMS yuborish" description={name}
      footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" disabled={!tpl && !body.trim()} loading={send.isPending} onClick={() => send.mutate(undefined)}>Yuborish</Button></>}>
      <div className="grid gap-4">
        {student && (
          <Field label="Kimga"><Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="auto">Avtomatik (ota-ona, bo‘lmasa o‘quvchi)</option><option value="parent">Ota-onasiga {student.parent_phone ?? ''}</option><option value="student">O‘quvchiga {student.phone ?? ''}</option>
          </Select></Field>
        )}
        <Field label="Shablon"><Select value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Shablonsiz (o‘zim yozaman)</option>{templates.data?.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.code}>{t.code}</option>)}</Select></Field>
        {tpl ? <p className="rounded-md bg-sunken p-3 text-[13px] text-muted">{templates.data?.find((t) => t.code === tpl)?.body}</p>
          : <Field label="Matn"><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="SMS matni…" /></Field>}
      </div>
    </Modal>
  )
}

/* ---------------- Onlayn to'lov havolasi (Click / Payme) ---------------- */
export function OnlineCheckoutDialog({ open, onClose, student }: { open: boolean; onClose: () => void; student?: Student | null }) {
  const [st, setSt] = useState<Student | null>(student ?? null)
  const [provider, setProvider] = useState<'click' | 'payme'>('click')
  const [amount, setAmount] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [sendSms, setSendSms] = useState(false)
  const [result, setResult] = useState<Checkout | null>(null)
  useEffect(() => { if (open) { setSt(student ?? null); setProvider('click'); setAmount(''); setInvoiceId(''); setSendSms(false); setResult(null) } }, [open, student])
  const invoices = useGet<Page<Invoice>>(open && st ? '/invoices/' : null, { student_id: st?.id, limit: 100 })
  const unpaid = (invoices.data?.items ?? []).filter((i) => !['paid', 'cancelled'].includes(i.status))
  const create = useMut(() => api.post<Checkout>('/payments/online/checkout', { student_id: st!.id, amount, provider, invoice_id: invoiceId ? Number(invoiceId) : undefined, send_sms: sendSms }),
    { invalidate: ['/payments/', '/sms/'], onSuccess: setResult })
  const copy = () => { void navigator.clipboard.writeText(result!.url).then(() => import('sonner').then(({ toast }) => toast.success('Havola nusxalandi'))) }
  return (
    <Modal open={open} onClose={onClose} title="Onlayn to‘lov havolasi" size="md"
      description={result ? undefined : 'Havola yaratiladi. Ota-ona to‘lagach, Click/Payme avtomatik balansni yangilaydi.'}
      footer={result ? <Button variant="primary" onClick={onClose}>Yopish</Button>
        : <><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" disabled={!st || Number(amount) <= 0} loading={create.isPending} onClick={() => create.mutate(undefined)}>Havola yaratish</Button></>}>
      {result ? (
        <div className="space-y-3">
          <p className="rounded-md bg-success-soft px-3 py-2 text-success">Havola yaratildi (to‘lov #{result.payment_id}, {fmtMoney(result.amount)}).{result.sms_sent && ' SMS yuborildi.'}</p>
          <Field label={`${result.provider === 'click' ? 'Click' : 'Payme'} to‘lov havolasi`}>
            <div className="flex gap-2"><Input readOnly value={result.url} onFocus={(e) => e.target.select()} className="font-mono text-xs" /><Button onClick={copy}>Nusxalash</Button></div>
          </Field>
          <a href={result.url} target="_blank" rel="noreferrer" className="inline-block text-brand underline">Havolani ochish</a>
          <p className="text-[13px] text-muted">To‘lov ‘Kutilmoqda’ holatida turadi va Click/Payme tasdiqlagach avtomatik ‘Muvaffaqiyatli’ bo‘ladi.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{student ? null : <StudentPicker value={st} onChange={setSt} />}</div>
          <div className="sm:col-span-2"><div className="mb-1 text-[13px] font-medium">To‘lov tizimi</div>
            <div className="inline-flex overflow-hidden rounded-md border border-line" role="radiogroup">
              {(['click', 'payme'] as const).map((p) => (
                <button key={p} role="radio" aria-checked={provider === p} onClick={() => setProvider(p)} className={`px-4 py-1.5 font-medium ${provider === p ? 'bg-brand text-brand-fg' : 'bg-surface text-muted hover:bg-sunken'}`}>{p === 'click' ? 'Click' : 'Payme'}</button>))}
            </div></div>
          <Field label="Summa (so‘m)" required><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Qaysi hisobga"><Select value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); const inv = unpaid.find((i) => String(i.id) === e.target.value); if (inv) setAmount(String(Number(inv.total) - Number(inv.paid_amount))) }} disabled={!st}>
            <option value="">Avtomatik</option>{unpaid.map((i) => <option key={i.id} value={i.id}>{fmtMonth(i.period_month)} — qoldiq {fmtMoney(Number(i.total) - Number(i.paid_amount))}</option>)}</Select></Field>
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />Havolani ota-onaga SMS orqali yuborish</label>
        </div>
      )}
    </Modal>
  )
}
