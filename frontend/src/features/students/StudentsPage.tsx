import { useNavigate } from 'react-router-dom'
import type { Group, LeadSource, Student } from '@/api/types'
import { ResourcePage, type FieldDef } from '@/components/resource'
import { Money, StatusBadge } from '@/components/ui'
import { O_STUDENT_STATUS, STUDENT_STATUS } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fullName } from '@/lib/utils'

export const STUDENT_FIELDS: FieldDef[] = [
  { name: 'branch_id', label: 'Filial', type: 'select', required: true, createOnly: true, options: { endpoint: '/branches/', params: { is_active: true }, label: (b: { name: string }) => b.name }, default: ({ branchId, me }) => branchId ?? me?.branch_id },
  { name: 'first_name', label: 'Ism', required: true },
  { name: 'last_name', label: 'Familiya', required: true },
  { name: 'phone', label: 'O‘quvchi telefoni', type: 'tel', clearable: true, placeholder: '+998 90 123 45 67' },
  { name: 'parent_phone', label: 'Ota-ona telefoni', type: 'tel', clearable: true, hint: 'Kamida bitta telefon kerak' },
  { name: 'birth_date', label: 'Tug‘ilgan sana', type: 'date', clearable: true },
  { name: 'source_id', label: 'Qayerdan bilgan', type: 'select', clearable: true, emptyLabel: '— noma‘lum —', options: { endpoint: '/lead-sources/', label: (s: LeadSource) => s.name } },
  { name: 'status', label: 'Holat', type: 'select', options: O_STUDENT_STATUS, default: 'trial' },
]

export default function StudentsPage() {
  const nav = useNavigate()
  return (
    <ResourcePage<Student>
      title="O‘quvchilar" subtitle="Hamma o‘quvchilar va ularning balansi. Qator ustiga bosing — kartochka ochiladi." endpoint="/students/" noun="o‘quvchi"
      search="Ism yoki telefon bo‘yicha qidirish" branchScoped pageSize={30}
      canCreate={can.manager} canEdit={can.manager} canDelete={(me, r) => can.manager(me) && r?.status !== 'left'}
      deleteLabel="Ketgan deb belgilash" deleteHint="O‘quvchi o‘chirilmaydi (to‘lov tarixi saqlanadi), holati ‘Ketgan’ bo‘ladi."
      onRowClick={(s) => nav(`/students/${s.id}`)} modalSize="lg"
      filters={[
        { name: 'status', label: 'Holat', type: 'select', emptyLabel: 'Barcha holatlar', options: O_STUDENT_STATUS },
        { name: 'group_id', label: 'Guruh', type: 'select', emptyLabel: 'Barcha guruhlar', options: { endpoint: '/groups/', label: (g: Group) => g.name } },
        { name: 'debtors_only', label: 'Faqat qarzdorlar', type: 'checkbox' },
      ]}
      columns={[
        { key: 'n', header: 'O‘quvchi', cell: (s) => <div><div className="font-medium">{fullName(s)}</div><div className="text-xs text-muted">{s.phone ?? '—'}</div></div> },
        { key: 's', header: 'Holat', cell: (s) => <StatusBadge map={STUDENT_STATUS} value={s.status} /> },
        { key: 'pp', header: 'Ota-ona', cell: (s) => s.parent_phone ?? '—' },
        { key: 'b', header: 'Balans', cell: (s) => <Money value={s.balance} signed />, align: 'right' },
        { key: 'c', header: 'Qo‘shilgan', cell: (s) => fmtDate(s.created_at) },
      ]}
      fields={STUDENT_FIELDS}
    />
  )
}
