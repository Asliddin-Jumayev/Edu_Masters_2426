import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { uz } from 'date-fns/locale'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGet } from '@/api/hooks'
import type { Dashboard, Debtor, FunnelStage, Group, IncomeExpense, Page, Session, Task } from '@/api/types'
import { Badge, EmptyState, Money, PageHeader, Panel, Spinner, Stat, StatusBadge } from '@/components/ui'
import { useAuth, useBranch } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { PRIORITY, SESSION_STATUS } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDT, fmtMoney, fmtTime, today } from '@/lib/utils'

const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--fg)' }, cursor: { fill: 'var(--sunken)' } }

function FinanceSection({ branchId }: { branchId: number | null }) {
  const p = { branch_id: branchId ?? undefined }
  const d = useGet<Dashboard>('/reports/dashboard', p)
  const ie = useGet<IncomeExpense>('/reports/income-expense', p)
  const fun = useGet<{ stages: FunnelStage[] }>('/reports/lead-funnel', p)
  const debt = useGet<Debtor[]>('/reports/debtors', { ...p, limit: 8 })
  const x = d.data
  const cats = (ie.data?.expenses_by_category ?? []).map((c) => ({ name: c.category, value: Number(c.total) }))
  const stages = (fun.data?.stages ?? []).map((s) => ({ ...s, fill: s.is_won ? 'var(--success)' : s.is_lost ? 'var(--danger)' : 'var(--brand)' }))
  return (
    <>
      <Panel flush className="overflow-hidden">
        {!x ? <div className="p-8 text-center"><Spinner /></div> : (
          <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4 xl:grid-cols-6 [&>*]:bg-surface">
            <Stat label="Faol o‘quvchilar" value={x.students_active} />
            <Stat label="Faol guruhlar" value={x.groups_active} />
            <Stat label="Bugungi darslar" value={x.sessions_today} />
            <Stat label="Oylik tushum" value={fmtMoney(x.income_this_month, false)} hint="so‘m, joriy oy" tone="success" />
            <Stat label="Oylik xarajat" value={fmtMoney(x.expenses_this_month, false)} hint="so‘m, joriy oy" />
            <Stat label="Umumiy qarz" value={fmtMoney(x.debt_total, false)} hint={`${x.debtors_count} ta qarzdor`} tone={Number(x.debt_total) > 0 ? 'danger' : undefined} />
          </div>
        )}
      </Panel>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Lid voronkasi" actions={x && <Badge tone="brand">Konversiya {x.lead_conversion_percent}%</Badge>}>
          {stages.length === 0 ? <EmptyState title="Bu oyda lid yo‘q" /> : (
            <div className="h-64" role="img" aria-label="Lid bosqichlari bo‘yicha diagramma">
              <ResponsiveContainer><BarChart data={stages} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} stroke="var(--muted)" fontSize={12} />
                <YAxis type="category" dataKey="name" width={130} stroke="var(--muted)" fontSize={12} />
                <Tooltip {...tip} formatter={(v) => [v, 'Lidlar']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>{stages.map((s) => <Cell key={s.status_id} fill={s.fill} />)}</Bar>
              </BarChart></ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Xarajatlar (kategoriya bo‘yicha)" actions={ie.data && <span className="text-[13px] text-muted">Foyda: <Money value={ie.data.profit} signed /></span>}>
          {cats.length === 0 ? <EmptyState title="Bu oyda xarajat yo‘q" /> : (
            <div className="h-64" role="img" aria-label="Xarajatlar diagrammasi">
              <ResponsiveContainer><BarChart data={cats} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={110} stroke="var(--muted)" fontSize={12} />
                <Tooltip {...tip} formatter={(v) => [fmtMoney(Number(v)), 'Summa']} />
                <Bar dataKey="value" fill="var(--warn)" radius={[0, 4, 4, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Eng katta qarzdorlar" className="mt-4" flush actions={<Link to="/debtors" className="text-[13px] text-brand hover:underline">Hammasi</Link>}>
        {(debt.data ?? []).length === 0 ? <EmptyState title="Qarzdor yo‘q" hint="Hamma o‘quvchi to‘lovni o‘z vaqtida qilgan." /> : (
          <ul>{debt.data!.map((r) => (
            <li key={r.student_id} className="flex items-center justify-between border-b border-line/70 px-4 py-2.5 last:border-0">
              <Link to={`/students/${r.student_id}`} className="font-medium hover:underline">{r.name}</Link>
              <span className="flex items-center gap-4"><span className="hidden text-muted sm:inline">{r.parent_phone ?? r.phone}</span><Money value={-Number(r.debt)} /></span>
            </li>))}</ul>
        )}
      </Panel>
    </>
  )
}

function TodaySessions() {
  const t = today()
  const q = useGet<Page<Session>>('/lesson-sessions/', { date_from: t, date_to: t, limit: 50 })
  const group = useNames<Group>('/groups/', (g) => g.name)
  const rows = q.data?.items ?? []
  return (
    <Panel title="Bugungi darslar" flush actions={<Link to="/sessions" className="text-[13px] text-brand hover:underline">Jadval</Link>}>
      {q.isLoading ? <div className="p-6 text-center"><Spinner /></div> : rows.length === 0 ? <EmptyState title="Bugun dars yo‘q" /> : (
        <ul>{rows.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2.5 last:border-0">
            <div><span className="num font-medium">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span><span className="ml-3">{group(s.group_id)}</span></div>
            <StatusBadge map={SESSION_STATUS} value={s.status} />
          </li>))}</ul>
      )}
    </Panel>
  )
}

function MyTasks() {
  const q = useGet<Page<Task>>('/tasks/', { completed: false, limit: 6 })
  const rows = q.data?.items ?? []
  return (
    <Panel title="Vazifalarim" flush actions={<Link to="/tasks" className="text-[13px] text-brand hover:underline">Hammasi</Link>}>
      {q.isLoading ? <div className="p-6 text-center"><Spinner /></div> : rows.length === 0 ? <EmptyState title="Ochiq vazifa yo‘q" /> : (
        <ul>{rows.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2.5 last:border-0">
            <div><div className="font-medium">{t.title}</div><div className={`text-xs ${t.due_at && new Date(t.due_at) < new Date() ? 'text-danger' : 'text-muted'}`}>{t.due_at ? fmtDT(t.due_at) : 'Muddatsiz'}</div></div>
            <StatusBadge map={PRIORITY} value={t.priority} />
          </li>))}</ul>
      )}
    </Panel>
  )
}

function TeacherGroups() {
  const q = useGet<Page<Group>>('/groups/', { status: 'active', limit: 20 })
  return (
    <Panel title="Mening guruhlarim" flush>
      {(q.data?.items ?? []).length === 0 ? <EmptyState title="Faol guruh yo‘q" /> : (
        <ul>{q.data!.items.map((g) => (
          <li key={g.id}><Link to={`/groups/${g.id}`} className="flex items-center justify-between border-b border-line/70 px-4 py-2.5 last:border-0 hover:bg-sunken/60">
            <span className="font-medium">{g.name}</span><span className="text-muted">{g.current_students}/{g.max_students} o‘quvchi</span></Link></li>))}</ul>
      )}
    </Panel>
  )
}

export default function DashboardPage() {
  const me = useAuth((s) => s.me)
  const branchId = useBranch((s) => s.branchId)
  const fin = can.finance(me)
  return (
    <>
      <PageHeader title={`Salom, ${me?.first_name ?? ''}`} subtitle={format(new Date(), "d-MMMM, EEEE", { locale: uz })} />
      {fin && <FinanceSection branchId={branchId} />}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TodaySessions />
        <MyTasks />
        {!fin && <TeacherGroups />}
      </div>
    </>
  )
}
