import { useState } from 'react'
import { Check, Copy, Mail, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Integrations, Page, ProviderTx, TestResult } from '@/api/types'
import { Badge, Button, DataTable, Field, Input, PageHeader, Pager, Panel, Spinner, Tabs } from '@/components/ui'
import { fmtMoney, fmtTs } from '@/lib/utils'

function Copyable({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="mt-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 rounded-md border border-line bg-sunken px-2.5 py-1.5">
        <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
        <button aria-label="Nusxalash" className="text-muted hover:text-fg" onClick={() => { void navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}>
          {done ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}</button>
      </div>
    </div>
  )
}

function Card({ title, ok, children, env }: { title: string; ok: boolean; children?: React.ReactNode; env?: string }) {
  return (
    <Panel title={title} actions={<Badge tone={ok ? 'success' : 'warn'}>{ok ? 'Sozlangan' : 'Sozlanmagan'}</Badge>}>
      {children}
      {!ok && env && <p className="mt-2 text-[13px] text-muted">Backend <code>.env</code> faylida to‘ldiring: <code className="text-xs">{env}</code></p>}
    </Panel>
  )
}

const STATE: Record<number, { label: string; tone: 'info' | 'success' | 'neutral' | 'danger' }> = {
  1: { label: 'Yaratildi', tone: 'info' }, 2: { label: 'Bajarildi', tone: 'success' }, '-1': { label: 'Bekor qilindi', tone: 'neutral' }, '-2': { label: 'Qaytarildi', tone: 'danger' },
}

function Status() {
  const q = useGet<Integrations>('/system/integrations')
  const [phone, setPhone] = useState(''); const [text, setText] = useState(''); const [to, setTo] = useState('')
  const report = (r: TestResult) => (r.ok ? toast.success(r.detail ?? 'Muvaffaqiyatli yuborildi') : toast.error(r.detail ?? 'Yuborib bo‘lmadi'))
  const sms = useMut(() => api.post<TestResult>('/system/integrations/test-sms', { phone, text: text || undefined }), { invalidate: ['/sms/'], onSuccess: report })
  const mail = useMut(() => api.post<TestResult>('/system/integrations/test-email', { to: to || undefined }), { onSuccess: report })
  if (!q.data) return <div className="py-16 text-center"><Spinner className="size-7" /></div>
  const d = q.data
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Click" ok={d.click.configured} env="CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY">
        <p className="text-[13px] text-muted">Click kabinetida Prepare va Complete URL ga bir xil manzilni kiriting:</p>
        <Copyable label="Prepare URL" value={d.click.urls.prepare_url} /><Copyable label="Complete URL" value={d.click.urls.complete_url} />
        {d.click.info.service_id && <p className="mt-2 text-[13px] text-muted">Service ID: <b className="text-fg">{String(d.click.info.service_id)}</b></p>}
      </Card>
      <Card title="Payme" ok={d.payme.configured} env="PAYME_MERCHANT_ID, PAYME_KEY">
        <p className="text-[13px] text-muted">Payme kabinetida Endpoint URL sifatida kiriting (Basic avtorizatsiya kaliti .env dagi PAYME_KEY):</p>
        <Copyable label="Endpoint URL" value={d.payme.urls.endpoint_url} />
        <p className="mt-2 text-[13px] text-muted">Checkout: <b className="text-fg">{String(d.payme.info.checkout)}</b></p>
      </Card>
      <Card title="SMS" ok={d.sms.configured} env="SMS_PROVIDER=eskiz, ESKIZ_EMAIL, ESKIZ_PASSWORD">
        <p className="text-[13px] text-muted">Provayder: <b className="text-fg">{String(d.sms.info.provider)}</b>{d.sms.info.provider === 'console' && ' (haqiqiy SMS yuborilmaydi, faqat logga yoziladi)'}</p>
        {d.sms.urls.callback_url && <Copyable label="Yetkazish holati callback URL (Eskiz)" value={d.sms.urls.callback_url} />}
        <div className="mt-4 grid gap-2 border-t border-line pt-3">
          <Field label="Test SMS: telefon"><Input type="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Matn (ixtiyoriy)" hint="Eskiz test hisobida faqat ruxsat etilgan matn o‘tadi"><Input value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Button className="justify-self-start" disabled={!phone} loading={sms.isPending} onClick={() => sms.mutate(undefined)}><MessageSquare className="size-4" />Test SMS yuborish</Button>
        </div>
      </Card>
      <Card title="Email (yangi qurilma xabarnomasi)" ok={d.email.configured} env="SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM">
        <p className="text-[13px] text-muted">Usul: <b className="text-fg">{String(d.email.info.backend)}</b>{d.email.info.backend === 'console' && ' (haqiqiy xat yuborilmaydi, faqat logga yoziladi)'}{d.email.info.host ? <> · {String(d.email.info.host)}</> : null}</p>
        <div className="mt-4 grid gap-2 border-t border-line pt-3">
          <Field label="Qabul qiluvchi" hint="Bo‘sh qoldirsangiz — o‘z emailingizga"><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Button className="justify-self-start" loading={mail.isPending} onClick={() => mail.mutate(undefined)}><Mail className="size-4" />Test xat yuborish</Button>
        </div>
      </Card>
    </div>
  )
}

