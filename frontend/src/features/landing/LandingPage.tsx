import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Compass,
  GraduationCap,
  Laptop,
  LogIn,
  MapPin,
  MessageSquare,
  Palette,
  Phone,
  Search,
  Sparkles,
  Star,
  Users2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, formatError } from '@/api/client'
import type { Branch, Course } from '@/api/types'
import { Button, Input, Modal } from '@/components/ui'
import { fmtMoney } from '@/lib/utils'

const DEFAULT_COURSES = [
  {
    id: 1,
    name: 'Full-Stack Python (FastAPI & React)',
    description: 'Noldan professional darajagacha zamonaviy veb-ilovalar, API va ma’lumotlar bazalarini ishlab chiqish.',
    duration_months: 8,
    lessons_count: 96,
    price: '950000',
    category: 'it',
  },
  {
    id: 2,
    name: 'Frontend Dasturlash (React & TypeScript)',
    description: 'Zamonaviy interfeyslar, SPA ilovalar, Redux Toolkit, Tailwind va REST API bilan ishlash.',
    duration_months: 6,
    lessons_count: 72,
    price: '850000',
    category: 'it',
  },
  {
    id: 3,
    name: 'UI/UX & Raqamli Mahsulot Dizayni',
    description: 'Figma, foydalanuvchi tadqiqotlari (UX research), mobil va veb dizayn hamda prototiplash.',
    duration_months: 5,
    lessons_count: 60,
    price: '800000',
    category: 'design',
  },
  {
    id: 4,
    name: 'Grafik Dizayn va Brending',
    description: 'Photoshop, Illustrator, logotiplar yaratish, brendbuk va ijtimoiy tarmoqlar uchun vizual dizayn.',
    duration_months: 4,
    lessons_count: 48,
    price: '700000',
    category: 'design',
  },
  {
    id: 5,
    name: 'IELTS Intensive & Akademik Ingliz tili',
    description: 'IELTS imtihonidan 7.0+ ball olish uchun tajribali instruktorlar bilan intensiv tayyorgarlik.',
    duration_months: 3,
    lessons_count: 36,
    price: '650000',
    category: 'language',
  },
  {
    id: 6,
    name: 'IT Foundation & Algoritmlar',
    description: 'Kompyuter savodxonligi, mantiqiy fikrlash, algoritmlar va dasturlashga ilk mustahkam qadam.',
    duration_months: 2,
    lessons_count: 24,
    price: '500000',
    category: 'it',
  },
]

