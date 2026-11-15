import { useState, type FormEvent } from 'react'
import { Laptop, ShieldCheck, Smartphone } from 'lucide-react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Device, Me, TeacherProfile } from '@/api/types'
import { FormModal } from '@/components/resource'
import { Badge, Button, Field, Input, PageHeader, Panel } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/labels'
import { hasRole } from '@/lib/permissions'
import { fmtTs } from '@/lib/utils'

function PasswordForm() {
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [n2, setN2] = useState('')
  const m = useMut(() => api.post('/auth/change-password', { old_password: o, new_password: n }), { success: 'Parol o‘zgartirildi', onSuccess: () => { setO(''); setN(''); setN2('') } })
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(undefined) }
  const mismatch = n2 !== '' && n !== n2
  return (
    <Panel title="Parolni o‘zgartirish">
      <form onSubmit={submit} className="grid max-w-sm gap-3">
        <Field label="Joriy parol"><Input type="password" autoComplete="current-password" value={o} onChange={(e) => setO(e.target.value)} required /></Field>
        <Field label="Yangi parol" hint="Kamida 8 belgi"><Input type="password" autoComplete="new-password" minLength={8} value={n} onChange={(e) => setN(e.target.value)} required /></Field>
        <Field label="Yangi parolni takrorlang" error={mismatch ? 'Parollar mos emas' : undefined}><Input type="password" autoComplete="new-password" value={n2} onChange={(e) => setN2(e.target.value)} required /></Field>
        <Button type="submit" variant="primary" loading={m.isPending} disabled={!o || n.length < 8 || n !== n2} className="justify-self-start">Saqlash</Button>
      </form>
    </Panel>
  )
}

function EmailSection({ me }: { me: Me }) {
  const setMe = useAuth((s) => s.setMe)
  const [edit, setEdit] = useState(false)
  const [email, setEmail] = useState(me.email ?? '')
  const [password, setPassword] = useState('')

  const openModal = () => {
    setEmail(me.email ?? '')
    setPassword('')
    setEdit(true)
  }

  const save = useMut((p: Record<string, unknown>) => api.put('/auth/me/email', p), {
    invalidate: ['/auth/me'],
    success: 'Email saqlandi',
    onSuccess: async () => {
      setMe(await api.get<Me>('/auth/me'))
      setEdit(false)
      setPassword('')
    },
  })

  const test = useMut(() => api.post<{ msg: string }>('/auth/me/test-email'), {
    onSuccess: (r) => import('sonner').then(({ toast }) => toast.success(r.msg)),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({ email, password })
  }

  return (
    <Panel title="Xavfsizlik xabarnomalari" actions={<ShieldCheck className="size-5 text-success" aria-hidden />}>
      <p className="text-[13px] text-muted">
        Hisobingizga <b className="text-fg">yangi qurilmadan</b> kirilsa, shu emailga xabar yuboramiz. Bu siz bo‘lmasangiz, darhol parolni o‘zgartiring.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {me.email ? <Badge tone="success">{me.email}</Badge> : <Badge tone="warn">Email kiritilmagan</Badge>}
        <Button size="sm" onClick={openModal}>{me.email ? 'O‘zgartirish' : 'Email qo‘shish'}</Button>
        {me.email && (
          <Button size="sm" variant="ghost" loading={test.isPending} onClick={() => test.mutate(undefined)}>
            Test xat yuborish
          </Button>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Email manzili</h3>
                <p className="text-xs text-muted">Xavfsizlik uchun joriy parolingiz bilan tasdiqlang.</p>
              </div>
              <button type="button" onClick={() => setEdit(false)} className="text-muted hover:text-fg">✕</button>
            </div>

            <form onSubmit={submit} autoComplete="off" className="grid gap-3">
              {/* Brauzer autofill'ni aldash uchun yashirin soxta inputlar */}
              <input type="text" name="fake-user" autoComplete="username" className="hidden" tabIndex={-1} />
              <input type="password" name="fake-pass" autoComplete="current-password" className="hidden" tabIndex={-1} />

              <Field label="Email *">
                <Input
                  type="email"
                  name="security_email_field"
                  autoComplete="off"
                  placeholder="misol@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field label="Joriy parol *">
                <Input
                  type="password"
                  name="security_password_confirm"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEdit(false)}>Bekor qilish</Button>
                <Button type="submit" variant="primary" loading={save.isPending}>Saqlash</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Panel>
  )
}
function DevicesSection() {
  const q = useGet<Device[]>('/auth/devices')
  const forget = useMut((id: number) => api.del(`/auth/devices/${id}`), { invalidate: ['/auth/devices'], success: 'Qurilma olib tashlandi' })
  const list = q.data ?? []
  return (
    <Panel title="Kirgan qurilmalarim" className="lg:col-span-2" flush>
      <p className="border-b border-line px-4 py-2.5 text-[13px] text-muted">Tanish bo‘lmagan qurilmani ko‘rsangiz — parolni o‘zgartiring. Olib tashlangan qurilmadan keyingi kirishda yana xabarnoma yuboriladi.</p>
      <ul>
        {list.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-3 last:border-0">
            <div className="flex items-center gap-3">
              {/(iOS|Android)/.test(d.label) ? <Smartphone className="size-5 text-muted" aria-hidden /> : <Laptop className="size-5 text-muted" aria-hidden />}
              <div>
                <div className="font-medium">{d.label} {d.is_current && <Badge tone="success" className="ml-1">Shu qurilma</Badge>}</div>
                <div className="text-xs text-muted">So‘nggi kirish: {fmtTs(d.last_seen_at)} · IP {d.last_ip ?? '—'} · {d.login_count} marta · birinchi: {fmtTs(d.first_seen_at)}</div>
              </div>
            </div>
            {!d.is_current && <Button size="sm" variant="ghost" className="text-danger" onClick={() => forget.mutate(d.id)}>Olib tashlash</Button>}
          </li>
        ))}
        {list.length === 0 && !q.isLoading && <li className="px-4 py-8 text-center text-muted">Qurilmalar yo‘q</li>}
      </ul>
    </Panel>
  )
}

