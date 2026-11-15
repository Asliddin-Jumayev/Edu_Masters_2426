import type { Role } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/labels'
import { can } from '@/lib/permissions'

export default function RolesPage() {
  return (
    <ResourcePage<Role>
      title="Rollar" subtitle="Xodimlarga biriktiriladigan rollar. Ruxsatlar rol kodiga bog‘langan." endpoint="/roles/" noun="rol"
      canCreate={can.admin} canEdit={can.admin} canDelete={(me, r) => can.admin(me) && !r?.is_system}
      deleteHint="Xodimlarga biriktirilgan rolni o‘chirib bo‘lmaydi."
      columns={[
        { key: 'n', header: 'Nomi', cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: 'c', header: 'Kod', cell: (r) => <code className="rounded bg-sunken px-1.5 py-0.5 text-xs">{r.code}</code> },
        { key: 'd', header: 'Imkoniyatlari', cell: (r) => <span className="text-muted">{DESC[r.code] ?? ROLE_LABEL[r.code] ?? 'Maxsus rol'}</span> },
        { key: 's', header: '', cell: (r) => (r.is_system ? <Badge tone="brand">Tizim</Badge> : null) },
      ]}
      fields={[
        { name: 'code', label: 'Kod', required: true, hint: 'Kichik lotin harflar va _ (masalan: reception)' },
        { name: 'name', label: 'Nomi', required: true },
      ]}
    />
  )
}

const DESC: Record<string, string> = {
  admin: 'Hamma narsaga to‘liq ruxsat',
  manager: 'Guruh, o‘quvchi, lid, dars, xodimlar; to‘lov qabul qilish',
  accountant: 'Hisob, to‘lov, xarajat, maosh',
  teacher: 'O‘z guruhlari: davomat, imtihon, o‘z maoshi',
}
