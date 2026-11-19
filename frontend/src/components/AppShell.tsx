import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { 
  ArrowUpRight,
  Bell, 
  Building2, 
  ChevronDown, 
  Globe,
  GraduationCap, 
  LogOut, 
  Menu, 
  Monitor, 
  Moon, 
  Search, 
  ShieldAlert, 
  Sun, 
  UserCircle2, 
  X 
} from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Branch, Me, Notification, Page } from '@/api/types'
import { useAuth, useBranch } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { cn, fmtTs } from '@/lib/utils'
import { AIAssistantWidget } from './AIAssistantWidget'
import { CommandPalette } from './CommandPalette'
import { NAV } from './nav'
import { Button, Select } from './ui'

type Theme = 'light' | 'dark' | 'system'
function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

function ThemeToggle() {
  const [t, setT] = useState<Theme>(() => { try { return JSON.parse(localStorage.getItem('em-theme') ?? '"system"') } catch { return 'system' } })
  useEffect(() => { applyTheme(t); localStorage.setItem('em-theme', JSON.stringify(t)) }, [t])
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const Icon = t === 'dark' ? Moon : t === 'light' ? Sun : Monitor
  const label = { system: 'Tizim mavzusi', light: 'Yorug‘ mavzu', dark: 'Qorong‘i mavzu' }[t]
  return <Button variant="ghost" size="sm" aria-label={label} title={label} onClick={() => setT(next[t])} className="rounded-xl"><Icon className="size-[18px]" /></Button>
}

function useOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onOut])
  return ref
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(() => setOpen(false))
  const count = useGet<{ unread: number }>('/notifications/unread-count', undefined, { refetchInterval: 60_000 })
  const list = useGet<Page<Notification>>(open ? '/notifications/' : null, { limit: 10 })
  const read = useMut((id: number) => api.patch(`/notifications/${id}/read`), { invalidate: ['/notifications'], silent: true })
  const readAll = useMut(() => api.post('/notifications/read-all'), { invalidate: ['/notifications'] })
  const unread = count.data?.unread ?? 0
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" aria-label={`Bildirishnomalar${unread ? `: ${unread} ta o'qilmagan` : ''}`} onClick={() => setOpen((o) => !o)} className="relative rounded-xl">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white shadow-sm">{unread > 9 ? '9+' : unread}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface shadow-2xl p-1">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="font-display text-sm font-semibold">Bildirishnomalar</span>
            {unread > 0 && <button className="text-xs text-brand hover:underline font-medium" onClick={() => readAll.mutate(undefined)}>O‘qildi</button>}
          </div>
          <ul className="scroll-thin max-h-80 overflow-y-auto">
            {(list.data?.items ?? []).map((n) => (
              <li key={n.id}>
                <button onClick={() => !n.is_read && read.mutate(n.id)} className={cn('block w-full rounded-xl px-3 py-2 text-left hover:bg-sunken transition-colors', !n.is_read && 'bg-brand-soft/50')}>
                  <div className="flex items-center gap-2">{n.type === 'security' && <ShieldAlert className="size-4 text-danger" aria-label="Xavfsizlik" />}<span className="font-medium text-xs">{n.title}</span>{!n.is_read && <span className="size-1.5 rounded-full bg-brand" />}</div>
                  {n.body && <div className="text-[12px] text-muted line-clamp-2 mt-0.5">{n.body}</div>}
                  <div className="mt-1 text-[10px] text-muted">{fmtTs(n.created_at)}</div>
                </button>
              </li>
            ))}
            {list.data && list.data.items.length === 0 && <li className="px-3 py-8 text-center text-xs text-muted">Bildirishnoma yo‘q</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

function BranchSwitcher({ me }: { me?: Me }) {
  const { branchId, setBranch } = useBranch()
  const branches = useGet<Branch[]>('/branches/', { is_active: true })
  const list = branches.data ?? []
  useEffect(() => {
    if (branchId && branches.data && !list.some((b) => b.id === branchId)) setBranch(null)
  }, [branchId, branches.data, list, setBranch])
  if (list.length <= 1 && !can.admin(me)) return null
  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="size-4 text-muted" aria-hidden />
      <Select aria-label="Filial" value={branchId ?? ''} onChange={(e) => setBranch(e.target.value ? Number(e.target.value) : null)} className="h-8 w-auto max-w-44 py-0 text-xs rounded-xl border-line bg-surface">
        <option value="">Barcha filiallar</option>
        {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
    </div>
  )
}

function Sidebar({ me, onNavigate }: { me?: Me; onNavigate?: () => void }) {
  const loc = useLocation()
  
  // URL ga qarab ochiq turishi kerak bo'lgan guruhlarni aniqlaymiz
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      academic: true,
      crm: true,
      finance: false,
      comm: false,
      settings: false,
    }
    NAV.forEach((g) => {
      if (g.id && g.items.some((it) => it.to === loc.pathname || (it.to !== '/dashboard' && loc.pathname.startsWith(it.to)))) {
        initial[g.id] = true
      }
    })
    return initial
  })

  // Sahifa o'zgarganda unga tegishli bo'lim avtomatik ochiladi
  useEffect(() => {
    NAV.forEach((g) => {
      if (g.id && g.items.some((it) => it.to === loc.pathname || (it.to !== '/dashboard' && loc.pathname.startsWith(it.to)))) {
        setOpenGroups((prev) => ({ ...prev, [g.id!]: true }))
      }
    })
  }, [loc.pathname])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <nav aria-label="Asosiy menyu" className="scroll-thin flex h-full flex-col gap-2 overflow-y-auto px-3.5 py-4 font-sans bg-slate-50/90 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border-r border-slate-200/80 dark:border-slate-800/80 transition-colors">
      
      {/* Brand Header */}
      <Link to="/dashboard" onClick={onNavigate} className="mb-3 flex items-center gap-3 px-2 py-1.5 group rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-900/60 transition-colors">
        <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25 group-hover:scale-105 transition-transform">
          <GraduationCap className="size-6 stroke-[2.2]" />
        </div>
        <div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
            Edu Masters
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
          <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            CRM Tizimi
          </span>
        </div>
      </Link>

      {/* Menyu guruhlari va oqib chiquvchi (accordion) ro'yxat */}
      <div className="space-y-1.5 flex-1">
        {NAV.map((g, i) => {
          const items = g.items.filter((it) => it.show(me))
          if (!items.length) return null

          // 1. Agar guruh sarlavhasi bo'lmasa (masalan: Bosh sahifa) — yakka havola
          if (!g.title) {
            return (
              <div key={g.id || i} className="mb-2">
                {items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all',
                      isActive 
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs font-semibold' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-900/70'
                    )}
                  >
                    <it.icon className="size-[18px] shrink-0" />
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </div>
            )
          }

          // 2. Oqib chiquvchi guruh (Accordion Dropdown)
          const isOpen = g.id ? !!openGroups[g.id] : true
          const isGroupActive = items.some((it) => it.to === loc.pathname || (it.to !== '/dashboard' && loc.pathname.startsWith(it.to)))
          const GroupIcon = g.icon

          return (
            <div key={g.id || i} className="space-y-1">
              {/* Oqib chiquvchi guruh tugmasi */}
              <button
                type="button"
                onClick={() => g.id && toggleGroup(g.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all group select-none cursor-pointer',
                  isGroupActive
                    ? 'text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50/80 dark:bg-indigo-950/40'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900/50'
                )}
              >
                <div className="flex items-center gap-2.5">
                  {GroupIcon && <GroupIcon className="size-[17px] shrink-0 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />}
                  <span>{g.title}</span>
                </div>
                <ChevronDown 
                  className={cn(
                    'size-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                    isOpen && 'rotate-180 text-indigo-600 dark:text-indigo-400'
                  )} 
                />
              </button>

              {/* Oqib chiquvchi ichki havolalar */}
              {isOpen && (
                <ul className="border-l-2 border-slate-200 dark:border-slate-800/80 ml-5 pl-2.5 space-y-1 my-1.5 transition-all">
                  {items.map((it) => (
                    <li key={it.to}>
                      <NavLink
                        to={it.to}
                        end={it.end}
                        onClick={onNavigate}
                        className={({ isActive }) => cn(
                          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                          isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-900/60'
                        )}
                      >
                        <it.icon className="size-3.5 shrink-0" />
                        <span className="truncate">{it.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {/* Pastki qism */}
      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400">
        <Link 
          to="/" 
          onClick={onNavigate}
          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-900 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-slate-600 dark:text-slate-400 font-medium"
        >
          <Globe className="size-3.5" />
          <span>asliddin2426.uz saytiga o‘tish</span>
        </Link>
        <span className="text-center text-[10px] text-slate-400 dark:text-slate-600">© Edu Masters • 2026</span>
      </div>
    </nav>
  )
}
function UserMenu({ me }: { me?: Me }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside<HTMLDivElement>(() => setOpen(false))
  const logout = useAuth((s) => s.logout)
  const role = me?.roles[0]?.code
  return (
    <div ref={ref} className="relative">
      <button 
        onClick={() => setOpen((o) => !o)} 
        className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-sunken transition-colors" 
        aria-haspopup="menu" 
        aria-expanded={open}
      >
        <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-[13px] font-bold text-white shadow-sm shadow-indigo-600/30">
          {(me?.first_name?.[0] ?? '?') + (me?.last_name?.[0] ?? '')}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-xs font-bold text-foreground">{me?.first_name} {me?.last_name}</span>
          <span className="block text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">{role ? ROLE_LABEL[role] ?? role : 'Foydalanuvchi'}</span>
        </span>
        <ChevronDown className="hidden md:block size-3.5 text-muted ml-0.5" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-xs font-bold text-foreground">{me?.first_name} {me?.last_name}</p>
            <p className="text-[11px] text-muted truncate">{me?.phone}</p>
          </div>
          <Link 
            role="menuitem" 
            to="/" 
            onClick={() => setOpen(false)} 
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-colors mb-1"
          >
            <Globe className="size-4 text-indigo-500" />
            <span>Asosiy saytga o‘tish</span>
          </Link>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium hover:bg-sunken transition-colors">
            <UserCircle2 className="size-4 text-muted" />
            <span>Shaxsiy profil</span>
          </Link>
          <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-danger hover:bg-danger-soft transition-colors mt-0.5">
            <LogOut className="size-4" />
            <span>Tizimdan chiqish</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const me = useAuth((s) => s.me)
  const setMe = useAuth((s) => s.setMe)
  const [drawer, setDrawer] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [hideMail, setHideMail] = useState(() => sessionStorage.getItem('em-hide-mail') === '1')
  const loc = useLocation()
  const fresh = useGet<Me>('/auth/me')
  useEffect(() => { if (fresh.data) setMe(fresh.data) }, [fresh.data, setMe])
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0) }, [loc.pathname])

  // Global Ctrl+K / Cmd+K klaviatura tinglovchisi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen lg:pl-64 bg-slate-100/60 dark:bg-slate-950 text-foreground font-sans selection:bg-indigo-500 selection:text-white">
      {/* Chap Asosiy Menyu (Sidebar) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-50/95 dark:bg-slate-950 border-r border-slate-200/90 dark:border-slate-800/80 lg:block">
        <Sidebar me={me} />
      </aside>

      {/* Mobil Menyu (Drawer) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-50 dark:bg-slate-950 shadow-2xl">
            <button onClick={() => setDrawer(false)} aria-label="Yopish" className="absolute right-3.5 top-3.5 rounded-xl p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white">
              <X className="size-5" />
            </button>
            <Sidebar me={me} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* Asosiy Ish Maydoni */}
      <div className="flex min-h-screen flex-col">
        {/* Tepadagi Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 px-3 backdrop-blur-md sm:px-6 transition-colors shadow-2xs">
          <Button variant="ghost" size="sm" className="lg:hidden rounded-xl" aria-label="Menyu" onClick={() => setDrawer(true)}>
            <Menu className="size-5" />
          </Button>

          <div className="flex items-center gap-3 flex-1">
            <BranchSwitcher me={me} />
            {/* Spotlight Command Search trigger button */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden sm:flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/60 px-3.5 py-2 text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-400/50 hover:text-slate-800 dark:hover:text-white transition-all w-52 md:w-72 shadow-2xs"
            >
              <Search className="size-3.5 text-muted" />
              <span className="flex-1 text-left truncate font-medium">Qidiruv yoki buyruq...</span>
              <kbd className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 shadow-2xs">Ctrl K</kbd>
            </button>
          </div>

          <button
            onClick={() => setCmdOpen(true)}
            className="sm:hidden grid size-9 place-items-center rounded-xl border border-line bg-sunken text-muted hover:text-foreground"
            title="Qidirish (Ctrl+K)"
          >
            <Search className="size-4" />
          </button>

          {/* Yuqori paneldagi Asosiy saytga o'tish tugmasi */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700/80 transition-all active:scale-95 shrink-0"
            title="Asosiy ommaviy sayt sahifasiga o'tish"
          >
            <Globe className="size-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">Asosiy saytga qaytish</span>
            <span className="md:hidden">Saytga</span>
            <ArrowUpRight className="size-3 text-slate-400" />
          </Link>

          <ThemeToggle />
          <NotificationBell />
          <UserMenu me={me} />
        </header>

        {/* Ogohlantirish (Email kiritilmagan bo'lsa) */}
        {me && !me.email && !hideMail && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-warn/30 bg-warn-soft px-4 py-2 text-xs text-warn">
            <span><b>Xavfsizlik:</b> Yangi qurilmadan kirilganda xavfsizlik xabarnomasi olish uchun <Link to="/profile" className="underline font-semibold">profilingizga email qo‘shing</Link>.</span>
            <button className="font-semibold underline" onClick={() => { sessionStorage.setItem('em-hide-mail', '1'); setHideMail(true) }}>Keyinroq</button>
          </div>
        )}

        {/* Sahifa asosiy kontenti */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Global Spotlight Command Palette (Ctrl+K) */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* AI Assistant Floating Widget */}
      <AIAssistantWidget />
    </div>
  )
}
