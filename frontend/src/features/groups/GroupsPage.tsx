import { useNavigate } from 'react-router-dom'
import type { Course, Employee, Group, Page, Room } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge, Money, StatusBadge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { GROUP_STATUS, O_GROUP_STATUS } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fullName } from '@/lib/utils'

export const GROUP_FIELDS = [
  { name: 'branch_id', label: 'Filial', type: 'select' as const, required: true, createOnly: true, options: { endpoint: '/branches/', params: { is_active: true }, label: (b: { name: string }) => b.name }, default: ({ branchId, me }: { branchId: number | null; me?: { branch_id: number } }) => branchId ?? me?.branch_id },
  { name: 'name', label: 'Guruh nomi', required: true, placeholder: 'Ingliz tili A1 — 18:00' },
  { name: 'course_id', label: 'Kurs', type: 'select' as const, required: true, options: { endpoint: '/courses/', params: { is_active: true }, label: (c: Course) => c.name } },
  { name: 'teacher_id', label: 'O‘qituvchi', type: 'select' as const, clearable: true, emptyLabel: '— biriktirilmagan —', options: { endpoint: '/employees/', params: { role: 'teacher', is_active: true }, label: (e: Employee) => fullName(e) } },
  { name: 'room_id', label: 'Xona', type: 'select' as const, clearable: true, emptyLabel: '— biriktirilmagan —', options: { endpoint: '/rooms/', label: (r: Room) => `${r.name} (${r.capacity} o‘rin)` } },
  { name: 'max_students', label: 'Maksimal o‘quvchi', type: 'number' as const, required: true, default: 12 },
  { name: 'start_date', label: 'Boshlanish sanasi', type: 'date' as const, clearable: true },
  { name: 'end_date', label: 'Tugash sanasi', type: 'date' as const, clearable: true },
  { name: 'price', label: 'Oylik narx (so‘m)', type: 'money' as const, clearable: true, hint: 'Bo‘sh = kurs narxi' },
  { name: 'status', label: 'Holat', type: 'select' as const, options: O_GROUP_STATUS, default: 'planned' },
]

export default function GroupsPage() {
  const nav = useNavigate()
  const me = useAuth((s) => s.me)
  const course = useNames<Course>('/courses/', (c) => c.name)
  const teacher = useNames<Employee>(can.finance(me) ? '/employees/' : null, (e) => fullName(e), { role: 'teacher' })
  return (
    <ResourcePage<Group>
      title="Guruhlar" subtitle="O‘quv guruhlari. Qator ustiga bosing — jadval, o‘quvchilar va imtihonlar ochiladi." endpoint="/groups/" noun="guruh"
      search="Guruh nomi" branchScoped pageSize={30} onRowClick={(g) => nav(`/groups/${g.id}`)} modalSize="lg"
      canCreate={can.manager} canEdit={can.manager} canDelete={() => false}
      filters={[
        { name: 'status', label: 'Holat', type: 'select', emptyLabel: 'Barcha holatlar', options: O_GROUP_STATUS },
        { name: 'course_id', label: 'Kurs', type: 'select', emptyLabel: 'Barcha kurslar', options: { endpoint: '/courses/', label: (c: Course) => c.name } },
      ]}
      columns={[
        { key: 'n', header: 'Guruh', cell: (g) => <span className="font-medium">{g.name}</span> },
        { key: 'c', header: 'Kurs', cell: (g) => course(g.course_id) },
        { key: 't', header: 'O‘qituvchi', cell: (g) => (g.teacher_id ? teacher(g.teacher_id) : <span className="text-muted">—</span>) },
        { key: 's', header: 'Holat', cell: (g) => <StatusBadge map={GROUP_STATUS} value={g.status} /> },
        { key: 'st', header: 'O‘quvchilar', cell: (g) => <Badge tone={g.current_students >= g.max_students ? 'warn' : 'neutral'}>{g.current_students} / {g.max_students}</Badge> },
        { key: 'd', header: 'Muddat', cell: (g) => (g.start_date ? `${fmtDate(g.start_date)} — ${fmtDate(g.end_date)}` : '—') },
        { key: 'p', header: 'Narx', cell: (g) => (g.price ? <Money value={g.price} /> : <span className="text-muted">kurs narxi</span>), align: 'right' },
      ]}
      fields={GROUP_FIELDS}
    />
  )
}
export type { Page }
