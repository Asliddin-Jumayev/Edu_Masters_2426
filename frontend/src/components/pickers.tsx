import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useGet } from '@/api/hooks'
import type { Page, Student } from '@/api/types'
import { useDebounce } from '@/lib/hooks'
import { fullName } from '@/lib/utils'
import { Field, Input, Spinner } from './ui'

/** O'quvchini ism/telefon bo'yicha qidirib tanlash */
export function StudentPicker({ value, onChange, label = "O'quvchi", branchId }: { value: Student | null; onChange: (s: Student | null) => void; label?: string; branchId?: number | null }) {
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const res = useGet<Page<Student>>(!value && dq.trim().length >= 2 ? '/students/' : null, { q: dq.trim(), limit: 8, branch_id: branchId ?? undefined })
  if (value) {
    return (
      <Field label={label}>
        <div className="flex h-9 items-center justify-between rounded-md border border-line bg-sunken px-3">
          <span className="font-medium">{fullName(value)} <span className="font-normal text-muted">{value.phone ?? value.parent_phone}</span></span>
          <button type="button" onClick={() => onChange(null)} aria-label="Tanlovni bekor qilish" className="text-muted hover:text-fg"><X className="size-4" /></button>
        </div>
      </Field>
    )
  }
  return (
    <div className="relative">
      <Field label={label}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" aria-hidden />
          <Input className="pl-8" placeholder="Ism yoki telefon (kamida 2 belgi)" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
      </Field>
      {dq.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
          {res.isFetching && !res.data && <li className="px-3 py-2"><Spinner className="size-4" /></li>}
          {res.data?.items.map((s) => (
            <li key={s.id}><button type="button" onClick={() => { onChange(s); setQ('') }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-sunken">
              <span>{fullName(s)}</span><span className="text-xs text-muted">{s.phone ?? s.parent_phone}</span></button></li>
          ))}
          {res.data && res.data.items.length === 0 && <li className="px-3 py-2 text-muted">Topilmadi</li>}
        </ul>
      )}
    </div>
  )
}

/** Hisob/to'lov ro'yxatlarida o'quvchi nomini id bo'yicha ko'rsatadi (so'rovlar keshlanadi) */
export function StudentName({ id }: { id: number }) {
  const q = useGet<Student>(`/students/${id}`)
  return <Link to={`/students/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{q.data ? fullName(q.data) : `#${id}`}</Link>
}

/** Lidni ism/telefon bo'yicha qidirib tanlash (faqat manager) */
export function LeadPicker({ value, onChange }: { value: { id: number; first_name: string; last_name: string | null; phone: string } | null; onChange: (l: { id: number; first_name: string; last_name: string | null; phone: string } | null) => void }) {
  type L = { id: number; first_name: string; last_name: string | null; phone: string }
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const res = useGet<Page<L>>(!value && dq.trim().length >= 2 ? '/leads/' : null, { q: dq.trim(), limit: 8 })
  if (value) {
    return (
      <Field label="Lid"><div className="flex h-9 items-center justify-between rounded-md border border-line bg-sunken px-3">
        <span className="font-medium">{fullName(value)} <span className="font-normal text-muted">{value.phone}</span></span>
        <button type="button" onClick={() => onChange(null)} aria-label="Tanlovni bekor qilish" className="text-muted hover:text-fg"><X className="size-4" /></button></div></Field>
    )
  }
  return (
    <div className="relative">
      <Field label="Lid"><Input placeholder="Ism yoki telefon (kamida 2 belgi)" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></Field>
      {dq.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
          {res.data?.items.map((l) => <li key={l.id}><button type="button" onClick={() => { onChange(l); setQ('') }} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-sunken"><span>{fullName(l)}</span><span className="text-xs text-muted">{l.phone}</span></button></li>)}
          {res.data && res.data.items.length === 0 && <li className="px-3 py-2 text-muted">Topilmadi</li>}
        </ul>
      )}
    </div>
  )
}
