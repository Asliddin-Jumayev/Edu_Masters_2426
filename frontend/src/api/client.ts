import { useAuth } from '@/lib/auth'
import { getDeviceId } from '@/lib/device'

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

/** FastAPI xatolarini (matn yoki 422 ro'yxati) foydalanuvchiga tushunarli matnga aylantiradi */
export function formatError(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d.map((x: { loc?: (string | number)[]; msg?: string }) => {
        const field = (x.loc ?? []).filter((p) => p !== 'body' && p !== 'query').join('.')
        return field ? `${field}: ${x.msg}` : x.msg
      }).join('\n')
    }
    if (e.status === 429) return "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring"
    return `Xatolik (${e.status})`
  }
  if (e instanceof TypeError) return "Serverga ulanib bo'lmadi. Internetni va backend manzilini tekshiring"
  return e instanceof Error ? e.message : "Noma'lum xatolik"
}

type Params = Record<string, unknown>
interface Opts { params?: Params; body?: unknown; form?: FormData; auth?: boolean }

function buildUrl(path: string, params?: Params): string {
  const url = new URL(BASE + path, window.location.origin)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || v === '') continue
    url.searchParams.set(k, String(v))
  }
  return url.toString()
}

let refreshing: Promise<boolean> | null = null
async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing  // bir vaqtdagi ko'p 401 uchun bitta yangilash
  refreshing = (async () => {
    const { refreshToken, setTokens } = useAuth.getState()
    if (!refreshToken) return false
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return false
      const t = await res.json()
      setTokens(t.access_token, t.refresh_token)
      return true
    } catch { return false } finally { setTimeout(() => { refreshing = null }, 0) }
  })()
  return refreshing
}

async function raw(method: string, path: string, opts: Opts, retry = true): Promise<Response> {
  const headers: Record<string, string> = { 'X-Device-Id': getDeviceId() }
  const token = useAuth.getState().accessToken
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body) }
  const res = await fetch(buildUrl(path, opts.params), { method, headers, body })
  if (res.status === 401 && retry && opts.auth !== false && useAuth.getState().refreshToken) {
    if (await refreshTokens()) return raw(method, path, opts, false)
    useAuth.getState().logout()
  }
  return res
}

async function request<T>(method: string, path: string, opts: Opts = {}): Promise<T> {
  const res = await raw(method, path, opts)
  if (!res.ok) {
    let detail: unknown = res.statusText
    try { detail = (await res.json()).detail ?? detail } catch { /* matn emas */ }
    if (res.status === 401 && opts.auth !== false) useAuth.getState().logout()
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown, params?: Params) => request<T>('POST', path, { body, params }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown, params?: Params) => request<T>('PATCH', path, { body, params }),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
  /** Ro'yxat endpointlari ham massiv, ham {items} qaytarishi mumkin — ikkalasini bir xil qiladi */
  list: async <T>(path: string, params?: Params): Promise<T[]> => {
    const r = await request<T[] | { items: T[] }>('GET', path, { params })
    return Array.isArray(r) ? r : r.items
  },
  /** Autentifikatsiya talab qiladigan faylni yuklab olish */
  download: async (path: string, filename: string) => {
    const res = await raw('GET', path, {})
    if (!res.ok) throw new ApiError(res.status, 'Faylni yuklab bo\'lmadi')
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}

/** /auth/login x-www-form-urlencoded kutadi (OAuth2PasswordRequestForm) */
export async function loginRequest(username: string, password: string) {
  const res = await fetch(buildUrl('/auth/login'), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Device-Id': getDeviceId() },
    body: new URLSearchParams({ username, password }),
  })
  if (!res.ok) {
    let detail: unknown = res.statusText
    try { detail = (await res.json()).detail ?? detail } catch { /* */ }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as { access_token: string; refresh_token: string }
}
