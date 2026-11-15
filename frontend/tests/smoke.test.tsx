/**
 * Haqiqiy backendga ulangan integratsion sinov (jsdom).
 * Talab: backend 8000-portda ishlayotgan va  python scripts/demo_data.py  bajarilgan bo'lishi kerak.
 */
import { cleanup, render, screen, waitFor, within, configure } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { api, loginRequest } from '@/api/client'
import type { Me } from '@/api/types'
import { useAuth, useBranch } from '@/lib/auth'

configure({ asyncUtilTimeout: 10000 })

async function loginAs(phone: string, pw: string) {
  const t = await loginRequest(phone, pw)
  useAuth.setState({ accessToken: t.access_token, refreshToken: t.refresh_token, me: undefined })
  useAuth.getState().setMe(await api.get<Me>('/auth/me'))
  useBranch.setState({ branchId: null })
}
const ADMIN = ['+998901112233', 'AdminPass123']
const MANAGER = ['+998900000001', 'Demo12345']
const ACCOUNTANT = ['+998900000002', 'Demo12345']
const TEACHER = ['+998900000003', 'Demo12345']

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>)
}

const errors: string[] = []
beforeEach(() => {
  errors.length = 0
  vi.spyOn(console, 'error').mockImplementation((...a) => { const s = a.map(String).join(' '); if (!/not wrapped in act|act\(/.test(s)) errors.push(s.slice(0, 300)) })
})
afterEach(() => { vi.restoreAllMocks(); expect(errors, 'React/console xatolari').toEqual([]) })

describe('login', () => {
  it('noto‘g‘ri parolda xato, to‘g‘risida Bosh sahifa', async () => {
    useAuth.getState().logout()
    const ui = userEvent.setup()
    renderAt('/')
    await ui.type(await screen.findByLabelText(/Telefon raqam/), '+998901112233')
    await ui.type(screen.getByLabelText('Parol'), 'xato-parol')
    await ui.click(screen.getByRole('button', { name: 'Kirish' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/noto.g.ri/)
    await ui.clear(screen.getByLabelText('Parol'))
    await ui.type(screen.getByLabelText('Parol'), 'AdminPass123')
    await ui.click(screen.getByRole('button', { name: 'Kirish' }))
    expect(await screen.findByText(/Salom, Admin/)).toBeInTheDocument()
  })
})

describe('admin: barcha sahifalar haqiqiy ma‘lumot bilan chiziladi', () => {
  beforeAll(() => loginAs(...(ADMIN as [string, string])))
  const pages: [string, RegExp][] = [
    ['/', /Umumiy qarz/], ['/students', /Karimova/], ['/students/1', /Hisoblar/], ['/groups', /Ingliz tili A1/], ['/groups/1', /Jadval/],
    ['/sessions', /Darslar va davomat/], ['/leads', /Nodira/], ['/tasks', /Ota-onasiga/], ['/invoices', /Hisob-fakturalar/],
    ['/payments', /Naqd/], ['/debtors', /Umumiy qarz/], ['/expenses', /Ijara/], ['/payroll', /Oylik hisob/], ['/sms', /SMS jurnali/],
    ['/certificates', /Sertifikatlar/], ['/settings/branches', /Asosiy filial/], ['/settings/rooms', /101-xona/], ['/settings/courses', /Matematika/],
    ['/settings/employees', /Dilshod/], ['/settings/roles', /Administrator/], ['/settings/lookups', /Lid manbalari/], ['/settings/audit', /Audit jurnali/], ['/settings/integrations', /Integratsiyalar/],
    ['/profile', /Parolni o.zgartirish/], ['/verify/YOQ-1', /Bunday sertifikat topilmadi/],
  ]
  it.each(pages)('%s', async (path, expected) => {
    renderAt(path)
    expect((await screen.findAllByText(expected)).length).toBeGreaterThan(0)
  })

  it('o‘quvchi kartochkasi: tablar va real ma‘lumot', async () => {
    const ui = userEvent.setup()
    renderAt('/students/1')
    expect((await screen.findAllByText(/Aziza Karimova/)).length).toBeGreaterThan(0)
    for (const tab of ['To.lovlar', 'Balans tarixi', 'Chegirmalar', 'Davomat', 'Fayllar', 'Hisoblar']) {
      await ui.click(screen.getByRole('tab', { name: new RegExp(tab) }))
      await waitFor(() => expect(screen.getByRole('tab', { name: new RegExp(tab) })).toHaveAttribute('aria-selected', 'true'))
    }
  })
})

describe('admin: amallar backendga haqiqatan yetib boradi', () => {
  beforeAll(() => loginAs(...(ADMIN as [string, string])))

  it('xona yaratish (forma → API)', async () => {
    const ui = userEvent.setup()
    const roomName = `Test xona ${Date.now()}`
    renderAt('/settings/rooms')
    await ui.click(await screen.findByRole('button', { name: /Yangi xona/ }))
    const dlg = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dlg).getByRole('option', { name: 'Asosiy filial' })).toBeInTheDocument())
    await ui.selectOptions(within(dlg).getByLabelText(/Filial/), 'Asosiy filial')
    await ui.type(within(dlg).getByLabelText(/Xona nomi/), roomName)
    await ui.type(within(dlg).getByLabelText(/Sig.im/), '7')
    await ui.click(within(dlg).getByRole('button', { name: /Qo.shish/ }))
    await waitFor(async () => expect((await api.list<{ name: string }>('/rooms/')).some((r) => r.name === roomName)).toBe(true))
    expect(await screen.findByText(roomName)).toBeInTheDocument()
  })

  it('validatsiya xatosi: majburiy maydon', async () => {
    const ui = userEvent.setup()
    renderAt('/settings/courses')
    await ui.click(await screen.findByRole('button', { name: /Yangi kurs/ }))
    const dlg = await screen.findByRole('dialog')
    await ui.click(within(dlg).getByRole('button', { name: /Qo.shish/ }))
    expect((await within(dlg).findAllByText('Majburiy maydon')).length).toBeGreaterThan(2)
  })

  it('to‘lov qabul qilish → balans o‘zgaradi', async () => {
    const before = Number((await api.get<{ balance: string }>('/students/2')).balance)
    const ui = userEvent.setup()
    renderAt('/students/2')
    await ui.click(await screen.findByRole('button', { name: /To.lov qabul qilish/ }))
    const dlg = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dlg).getByRole('option', { name: 'Naqd' })).toBeInTheDocument())
    await ui.selectOptions(within(dlg).getByLabelText(/To.lov usuli/), 'Naqd')
    await ui.type(within(dlg).getByLabelText(/Summa/), '100000')
    await ui.click(within(dlg).getByRole('button', { name: /To.lovni saqlash/ }))
    await waitFor(async () => expect(Number((await api.get<{ balance: string }>('/students/2')).balance)).toBe(before + 100000))
  })

  it('davomat belgilash → API da saqlanadi', async () => {
    const ses = (await api.get<{ items: { id: number; status: string }[] }>('/lesson-sessions/', { group_id: 1, limit: 50 })).items.find((s) => s.status === 'planned')!
    const ui = userEvent.setup()
    renderAt('/groups/1')
    await ui.click(await screen.findByRole('tab', { name: 'Darslar' }))
    const btns = await screen.findAllByRole('button', { name: /Davomat/ })
    await ui.click(btns[btns.length - 1]) // oxirgi (rejadagi) dars
    const dlg = await screen.findByRole('dialog')
    const kelmadi = await within(dlg).findAllByRole('radio', { name: 'Kelmadi' })
    await ui.click(kelmadi[0])
    await ui.click(within(dlg).getByRole('button', { name: 'Saqlash' }))
    await waitFor(async () => {
      const all = await Promise.all((await api.get<{ items: { id: number }[] }>('/lesson-sessions/', { group_id: 1, limit: 50 })).items.map((s) => api.get<{ status: string }[]>(`/lesson-sessions/${s.id}/attendance`)))
      expect(all.flat().filter((a) => a.status === 'absent').length).toBeGreaterThan(0)
    })
    expect(ses).toBeTruthy()
  })

  it('lid bosqichini o‘zgartirish va o‘quvchiga aylantirish', async () => {
    const stamp = String(Date.now()).slice(-7)
    const branch = (await api.get<{ id: number }[]>('/branches/'))[0].id
    const mk = (first: string, n: number) => api.post<{ id: number }>('/leads/', { branch_id: branch, first_name: first, phone: `+99893${stamp.slice(0, 6)}${n}` })
    const moveName = `Move${stamp}`, convName = `Conv${stamp}`
    const moveLead = await mk(moveName, 1)
    await mk(convName, 2)
    const ui = userEvent.setup()
    renderAt('/leads')
    const card = (await screen.findByText(moveName)).closest('li')!
    await ui.selectOptions(within(card).getByLabelText(/Bosqichni/), "Bog'lanildi")
    await waitFor(async () => {
      const lead = await api.get<{ status_id: number }>(`/leads/${moveLead.id}`)
      const sts = await api.get<{ id: number; name: string }[]>('/lead-statuses/')
      expect(sts.find((x) => x.id === lead.status_id)!.name).toBe("Bog'lanildi")
    })
    await ui.click(screen.getByRole('button', { name: convName }))
    await ui.click(await screen.findByRole('button', { name: /O.quvchiga aylantirish/ }))
    const dlg = (await screen.findAllByRole('dialog')).at(-1)!
    await ui.type(await within(dlg).findByLabelText(/Familiya/), `Fam${stamp}`)
    await ui.click(within(dlg).getByRole('button', { name: 'Aylantirish' }))
    await waitFor(async () => expect((await api.get<{ items: { first_name: string }[] }>('/students/', { q: `Fam${stamp}` })).items.map((x) => x.first_name)).toContain(convName))
  })
})

