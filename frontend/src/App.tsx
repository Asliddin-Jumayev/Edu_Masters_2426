import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { can, hasRole } from '@/lib/permissions'
import type { Me } from '@/api/types'

const L = (f: () => Promise<{ default: React.ComponentType }>) => lazy(f)
const Landing = L(() => import('@/features/landing/LandingPage'))
const Login = L(() => import('@/features/auth/LoginPage'))
const Verify = L(() => import('@/features/misc/VerifyPage'))
const Dashboard = L(() => import('@/features/dashboard/DashboardPage'))
const Students = L(() => import('@/features/students/StudentsPage'))
const StudentDetail = L(() => import('@/features/students/StudentDetail'))
const Groups = L(() => import('@/features/groups/GroupsPage'))
const GroupDetail = L(() => import('@/features/groups/GroupDetail'))
const Sessions = L(() => import('@/features/lessons/SessionsPage'))
const Certificates = L(() => import('@/features/misc/CertificatesPage'))
const Leads = L(() => import('@/features/leads/LeadsPage'))
const Tasks = L(() => import('@/features/misc/TasksPage'))
const Invoices = L(() => import('@/features/finance/InvoicesPage'))
const Payments = L(() => import('@/features/finance/PaymentsPage'))
const Debtors = L(() => import('@/features/finance/DebtorsPage'))
const Expenses = L(() => import('@/features/finance/ExpensesPage'))
const Payroll = L(() => import('@/features/payroll/PayrollPage'))
const Sms = L(() => import('@/features/misc/SmsPage'))
const Profile = L(() => import('@/features/misc/ProfilePage'))
const Branches = L(() => import('@/features/settings/BranchesPage'))
const Rooms = L(() => import('@/features/settings/RoomsPage'))
const Courses = L(() => import('@/features/settings/CoursesPage'))
const Employees = L(() => import('@/features/settings/EmployeesPage'))
const Roles = L(() => import('@/features/settings/RolesPage'))
const Lookups = L(() => import('@/features/settings/LookupsPage'))
const Integrations = L(() => import('@/features/settings/IntegrationsPage'))
const Audit = L(() => import('@/features/settings/AuditPage'))

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.accessToken)
  const loc = useLocation()
  return token ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
}

function Guard({ allow, children }: { allow: (me?: Me) => boolean; children: ReactNode }) {
  const me = useAuth((s) => s.me)
  if (!me) return <div className="grid place-items-center py-24"><Spinner /></div>
  if (!allow(me)) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Ruxsat yo‘q</h1>
        <p className="mt-2 text-muted">Bu sahifa sizning rolingiz uchun mo‘ljallanmagan.</p>
        <Link to="/" className="mt-4 inline-block text-brand underline">Bosh sahifaga qaytish</Link>
      </div>
    )
  }
  return <>{children}</>
}

const g = (allow: (me?: Me) => boolean, el: ReactNode) => <Guard allow={allow}>{el}</Guard>
const any = () => true

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner className="size-7" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/afdmr2426" element={<Login />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:serial" element={<Verify />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:id" element={<StudentDetail />} />
          <Route path="groups" element={<Groups />} />
          <Route path="groups/:id" element={<GroupDetail />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="leads" element={g(can.manager, <Leads />)} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="invoices" element={g(can.finance, <Invoices />)} />
          <Route path="payments" element={g(can.finance, <Payments />)} />
          <Route path="debtors" element={g(can.finance, <Debtors />)} />
          <Route path="expenses" element={g(can.finance, <Expenses />)} />
          <Route path="payroll" element={g((me) => hasRole(me, 'manager', 'accountant', 'teacher'), <Payroll />)} />
          <Route path="sms" element={g(can.finance, <Sms />)} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings/branches" element={g(can.manager, <Branches />)} />
          <Route path="settings/rooms" element={g(can.manager, <Rooms />)} />
          <Route path="settings/courses" element={g(can.manager, <Courses />)} />
          <Route path="settings/employees" element={g(can.manager, <Employees />)} />
          <Route path="settings/roles" element={g(can.manager, <Roles />)} />
          <Route path="settings/lookups" element={g(can.finance, <Lookups />)} />
          <Route path="settings/integrations" element={g(can.admin, <Integrations />)} />
          <Route path="settings/audit" element={g(can.admin, <Audit />)} />
          <Route path="*" element={g(any, <div className="py-24 text-center"><h1 className="font-display text-3xl font-semibold">Sahifa topilmadi</h1><Link to="/" className="mt-3 inline-block text-brand underline">Bosh sahifa</Link></div>)} />
        </Route>
      </Routes>
    </Suspense>
  )
}
