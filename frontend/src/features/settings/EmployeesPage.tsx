import { useState } from 'react'
import { KeyRound, ShieldPlus, UserMinus, UserCheck } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Branch, Employee, EmployeeRole, Role } from '@/api/types'
import { FormModal, ResourcePage, useResolved } from '@/components/resource'
import { Badge, Button, Confirm, Field, Modal, Select, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fullName } from '@/lib/utils'

const BRANCHES = { endpoint: '/branches/', params: { is_active: true }, label: (b: Branch) => b.name }

function RolesDialog({ emp, onClose }: { emp: Employee | null; onClose: () => void }) {
  const me = useAuth((s) => s.me)
  const isAdmin = can.admin(me)
  const roles = useGet<Role[]>(emp ? '/roles/' : null)
  const mine = useGet<EmployeeRole[]>(emp ? '/employee-roles/' : null, { employee_id: emp?.id })
  const branches = useResolved(BRANCHES)
  const [roleId, setRoleId] = useState('')
  const [branchId, setBranchId] = useState('')
  const inv = ['/employee-roles/']
  const add = useMut(() => api.post('/employee-roles/', { employee_id: emp!.id, role_id: Number(roleId), branch_id: branchId ? Number(branchId) : null }),
    { invalidate: inv, success: 'Rol biriktirildi', onSuccess: () => setRoleId('') })
  const remove = useMut((id: number) => api.del(`/employee-roles/${id}`), { invalidate: inv, success: 'Rol olib tashlandi' })
  const roleName = (code?: string | null) => (code ? ROLE_LABEL[code] ?? code : '—')
  const branchName = (id: number | null) => (id === null ? 'Barcha filiallar' : branches?.find((b) => b.value === id)?.label ?? `#${id}`)
  const rolesAllowed = (roles.data ?? []).filter((r) => isAdmin || r.code !== 'admin')
  const needBranch = !isAdmin && !branchId
  return (
    <Modal open={!!emp} onClose={onClose} size="md" title={`Rollar: ${fullName(emp)}`} description="Rol qaysi filialda amal qilishini tanlang. Filial tanlanmasa — barcha filiallarda (faqat admin bera oladi).">
      {mine.isLoading ? <Spinner /> : (
        <ul className="mb-5 divide-y divide-line rounded-md border border-line">
          {(mine.data ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div><span className="font-medium">{roleName(r.role_code)}</span> <span className="text-muted">· {branchName(r.branch_id)}</span></div>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)} className="text-danger">Olib tashlash</Button>
            </li>
          ))}
          {(mine.data ?? []).length === 0 && <li className="px-3 py-4 text-center text-muted">Rol biriktirilmagan — xodim tizimda hech narsa qila olmaydi</li>}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Rol"><Select value={roleId} onChange={(e) => setRoleId(e.target.value)}><option value="">— tanlang —</option>{rolesAllowed.map((r) => <option key={r.id} value={r.id}>{roleName(r.code)}</option>)}</Select></Field>
        <Field label="Filial"><Select value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">{isAdmin ? 'Barcha filiallar' : '— tanlang —'}</option>{(branches ?? []).map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</Select></Field>
        <Button variant="primary" disabled={!roleId || needBranch} loading={add.isPending} onClick={() => add.mutate(undefined)}>Biriktirish</Button>
      </div>
    </Modal>
  )
}

