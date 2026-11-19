import { 
  Award, 
  BadgeDollarSign, 
  Banknote, 
  BookOpen, 
  Building2, 
  CalendarCheck, 
  DoorOpen, 
  FileText, 
  GraduationCap, 
  History, 
  LayoutDashboard, 
  Plug, 
  ListChecks, 
  Megaphone, 
  MessageSquare, 
  ReceiptText, 
  Settings2, 
  ShieldCheck, 
  Tags, 
  UserCog, 
  Users, 
  Wallet, 
  type LucideIcon 
} from 'lucide-react'
import type { Me } from '@/api/types'
import { can, hasRole } from '@/lib/permissions'

export interface NavItem { 
  to: string
  label: string
  icon: LucideIcon
  show: (me?: Me) => boolean
  end?: boolean 
}

export interface NavGroup { 
  id?: string
  title?: string
  icon?: LucideIcon
  items: NavItem[] 
}

const all = () => true

export const NAV: NavGroup[] = [
  { 
    id: 'dashboard',
    items: [
      { to: '/dashboard', label: 'Boshqaruv paneli', icon: LayoutDashboard, show: all, end: true }
    ] 
  },
  { 
    id: 'academic',
    title: "O'quv jarayoni", 
    icon: GraduationCap,
    items: [
      { to: '/students', label: "O'quvchilar", icon: Users, show: can.academic },
      { to: '/groups', label: 'Guruhlar', icon: BookOpen, show: can.academic },
      { to: '/sessions', label: 'Darslar va davomat', icon: CalendarCheck, show: can.academic },
      { to: '/certificates', label: 'Sertifikatlar', icon: Award, show: can.manager },
    ] 
  },
  { 
    id: 'crm',
    title: 'Qabul va Lidlar', 
    icon: Megaphone,
    items: [
      { to: '/leads', label: 'Lidlar (Qabul)', icon: Megaphone, show: can.manager },
      { to: '/tasks', label: 'Vazifalar', icon: ListChecks, show: can.manager },
    ] 
  },
  { 
    id: 'finance',
    title: 'Moliya va Hisob', 
    icon: Wallet,
    items: [
      { to: '/invoices', label: 'Hisoblar', icon: ReceiptText, show: can.finance },
      { to: '/payments', label: "To'lovlar", icon: Banknote, show: can.finance },
      { to: '/debtors', label: 'Qarzdorlar', icon: BadgeDollarSign, show: can.finance },
      { to: '/expenses', label: 'Xarajatlar', icon: ReceiptText, show: can.finance },
      { to: '/payroll', label: 'Maosh', icon: FileText, show: (me) => hasRole(me, 'manager', 'accountant', 'teacher') },
    ] 
  },
  { 
    id: 'comm',
    title: 'Aloqa va SMS', 
    icon: MessageSquare,
    items: [
      { to: '/sms', label: 'SMS xabarnomalar', icon: MessageSquare, show: can.finance }
    ] 
  },
  { 
    id: 'settings',
    title: 'Sozlamalar', 
    icon: Settings2,
    items: [
      { to: '/settings/branches', label: 'Filiallar', icon: Building2, show: can.manager },
      { to: '/settings/rooms', label: 'Xonalar', icon: DoorOpen, show: can.manager },
      { to: '/settings/courses', label: 'Kurslar', icon: BookOpen, show: can.manager },
      { to: '/settings/employees', label: 'Xodimlar', icon: UserCog, show: can.manager },
      { to: '/settings/roles', label: 'Rollar', icon: ShieldCheck, show: can.manager },
      { to: '/settings/lookups', label: "Ma'lumotnomalar", icon: Tags, show: can.finance },
      { to: '/settings/integrations', label: 'Integratsiyalar', icon: Plug, show: can.admin },
      { to: '/settings/audit', label: 'Audit jurnali', icon: History, show: can.admin },
    ] 
  },
]

export { Settings2 }
