import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, Building2, ChevronDown, Globe, LogOut, Menu, Monitor, Moon, ShieldAlert, Sun, UserCircle2, X } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Branch, Me, Notification, Page } from '@/api/types'
import { useAuth, useBranch } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { cn, fmtTs } from '@/lib/utils'
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
  const label = { system: 'Tizim mavzusi', light: 'Yorug‘ mavzu', dark: 'Doska (qorong‘i) mavzu' }[t]
  return <Button variant="ghost" size="sm" aria-label={label} title={label} onClick={() => setT(next[t])}><Icon className="size-[18px]" /></Button>
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
      <Button variant="ghost" size="sm" aria-label={`Bildirishnomalar${unread ? `: ${unread} ta o'qilmagan` : ''}`} onClick={() => setOpen((o) => !o)} className="relative">
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="font-display font-semibold">Bildirishnomalar</span>
            {unread > 0 && <button className="text-xs text-brand hover:underline" onClick={() => readAll.mutate(undefined)}>Hammasini o‘qilgan deb belgilash</button>}
          </div>
          <ul className="scroll-thin max-h-80 overflow-y-auto">
            {(list.data?.items ?? []).map((n) => (
              <li key={n.id}>
                <button onClick={() => !n.is_read && read.mutate(n.id)} className={cn('block w-full border-b border-line/60 px-3 py-2.5 text-left hover:bg-sunken', !n.is_read && 'bg-brand-soft/50')}>
                  <div className="flex items-center gap-2">{n.type === 'security' && <ShieldAlert className="size-4 text-danger" aria-label="Xavfsizlik" />}<span className="font-medium">{n.title}</span>{!n.is_read && <span className="size-1.5 rounded-full bg-brand" />}</div>
                  {n.body && <div className="text-[13px] text-muted">{n.body}</div>}
                  <div className="mt-0.5 text-xs text-muted">{fmtTs(n.created_at)}</div>
                </button>
              </li>
            ))}
            {list.data && list.data.items.length === 0 && <li className="px-3 py-8 text-center text-muted">Bildirishnoma yo‘q</li>}
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
  useEffect(() => { // saqlangan filial endi ruxsat etilmagan bo'lsa tozalaymiz
    if (branchId && branches.data && !list.some((b) => b.id === branchId)) setBranch(null)
  }, [branchId, branches.data, list, setBranch])
  if (list.length <= 1 && !can.admin(me)) return null
  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="size-4 text-muted" aria-hidden />
      <Select aria-label="Filial" value={branchId ?? ''} onChange={(e) => setBranch(e.target.value ? Number(e.target.value) : null)} className="h-8 w-auto max-w-44 py-0 text-[13px]">
        <option value="">Barcha filiallar</option>
        {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
    </div>
  )
}

