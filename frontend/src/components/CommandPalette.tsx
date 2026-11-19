import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Search,
  Settings,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  to: string
  category: string
}

const STATIC_COMMANDS: CommandItem[] = [
  { id: 'site', title: 'Asosiy saytga o‘tish (Landing)', subtitle: 'Ommaviy veb-sayt sahifasi', category: 'Sahifalar', icon: Globe, to: '/' },
  { id: 'dash', title: 'Boshqaruv paneli (Dashboard)', subtitle: 'Statistika va tezkor hisobotlar', category: 'Sahifalar', icon: LayoutDashboard, to: '/dashboard' },
  { id: 'students', title: "O'quvchilar ro'yxati", category: 'Sahifalar', icon: GraduationCap, to: '/students' },
  { id: 'new-student', title: "Yangi o'quvchi qo'shish", category: 'Amallar', icon: UserPlus, to: '/students?action=new' },
  { id: 'groups', title: 'Guruhlar', category: 'Sahifalar', icon: Users, to: '/groups' },
  { id: 'leads', title: 'CRM — Lidlar', category: 'Sahifalar', icon: UserCheck, to: '/leads' },
  { id: 'sessions', title: 'Darslar va Davomat', category: 'Sahifalar', icon: Calendar, to: '/sessions' },
  { id: 'invoices', title: 'Hisob-fakturalar (Invoices)', category: 'Moliya', icon: FileText, to: '/invoices' },
  { id: 'payments', title: "To'lovlar", category: 'Moliya', icon: CreditCard, to: '/payments' },
  { id: 'debtors', title: 'Qarzdorlar ro‘yxati', category: 'Moliya', icon: CreditCard, to: '/debtors' },
  { id: 'courses', title: 'Kurslar', category: 'Sozlamalar', icon: BookOpen, to: '/settings/courses' },
  { id: 'employees', title: 'Xodimlar', category: 'Sozlamalar', icon: Users, to: '/settings/employees' },
  { id: 'settings', title: 'Tizim sozlamalari', category: 'Sozlamalar', icon: Settings, to: '/settings/integrations' },
]

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [studentResults, setStudentResults] = useState<CommandItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Talabalarni qidirish
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setStudentResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        interface StudentItem { id: number; first_name: string; last_name: string; phone?: string }
        const res = await api.get<{ items: StudentItem[] }>(
          `/students/?search=${encodeURIComponent(query)}&limit=5`,
        )
        const items: CommandItem[] = (res.items ?? []).map((s: StudentItem) => ({
          id: `student-${s.id}`,
          title: `${s.first_name} ${s.last_name}`,
          subtitle: `Tel: ${s.phone || "yo'q"}`,
          category: "O'quvchilar",
          icon: GraduationCap,
          to: `/students/${s.id}`,
        }))
        setStudentResults(items)
      } catch {
        setStudentResults([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const filteredStatic = STATIC_COMMANDS.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase()),
  )

  const allItems = [...studentResults, ...filteredStatic]

  const handleSelect = (item: CommandItem) => {
    onClose()
    navigate(item.to)
  }

  // Klaviatura navigatsiyasi
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, selectedIndex, allItems])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search className="size-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="O'quvchi, guruh yoki sahifalarni qidiring (Ctrl+K)..."
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
          <span className="hidden sm:inline-block rounded border border-line bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="scroll-thin max-h-96 overflow-y-auto p-2">
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              "{query}" bo‘yicha hech narsa topilmadi
            </div>
          ) : (
            <div className="space-y-1">
              {allItems.map((item, idx) => {
                const Icon = item.icon
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors',
                      isSelected ? 'bg-brand text-brand-fg font-medium' : 'hover:bg-sunken text-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'grid size-8 place-items-center rounded-lg',
                        isSelected ? 'bg-white/20 text-white' : 'bg-sunken text-muted',
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className={cn('text-xs truncate', isSelected ? 'text-white/80' : 'text-muted')}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-medium px-2 py-0.5 rounded-full',
                        isSelected ? 'bg-white/20 text-white' : 'bg-sunken text-muted',
                      )}
                    >
                      {item.category}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-line bg-sunken/50 px-4 py-2.5 text-[12px] text-muted">
          <div className="flex items-center gap-2">
            <span>Tanlash: <kbd className="rounded bg-surface px-1.5 py-0.5 border border-line">↵</kbd></span>
            <span>Navigatsiya: <kbd className="rounded bg-surface px-1.5 py-0.5 border border-line">↑</kbd> <kbd className="rounded bg-surface px-1.5 py-0.5 border border-line">↓</kbd></span>
          </div>
          <span>Edu Masters Spotlight</span>
        </div>
      </div>
    </div>
  )
}
