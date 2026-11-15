import { useState } from 'react'
import type { ExpenseCategory, LeadSource, LeadStatus, PaymentMethod, SmsTemplate } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge, Money, PageHeader, Tabs } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/permissions'

const yn = (v: boolean) => <Badge tone={v ? 'success' : 'neutral'}>{v ? 'Ha' : 'Yo‘q'}</Badge>

function Sources() {
  return <ResourcePage<LeadSource> title="Lid manbalari" subtitle="Lidlar qayerdan kelishi. Oylik byudjet reklama samaradorligini hisoblash uchun." embedded endpoint="/lead-sources/" noun="manba"
    deleteLabel="Faolsizlantirish" columns={[
      { key: 'n', header: 'Manba', cell: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'b', header: 'Oylik byudjet', cell: (r) => <Money value={r.monthly_budget} />, align: 'right' },
      { key: 'a', header: 'Faol', cell: (r) => yn(r.is_active) },
    ]} fields={[
      { name: 'name', label: 'Nomi', required: true },
      { name: 'monthly_budget', label: 'Oylik reklama byudjeti', type: 'money', default: '0' },
      { name: 'is_active', label: 'Faol', type: 'checkbox', default: true },
    ]} />
}
function Statuses() {
  return <ResourcePage<LeadStatus> title="Lid bosqichlari" subtitle="Voronka bosqichlari tartibi. Bitta bosqich ‘yutilgan’, bittasi ‘yo‘qotilgan’ bo‘lishi kerak." embedded endpoint="/lead-statuses/" noun="bosqich"
    deleteHint="Lidlari bor bosqichni o‘chirib bo‘lmaydi." columns={[
      { key: 'p', header: 'Tartib', cell: (r) => r.position, className: 'w-20' },
      { key: 'n', header: 'Bosqich', cell: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'w', header: 'Yutilgan', cell: (r) => (r.is_won ? <Badge tone="success">Ha</Badge> : '—') },
      { key: 'l', header: 'Yo‘qotilgan', cell: (r) => (r.is_lost ? <Badge tone="danger">Ha</Badge> : '—') },
    ]} fields={[
      { name: 'name', label: 'Nomi', required: true },
      { name: 'position', label: 'Tartib raqami', type: 'number', default: 0 },
      { name: 'is_won', label: 'Yutilgan (o‘quvchiga aylangan)', type: 'checkbox', span: 2 },
      { name: 'is_lost', label: 'Yo‘qotilgan', type: 'checkbox', span: 2 },
    ]} />
}
function Methods() {
  return <ResourcePage<PaymentMethod> title="To‘lov usullari" subtitle="Onlayn usullarda tranzaksiya raqami majburiy." embedded endpoint="/payment-methods/" noun="usul"
    canCreate={can.admin} canEdit={can.admin} canDelete={() => false} columns={[
      { key: 'n', header: 'Nomi', cell: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'c', header: 'Kod', cell: (r) => <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">{r.code}</code> },
      { key: 'o', header: 'Onlayn', cell: (r) => yn(r.is_online) },
    ]} fields={[
      { name: 'code', label: 'Kod', required: true, hint: 'masalan: cash, click' },
      { name: 'name', label: 'Nomi', required: true },
      { name: 'is_online', label: 'Onlayn to‘lov', type: 'checkbox', span: 2 },
    ]} />
}
function Categories() {
  return <ResourcePage<ExpenseCategory> title="Xarajat kategoriyalari" embedded endpoint="/expense-categories/" noun="kategoriya"
    deleteHint="Xarajatlari bor kategoriyani o‘chirib bo‘lmaydi." columns={[
      { key: 'n', header: 'Kategoriya', cell: (r) => <span className="font-medium">{r.name}</span> },
    ]} fields={[{ name: 'name', label: 'Nomi', required: true, span: 2 }]} />
}
function Templates() {
  return <ResourcePage<SmsTemplate> title="SMS shablonlar" subtitle="O‘zgaruvchilar: {name}, {debt}. Masalan: ‘{name}, qarzingiz {debt} so‘m’." embedded endpoint="/sms-templates/" noun="shablon"
    canCreate={can.manager} canEdit={can.manager} canDelete={() => false} modalSize="lg" columns={[
      { key: 'c', header: 'Kod', cell: (r) => <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">{r.code}</code> },
      { key: 'b', header: 'Matn', cell: (r) => <span className="line-clamp-2 max-w-xl text-muted">{r.body}</span> },
      { key: 'a', header: 'Faol', cell: (r) => yn(r.is_active) },
    ]} fields={[
      { name: 'code', label: 'Kod', required: true, hint: 'payment_reminder — qarz eslatmasi uchun ishlatiladi', span: 2 },
      { name: 'body', label: 'Matn', type: 'textarea', required: true, span: 2 },
      { name: 'is_active', label: 'Faol', type: 'checkbox', default: true },
    ]} />
}

type Tab = 'sources' | 'statuses' | 'methods' | 'categories' | 'templates'
export default function LookupsPage() {
  const me = useAuth((s) => s.me)
  const all: { id: Tab; label: string; show: boolean }[] = [
    { id: 'sources', label: 'Lid manbalari', show: can.manager(me) },
    { id: 'statuses', label: 'Lid bosqichlari', show: can.manager(me) },
    { id: 'methods', label: 'To‘lov usullari', show: true },
    { id: 'categories', label: 'Xarajat kategoriyalari', show: true },
    { id: 'templates', label: 'SMS shablonlar', show: true },
  ]
  const tabs = all.filter((t) => t.show)
  const [tab, setTab] = useState<Tab>(tabs[0].id)
  return (
    <>
      <PageHeader title="Ma‘lumotnomalar" subtitle="Tizim bo‘ylab ishlatiladigan ro‘yxatlar" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div key={tab}>
        {tab === 'sources' && <Sources />}{tab === 'statuses' && <Statuses />}{tab === 'methods' && <Methods />}
        {tab === 'categories' && <Categories />}{tab === 'templates' && <Templates />}
      </div>
    </>
  )
}