describe('rollar bo‘yicha ko‘rinish', () => {
  it('o‘qituvchi: faqat o‘z guruhlari, moliya yopiq', async () => {
    await loginAs(...(TEACHER as [string, string]))
    const ui = userEvent.setup()
    renderAt('/groups')
    expect(await screen.findByText(/Ingliz tili A1/)).toBeInTheDocument()
    expect(screen.queryByText(/Matematika 9-sinf/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Hisoblar|To.lovlar|Lidlar/ })).not.toBeInTheDocument()
    cleanupAndRender('/invoices')
    expect(await screen.findByText(/Ruxsat yo.q/)).toBeInTheDocument()
    void ui
  })
  it('o‘qituvchi bosh sahifasi', async () => {
    await loginAs(...(TEACHER as [string, string]))
    renderAt('/')
    expect(await screen.findByText(/Mening guruhlarim/)).toBeInTheDocument()
    expect(screen.queryByText(/Umumiy qarz/)).not.toBeInTheDocument()
  })
  it('buxgalter: maosh qoidalari va xodim nomlari', async () => {
    await loginAs(...(ACCOUNTANT as [string, string]))
    const ui = userEvent.setup()
    renderAt('/payroll')
    await ui.click(await screen.findByRole('tab', { name: 'Qoidalar' }))
    expect(await screen.findAllByText(/Sardor Rahimov/)).not.toHaveLength(0)
  })
  it('manager: lidlar ochiq', async () => {
    await loginAs(...(MANAGER as [string, string]))
    renderAt('/leads')
    expect(await screen.findByText('Anvar')).toBeInTheDocument()
  })
})

