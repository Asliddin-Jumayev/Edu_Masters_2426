import { useState } from 'react'
import { MessageSquare, RotateCw, Send } from 'lucide-react'
import { api } from '@/api/client'
import { useMut } from '@/api/hooks'
import type { Sms, Student } from '@/api/types'
import { SmsDialog } from '@/components/dialogs'
import { StudentPicker } from '@/components/pickers'
import { ResourcePage } from '@/components/resource'
import { Button, Confirm, Modal, Money, StatusBadge } from '@/components/ui'
import { useBranch } from '@/lib/auth'
import { SMS_STATUS } from '@/lib/labels'
import { fmtTs } from '@/lib/utils'

export default function SmsPage() {
  const branchId = useBranch((s) => s.branchId)
  const [pick, setPick] = useState(false)
  const [st, setSt] = useState<Student | null>(null)
  const [sendTo, setSendTo] = useState<Student | null>(null)
  const [bulk, setBulk] = useState(false)
  const retry = useMut((id: number) => api.post<Sms>(`/sms/${id}/retry`), { invalidate: ['/sms/'], onSuccess: (r) => import('sonner').then(({ toast }) => (r.status === 'failed' ? toast.error(r.error ?? 'Yuborib bo‘lmadi') : toast.success('SMS qayta yuborildi'))) })
  const remind = useMut(() => api.post<{ msg: string }>('/sms/debt-reminders', { branch_id: branchId ?? undefined }), { invalidate: ['/sms/'], onSuccess: (r) => { setBulk(false); import('sonner').then(({ toast }) => toast.success(r.msg)) } })
  return (
    <>
      <ResourcePage<Sms>
        title="SMS jurnali" subtitle="Yuborilgan SMS xabarlar. Shablonlarni Sozlamalar → Ma‘lumotnomalar bo‘limida tahrirlang." endpoint="/sms/logs" noun="SMS" pageSize={30}
        canCreate={() => false} canEdit={() => false} canDelete={() => false}
        headerActions={<><Button onClick={() => setBulk(true)}><Send className="size-4" />Qarzdorlarga eslatma</Button><Button variant="primary" onClick={() => setPick(true)}><MessageSquare className="size-4" />SMS yuborish</Button></>}
        columns={[
          { key: 'd', header: 'Vaqt', cell: (s) => <span className="num whitespace-nowrap">{fmtTs(s.created_at)}</span> },
          { key: 'r', header: 'Qabul qiluvchi', cell: (s) => s.recipient_phone },
          { key: 'b', header: 'Matn', cell: (s) => <span className="line-clamp-2 max-w-xl text-muted">{s.body}</span> },
          { key: 's', header: 'Holat', cell: (s) => <div><StatusBadge map={SMS_STATUS} value={s.status} />{s.error && <div className="mt-0.5 max-w-60 text-xs text-danger">{s.error}</div>}</div> },
          { key: 'c', header: 'Narx', cell: (s) => <Money value={s.cost} />, align: 'right' },
        ]}
        rowActions={(s) => (s.status === 'failed' ? <Button size="sm" onClick={() => retry.mutate(s.id)}><RotateCw className="size-4" />Qayta yuborish</Button> : null)}
        fields={[]}
      />
      <Modal open={pick} onClose={() => { setPick(false); setSt(null) }} size="sm" title="Kimga SMS yuboramiz?"
        footer={<><Button onClick={() => setPick(false)}>Bekor qilish</Button><Button variant="primary" disabled={!st} onClick={() => { setSendTo(st); setPick(false); setSt(null) }}>Davom etish</Button></>}>
        <StudentPicker value={st} onChange={setSt} />
      </Modal>
      <SmsDialog open={!!sendTo} onClose={() => setSendTo(null)} student={sendTo} />
      <Confirm open={bulk} onClose={() => setBulk(false)} loading={remind.isPending} confirmLabel="Yuborish" title="Hamma qarzdorga eslatma yuborilsinmi?"
        message="‘payment_reminder’ shabloni qarzdor o‘quvchilarning ota-onasiga (bo‘lmasa o‘zlariga) yuboriladi." onConfirm={() => remind.mutate(undefined)} />
    </>
  )
}
