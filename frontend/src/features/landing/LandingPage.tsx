import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Compass,
  GraduationCap,
  Laptop,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, formatError } from '@/api/client'
import type { Branch, Course } from '@/api/types'
import { Button, Modal } from '@/components/ui'
import { cn, fmtMoney } from '@/lib/utils'

function formatPhoneDisplay(digits: string): string {
  if (!digits) return ''
  let res = ''
  if (digits.length > 0) res += '(' + digits.slice(0, 2)
  if (digits.length >= 2) res += ') ' + digits.slice(2, 5)
  if (digits.length >= 5) res += '-' + digits.slice(5, 7)
  if (digits.length >= 7) res += '-' + digits.slice(7, 9)
  return res
}

interface DefaultCourse {
  id: number
  name: string
  description: string
  duration_months: number
  lessons_count: number
  price: string
  category: 'otm' | 'language' | 'it'
}

const BASE_COURSES: DefaultCourse[] = [
  {
    id: 1,
    name: 'Ingliz tili (IELTS 7.5+ & CEFR B2/C1)',
    description: 'Listening, Reading, Writing va Speaking ko‘nikmalarini chuqur rivojlantirish hamda xalqaro sertifikat kafolati.',
    duration_months: 6,
    lessons_count: 72,
    price: '650000',
    category: 'language',
  },
  {
    id: 2,
    name: 'Matematika (DTM va Milliy sertifikat)',
    description: 'Asosiy va majburiy blok fanlari, murakkab masalalar yechish metodikasi va Milliy sertifikat A+ darajasiga tayyorgarlik.',
    duration_months: 9,
    lessons_count: 108,
    price: '600000',
    category: 'otm',
  },
  {
    id: 3,
    name: 'Tarix (O‘zbekiston va Jahon tarixi)',
    description: 'Xronologik jadvallar, tarixiy manbalar, xaritalar va DTM bazasi testlari bo‘yicha 100% natijadorlik dasturi.',
    duration_months: 8,
    lessons_count: 96,
    price: '550000',
    category: 'otm',
  },
  {
    id: 4,
    name: 'Huquqshunoslik (Davlat va huquq asoslari)',
    description: 'TDYU (Yuridik) va nufuzli huquqshunoslik yo‘nalishlariga kirish uchun ixtisoslashtirilgan mukammal kurs.',
    duration_months: 8,
    lessons_count: 96,
    price: '600000',
    category: 'otm',
  },
  {
    id: 5,
    name: 'Fizika (DTM va Olimpiada tayyorgarligi)',
    description: 'Nazariy qonuniyatlar, formulalarni amaliyotda tushunish va murakkab hisoblash masalalarini oson yechish.',
    duration_months: 9,
    lessons_count: 108,
    price: '600000',
    category: 'otm',
  },
  {
    id: 6,
    name: 'Ona tili va adabiyot (Milliy sertifikat)',
    description: 'Grammatika, matn ustida ishlash, badiiy tahlil va insho yozish bo‘yicha maksimal ball to‘plash texnikalari.',
    duration_months: 7,
    lessons_count: 84,
    price: '550000',
    category: 'otm',
  },
  {
    id: 7,
    name: 'Kimyo va Biologiya (Tibbiyot yo‘nalishi)',
    description: 'Tibbiyot akademiyasi, Farmatsevtika va stomatologiya fakultetlari abituriyentlari uchun chuqurlashtirilgan dastur.',
    duration_months: 10,
    lessons_count: 120,
    price: '650000',
    category: 'otm',
  },
  {
    id: 8,
    name: 'Frontend Dasturlash (React & TypeScript)',
    description: 'Zamonaviy veb-ilovalar yaratish: HTML, CSS, Tailwind, JavaScript, React va TypeScript amaliy loyihalari.',
    duration_months: 6,
    lessons_count: 72,
    price: '850000',
    category: 'it',
  },
  {
    id: 9,
    name: 'Backend Dasturlash (Python & FastAPI)',
    description: 'Python asoslari, FastAPI framework, PostgreSQL ma’lumotlar bazasi, REST API va Docker bilan ishlash.',
    duration_months: 7,
    lessons_count: 84,
    price: '900000',
    category: 'it',
  },
  {
    id: 10,
    name: 'Kiberxavfsizlik va Tarmoq asoslari',
    description: 'Axborot xavfsizligi asoslari, tarmoq protokollari, zaifliklarni aniqlash (pentesting) va himoya choralari.',
    duration_months: 6,
    lessons_count: 72,
    price: '950000',
    category: 'it',
  },
]