export default function EmployeesPage() {
  const me = useAuth((s) => s.me)
  const [rolesFor, setRolesFor] = useState<Employee | null>(null)
  const [pwFor, setPwFor] = useState<Employee | null>(null)
  const [fireFor, setFireFor] = useState<Employee | null>(null)
  const inv = ['/employees/']
  const fire = useMut((id: number) => api.post(`/employees/${id}/fire`, {}), { invalidate: inv, success: 'Xodim ishdan bo‘shatildi', onSuccess: () => setFireFor(null) })
  const react = useMut((id: number) => api.post(`/employees/${id}/reactivate`), { invalidate: inv, success: 'Xodim qayta faollashtirildi' })
  const reset = useMut((p: { id: number; pw: string }) => api.put(`/employees/${p.id}/password`, { new_password: p.pw }), { success: 'Parol yangilandi', onSuccess: () => setPwFor(null) })

  return (
    <>
      <ResourcePage<Employee>
        title="Xodimlar" subtitle="Xodimlar, ularning rollari va ishga kirish-chiqish sanalari" endpoint="/employees/" noun="xodim"
        search="Ism yoki telefon" branchScoped canCreate={can.manager} canDelete={() => false} defaultFilters={{ is_active: 'true' }}
        filters={[
          { name: 'is_active', label: 'Holat', type: 'select', emptyLabel: 'Hammasi', options: [{ value: 'true', label: 'Ishlayotganlar' }, { value: 'false', label: 'Bo‘shatilganlar' }] },
          { name: 'role', label: 'Rol', type: 'select', emptyLabel: 'Barcha rollar', options: [{ value: 'teacher', label: 'O‘qituvchi' }, { value: 'manager', label: 'Menejer' }, { value: 'accountant', label: 'Buxgalter' }, { value: 'admin', label: 'Administrator' }] },
        ]}
        columns={[
          { key: 'n', header: 'Xodim', cell: (e) => <div><div className="font-semibold text-slate-900 dark:text-slate-100">{fullName(e)}</div><div className="text-xs text-slate-500 dark:text-slate-400">{e.position}</div></div> },
          { key: 'p', header: 'Telefon', cell: (e) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{e.phone}</span> },
          { key: 'h', header: 'Ishga kirgan', cell: (e) => <span className="text-slate-600 dark:text-slate-400 text-xs">{fmtDate(e.hired_at)}</span> },
          { key: 's', header: 'Holat', cell: (e) => (e.is_active ? <Badge tone="success">Ishlayapti</Badge> : <Badge tone="neutral">Bo‘shatilgan {fmtDate(e.fired_at)}</Badge>) },
        ]}
        rowActions={(e) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" title="Rollar" aria-label="Rollar" onClick={() => setRolesFor(e)} className="hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 rounded-lg p-1.5 h-8 w-8"><ShieldPlus className="size-4" /></Button>
            {can.admin(me) && <Button variant="ghost" size="sm" title="Parolni tiklash" aria-label="Parolni tiklash" onClick={() => setPwFor(e)} className="hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-600 rounded-lg p-1.5 h-8 w-8"><KeyRound className="size-4" /></Button>}
            {e.is_active
              ? <Button variant="ghost" size="sm" title="Ishdan bo‘shatish" aria-label="Ishdan bo‘shatish" onClick={() => setFireFor(e)} className="hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-500 hover:text-rose-600 rounded-lg p-1.5 h-8 w-8"><UserMinus className="size-4" /></Button>
              : <Button variant="ghost" size="sm" title="Qayta faollashtirish" aria-label="Qayta faollashtirish" onClick={() => react.mutate(e.id)} className="hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-600 rounded-lg p-1.5 h-8 w-8"><UserCheck className="size-4" /></Button>}
          </div>
        )}
        modalSize="lg"
        fields={[
          { name: 'first_name', label: 'Ism', required: true },
          { name: 'last_name', label: 'Familiya', required: true },
          { name: 'phone', label: 'Telefon (login)', type: 'tel', required: true, placeholder: '+998 90 123 45 67' },
          { name: 'email', label: 'Email', type: 'email', clearable: true },
          { name: 'branch_id', label: 'Filial', type: 'select', required: true, options: BRANCHES, default: ({ branchId, me: m }) => branchId ?? m?.branch_id },
          { name: 'position', label: 'Lavozim', required: true, placeholder: 'Ingliz tili o‘qituvchisi' },
          { name: 'hired_at', label: 'Ishga kirgan sana', type: 'date', required: true, default: () => new Date().toISOString().slice(0, 10) },
          { name: 'birth_date', label: 'Tug‘ilgan sana', type: 'date', clearable: true },
          { name: 'password', label: 'Boshlang‘ich parol', type: 'password', required: true, createOnly: true, hint: 'Kamida 8 belgi', span: 2 },
        ]}
      />
      <RolesDialog emp={rolesFor} onClose={() => setRolesFor(null)} />
      <Confirm open={!!fireFor} onClose={() => setFireFor(null)} danger confirmLabel="Ishdan bo‘shatish" loading={fire.isPending}
        title="Xodimni ishdan bo‘shatish?" onConfirm={() => fireFor && fire.mutate(fireFor.id)}
        message={<>{fullName(fireFor)} tizimga kira olmaydi. Darslari va maosh tarixi saqlanadi.</>} />
      <FormModal open={!!pwFor} onClose={() => setPwFor(null)} title={`Parolni tiklash: ${fullName(pwFor)}`} size="sm" submitLabel="Yangi parolni o‘rnatish"
        fields={[{ name: 'new_password', label: 'Yangi parol', type: 'password', required: true, hint: 'Kamida 8 belgi', span: 2 }]}
        submitting={reset.isPending} onSubmit={(p) => pwFor && reset.mutate({ id: pwFor.id, pw: String(p.new_password) })} />
    </>
  )
}
