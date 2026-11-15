import { useEffect, useMemo, useState } from 'react'
import { useOptions } from '@/api/hooks'

export function useDebounce<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** id -> nom xaritasi. endpoint=null bo'lsa (ruxsat yo'q) '#id' qaytaradi. */
export function useNames<T extends { id: number }>(endpoint: string | null, label: (x: T) => string, params?: Record<string, unknown>) {
  const q = useOptions<T>(endpoint, params)
  const map = useMemo(() => new Map((q.data ?? []).map((x) => [x.id, label(x)])), [q.data]) // eslint-disable-line react-hooks/exhaustive-deps
  return (id?: number | null) => (id === null || id === undefined ? '—' : map.get(id) ?? `#${id}`)
}
