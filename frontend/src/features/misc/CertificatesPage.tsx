import { useEffect, useState } from 'react'
import { FileDown, Link2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api, formatError } from '@/api/client'
import { useMut, useOptions } from '@/api/hooks'
import type { Certificate, Group, Student } from '@/api/types'
import { StudentName, StudentPicker } from '@/components/pickers'
import { ResourcePage } from '@/components/resource'
import { Button, Field, Modal, Select } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { can } from '@/lib/permissions'
import { fmtDate } from '@/lib/utils'

function IssueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useAuth((s) => s.me)
  const [st, setSt] = useState<Student | null>(null)
  const [groupId, setGroupId] = useState('')
  const [force, setForce] = useState(false)
  useEffect(() => { if (open) { setSt(null); setGroupId(''); setForce(false) } }, [open])
  const groups = useOptions<Group>(open ? '/groups/' : null)
  const issue = useMut(() => api.post<Certificate>('/certificates/', { student_id: st!.id, group_id: Number(groupId), force }), { invalidate: ['/certificates/'], success: 'Sertifikat berildi', onSuccess: onClose })
  return (
    <Modal open={open} onClose={onClose} title="Sertifikat berish" description="Shartlar: guruh yoki yozilish yakunlangan va yakuniy imtihondan o‘tish balli to‘plangan bo‘lishi kerak."
      footer={<><Button onClick={onClose}>Bekor qilish</Button><Button variant="primary" disabled={!st || !groupId} loading={issue.isPending} onClick={() => issue.mutate(undefined)}>Berish</Button></>}>
      <div className="grid gap-4">
        <StudentPicker value={st} onChange={setSt} />
        <Field label="Guruh" required><Select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">— tanlang —</option>{groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
        {can.admin(me) && <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={force} onChange={(e) => setForce(e.target.checked)} />Shartlarni e‘tiborsiz qoldirish <span className="text-xs text-muted">(faqat administrator)</span></label>}
      </div>
    </Modal>
  )
}

export default function CertificatesPage() {
  const me = useAuth((s) => s.me)
  const [issue, setIssue] = useState(false)
  const group = useNames<Group>('/groups/', (g) => g.name)
  const download = (c: Certificate) => api.download(`/certificates/${c.id}/pdf`, `sertifikat-${c.serial_number}.pdf`).catch((e) => toast.error(formatError(e)))
  const copy = (serial: string) => { void navigator.clipboard.writeText(`${location.origin}/verify/${serial}`); toast.success('Tekshirish havolasi nusxalandi') }
  return (
    <>
      <ResourcePage<Certificate>
        title="Sertifikatlar" subtitle="Berilgan sertifikatlar. Har birining ochiq tekshirish havolasi bor." endpoint="/certificates/" noun="sertifikat" pageSize={30}
        canCreate={() => false} canEdit={() => false} canDelete={can.manager} deleteLabel="Bekor qilish" deleteHint="Sertifikat bekor qilinadi va tekshiruvda ‘topilmadi’ deb chiqadi."
        headerActions={can.manager(me) && <Button variant="primary" onClick={() => setIssue(true)}><Plus className="size-4" />Sertifikat berish</Button>}
        filters={[{ name: 'group_id', label: 'Guruh', type: 'select', emptyLabel: 'Barcha guruhlar', options: { endpoint: '/groups/', label: (g: Group) => g.name } }]}
        columns={[
          { key: 's', header: 'Seriya', cell: (c) => <code className="rounded bg-sunken px-1.5 py-0.5 text-xs font-medium">{c.serial_number}</code> },
          { key: 'st', header: 'O‘quvchi', cell: (c) => <StudentName id={c.student_id} /> },
          { key: 'g', header: 'Guruh', cell: (c) => group(c.group_id) },
          { key: 'd', header: 'Berilgan', cell: (c) => fmtDate(c.issued_at) },
        ]}
        rowActions={(c) => <><Button size="sm" aria-label="PDF yuklab olish" title="Sertifikatni PDF sifatida yuklab olish" onClick={() => download(c)}><FileDown className="size-4" />PDF</Button><Button size="sm" variant="ghost" aria-label="Havolani nusxalash" title="Tekshirish havolasini nusxalash" onClick={() => copy(c.serial_number)}><Link2 className="size-4" /></Button></>}
        fields={[]}
      />
      <IssueDialog open={issue} onClose={() => setIssue(false)} />
    </>
  )
}
