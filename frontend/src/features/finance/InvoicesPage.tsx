import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useMut } from '@/api/hooks'
import type { Group, Invoice } from '@/api/types'
import { GenerateInvoicesDialog } from '@/components/dialogs'
import { StudentName } from '@/components/pickers'
import { FormModal, ResourcePage } from '@/components/resource'
import { Button, Money, StatusBadge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { INVOICE_STATUS, O_INVOICE_STATUS } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fmtMonth } from '@/lib/utils'

export default function InvoicesPage() {
  const me = useAuth((s) => s.me)
  const [gen, setGen] = useState(false)
  const [cancelFor, setCancelFor] = useState<Invoice | null>(null)
  const cancel = useMut((v: { id: number; reason: string }) => api.post(`/invoices/${v.id}/cancel`, { reason: v.reason }), { invalidate: ['/invoices/', '/students/'], success: 'Hisob bekor qilindi', onSuccess: () => setCancelFor(null) })
  return (
    <>
      <ResourcePage<Invoice>
        title="Hisob-fakturalar" subtitle="O‘quvchilarga yozilgan oylik hisoblar. Qarz — to‘lanishi kerak, lekin to‘lanmagan summa." endpoint="/invoices/" noun="hisob"
        branchScoped pageSize={30} canCreate={() => false} canEdit={() => false} canDelete={() => false}
        headerActions={<Button variant="primary" onClick={() => setGen(true)}><Plus className="size-4" />Oylik hisob yaratish</Button>}
        filters={[
          { name: 'status', label: 'Holat', type: 'select', emptyLabel: 'Barcha holatlar', options: O_INVOICE_STATUS },
          { name: 'group_id', label: 'Guruh', type: 'select', emptyLabel: 'Barcha guruhlar', options: { endpoint: '/groups/', label: (g: Group) => g.name } },
          { name: 'period_month', label: 'Oy', type: 'date' },
        ]}
        columns={[
          { key: 's', header: 'O‘quvchi', cell: (i) => <StudentName id={i.student_id} /> },
          { key: 'm', header: 'Oy', cell: (i) => <span className="capitalize">{fmtMonth(i.period_month)}</span> },
          { key: 't', header: 'Jami', cell: (i) => <Money value={i.total} className="font-medium" />, align: 'right' },
          { key: 'p', header: 'To‘langan', cell: (i) => <Money value={i.paid_amount} />, align: 'right' },
          { key: 'q', header: 'Qoldiq', cell: (i) => { const r = Number(i.total) - Number(i.paid_amount); return i.status === 'cancelled' ? '—' : <Money value={r > 0 ? -r : 0} /> }, align: 'right' },
          { key: 'd', header: 'Muddat', cell: (i) => fmtDate(i.due_date) },
          { key: 'st', header: 'Holat', cell: (i) => <StatusBadge map={INVOICE_STATUS} value={i.status} /> },
        ]}
        rowActions={(i) => (can.accountant(me) && i.status !== 'cancelled' ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelFor(i)}>Bekor qilish</Button> : null)}
        fields={[]}
      />
      <GenerateInvoicesDialog open={gen} onClose={() => setGen(false)} />
      <FormModal open={!!cancelFor} onClose={() => setCancelFor(null)} size="sm" title="Hisobni bekor qilish" submitLabel="Bekor qilish" submitting={cancel.isPending}
        description="Hisob summasi o‘quvchi balansiga qaytariladi. Sabab audit jurnaliga yoziladi."
        fields={[{ name: 'reason', label: 'Sabab', required: true, span: 2 }]} onSubmit={(p) => cancelFor && cancel.mutate({ id: cancelFor.id, reason: String(p.reason) })} />
    </>
  )
}
