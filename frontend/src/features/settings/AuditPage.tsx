import type { AuditLog } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge } from '@/components/ui'
import { fmtTs } from '@/lib/utils'

const ENTITIES = ['employee', 'employee_role', 'student', 'enrollment', 'invoice', 'payment', 'discount', 'student_balance', 'expense', 'payroll', 'salary_rule', 'certificate', 'lead']
const ACTIONS = ['create', 'update', 'delete', 'cancel', 'refund', 'confirm', 'adjust', 'generate', 'approve', 'pay', 'calculate', 'convert']

export default function AuditPage() {
  return (
    <ResourcePage<AuditLog>
      title="Audit jurnali" subtitle="Pul va muhim ma‘lumotlardagi barcha o‘zgarishlar: kim, nima, qachon" endpoint="/audit-logs/" noun="yozuv"
      canCreate={() => false} canEdit={() => false} canDelete={() => false} pageSize={30}
      filters={[
        { name: 'entity_type', label: 'Obyekt', type: 'select', emptyLabel: 'Barcha obyektlar', options: ENTITIES.map((e) => ({ value: e, label: e })) },
        { name: 'action', label: 'Amal', type: 'select', emptyLabel: 'Barcha amallar', options: ACTIONS.map((e) => ({ value: e, label: e })) },
        { name: 'date_from', label: 'Dan', type: 'date' }, { name: 'date_to', label: 'Gacha', type: 'date' },
      ]}
      columns={[
        { key: 't', header: 'Vaqt', cell: (r) => <span className="num whitespace-nowrap">{fmtTs(r.created_at)}</span> },
        { key: 'a', header: 'Amal', cell: (r) => <Badge tone={r.action === 'delete' || r.action === 'refund' || r.action === 'cancel' ? 'danger' : 'brand'}>{r.action}</Badge> },
        { key: 'e', header: 'Obyekt', cell: (r) => <span>{r.entity_type}{r.entity_id ? <span className="text-muted"> #{r.entity_id}</span> : ''}</span> },
        { key: 'u', header: 'Xodim', cell: (r) => (r.employee_id ? `#${r.employee_id}` : '—') },
        { key: 'd', header: 'Tafsilot', cell: (r) => (r.old_values || r.new_values) ? (
          <details className="max-w-md"><summary className="cursor-pointer text-brand">Ko‘rish</summary>
            <pre className="scroll-thin mt-1 max-h-48 overflow-auto rounded bg-sunken p-2 text-xs">{JSON.stringify({ old: r.old_values, new: r.new_values }, null, 1)}</pre></details>) : <span className="text-muted">—</span> },
      ]}
      fields={[]}
    />
  )
}
