import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, formatError } from './client'

type Params = Record<string, unknown>

export function useGet<T>(path: string | null, params?: Params, opts: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: [path, params ?? {}],
    queryFn: () => api.get<T>(path as string, params),
    enabled: path !== null && (opts.enabled ?? true),
    placeholderData: keepPreviousData,
    refetchInterval: opts.refetchInterval,
  })
}

/** Tanlash maydonlari uchun ro'yxat (massiv yoki {items} ikkalasini qabul qiladi) */
export function useOptions<T = Record<string, unknown>>(path: string | null, params?: Params) {
  return useQuery({
    queryKey: [path, params ?? {}, 'options'],
    queryFn: () => api.list<T>(path as string, { limit: 200, ...params }),
    enabled: path !== null,
    staleTime: 60_000,
  })
}

export function invalidate(qc: QueryClient, prefixes: string[]) {
  return qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === 'string' && prefixes.some((p) => (q.queryKey[0] as string).startsWith(p)),
  })
}

interface MutOpts<R> { invalidate?: string[]; success?: string; onSuccess?: (r: R) => void; silent?: boolean }

/** Xatolarni toast qilib ko'rsatadi, muvaffaqiyatda tegishli so'rovlarni yangilaydi */
export function useMut<V, R = unknown>(fn: (v: V) => Promise<R>, o: MutOpts<R> = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      if (o.invalidate) await invalidate(qc, o.invalidate)
      if (o.success) toast.success(o.success)
      o.onSuccess?.(r)
    },
    onError: (e) => { if (!o.silent) toast.error(formatError(e)) },
  })
}