export default function LandingPage() {
  const [backendCourses, setBackendCourses] = useState<Course[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeCategory, setActiveCategory] = useState<'all' | 'otm' | 'language' | 'it'>('all')

  // Lead modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined)
  const [formName, setFormName] = useState('')
  const [formPhoneDigits, setFormPhoneDigits] = useState('')
  const [formComment, setFormComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Hero quick form
  const [heroName, setHeroName] = useState('')
  const [heroPhoneDigits, setHeroPhoneDigits] = useState('')
  const [heroCourse, setHeroCourse] = useState<number | undefined>(undefined)
  const [heroSubmitting, setHeroSubmitting] = useState(false)

  useEffect(() => {
    api
      .get<Course[]>('/courses/public')
      .then((data) => {
        if (data && data.length > 0) setBackendCourses(data)
      })
      .catch(() => {})

    api
      .get<Branch[]>('/branches/public')
      .then((data) => {
        if (data && data.length > 0) setBranches(data)
      })
      .catch(() => {})
  }, [])

  // Doimo barcha 10 ta kurs ko'rinadi; backendda bori bo'lsa ID va narxi boyitiladi
  const displayCourses = useMemo(() => {
    return BASE_COURSES.map((base) => {
      const found = backendCourses.find(
        (bc) =>
          bc.name.toLowerCase().includes(base.name.toLowerCase().slice(0, 6)) ||
          base.name.toLowerCase().includes(bc.name.toLowerCase().slice(0, 6))
      )
      if (found) {
        return {
          ...base,
          id: found.id,
          price: found.price || base.price,
        }
      }
      return base
    })
  }, [backendCourses])

  const filteredCourses = useMemo(() => {
    if (activeCategory === 'all') return displayCourses
    return displayCourses.filter((c) => c.category === activeCategory)
  }, [displayCourses, activeCategory])

  function handlePhoneDigitsChange(val: string, setter: (s: string) => void) {
    const raw = val.replace(/\D/g, '')
    const digits = raw.startsWith('998') ? raw.slice(3) : raw
    setter(digits.slice(0, 9))
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault()
    }
  }

  async function handleLeadSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formName.trim() || formPhoneDigits.length < 9) {
      toast.error('Iltimos, ismingiz va 9 xonali telefon raqamingizni to‘liq kiriting')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post<{ msg: string }>('/leads/public', {
        first_name: formName.trim(),
        phone: `+998${formPhoneDigits}`,
        course_id: selectedCourse || undefined,
        comment: formComment.trim() || undefined,
      })
      toast.success(res?.msg || 'Arizangiz qabul qilindi! Tez orada bog‘lanamiz.')
      setModalOpen(false)
      setFormName('')
      setFormPhoneDigits('')
      setFormComment('')
      setSelectedCourse(undefined)
    } catch (err) {
      toast.error(formatError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleHeroSubmit(e: FormEvent) {
    e.preventDefault()
    if (!heroName.trim() || heroPhoneDigits.length < 9) {
      toast.error('Iltimos, ismingiz va 9 xonali telefon raqamingizni to‘liq kiriting')
      return
    }

    setHeroSubmitting(true)
    try {
      const res = await api.post<{ msg: string }>('/leads/public', {
        first_name: heroName.trim(),
        phone: `+998${heroPhoneDigits}`,
        course_id: heroCourse || undefined,
      })
      toast.success(res?.msg || 'Arizangiz qabul qilindi! Tez orada bog‘lanamiz.')
      setHeroName('')
      setHeroPhoneDigits('')
      setHeroCourse(undefined)
    } catch (err) {
      toast.error(formatError(err))
    } finally {
      setHeroSubmitting(false)
    }
  }

  const getCourseIcon = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('ingliz') || n.includes('ielts') || n.includes('cefr')) return <Compass className="size-5" />
    if (n.includes('kiber') || n.includes('xavfsizlik')) return <ShieldCheck className="size-5" />
    if (n.includes('front') || n.includes('back') || n.includes('python') || n.includes('dastur')) return <Code2 className="size-5" />
    if (n.includes('huquq') || n.includes('tarix')) return <Award className="size-5" />
    return <BookOpen className="size-5" />
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
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedCourse(undefined)
                setModalOpen(true)
              }}
            >
              Konsultatsiya olish
            </Button>
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
                <GraduationCap className="size-3.5" />
                OTM ga kirish imtihonlari va zamonaviy kasblar markazi
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl lg:text-6xl leading-[1.12]">
                OTM talabasi bo‘ling va <span className="marker">kelajak kasblarini</span> egallang
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-muted sm:text-xl">
                Ingliz tili (IELTS / CEFR), Matematika, Tarix, Huquq, Fizika bo‘yicha DTM va Milliy sertifikatga tayyorgarlik hamda eng talabgir IT dasturlash kurslari.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#courses"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-base font-semibold text-brand-fg transition hover:opacity-90"
                >
                  Kurslarni tanlash
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
                  <CheckCircle2 className="size-5 text-success shrink-0" />
                  <span className="text-sm font-medium">DTM & Milliy sertifikat</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-success shrink-0" />
                  <span className="text-sm font-medium">IELTS 7.5+ kafolatlangan tizim</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-5 text-success shrink-0" />
                  <span className="text-sm font-medium">Kuchli mentorlar nazorati</span>
                </div>
              </div>
            </div>

            {/* Hero Right Lead Form */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-line bg-gradient-to-br from-sunken/60 to-surface p-6 shadow-xl lg:p-8">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">Qabul 2026 davom etmoqda</h3>
                    <p className="text-xs text-muted">Yangi guruhlar uchun ro‘yxatdan o‘ting</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                    Ochiq
                  </span>
                </div>

                <form onSubmit={handleHeroSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted">Ismingiz *</label>
                    <input
                      type="text"
                      required
                      value={heroName}
                      onChange={(e) => setHeroName(e.target.value)}
                      placeholder="Masalan: Asliddin"
                      className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted">Telefon raqamingiz *</label>
                    <div className="mt-1 flex items-center rounded-md border border-line bg-surface focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
                      <span className="flex items-center gap-1 border-r border-line bg-sunken/60 px-2.5 py-2 text-xs font-semibold text-fg select-none rounded-l-md">
                        <span>🇺🇿</span>
                        <span>+998</span>
                      </span>
                      <input
                        type="tel"
                        required
                        placeholder="(90) 123-45-67"
                        value={formatPhoneDisplay(heroPhoneDigits)}
                        onChange={(e) => handlePhoneDigitsChange(e.target.value, setHeroPhoneDigits)}
                        onKeyDown={handlePhoneKeyDown}
                        className="h-10 w-full rounded-r-md bg-transparent px-3 text-sm text-fg placeholder:text-muted focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted">Qiziqqan yo‘nalishingiz</label>
                    <select
                      value={heroCourse ?? ''}
                      onChange={(e) => setHeroCourse(e.target.value ? Number(e.target.value) : undefined)}
                      className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
                    >
                      <option value="">— Fan yoki kursni tanlang —</option>
                      {displayCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button type="submit" variant="primary" loading={heroSubmitting} className="h-11 w-full text-sm font-semibold">
                    Ariza qoldirish
                  </Button>
                </form>
                <p className="mt-3 text-center text-xs text-muted">Menejerlarimiz 15 daqiqa ichida siz bilan bog‘lanishadi.</p>
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
              <span className="font-display text-4xl font-extrabold text-success">96%</span>
              <p className="mt-2 text-sm font-medium text-muted">OTM talabasi bo‘lish ko‘rsatkichi</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-brand">1,800+</span>
              <p className="mt-2 text-sm font-medium text-muted">Talabaga aylangan o‘quvchilar</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-brand">85+</span>
              <p className="mt-2 text-sm font-medium text-muted">IELTS 7.0+ & Milliy sertifikat</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 text-center">
              <span className="font-display text-4xl font-extrabold text-warn">4 ta</span>
              <p className="mt-2 text-sm font-medium text-muted">Zamonaviy filiallar</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Courses Section */}
      <section id="courses" className="border-b border-line py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3.5 py-1 text-xs font-semibold text-brand">
              <Sparkles className="size-3.5" />
              Mukammal ta’lim dasturlari
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
              Yo‘nalishlar va Kurslar
            </h2>
            <p className="mt-3 max-w-2xl mx-auto text-base text-muted sm:text-lg">
              OTM ga kirish uchun zarur bo‘lgan barcha asosiy fanlar va bozor talabiga mos amaliy IT kurslari.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[
              { id: 'all', label: 'Barcha kurslar' },
              { id: 'otm', label: '🏛️ OTM fanlari (DTM)' },
              { id: 'language', label: '🇬🇧 Chet tillari (IELTS / CEFR)' },
              { id: 'it', label: '💻 Zamonaviy IT yo‘nalishlari' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as any)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition',
                  activeCategory === cat.id
                    ? 'bg-brand text-brand-fg shadow-sm'
                    : 'bg-surface border border-line text-muted hover:text-fg hover:border-brand/40'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((c) => (
              <div
                key={c.id}
                className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 transition duration-200 hover:-translate-y-1 hover:border-brand hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      {getCourseIcon(c.name)}
                    </span>
                    <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
                      {c.duration_months} oy
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-xl font-bold text-fg group-hover:text-brand">{c.name}</h3>

                  <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-3">
                    {c.description || 'DTM standartlari va xalqaro tajriba asosida chuqurlashtirilgan o‘quv kursi.'}
                  </p>

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {c.lessons_count} ta dars
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="size-3.5" />
                      Haftalik testlar
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
              Biz faqat dars o‘tmaymiz — abituriyentning OTM ga kirish natijasi uchun to‘liq javobgarlikni his qilamiz.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
                <GraduationCap className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">DTM va Milliy standartlar</h3>
              <p className="mt-2 text-sm text-muted">
                Barcha mavzular Davlat Test Markazi talablari va Milliy sertifikat darajalari bo‘yicha chuqur tahlil qilinadi.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-success-soft text-success">
                <Users2 className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">Shaxsiy kurator va mentor</h3>
              <p className="mt-2 text-sm text-muted">
                Har bir o‘quvchining o‘zlashtirishi, davomati va haftalik test natijalari nazorat qilinib, ota-onaga hisobot beriladi.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-warn-soft text-warn">
                <Laptop className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">Zamonaviy IT laboratoriya</h3>
              <p className="mt-2 text-sm text-muted">
                Dasturlash va kiberxavfsizlik darslari kuchli kompyuterlar va amaliy laboratoriya tizimida o‘tkaziladi.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-mark/30 text-mark-fg">
                <Award className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-fg">Rasmiy bitiruv sertifikati</h3>
              <p className="mt-2 text-sm text-muted">
                Kursni tamomlagan o‘quvchilarga maxsus seriyali rasmiy bitiruv sertifikatlari topshiriladi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Branches / Filiallar Section */}
      <section id="branches" className="border-b border-line py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">Bizning Filiallar</h2>
            <p className="mt-2 text-sm text-muted">Qulay lokatsiya va zamonaviy dars xonalari bilan jihozlangan markazlarimiz.</p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(branches.length > 0
              ? branches
              : [
                  { id: 1, name: 'Asosiy filial', city: 'Toshkent', address: 'Toshkent shahri, markaziy filial', phone: '+998 71 200 00 00' },
                  { id: 2, name: 'Kasbi Edu Masters', city: 'Qashqadaryo', address: 'WQG3+RJC', phone: '+998 88 010 09 08' },
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

      {/* 7. Footer */}
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
              <a href="#branches" className="hover:text-fg">
                Filiallar
              </a>
              <Link to="/verify" className="text-muted/70 hover:text-fg">
                Sertifikat tekshirish
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 text-xs sm:flex-row">
            <p>© 2026 Edu Masters. Barcha huquqlar himoyalangan.</p>
            <p className="text-muted/80">Oliy ta’limga tayyorgarlik va boshqaruv tizimi.</p>
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
              className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">Telefon raqamingiz *</label>
            <div className="mt-1 flex items-center rounded-md border border-line bg-surface focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
              <span className="flex items-center gap-1 border-r border-line bg-sunken/60 px-2.5 py-2 text-xs font-semibold text-fg select-none rounded-l-md">
                <span>🇺🇿</span>
                <span>+998</span>
              </span>
              <input
                type="tel"
                required
                placeholder="(90) 123-45-67"
                value={formatPhoneDisplay(formPhoneDigits)}
                onChange={(e) => handlePhoneDigitsChange(e.target.value, setFormPhoneDigits)}
                onKeyDown={handlePhoneKeyDown}
                className="h-10 w-full rounded-r-md bg-transparent px-3 text-sm text-fg placeholder:text-muted focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted">Kurs (yo‘nalish)</label>
            <select
              value={selectedCourse ?? ''}
              onChange={(e) => setSelectedCourse(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none"
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
              className="mt-1 w-full rounded-md border border-line bg-surface p-3 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none"
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
