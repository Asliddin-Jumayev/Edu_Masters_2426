import { RotateCcw } from 'lucide-react'
import { api } from '@/api/client'
import { useMut } from '@/api/hooks'
import type { Branch } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge, Button } from '@/components/ui'
import { can } from '@/lib/permissions'
import { fmtDate } from '@/lib/utils'

function Activate({ b }: { b: Branch }) {
  const m = useMut(() => api.post(`/branches/${b.id}/activate`), { invalidate: ['/branches/'], success: 'Filial faollashtirildi' })
  return <Button variant="ghost" size="sm" onClick={() => m.mutate(undefined)} aria-label="Faollashtirish" title="Faollashtirish"><RotateCcw className="size-4" /></Button>
}

export default function BranchesPage() {
  return (
    <ResourcePage<Branch>
      title="Filiallar" subtitle="O‘quv markaz filiallari" endpoint="/branches/" noun="filial"
      canCreate={can.admin} canEdit={can.manager} canDelete={(me, r) => can.admin(me) && !!r?.is_active}
      deleteLabel="Faolsizlantirish" deleteHint="Filial o‘chirilmaydi (tarixi saqlanadi), faqat faolsizlantiriladi."
      rowActions={(b) => (!b.is_active ? <Activate b={b} /> : null)}
      columns={[
        { key: 'n', header: 'Nomi', cell: (b) => <span className="font-medium">{b.name}</span> },
        { key: 'c', header: 'Kod', cell: (b) => <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">{b.code}</code> },
        { key: 'city', header: 'Shahar', cell: (b) => b.city },
        { key: 'p', header: 'Telefon', cell: (b) => b.phone },
        { key: 'o', header: 'Ochilgan', cell: (b) => fmtDate(b.opened_at) },
        { key: 's', header: 'Holat', cell: (b) => <Badge tone={b.is_active ? 'success' : 'neutral'}>{b.is_active ? 'Faol' : 'Nofaol'}</Badge> },
      ]}
      fields={[
        { name: 'name', label: 'Nomi', required: true },
        { name: 'code', label: 'Kod', required: true, hint: 'Lotin harf, raqam, - yoki _ (sertifikat raqamida ishlatiladi)' },
        { name: 'city', label: 'Shahar', required: true },
        { name: 'phone', label: 'Telefon', type: 'tel', required: true, placeholder: '+998 71 123 45 67' },
        { name: 'address', label: 'Manzil', type: 'textarea', required: true, span: 2 },
        { name: 'opened_at', label: 'Ochilgan sana', type: 'date', required: true },
      ]}
    />
  )
}
