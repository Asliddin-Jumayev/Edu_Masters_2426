import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { uz } from 'date-fns/locale'

export const cn = (...v: ClassValue[]) => twMerge(clsx(v))

export function fmtMoney(v: string | number | null | undefined, suffix = true): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  const s = n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  return suffix ? `${s} so'm` : s
}

/** Sana (YYYY-MM-DD) -> 04.11.2026 */
export function fmtDate(v?: string | null): string {
  if (!v) return '—'
  try { return format(parseISO(v.slice(0, 10)), 'dd.MM.yyyy') } catch { return v }
}

/** Foydalanuvchi kiritgan vaqt (zonasiz): o'zgartirmasdan ko'rsatiladi */
export function fmtDT(v?: string | null): string {
  if (!v) return '—'
  try { return format(parseISO(v), 'dd.MM.yyyy HH:mm') } catch { return v }
}

/** Server vaqt tamg'asi (UTC, zonasiz) -> mahalliy vaqt */
export function fmtTs(v?: string | null): string {
  if (!v) return '—'
  try { return format(new Date(v.endsWith('Z') ? v : v + 'Z'), 'dd.MM.yyyy HH:mm') } catch { return v }
}

export const fmtTime = (v?: string | null) => (v ? v.slice(0, 5) : '—')
export const today = () => format(new Date(), 'yyyy-MM-dd')
export const monthStart = (d = new Date()) => format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
export const fullName = (x?: { first_name?: string; last_name?: string | null } | null) =>
  x ? `${x.first_name ?? ''} ${x.last_name ?? ''}`.trim() : '—'

/** 2026-11-01 -> 'noyabr 2026' */
export function fmtMonth(v?: string | null): string {
  if (!v) return '—'
  try { return format(parseISO(v.slice(0, 10)), 'LLLL yyyy', { locale: uz }) } catch { return v }
}
export const monthInputToDate = (v: string) => (v.length === 7 ? `${v}-01` : v)
export const thisMonthInput = () => format(new Date(), 'yyyy-MM')
