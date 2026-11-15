import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Employee, Page, Payroll, SalaryRule } from '@/api/types'
import { FormModal } from '@/components/resource'
import { Button, DataTable, Field, Input, Money, PageHeader, Pager, Panel, StatusBadge, Tabs, Confirm } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { O_SALARY_TYPE, PAYROLL_STATUS, SALARY_LABEL } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fmtMoney, fmtMonth, fullName, monthInputToDate, thisMonthInput } from '@/lib/utils'

function Payrolls() {
  const me = useAuth((s) => s.me)
  const [month, setMonth] = useState(thisMonthInput())
  const [offset, setOffset] = useState(0)
  const q = useGet<Page<Payroll>>('/payrolls/', { period_month: monthInputToDate(month), limit: 50, offset })
  const emp = useNames<Employee>(can.finance(me) ? '/employees/' : null, (e) => fullName(e))
  const [adj, setAdj] = useState<Payroll | null>(null)
  const [payFor, setPayFor] = useState<Payroll | null>(null)
  const acc = can.accountant(me)
  const inv = ['/payrolls/']
  const calc = useMut(() => api.post<Payroll[]>('/payrolls/calculate', { period_month: monthInputToDate(month) }), { invalidate: inv, success: 'Maosh hisoblandi' })
  const adjust = useMut((v: { id: number; p: Record<string, unknown> }) => api.patch(`/payrolls/${v.id}`, v.p), { invalidate: inv, success: 'Saqlandi', onSuccess: () => setAdj(null) })
  const approve = useMut((id: number) => api.post(`/payrolls/${id}/approve`), { invalidate: inv, success: 'Tasdiqlandi' })
  const pay = useMut((id: number) => api.post(`/payrolls/${id}/pay`), { invalidate: inv, success: 'To‘langan deb belgilandi', onSuccess: () => setPayFor(null) })
  const rows = q.data?.items ?? []
  const total = rows.reduce((a, r) => a + Number(r.total), 0)
  return (
    <Panel flush title={<span className="capitalize">{fmtMonth(monthInputToDate(month))}</span>} actions={<>
      <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setOffset(0) }} className="w-auto" aria-label="Oy" />
      {acc && <Button variant="primary" loading={calc.isPending} onClick={() => calc.mutate(undefined)}><Calculator className="size-4" />Hisoblash</Button>}</>}>
      <DataTable loading={q.isLoading} rows={rows} rowKey={(r) => r.id}
        columns={[
          ...(can.manager(me) || acc ? [{ key: 'e', header: 'Xodim', cell: (r: Payroll) => <span className="font-medium">{emp(r.employee_id)}</span> }] : []),
          { key: 'l', header: 'Darslar', cell: (r) => r.lessons_count, align: 'right' },
          { key: 'b', header: 'Asosiy', cell: (r) => <Money value={r.base_amount} />, align: 'right' },
          { key: 'bo', header: 'Bonus', cell: (r) => (Number(r.bonus) ? <Money value={r.bonus} signed /> : '—'), align: 'right' },
          { key: 'p', header: 'Jarima', cell: (r) => (Number(r.penalty) ? <Money value={-Number(r.penalty)} /> : '—'), align: 'right' },
          { key: 't', header: 'Jami', cell: (r) => <Money value={r.total} className="font-semibold" />, align: 'right' },
          { key: 's', header: 'Holat', cell: (r) => <StatusBadge map={PAYROLL_STATUS} value={r.status} /> },
          ...(acc ? [{ key: 'a', header: '', align: 'right' as const, cell: (r: Payroll) => (
            <div className="flex justify-end gap-1">
              {r.status === 'draft' && <><Button size="sm" onClick={() => setAdj(r)}>Bonus/jarima</Button><Button size="sm" variant="primary" onClick={() => approve.mutate(r.id)}>Tasdiqlash</Button></>}
              {r.status === 'approved' && <Button size="sm" variant="mark" onClick={() => setPayFor(r)}>To‘lash</Button>}
              {r.status === 'paid' && <span className="text-[13px] text-muted">{fmtDate(r.paid_at)}</span>}
            </div>) }] : []),
        ]} />
      <Pager total={q.data?.total ?? 0} limit={50} offset={offset} onChange={setOffset} />
      {rows.length > 0 && <div className="flex justify-end border-t border-line px-4 py-2.5 text-[13px] text-muted">Jami: <span className="ml-2 font-semibold text-fg">{fmtMoney(total)}</span></div>}
      <FormModal open={!!adj} onClose={() => setAdj(null)} size="sm" title={`Bonus va jarima: ${adj ? emp(adj.employee_id) : ''}`} submitting={adjust.isPending}
        description="Faqat qoralama holatdagi maoshni o‘zgartirish mumkin. Qayta hisoblaganda bonus va jarima saqlanadi."
        fields={[{ name: 'bonus', label: 'Bonus (so‘m)', type: 'money', default: adj?.bonus }, { name: 'penalty', label: 'Jarima (so‘m)', type: 'money', default: adj?.penalty }]}
        onSubmit={(p) => adj && adjust.mutate({ id: adj.id, p: { bonus: p.bonus ?? '0', penalty: p.penalty ?? '0' } })} />
      <Confirm open={!!payFor} onClose={() => setPayFor(null)} loading={pay.isPending} confirmLabel="To‘langan" title="Maosh to‘landimi?"
        message={payFor && <>{emp(payFor.employee_id)} uchun <b>{fmtMoney(payFor.total)}</b> to‘langan deb belgilanadi. Keyin o‘zgartirib bo‘lmaydi.</>} onConfirm={() => payFor && pay.mutate(payFor.id)} />
    </Panel>
  )
}