function cleanupAndRender(path: string) { document.body.innerHTML = ''; renderAt(path) }


/* ================= Yangi mexanizmlar: onlayn to'lov, qurilma xabarnomasi, PDF, integratsiyalar ================= */
const API = (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')
const rnd = (n = 7) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0')
const adminApi = async () => { await loginAs(...(ADMIN as [string, string])) }
const logText = () => { try { return readFileSync('/tmp/uvicorn.log', 'utf8') } catch { return '' } }

async function makeStudent(first: string, amountInvoice?: string) {
  const branch = (await api.get<{ id: number }[]>('/branches/'))[0].id
  const st = await api.post<{ id: number }>('/students/', { branch_id: branch, first_name: first, last_name: 'Test', parent_phone: `+99890${rnd()}` })
  if (amountInvoice) await api.post('/invoices/', { student_id: st.id, period_month: new Date().toISOString().slice(0, 8) + '01', amount: amountInvoice })
  return st
}
const clickSign = (f: Record<string, string>, complete: boolean) =>
  createHash('md5').update(f.click_trans_id + f.service_id + 'click-secret' + f.merchant_trans_id + (complete ? f.merchant_prepare_id : '') + f.amount + f.action + f.sign_time).digest('hex')
async function clickCall(pid: number, action: 0 | 1, tid: string, amount: string, prepareId?: number) {
  const f: Record<string, string> = { click_trans_id: tid, service_id: '111', merchant_trans_id: String(pid), amount, action: String(action), sign_time: '2026-11-04 12:00:00', error: '0' }
  if (prepareId !== undefined) f.merchant_prepare_id = String(prepareId)
  f.sign_string = clickSign(f, action === 1)
  const r = await fetch(`${API}/webhooks/click`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(f) })
  return (await r.json()) as { error: number; merchant_prepare_id?: number }
}
async function paymeCall(method: string, params: Record<string, unknown>) {
  const r = await fetch(`${API}/webhooks/payme`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from('Paycom:payme-key').toString('base64') }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  return (await r.json()) as { result?: Record<string, unknown>; error?: { code: number } }
}

