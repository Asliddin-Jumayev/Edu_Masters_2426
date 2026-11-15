import type { Room } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge } from '@/components/ui'
import { can } from '@/lib/permissions'
import { useResolved } from '@/components/resource'

const BRANCHES = { endpoint: '/branches/', params: { is_active: true }, label: (b: { name: string }) => b.name }

function BranchName({ id }: { id: number }) {
  const o = useResolved(BRANCHES)
  return <>{o?.find((x) => x.value === id)?.label ?? `#${id}`}</>
}

export default function RoomsPage() {
  return (
    <ResourcePage<Room>
      title="Xonalar" subtitle="Dars o‘tiladigan xonalar va sig‘imi" endpoint="/rooms/" noun="xona"
      branchScoped canCreate={can.manager} canEdit={can.manager} canDelete={(me, r) => can.manager(me) && !!r?.is_active}
      deleteLabel="Faolsizlantirish" deleteHint="Faol yoki rejalashtirilgan guruhda ishlatilayotgan xonani faolsizlantirib bo‘lmaydi."
      defaultFilters={{ is_active: 'true' }}
      filters={[{ name: 'is_active', label: 'Holat', type: 'select', emptyLabel: 'Faol xonalar', options: [{ value: 'true', label: 'Faol' }, { value: 'false', label: 'Nofaol' }] }]}
      columns={[
        { key: 'n', header: 'Xona', cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'b', header: 'Filial', cell: (r) => <BranchName id={r.branch_id} /> },
        { key: 'c', header: 'Sig‘im', cell: (r) => `${r.capacity} o‘rin`, align: 'right' },
        { key: 's', header: 'Holat', cell: (r) => <Badge tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Faol' : 'Nofaol'}</Badge> },
      ]}
      fields={[
        { name: 'branch_id', label: 'Filial', type: 'select', required: true, createOnly: true, options: BRANCHES, default: ({ branchId, me }) => branchId ?? me?.branch_id },
        { name: 'name', label: 'Xona nomi', required: true, placeholder: '101-xona' },
        { name: 'capacity', label: 'Sig‘im (o‘rin)', type: 'number', required: true },
        { name: 'is_active', label: 'Faol', type: 'checkbox', editOnly: true },
      ]}
    />
  )
}