function Sidebar({ me, onNavigate }: { me?: Me; onNavigate?: () => void }) {
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { education: true }
    for (const g of NAV) {
      if (g.isCollapsible && g.items.some((it) => location.pathname === it.to || location.pathname.startsWith(it.to + '/'))) {
        init[g.id] = true
      }
    }
    return init
  })

  useEffect(() => {
    for (const g of NAV) {
      if (g.isCollapsible && g.items.some((it) => location.pathname === it.to || location.pathname.startsWith(it.to + '/'))) {
        setOpenGroups((prev) => (prev[g.id] ? prev : { ...prev, [g.id]: true }))
      }
    }
  }, [location.pathname])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <nav aria-label="Asosiy menyu" className="scroll-thin flex h-full flex-col gap-3 overflow-y-auto px-3 py-4">
      <Link to="/dashboard" onClick={onNavigate} className="mb-2 flex items-center gap-2.5 px-2">
        <span className="grid size-8 place-items-center rounded-lg bg-mark"><span className="block h-3 w-4 border-y-[3px] border-mark-fg" /></span>
        <span className="font-display text-lg font-semibold text-white">Edu Masters</span>
      </Link>
      <div className="space-y-1.5">
        {NAV.map((g) => {
          const items = g.items.filter((it) => it.show(me))
          if (!items.length) return null

          if (!g.isCollapsible) {
            return (
              <div key={g.id}>
                {items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-2.5 py-2 font-medium rounded-lg transition-colors text-sm',
                        isActive
                          ? 'marker font-semibold shadow-sm'
                          : 'text-side-fg hover:bg-white/10 hover:text-white'
                      )
                    }
                  >
                    <it.icon className="size-[18px] shrink-0" aria-hidden />
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </div>
            )
          }

          const isOpen = !!openGroups[g.id]
          const isGroupActive = items.some(
            (it) => location.pathname === it.to || location.pathname.startsWith(it.to + '/')
          )
          const GroupIcon = g.icon

          return (
            <div key={g.id} className="rounded-lg">
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={cn(
                  'flex w-full items-center justify-between px-2.5 py-2 text-sm font-medium rounded-lg transition-colors',
                  isGroupActive
                    ? 'text-white bg-white/10 font-semibold'
                    : 'text-side-fg hover:bg-white/5 hover:text-white'
                )}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2.5">
                  {GroupIcon && <GroupIcon className="size-[18px] shrink-0 text-side-fg/80" aria-hidden />}
                  <span>{g.title}</span>
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 text-side-fg/60 transition-transform duration-200',
                    isOpen && 'rotate-180 text-side-fg'
                  )}
                  aria-hidden
                />
              </button>

              {isOpen && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-white/15 pl-2 transition-all">
                  {items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-2.5 py-1.5 font-medium rounded-md text-[13px] transition-colors',
                          isActive
                            ? 'marker font-semibold shadow-sm'
                            : 'text-side-fg/80 hover:bg-white/10 hover:text-white'
                        )
                      }
                    >
                      <it.icon className="size-4 shrink-0" aria-hidden />
                      <span>{it.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sunken" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-8 place-items-center rounded-full bg-brand text-[13px] font-semibold text-brand-fg">{(me?.first_name?.[0] ?? '?') + (me?.last_name?.[0] ?? '')}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block font-medium">{me?.first_name} {me?.last_name}</span>
          <span className="block text-xs text-muted">{role ? ROLE_LABEL[role] ?? role : ''}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-52 rounded-lg border border-line bg-surface p-1 shadow-xl">
          <Link role="menuitem" to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-muted hover:bg-sunken hover:text-fg"><Globe className="size-4" />Asosiy sayt</Link>
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sunken"><UserCircle2 className="size-4" />Profil</Link>
          <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-danger hover:bg-danger-soft"><LogOut className="size-4" />Chiqish</button>
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const me = useAuth((s) => s.me)
  const setMe = useAuth((s) => s.setMe)
  const [drawer, setDrawer] = useState(false)
  const [hideMail, setHideMail] = useState(() => sessionStorage.getItem('em-hide-mail') === '1')
  const loc = useLocation()
  const fresh = useGet<Me>('/auth/me')
  useEffect(() => { if (fresh.data) setMe(fresh.data) }, [fresh.data, setMe])
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0) }, [loc.pathname])
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-side lg:block"><Sidebar me={me} /></aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-side shadow-2xl">
            <button onClick={() => setDrawer(false)} aria-label="Yopish" className="absolute right-3 top-3 rounded-md p-1 text-side-fg hover:bg-white/10"><X className="size-5" /></button>
            <Sidebar me={me} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Menyu" onClick={() => setDrawer(true)}><Menu className="size-5" /></Button>
          <div className="flex-1"><BranchSwitcher me={me} /></div>
          <ThemeToggle /><NotificationBell /><UserMenu me={me} />
        </header>
        {me && !me.email && !hideMail && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-warn/30 bg-warn-soft px-4 py-2 text-[13px] text-warn">
            <span><b>Email kiritilmagan.</b> Yangi qurilmadan kirilganda xavfsizlik xabarnomasi olish uchun <Link to="/profile" className="underline">profilingizga email qo‘shing</Link>.</span>
            <button className="font-medium underline" onClick={() => { sessionStorage.setItem('em-hide-mail', '1'); setHideMail(true) }}>Keyinroq</button>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-6 sm:px-6"><Outlet /></main>
      </div>
    </div>
  )
}