describe('integratsiyalar sahifasi', () => {
  beforeAll(adminApi)
  it('holat, webhook manzillari va maxfiy kalit ko‘rinmasligi', async () => {
    renderAt('/settings/integrations')
    expect((await screen.findAllByText('Sozlangan')).length).toBeGreaterThanOrEqual(3)
    expect((await screen.findAllByText(/localhost:8000\/webhooks\/click/)).length).toBe(2)   // Prepare va Complete
    expect(screen.getByText(/localhost:8000\/webhooks\/payme/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('click-secret')
    expect(document.body.textContent).not.toContain('payme-key')
  })
  it('test SMS va test email serverga yetadi', async () => {
    const ui = userEvent.setup()
    const phone = `+99891${rnd()}`
    renderAt('/settings/integrations')
    await ui.type(await screen.findByLabelText(/Test SMS: telefon/), phone)
    await ui.click(screen.getByRole('button', { name: /Test SMS yuborish/ }))
    await waitFor(async () => expect((await api.get<{ items: { recipient_phone: string; status: string }[] }>('/sms/logs', { limit: 20 })).items.some((x) => x.recipient_phone === phone && x.status === 'sent')).toBe(true))
    await ui.type(screen.getByLabelText(/Qabul qiluvchi/), 'tester@example.uz')
    await ui.click(screen.getByRole('button', { name: /Test xat yuborish/ }))
    await waitFor(() => expect(logText()).toContain('tester@example.uz'))
  })
  it('Click/Payme tranzaksiyalari jadvali', async () => {
    const ui = userEvent.setup()
    renderAt('/settings/integrations')
    await ui.click(await screen.findByRole('tab', { name: /Onlayn tranzaksiyalar/ }))
    expect(await screen.findByText(/Click \/ Payme tranzaksiyalari/)).toBeInTheDocument()
  })
})

describe('onlayn to‘lov havolasi (Click va Payme)', () => {
  beforeAll(adminApi)
  it('Click: UI havola yaratadi, webhook to‘lovni yopadi, balans yangilanadi', async () => {
    const st = await makeStudent(`Click${rnd(4)}`)
    const ui = userEvent.setup()
    renderAt(`/students/${st.id}`)
    await ui.click(await screen.findByRole('button', { name: /Onlayn to.lov havolasi/ }))
    const dlg = await screen.findByRole('dialog')
    await ui.type(within(dlg).getByLabelText(/Summa/), '25000')
    await ui.click(within(dlg).getByRole('button', { name: 'Havola yaratish' }))
    const url = (await within(dlg).findByDisplayValue(/my\.click\.uz\/services\/pay/)) as HTMLInputElement
    const q = new URL(url.value).searchParams
    const pid = Number(q.get('transaction_param'))
    expect(q.get('amount')).toBe('25000.00')
    expect((await api.get<{ status: string }>(`/payments/${pid}`)).status).toBe('pending')
    const prep = await clickCall(pid, 0, `T${rnd(6)}`.replace('T', '9'), '25000.0')
    expect(prep.error).toBe(0)
    // Click ishi: complete
    const tid = (await api.get<{ items: { provider_trans_id: string }[] }>('/payments/online/transactions', { payment_id: pid })).items[0].provider_trans_id
    expect((await clickCall(pid, 1, tid, '25000.0', prep.merchant_prepare_id)).error).toBe(0)
    expect((await api.get<{ status: string }>(`/payments/${pid}`)).status).toBe('completed')
    expect(Number((await api.get<{ balance: string }>(`/students/${st.id}`)).balance)).toBe(25000)
  })

  it('Payme: UI havola yaratadi, JSON-RPC oqimi to‘lovni yopadi', async () => {
    const st = await makeStudent(`Payme${rnd(4)}`, '40000')
    const ui = userEvent.setup()
    renderAt(`/students/${st.id}`)
    await ui.click(await screen.findByRole('button', { name: /Onlayn to.lov havolasi/ }))
    const dlg = await screen.findByRole('dialog')
    await ui.click(within(dlg).getByRole('radio', { name: 'Payme' }))
    await waitFor(() => expect(within(dlg).getByRole('option', { name: /qoldiq/ })).toBeInTheDocument())
    await ui.selectOptions(within(dlg).getByLabelText(/Qaysi hisobga/), within(dlg).getByRole('option', { name: /qoldiq/ }))
    expect((within(dlg).getByLabelText(/Summa/) as HTMLInputElement).value).toBe('40000')   // qoldiq avtomatik to'ldirildi
    await ui.click(within(dlg).getByRole('button', { name: 'Havola yaratish' }))
    const url = (await within(dlg).findByDisplayValue(/checkout\.paycom\.uz/)) as HTMLInputElement
    const decoded = Buffer.from(url.value.split('/').pop()!, 'base64').toString()
    const pid = Number(/ac\.order_id=(\d+)/.exec(decoded)![1])
    expect(decoded).toContain('a=4000000')
    const t = String(Date.now())
    expect((await paymeCall('CheckPerformTransaction', { amount: 4000000, account: { order_id: pid } })).result).toEqual({ allow: true })
    expect((await paymeCall('CreateTransaction', { id: `fe-${t}`, time: Date.now(), amount: 4000000, account: { order_id: pid } })).result?.state).toBe(1)
    expect((await paymeCall('PerformTransaction', { id: `fe-${t}` })).result?.state).toBe(2)
    expect((await api.get<{ status: string }>(`/payments/${pid}`)).status).toBe('completed')
    expect(Number((await api.get<{ balance: string }>(`/students/${st.id}`)).balance)).toBe(0)       // hisob (40 000) yopildi
    // ro'yxatda "Kutilmoqda" bekor qilish tugmasi ishlaydi
    cleanup()
    const st2 = await makeStudent(`Cancel${rnd(4)}`)
    const co = await api.post<{ payment_id: number }>('/payments/online/checkout', { student_id: st2.id, amount: '1000', provider: 'click' })
    renderAt(`/students/${st2.id}`)
    await ui.click(await screen.findByRole('tab', { name: /To.lovlar/ }))
    await ui.click(await screen.findByRole('button', { name: /Havolani bekor qilish/ }))
    await waitFor(async () => expect((await api.get<{ status: string }>(`/payments/${co.payment_id}`)).status).toBe('failed'))
  })
})

describe('yangi qurilmadan kirish xabarnomasi', () => {
  it('email qo‘shish → ikkinchi qurilma → email serverda yuborildi → bildirishnoma → qurilmani olib tashlash', async () => {
    const ui = userEvent.setup()
    // yangi xodim (emailsiz)
    await adminApi()
    const phone = `+99890${rnd()}`, mail = `new${rnd(5)}@example.uz`
    const branch = (await api.get<{ id: number }[]>('/branches/'))[0].id
    const roles = await api.get<{ id: number; code: string }[]>('/roles/')
    const emp = await api.post<{ id: number }>('/employees/', { branch_id: branch, first_name: 'Qurilma', last_name: 'Sinovchi', phone, password: 'Passw0rd!!', position: 'Menejer', hired_at: '2024-01-01' })
    await api.post('/employee-roles/', { employee_id: emp.id, role_id: roles.find((r) => r.code === 'manager')!.id, branch_id: branch })

    // 1-qurilma (D1): birinchi kirish xabarnoma yubormaydi
    const D1 = localStorage.getItem('em-device')!
    await loginAs(phone, 'Passw0rd!!')
    renderAt('/profile')
    expect(await screen.findAllByText(/Email kiritilmagan/)).not.toHaveLength(0)                // eslatma chizig'i va nishon
    expect(await screen.findByText('Shu qurilma')).toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: /Email qo.shish/ }))
    const dlg = await screen.findByRole('dialog')
    await ui.type(within(dlg).getByLabelText(/^Email/), mail)
    await ui.type(within(dlg).getByLabelText(/^Joriy parol/), 'Passw0rd!!')
    await ui.click(within(dlg).getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(screen.queryByText(/Email kiritilmagan/)).not.toBeInTheDocument())
    expect((await api.get<{ email: string }>('/auth/me')).email).toBe(mail)

    // 2-qurilma (D2): boshqa brauzer — yangi qurilma
    localStorage.setItem('em-device', 'other-browser-' + rnd(12))
    await loginRequest(phone, 'Passw0rd!!')
    await waitFor(() => { const t = logText(); expect(t).toContain(mail); expect(t.toLowerCase()).toContain('yangi qurilmadan kirildi') })
    expect(logText()).toContain('Agar bu siz bo\'lmasangiz')

    // D1 ga qaytamiz: bildirishnoma qo'ng'iroqda
    localStorage.setItem('em-device', D1)
    await loginAs(phone, 'Passw0rd!!')
    cleanup()
    renderAt('/')
    await ui.click(await screen.findByRole('button', { name: /Bildirishnomalar/ }))
    expect(await screen.findByText('Yangi qurilmadan kirildi')).toBeInTheDocument()

    // qurilmalar ro'yxati
    cleanup()
    renderAt('/profile')
    const remove = await screen.findByRole('button', { name: 'Olib tashlash' })
    expect(screen.getByText('Shu qurilma')).toBeInTheDocument()
    await ui.click(remove)
    await waitFor(async () => expect((await api.get<unknown[]>('/auth/devices')).length).toBe(1))
  })
})

describe('sertifikat PDF', () => {
  beforeAll(adminApi)
  it('PDF tugmasi haqiqiy PDF faylni yuklab oladi', async () => {
    const branch = (await api.get<{ id: number }[]>('/branches/'))[0].id
    const course = await api.post<{ id: number }>('/courses/', { name: `PDF kurs ${rnd(4)}`, duration_months: 3, lessons_count: 30, price: '300000' })
    const grp = await api.post<{ id: number }>('/groups/', { branch_id: branch, course_id: course.id, name: `PDF guruh ${rnd(4)}`, max_students: 5, status: 'completed' })
    const st = await makeStudent('Sertifikat')
    const cert = await api.post<{ id: number; serial_number: string }>('/certificates/', { student_id: st.id, group_id: grp.id, force: true })
    const created = vi.fn(() => 'blob:mock')
    URL.createObjectURL = created as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const ui = userEvent.setup()
    renderAt('/certificates')
    expect(await screen.findByText(cert.serial_number)).toBeInTheDocument()
    await ui.click((await screen.findAllByRole('button', { name: /PDF yuklab olish/ }))[0])
    await waitFor(() => expect(created).toHaveBeenCalled())
    const blob = (created.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('application/pdf')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(5000)
  })
})
