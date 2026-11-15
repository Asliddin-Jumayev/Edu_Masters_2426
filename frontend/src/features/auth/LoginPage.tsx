import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { api, formatError, loginRequest } from '@/api/client'
import type { Me } from '@/api/types'
import { Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const token = useAuth((s) => s.accessToken)
  const { setTokens, setMe } = useAuth()
  const nav = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [phone, setPhone] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (token) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const t = await loginRequest(phone.trim(), pw)
      setTokens(t.access_token, t.refresh_token)
      setMe(await api.get<Me>('/auth/me'))
      nav(from, { replace: true })
    } catch (ex) {
      useAuth.getState().logout()
      setErr(formatError(ex))
    } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-side p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-mark"><span className="block h-3.5 w-[18px] border-y-[3px] border-mark-fg" /></span>
          <span className="font-display text-xl font-semibold">Edu Masters</span>
        </div>
        <div>
          <h1 className="font-display text-[44px] font-semibold leading-[1.08]">
            Davomatdan <span className="marker px-2 text-mark-fg">to‘lovgacha</span> — hammasi bir daftarda.
          </h1>
          <p className="mt-5 max-w-md text-lg text-side-fg">O‘quvchilar, guruhlar, lidlar, hisob-kitob va maosh — o‘quv markazingizni boshqarish uchun yagona joy.</p>
        </div>
        <p className="text-sm text-side-fg/70">© Edu Masters</p>
      </aside>
      <main className="grid place-items-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <h2 className="font-display text-3xl font-semibold">Tizimga kirish</h2>
          <p className="mt-1 text-muted">Telefon raqamingiz va parolingizni kiriting.</p>
          <div className="mt-7 space-y-4">
            <Field label="Telefon raqam">
              <Input type="tel" autoComplete="username" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus required />
            </Field>
            <Field label="Parol">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required className="pr-10" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'} className="absolute right-2 top-2 text-muted hover:text-fg">
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </Field>
            {err && <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">{err}</div>}
            <Button type="submit" variant="primary" loading={busy} disabled={!phone || !pw} className="h-10 w-full">Kirish</Button>
          </div>
        </form>
      </main>
    </div>
  )
}
