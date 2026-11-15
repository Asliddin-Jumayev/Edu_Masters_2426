import { useState } from 'react'
import { Link2, Wallet } from 'lucide-react'
import { api } from '@/api/client'
import { useMut, useOptions } from '@/api/hooks'
import type { Payment, PaymentMethod } from '@/api/types'
import { OnlineCheckoutDialog, PaymentDialog } from '@/components/dialogs'
import { StudentName } from '@/components/pickers'
import { ResourcePage } from '@/components/resource'
import { Badge, Button, Confirm, Money, StatusBadge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { PAYMENT_STATUS } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtMoney, fmtTs } from '@/lib/utils'

export default function PaymentsPage() {
  const me = useAuth((s) => s.me)
  const [pay, setPay] = useState(false)
  const [online, setOnline] = useState(false)
  const methods = useOptions<PaymentMethod>('/payment-methods/')
  const [refundFor, setRefundFor] = useState<Payment | null>(null)
  const method = useNames<PaymentMethod>('/payment-methods/', (m) => m.name)
  const fin = ['/payments/', '/invoices/', '/students/', '/reports/']
  const refund = useMut((id: number) => api.post(`/payments/${id}/refund`), { invalidate: fin, success: 'To‘lov qaytarildi', onSuccess: () => setRefundFor(null) })
  const cancelLink = useMut((id: number) => api.post(`/payments/online/${id}/cancel`), { invalidate: fin, success: 'To‘lov havolasi bekor qilindi' })
  const confirm = useMut((id: number) => api.post(`/payments/${id}/confirm`), { invalidate: fin, success: 'To‘lov tasdiqlandi' })
  return (
    <>
      <ResourcePage<Payment>
        title="To‘lovlar" subtitle="Qabul qilingan barcha to‘lovlar" endpoint="/payments/" noun="to‘lov" branchScoped pageSize={30}
        canCreate={() => false} canEdit={() => false} canDelete={() => false}
        headerActions={<><Button onClick={() => setOnline(true)}><Link2 className="size-4" />Onlayn to‘lov havolasi</Button><Button variant="mark" onClick={() => setPay(true)}><Wallet className="size-4" />To‘lov qabul qilish</Button></>}
        filters={[
          { name: 'method_id', label: 'Usul', type: 'select', emptyLabel: 'Barcha usullar', options: { endpoint: '/payment-methods/', label: (m: PaymentMethod) => m.name } },
          { name: 'status', label: 'Holat', type: 'select', emptyLabel: 'Barcha holatlar', options: [{ value: 'completed', label: 'Muvaffaqiyatli' }, { value: 'pending', label: 'Kutilmoqda' }] },
          { name: 'date_from', label: 'Dan', type: 'date' }, { name: 'date_to', label: 'Gacha', type: 'date' },
        ]}
        columns={[
          { key: 'd', header: 'Sana', cell: (p) => <span className="num">{fmtTs(p.paid_at)}</span> },
          { key: 's', header: 'O‘quvchi', cell: (p) => <StudentName id={p.student_id} /> },
          { key: 'a', header: 'Summa', cell: (p) => <Money value={p.amount} className={p.is_refunded ? 'line-through opacity-60' : 'font-medium'} />, align: 'right' },
          { key: 'm', header: 'Usul', cell: (p) => method(p.method_id) },
          { key: 't', header: 'Tranzaksiya', cell: (p) => p.transaction_id ?? '—' },
          { key: 'st', header: 'Holat', cell: (p) => (p.is_refunded ? <Badge tone="danger">Qaytarilgan</Badge> : <StatusBadge map={PAYMENT_STATUS} value={p.status} />) },
        ]}
        rowActions={(p) => {
          const isOnline = methods.data?.find((m) => m.id === p.method_id)?.is_online
          if (p.status === 'pending') return (
            <>
              {isOnline && <Button size="sm" variant="ghost" onClick={() => cancelLink.mutate(p.id)}>Havolani bekor qilish</Button>}
              {can.accountant(me) && <Button size="sm" onClick={() => confirm.mutate(p.id)}>Qo‘lda tasdiqlash</Button>}
            </>)
          return can.accountant(me) && p.status === 'completed' && !p.is_refunded ? <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRefundFor(p)}>Qaytarish</Button> : null
        }}
        fields={[]}
      />
      <PaymentDialog open={pay} onClose={() => setPay(false)} />
      <OnlineCheckoutDialog open={online} onClose={() => setOnline(false)} />
      <Confirm open={!!refundFor} onClose={() => setRefundFor(null)} danger loading={refund.isPending} confirmLabel="Qaytarish" title="To‘lovni qaytarish?"
        message={<>{fmtMoney(refundFor?.amount)} o‘quvchi balansidan ayiriladi va hisoblar qayta taqsimlanadi.</>} onConfirm={() => refundFor && refund.mutate(refundFor.id)} />
    </>
  )
}
