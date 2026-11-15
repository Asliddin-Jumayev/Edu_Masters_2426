import { Award, BadgeDollarSign, Banknote, BookOpen, Building2, CalendarCheck, DoorOpen, FileText, GraduationCap, History, LayoutDashboard, Plug, ListChecks, Megaphone, MessageSquare, ReceiptText, Settings2, ShieldCheck, Tags, UserCog, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { Me } from '@/api/types'
import { can, hasRole } from '@/lib/permissions'

export interface NavItem { to: string; label: string; icon: LucideIcon; show: (me?: Me) => boolean; end?: boolean }
export interface NavGroup { title?: string; items: NavItem[] }

const all = () => true
export const NAV: NavGroup[] = [
  { items: [{ to: '/', label: 'Bosh sahifa', icon: LayoutDashboard, show: all, end: true }] },
  { title: "O'quv jarayoni", items: [
    { to: '/students', label: "O'quvchilar", icon: Users, show: all },
    { to: '/groups', label: 'Guruhlar', icon: GraduationCap, show: all },
    { to: '/sessions', label: 'Darslar va davomat', icon: CalendarCheck, show: all },
    { to: '/certificates', label: 'Sertifikatlar', icon: Award, show: all },
  ] },
  { title: 'Qabul', items: [
    { to: '/leads', label: 'Lidlar', icon: Megaphone, show: can.manager },
    { to: '/tasks', label: 'Vazifalar', icon: ListChecks, show: all },
  ] },
  { title: 'Moliya', items: [
    { to: '/invoices', label: 'Hisoblar', icon: ReceiptText, show: can.finance },
    { to: '/payments', label: "To'lovlar", icon: Wallet, show: can.finance },
    { to: '/debtors', label: 'Qarzdorlar', icon: BadgeDollarSign, show: can.finance },
    { to: '/expenses', label: 'Xarajatlar', icon: Banknote, show: can.finance },
    { to: '/payroll', label: 'Maosh', icon: FileText, show: (me) => hasRole(me, 'manager', 'accountant', 'teacher') },
  ] },
  { title: 'Aloqa', items: [{ to: '/sms', label: 'SMS', icon: MessageSquare, show: can.finance }] },
  { title: 'Sozlamalar', items: [
    { to: '/settings/branches', label: 'Filiallar', icon: Building2, show: can.manager },
    { to: '/settings/rooms', label: 'Xonalar', icon: DoorOpen, show: can.manager },
    { to: '/settings/courses', label: 'Kurslar', icon: BookOpen, show: can.manager },
    { to: '/settings/employees', label: 'Xodimlar', icon: UserCog, show: can.manager },
    { to: '/settings/roles', label: 'Rollar', icon: ShieldCheck, show: can.manager },
    { to: '/settings/lookups', label: "Ma'lumotnomalar", icon: Tags, show: can.finance },
    { to: '/settings/integrations', label: 'Integratsiyalar', icon: Plug, show: can.admin },
    { to: '/settings/audit', label: 'Audit jurnali', icon: History, show: can.admin },
  ] },
]
export { Settings2 }