function Rules() {
  const q = useGet<SalaryRule[]>('/salary-rules/')
  const emp = useNames<Employee>('/employees/', (e) => fullName(e))
  const me = useAuth((s) => s.me)
  const [add, setAdd] = useState(false)
  const create = useMut((p: Record<string, unknown>) => api.post('/salary-rules/', p), { invalidate: ['/salary-rules/'], success: 'Qoida qo‘shildi', onSuccess: () => setAdd(false) })
  const del = useMut((id: number) => api.del(`/salary-rules/${id}`), { invalidate: ['/salary-rules/'], success: 'Qoida o‘chirildi' })
  return (
    <Panel flush title="Maosh qoidalari" actions={can.accountant(me) && <Button variant="primary" size="sm" onClick={() => setAdd(true)}>Qoida qo‘shish</Button>}>
      <DataTable loading={q.isLoading} rows={q.data ?? []} rowKey={(r) => r.id}
        columns={[
          { key: 'e', header: 'Xodim', cell: (r) => <span className="font-medium">{emp(r.employee_id)}</span> },
          { key: 't', header: 'Turi', cell: (r) => SALARY_LABEL[r.type] },
          { key: 'v', header: 'Qiymat', cell: (r) => (r.type === 'percent' ? `${Number(r.percent)}%` : <Money value={r.amount} />), align: 'right' },
          { key: 'f', header: 'Amal qilish', cell: (r) => `${fmtDate(r.effective_from)} — ${r.effective_to ? fmtDate(r.effective_to) : 'hozirgacha'}` },
          ...(can.accountant(me) ? [{ key: 'x', header: '', align: 'right' as const, cell: (r: SalaryRule) => <Button size="sm" variant="ghost" className="text-danger" onClick={() => del.mutate(r.id)}>O‘chirish</Button> }] : []),
        ]} />
      <FormModal open={add} onClose={() => setAdd(false)} title="Maosh qoidasi" submitting={create.isPending} onSubmit={(p) => create.mutate(p)}
        description="Bir oyda bir nechta qoida mos kelsa, eng oxirgi boshlangani qo‘llanadi."
        fields={[
          { name: 'employee_id', label: 'Xodim', type: 'select', required: true, span: 2, options: { endpoint: '/employees/', params: { is_active: true }, label: (e: Employee) => fullName(e) } },
          { name: 'type', label: 'Turi', type: 'select', required: true, options: O_SALARY_TYPE, default: 'per_lesson', hint: 'Foiz — guruhlari shu oy to‘langan tushumidan' },
          { name: 'amount', label: 'Summa (so‘m)', type: 'money', hint: 'Qat‘iy oylik / bir dars / bir soat narxi' },
          { name: 'percent', label: 'Foiz (%)', type: 'number', hint: 'Faqat ‘Tushumdan foiz’ uchun' },
          { name: 'effective_from', label: 'Boshlanishi', type: 'date', required: true, default: () => new Date().toISOString().slice(0, 10) }, { name: 'effective_to', label: 'Tugashi', type: 'date' },
        ]} />
    </Panel>
  )
}

export default function PayrollPage() {
  const me = useAuth((s) => s.me)
  const [tab, setTab] = useState<'payrolls' | 'rules'>('payrolls')
  const showRules = can.finance(me)
  return (
    <>
      <PageHeader title={showRules ? 'Maosh' : 'Mening maoshim'} subtitle="Maosh o‘tilgan (‘o‘tkazildi’ holatidagi) darslar, tushum yoki qat‘iy summa asosida hisoblanadi." />
      {showRules && <Tabs tabs={[{ id: 'payrolls', label: 'Oylik hisob' }, { id: 'rules', label: 'Qoidalar' }]} value={tab} onChange={setTab} />}
      {tab === 'payrolls' || !showRules ? <Payrolls /> : <Rules />}
      {false && <Field label=""><span /></Field>}
    </>
  )
}