function Transactions() {
  const [offset, setOffset] = useState(0)
  const [provider, setProvider] = useState('')
  const q = useGet<Page<ProviderTx>>('/payments/online/transactions', { limit: 30, offset, provider: provider || undefined })
  return (
    <Panel flush title="Click / Payme tranzaksiyalari" actions={
      <select aria-label="Tizim" className="h-8 rounded-md border border-line bg-surface px-2 text-[13px]" value={provider} onChange={(e) => { setProvider(e.target.value); setOffset(0) }}>
        <option value="">Hammasi</option><option value="click">Click</option><option value="payme">Payme</option></select>}>
      <DataTable loading={q.isLoading} rows={q.data?.items ?? []} rowKey={(t) => t.id}
        columns={[
          { key: 'd', header: 'Vaqt', cell: (t) => <span className="num whitespace-nowrap">{fmtTs(t.created_at)}</span> },
          { key: 'p', header: 'Tizim', cell: (t) => <span className="font-medium capitalize">{t.provider}</span> },
          { key: 'i', header: 'Tizim ID', cell: (t) => <code className="text-xs">{t.provider_trans_id}</code> },
          { key: 'o', header: 'To‘lov', cell: (t) => `#${t.payment_id}` },
          { key: 'a', header: 'Summa', cell: (t) => fmtMoney(t.amount), align: 'right' },
          { key: 's', header: 'Holat', cell: (t) => <Badge tone={STATE[t.state]?.tone ?? 'neutral'}>{STATE[t.state]?.label ?? t.state}</Badge> },
          { key: 'x', header: 'Bajarilgan / bekor', cell: (t) => fmtTs(t.perform_time ?? t.cancel_time) },
        ]} />
      <Pager total={q.data?.total ?? 0} limit={30} offset={offset} onChange={setOffset} />
    </Panel>
  )
}

export default function IntegrationsPage() {
  const [tab, setTab] = useState<'status' | 'tx'>('status')
  return (
    <>
      <PageHeader title="Integratsiyalar" subtitle="To‘lov tizimlari, SMS va email. Maxfiy kalitlar bu yerda ko‘rsatilmaydi — ular faqat serverdagi .env faylida." />
      <Tabs tabs={[{ id: 'status', label: 'Holat va manzillar' }, { id: 'tx', label: 'Onlayn tranzaksiyalar' }]} value={tab} onChange={setTab} />
      {tab === 'status' ? <Status /> : <Transactions />}
    </>
  )
}