function TeacherSection({ id }: { id: number }) {
  const q = useGet<TeacherProfile>('/teacher-profiles/me')
  const [edit, setEdit] = useState(false)
  const exists = !!q.data
  const save = useMut((p: Record<string, unknown>) => (exists ? api.put(`/teacher-profiles/${id}`, p) : api.post('/teacher-profiles/me', p)), { invalidate: ['/teacher-profiles/'], success: 'Profil saqlandi', onSuccess: () => setEdit(false) })
  return (
    <Panel title="O‘qituvchi profili" actions={<Button size="sm" onClick={() => setEdit(true)}>{exists ? 'Tahrirlash' : 'Profil yaratish'}</Button>}>
      {exists ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt className="text-xs text-muted">Mutaxassislik</dt><dd className="font-medium">{q.data!.specialization ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted">Tajriba</dt><dd className="font-medium">{q.data!.experience_years} yil</dd></div>
          <div><dt className="text-xs text-muted">Maksimal guruhlar</dt><dd className="font-medium">{q.data!.max_groups}</dd></div>
          {q.data!.bio && <div className="sm:col-span-3"><dt className="text-xs text-muted">Haqida</dt><dd>{q.data!.bio}</dd></div>}
        </dl>
      ) : <p className="text-muted">Profil hali yaratilmagan.</p>}
      <FormModal open={edit} onClose={() => setEdit(false)} mode={exists ? 'edit' : 'create'} title="O‘qituvchi profili" submitting={save.isPending} onSubmit={(p) => save.mutate(p)}
        initial={q.data as unknown as Record<string, unknown>}
        fields={[{ name: 'specialization', label: 'Mutaxassislik', span: 2, placeholder: 'IELTS, General English' }, { name: 'experience_years', label: 'Tajriba (yil)', type: 'number', default: 0 }, { name: 'bio', label: 'O‘zingiz haqingizda', type: 'textarea', span: 2 }]} />
    </Panel>
  )
}

export default function ProfilePage() {
  const me = useAuth((s) => s.me)
  if (!me) return null
  return (
    <>
      <PageHeader title="Profil" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${me.first_name} ${me.last_name}`}>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
            <dt className="text-muted">Telefon</dt><dd>{me.phone}</dd>
            <dt className="text-muted">Lavozim</dt><dd>{me.position}</dd>
            <dt className="text-muted">Rollar</dt><dd className="flex flex-wrap gap-1.5">{me.roles.map((r, i) => <Badge key={i} tone="brand">{ROLE_LABEL[r.code] ?? r.code}{r.branch_id ? ` · filial #${r.branch_id}` : ''}</Badge>)}</dd>
            <dt className="text-muted">Filiallar</dt><dd>{me.branch_ids === null ? 'Barcha filiallar' : me.branch_ids?.map((b) => `#${b}`).join(', ')}</dd>
          </dl>
        </Panel>
        <EmailSection me={me} />
        <PasswordForm />
        <DevicesSection />
        {hasRole(me, 'teacher') && !hasRole(me, 'manager', 'accountant') && <div className="lg:col-span-2"><TeacherSection id={me.id} /></div>}
      </div>
    </>
  )
}