export default function LandingPage() {
  const nav = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<'all' | 'it' | 'design' | 'language'>('all')

  // Lead modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formComment, setFormComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Certificate search state
  const [certSerial, setCertSerial] = useState('')

  useEffect(() => {
    // Kurslarni yuklash
    api
      .get<Course[]>('/courses/public')
      .then((data) => {
        if (data && data.length > 0) setCourses(data)
      })
      .catch(() => {
        // Fallback agar backend offline bo'lsa
      })

    // Filiallarni yuklash
    api
      .get<Branch[]>('/branches/public')
      .then((data) => {
        if (data && data.length > 0) setBranches(data)
      })
      .catch(() => {})
  }, [])

  const displayCourses = courses.length > 0 ? courses : (DEFAULT_COURSES as unknown as Course[])

  async function handleLeadSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formPhone.trim()) {
      toast.error('Ism va telefon raqamingizni kiriting')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post<{ msg: string }>('/leads/public', {
        first_name: formName.trim(),
        phone: formPhone.trim(),
        course_id: selectedCourse || undefined,
        comment: formComment.trim() || undefined,
      })
      toast.success(res?.msg || 'Arizangiz qabul qilindi! Tez orada bog‘lanamiz.')
      setModalOpen(false)
      setFormName('')
      setFormPhone('')
      setFormComment('')
      setSelectedCourse(undefined)
    } catch (err) {
      toast.error(formatError(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleCertCheck(e: FormEvent) {
    e.preventDefault()
    if (!certSerial.trim()) {
      toast.error('Sertifikat seriya raqamini kiriting')
      return
    }
    nav(`/verify/${encodeURIComponent(certSerial.trim())}`)
  }

  return (
    <div className="min-h-screen bg-bg text-fg selection:bg-mark selection:text-mark-fg">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-mark">
              <span className="block h-3.5 w-[18px] border-y-[3px] border-mark-fg" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-fg">Edu Masters</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#courses" className="text-sm font-medium text-muted transition hover:text-fg">
              Kurslar
            </a>
            <a href="#why-us" className="text-sm font-medium text-muted transition hover:text-fg">
              Nega biz?
            </a>
            <a href="#results" className="text-sm font-medium text-muted transition hover:text-fg">
              Natijalar
            </a>
            <a href="#branches" className="text-sm font-medium text-muted transition hover:text-fg">
              Filiallar
            </a>
            <Link to="/verify" className="flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-brand">
              <Award className="size-4" />
              Sertifikat tekshirish
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedCourse(undefined)
                setModalOpen(true)
              }}
              className="hidden sm:inline-flex"
            >
              Konsultatsiya olish
            </Button>

            <Link
              to="/afdmr2426"
              title="Xodimlar portali (ERP)"
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand"
            >
              <LogIn className="size-3.5" />
              <span className="hidden sm:inline">Kirish</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden border-b border-line bg-surface py-16 sm:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid)_1px,transparent_1px)] bg-[size:28px_28px] opacity-70" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand">
                <Sparkles className="size-3.5" />
                Zamonaviy kasblar va texnologiyalar akademiyasi
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl lg:text-6xl">
                Kelajak kasblarini eng kuchli <span className="marker">mentorlar bilan</span> o‘rganing
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-muted sm:text-xl">
                Dasturlash, dizayn va xorijiy tillar yo‘nalishlarida noldan boshlab amaliy loyihalar asosida ta’lim oling.
                Bitiruvchilarni ishga joylashtirishga faol ko‘maklashamiz.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#courses"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-base font-semibold text-brand-fg transition hover:opacity-90"
                >
                  Kurslarni ko‘rish
                  <ChevronRight className="size-4" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourse(undefined)
                    setModalOpen(true)
                  }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-6 text-base font-semibold text-fg transition hover:bg-sunken"
                >
                  Bepul konsultatsiya
                </button>
              </div>

              {/* Highlights */}
              <div className="mt-10 grid grid-cols-2 gap-4 border-t border-line/80 pt-8 sm:grid-cols-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-success" />
                  <span className="text-sm font-medium">Amaliy real loyihalar</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-success" />
                  <span className="text-sm font-medium">Shaxsiy mentor ko‘magi</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-success" />
                  <span className="text-sm font-medium">QR-tekshiruvli sertifikat</span>
                </div>
              </div>
            </div>

            {/* Hero Right Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-line bg-gradient-to-br from-sunken/60 to-surface p-6 shadow-xl lg:p-8">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">Qabul davom etmoqda</h3>
                    <p className="text-xs text-muted">Yangi guruhlar uchun ro‘yxatdan o‘ting</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                    Faol
                  </span>
                </div>

                <form onSubmit={handleLeadSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted">Ismingiz</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Masalan: Sardor"
                      className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted">Telefon raqamingiz</label>
                    <input
                      type="tel"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted">Qiziqqan yo‘nalishingiz</label>
                    <select
                      value={selectedCourse ?? ''}
                      onChange={(e) => setSelectedCourse(e.target.value ? Number(e.target.value) : undefined)}
                      className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                    >
                      <option value="">— Kursni tanlang (ixtiyoriy) —</option>
                      {displayCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button type="submit" variant="primary" loading={submitting} className="h-11 w-full text-sm font-semibold">
                    Konsultatsiya uchun yuborish
                  </Button>
                </form>
                <p className="mt-3 text-center text-xs text-muted">Menejerlarimiz 15 daqiqa ichida aloqaga chiqishadi.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Stats Section */}
      <section id="results" className="border-b border-line bg-sunken/40 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-brand">2,500+</span>
              <p className="mt-2 text-sm font-medium text-muted">Muvaffaqiyatli bitiruvchilar</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-success">92%</span>
              <p className="mt-2 text-sm font-medium text-muted">Ishga joylashish ko‘rsatkichi</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-brand">20+</span>
              <p className="mt-2 text-sm font-medium text-muted">Soha mutaxassisi bo‘lgan mentorlar</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-warn">4 ta</span>
              <p className="mt-2 text-sm font-medium text-muted">Zamonaviy va qulay filiallar</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Courses Section */}
      <section id="courses" className="border-b border-line py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">Yo‘nalishlar va Kurslar</h2>
            <p className="mt-3 text-base text-muted sm:text-lg">
              Mehnat bozorida eng yuqori talabga ega kasblar bo‘yicha sifatli ta’lim oling.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {displayCourses.map((c) => (
              <div
                key={c.id}
                className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 transition duration-200 hover:-translate-y-1 hover:border-brand hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      {c.name.toLowerCase().includes('dizayn') ? (
                        <Palette className="size-5" />
                      ) : c.name.toLowerCase().includes('ielts') || c.name.toLowerCase().includes('ingliz') ? (
                        <Compass className="size-5" />
                      ) : (
                        <Code2 className="size-5" />
                      )}
                    </span>
                    <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
                      {c.duration_months} oy
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-xl font-bold text-fg group-hover:text-brand">{c.name}</h3>

                  <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-3">
                    {c.description || 'Zamonaviy metodika, amaliy mashg‘ulotlar va professional portfolio tayyorlash.'}
                  </p>

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {c.lessons_count} ta dars
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="size-3.5" />
                      Amaliy loyihalar
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-line/70 pt-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-muted">Oylik to‘lov:</span>
                      <p className="font-display text-lg font-bold text-fg">{fmtMoney(c.price)}</p>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedCourse(c.id)
                        setModalOpen(true)
                      }}
                    >
                      Yozilish
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Why Edu Masters? */}
      <section id="why-us" className="border-b border-line bg-sunken/40 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">Nega aynan Edu Masters?</h2>
            <p className="mt-3 text-base text-muted sm:text-lg">
              Biz faqat dars o‘tib berish bilan cheklanmaymiz — bitiruvchining real natijasiga javobgarmiz.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
                <Laptop className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">Amaliy loyihalar</h3>
              <p className="mt-2 text-sm text-muted">
                Faqat quruq nazariya emas, rezyumega qo‘yish uchun real buyurtmalar va jamoaviy startap loyihalar.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-success-soft text-success">
                <Users2 className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">Mentorlik ko‘magi</h3>
              <p className="mt-2 text-sm text-muted">
                Top kompaniyalarda ishlovchi mentorlar darsdan tashqari ham doimiy savollarga javob berib, kodingizni tekshiradi.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-warn-soft text-warn">
                <Briefcase className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">Karyera markazi</h3>
              <p className="mt-2 text-sm text-muted">
                Bitiruvchilarga rezyume yozish, mock intervyular o‘tkazish va IT kompaniyalarga tavsiya berish yo‘lga qo‘yilgan.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-mark/30 text-mark-fg">
                <Award className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">QR-kodli Sertifikat</h3>
              <p className="mt-2 text-sm text-muted">
                Kursni muvaffaqiyatli tamomlaganlarga onlayn tekshiriladigan rasmiy bitiruv sertifikati topshiriladi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Certificate Verification Banner */}
      <section className="border-b border-line bg-surface py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <Award className="size-3.5" />
            Rasmiy sertifikat tekshiruvi
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-fg sm:text-3xl">
            Sertifikat haqiqiyligini tekshiring
          </h2>
          <p className="mt-2 text-sm text-muted">
            Edu Masters bitiruvchilarining sertifikat seriya raqamini kiritib, uning qonuniyligi va o‘quvchi natijasini onlayn tekshiring.
          </p>

          <form onSubmit={handleCertCheck} className="mx-auto mt-6 flex max-w-md gap-2">
            <input
              type="text"
              value={certSerial}
              onChange={(e) => setCertSerial(e.target.value)}
              placeholder="Masalan: MAIN-2026-00001"
              className="h-10 flex-1 rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
            />
            <Button type="submit" variant="primary" className="h-10 px-5">
              <Search className="size-4" />
              Tekshirish
            </Button>
          </form>
        </div>
      </section>

      {/* 7. Branches / Filiallar Section */}
      <section id="branches" className="border-b border-line py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">Bizning Filiallar</h2>
            <p className="mt-2 text-sm text-muted">Qulay lokatsiya va zamonaviy dars xonalari bilan jihozlangan markazlarimiz.</p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(branches.length > 0
              ? branches
              : [
                  { id: 1, name: 'Bosh Filial (Chilonzor)', city: 'Toshkent', address: 'Chilonzor tumani, Bunyodkor shox ko‘chasi', phone: '+998 71 200 00 00' },
                  { id: 2, name: 'Yunusobod Filiali', city: 'Toshkent', address: 'Yunusobod tumani, Amir Temur ko‘chasi', phone: '+998 71 200 11 11' },
                ]
            ).map((b) => (
              <div key={b.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2 text-brand">
                  <MapPin className="size-4" />
                  <h3 className="font-semibold text-fg">{b.name}</h3>
                </div>
                <p className="mt-2 text-xs text-muted">{b.address}</p>
                <p className="mt-2 text-xs font-medium text-fg flex items-center gap-1.5">
                  <Phone className="size-3.5 text-muted" />
                  {b.phone}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="bg-surface py-12 text-sm text-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 border-b border-line/70 pb-8 md:flex-row">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-mark">
                <span className="block h-3 w-[15px] border-y-[2px] border-mark-fg" />
              </span>
              <span className="font-display text-lg font-bold text-fg">Edu Masters</span>
            </Link>

            <div className="flex flex-wrap justify-center gap-6 text-xs font-medium">
              <a href="#courses" className="hover:text-fg">
                Kurslar
              </a>
              <a href="#why-us" className="hover:text-fg">
                Afzalliklar
              </a>
              <a href="#results" className="hover:text-fg">
                Natijalar
              </a>
              <Link to="/verify" className="hover:text-fg">
                Sertifikat tekshirish
              </Link>
              <Link to="/afdmr2426" className="text-brand hover:underline">
                Xodimlar portali (ERP)
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 text-xs sm:flex-row">
            <p>© 2026 Edu Masters. Barcha huquqlar himoyalangan.</p>
            <p className="text-muted/80">Zamonaviy ta’lim va boshqaruv tizimi.</p>
          </div>
        </div>
      </footer>

      {/* Lead Application Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Kursga yozilish va Bepul konsultatsiya"
        description="Ma’lumotlaringizni qoldiring, mutaxassislarimiz barcha savollaringizga batafsil javob berishadi."
      >
        <form onSubmit={handleLeadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted">Ismingiz *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ism va familiyangiz"
              className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">Telefon raqamingiz *</label>
            <input
              type="tel"
              required
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">Kurs (yo‘nalish)</label>
            <select
              value={selectedCourse ?? ''}
              onChange={(e) => setSelectedCourse(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">— Kursni tanlang —</option>
              {displayCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">Savol yoki izohingiz (ixtiyoriy)</label>
            <textarea
              rows={2}
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="Qo‘shimcha savollaringiz bo‘lsa yozing..."
              className="mt-1 w-full rounded-md border border-line bg-surface p-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Arizani yuborish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
