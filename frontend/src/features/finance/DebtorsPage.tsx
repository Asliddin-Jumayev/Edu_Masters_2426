import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Wallet } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Debtor, Student } from '@/api/types'
import { PaymentDialog, SmsDialog } from '@/components/dialogs'
import { Button, Confirm, DataTable, Money, PageHeader, Panel, Stat } from '@/components/ui'
import { useBranch } from '@/lib/auth'
import { fmtMoney } from '@/lib/utils'

export default function DebtorsPage() {
  const branchId = useBranch((s) => s.branchId)
  const q = useGet<Debtor[]>('/reports/debtors', { branch_id: branchId ?? undefined, limit: 500 })
  const rows = q.data ?? []
  const total = rows.reduce((a, r) => a + Number(r.debt), 0)
  const [payFor, setPayFor] = useState<Student | null>(null)
  const [smsFor, setSmsFor] = useState<Student | null>(null)
  const [bulk, setBulk] = useState(false)
  const load = useMut(async (id: number) => api.get<Student>(`/students/${id}`), { silent: true })
  const remind = useMut(() => api.post<{ msg: string }>('/sms/debt-reminders', { branch_id: branchId ?? undefined }), { invalidate: ['/sms/'], success: 'Eslatmalar yuborildi', onSuccess: () => setBulk(false) })
  return (
    <>
      <PageHeader title="Qarzdorlar" subtitle="Balansi manfiy bo‘lgan o‘quvchilar (eng katta qarzdan boshlab)"
        actions={<Button variant="primary" disabled={rows.length === 0} onClick={() => setBulk(true)}><MessageSquare className="size-4" />Hammasiga SMS eslatma</Button>} />
      <Panel flush className="mb-4 overflow-hidden"><div className="grid grid-cols-2 gap-px bg-line [&>*]:bg-surface"><Stat label="Qarzdorlar soni" value={rows.length} /><Stat label="Umumiy qarz" value={fmtMoney(total, false)} hint="so‘m" tone={total > 0 ? 'danger' : undefined} /></div></Panel>
      <Panel flush>
        <DataTable loading={q.isLoading} rows={rows} rowKey={(r) => r.student_id}
          columns={[
            { key: 'n', header: 'O‘quvchi', cell: (r) => <Link to={`/students/${r.student_id}`} className="font-medium hover:underline">{r.name}</Link> },
            { key: 'p', header: 'Telefon', cell: (r) => r.parent_phone ?? r.phone ?? '—' },
            { key: 'd', header: 'Qarz', cell: (r) => <Money value={-Number(r.debt)} />, align: 'right' },
            { key: 'a', header: '', align: 'right', cell: (r) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" onClick={() => load.mutate(r.student_id, { onSuccess: setSmsFor })}><MessageSquare className="size-4" />SMS</Button>
                <Button size="sm" variant="mark" onClick={() => load.mutate(r.student_id, { onSuccess: setPayFor })}><Wallet className="size-4" />To‘lov</Button>
              </div>) },
          ]} />
      </Panel>
      <PaymentDialog open={!!payFor} onClose={() => setPayFor(null)} student={payFor} />
      <SmsDialog open={!!smsFor} onClose={() => setSmsFor(null)} student={smsFor} />
      <Confirm open={bulk} onClose={() => setBulk(false)} loading={remind.isPending} confirmLabel="Yuborish" title={`${rows.length} ta qarzdorga SMS yuborilsinmi?`}
        message="‘payment_reminder’ shabloni ishlatiladi (Sozlamalar → Ma‘lumotnomalar → SMS shablonlar). Bir martada 500 tagacha." onConfirm={() => remind.mutate(undefined)} />
    </>
  )
}
