import type { Expense, ExpenseCategory } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Money } from '@/components/ui'
import { useNames } from '@/lib/hooks'
import { can } from '@/lib/permissions'
import { fmtDate } from '@/lib/utils'

const CATS = { endpoint: '/expense-categories/', label: (c: ExpenseCategory) => c.name }

export default function ExpensesPage() {
  const cat = useNames<ExpenseCategory>('/expense-categories/', (c) => c.name)
  return (
    <ResourcePage<Expense>
      title="Xarajatlar" subtitle="Ijara, kommunal, marketing va boshqa xarajatlar" endpoint="/expenses/" noun="xarajat" branchScoped pageSize={30}
      canDelete={can.accountant} createLabel="Xarajat kiritish"
      filters={[{ name: 'category_id', label: 'Kategoriya', type: 'select', emptyLabel: 'Barcha kategoriyalar', options: CATS }, { name: 'date_from', label: 'Dan', type: 'date' }, { name: 'date_to', label: 'Gacha', type: 'date' }]}
      columns={[
        { key: 'd', header: 'Sana', cell: (e) => <span className="num">{fmtDate(e.spent_at)}</span> },
        { key: 'c', header: 'Kategoriya', cell: (e) => <span className="font-medium">{cat(e.category_id)}</span> },
        { key: 'x', header: 'Izoh', cell: (e) => e.description ?? <span className="text-muted">—</span> },
        { key: 'a', header: 'Summa', cell: (e) => <Money value={e.amount} />, align: 'right' },
      ]}
      fields={[
        { name: 'branch_id', label: 'Filial', type: 'select', required: true, createOnly: true, options: { endpoint: '/branches/', params: { is_active: true }, label: (b: { name: string }) => b.name }, default: ({ branchId, me }) => branchId ?? me?.branch_id },
        { name: 'category_id', label: 'Kategoriya', type: 'select', required: true, options: CATS },
        { name: 'amount', label: 'Summa (so‘m)', type: 'money', required: true },
        { name: 'spent_at', label: 'Sana', type: 'date', required: true, default: () => new Date().toISOString().slice(0, 10) },
        { name: 'description', label: 'Izoh', type: 'textarea', span: 2, clearable: true },
      ]}
    />
  )
}
