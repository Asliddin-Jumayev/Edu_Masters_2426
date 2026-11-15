import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, BadgeX } from 'lucide-react'
import { api, formatError } from '@/api/client'
import type { CertificateVerify } from '@/api/types'
import { Button, Field, Input } from '@/components/ui'
import { fmtDate } from '@/lib/utils'

/** Ochiq sahifa: sertifikat haqiqiyligini tekshirish (kirish shart emas) */
export default function VerifyPage() {
  const { serial } = useParams()
  const nav = useNavigate()
  const [input, setInput] = useState(serial ?? '')
  const [res, setRes] = useState<CertificateVerify | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function check(s: string) {
    setBusy(true); setErr(''); setRes(null)
    try { setRes(await api.get<CertificateVerify>(`/certificates/verify/${encodeURIComponent(s.trim())}`)) } catch (e) { setErr(formatError(e)) } finally { setBusy(false) }
  }
  useEffect(() => { if (serial) void check(serial) }, [serial])
  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim()) nav(`/verify/${encodeURIComponent(input.trim())}`) }
  return (
    <main className="mx-auto grid min-h-screen max-w-lg content-center px-5 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-mark"><span className="block h-3.5 w-[18px] border-y-[3px] border-mark-fg" /></span><span className="font-display text-xl font-semibold">Edu Masters</span></Link>
      <h1 className="font-display text-3xl font-semibold">Sertifikatni tekshirish</h1>
      <p className="mt-1 text-muted">Sertifikatdagi seriya raqamini kiriting (masalan: MAIN-2026-00001).</p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <Field className="flex-1"><Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Seriya raqami" aria-label="Seriya raqami" /></Field>
        <Button type="submit" variant="primary" loading={busy} className="self-end">Tekshirish</Button>
      </form>
      {err && <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-danger">{err}</p>}
      {res && (res.valid ? (
        <div className="mt-6 rounded-lg border border-success bg-success-soft p-5" role="status">
          <div className="flex items-center gap-2 text-success"><BadgeCheck className="size-6" /><span className="font-display text-xl font-semibold">Sertifikat haqiqiy</span></div>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1.5">
            <dt className="text-muted">Egasi</dt><dd className="font-medium">{res.student_name}</dd>
            <dt className="text-muted">Kurs</dt><dd className="font-medium">{res.course_name}</dd>
            <dt className="text-muted">Berilgan sana</dt><dd className="font-medium">{fmtDate(res.issued_at)}</dd>
            <dt className="text-muted">Seriya</dt><dd className="font-medium">{res.serial_number}</dd>
          </dl>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-danger bg-danger-soft p-5 text-danger" role="status"><BadgeX className="size-6" /><span className="font-display text-xl font-semibold">Bunday sertifikat topilmadi</span></div>
      ))}
    </main>
  )
}
