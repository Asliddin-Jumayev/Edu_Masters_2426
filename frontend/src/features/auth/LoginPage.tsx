import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Phone, ArrowRight, GraduationCap, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'
import { api, formatError, loginRequest } from '@/api/client'
import type { Me } from '@/api/types'
import { useAuth } from '@/lib/auth'

// O'zbekiston telefon raqamini formatlash va harflarni cheklash funksiyasi
function formatUzPhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('998')) {
    digits = digits.slice(3)
  }
  digits = digits.slice(0, 9)
  if (digits.length === 0) return '+998 '
  if (digits.length <= 2) return `+998 (${digits}`
  if (digits.length <= 5) return `+998 (${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 7) return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5)}`
  return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`
}

export default function LoginPage() {
  const token = useAuth((s) => s.accessToken)
  const { setTokens, setMe } = useAuth()
  const nav = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/dashboard'
  const [phone, setPhone] = useState('+998 ')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  if (token) return <Navigate to={from === '/' ? '/dashboard' : from} replace />

  function handlePhoneChange(val: string) {
    if (val.length < 5) {
      setPhone('+998 ')
      return
    }
    setPhone(formatUzPhone(val))
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Harakatlanish va boshqaruv tugmalariga ruxsat berish
    if (
      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) ||
      e.ctrlKey || e.metaKey
    ) {
      return
    }
    // Raqam bo'lmagan har qanday belgini (harflar, 'e', simvollar) qat'iy to'xtatish
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')

    const pureDigits = phone.replace(/\D/g, '').replace(/^998/, '')
    if (pureDigits.length !== 9) {
      setErr("Telefon raqamingizni to‘liq kiriting (9 ta raqam)")
      return
    }
    const normalizedPhone = '+998' + pureDigits

    setBusy(true)
    try {
      const t = await loginRequest(normalizedPhone, pw)
      setTokens(t.access_token, t.refresh_token)
      const meData = await api.get<Me>('/auth/me')
      setMe(meData)
      setSuccess(true)
      const target = (!from || from === '/') ? '/dashboard' : from
      setTimeout(() => {
        nav(target, { replace: true })
      }, 300)
    } catch (ex) {
      useAuth.getState().logout()
      setErr(formatError(ex))
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Orqa fon bezaklari (Ambient Glowing Gradient Orbs) */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-indigo-500/15 dark:bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 size-96 rounded-full bg-blue-500/15 dark:bg-blue-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 size-80 rounded-full bg-violet-500/15 dark:bg-violet-600/15 blur-3xl pointer-events-none" />

      {/* Asosiy Login Karta */}
      <div className="relative w-full max-w-[420px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/10 dark:shadow-black/40 transition-all">
        
        {/* Yuqori qism: Brend va Logotip */}
        <div className="flex flex-col items-center text-center">
          <div className="size-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 mb-3.5 transition-transform hover:scale-105">
            <GraduationCap className="size-7 stroke-[2.2]" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-2">
            <Sparkles className="size-3.5" />
            <span>Edu Masters CRM</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tizimga kirish
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            O‘quv markazni boshqarish platformasiga xush kelibsiz
          </p>
        </div>

        {/* Xatolik xabari */}
        {err && (
          <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-[13px] leading-snug">{err}</div>
          </div>
        )}

        {/* Muvaffaqiyatli kirish xabari */}
        {success && (
          <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5 shrink-0" />
            <span className="text-[13px] font-medium">Kirish muvaffaqiyatli! Boshqaruv paneliga o'tilmoqda...</span>
          </div>
        )}

        {/* Forma */}
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {/* Telefon raqam */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Telefon raqam
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="size-4" />
              </div>
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+998 (90) 123-45-67"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onKeyDown={handlePhoneKeyDown}
                required
                className="w-full h-11 pl-10 pr-4 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Parol */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Parol
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="size-4" />
              </div>
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Parolingizni kiriting"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                className="w-full h-11 pl-10 pr-11 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Kirish Tugmasi */}
          <button
            type="submit"
            disabled={!phone || !pw || busy || success}
            className="w-full h-11 mt-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group active:scale-[0.99]"
          >
            {busy ? (
              <div className="flex items-center gap-2">
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Tekshirilmoqda...</span>
              </div>
            ) : success ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                <span>Muvaffaqiyatli!</span>
              </div>
            ) : (
              <>
                <span>Tizimga kirish</span>
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          {/* Asosiy saytga qaytish */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <span>← Asosiy saytga (Landing) qaytish</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
