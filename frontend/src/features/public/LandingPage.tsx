import { useState, useEffect, useRef, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { 
  GraduationCap, 
  BookOpen, 
  Users, 
  Award, 
  CheckCircle2, 
  Phone, 
  MapPin, 
  ArrowRight, 
  Sparkles, 
  Languages, 
  Calculator, 
  Scale, 
  Atom, 
  Dna, 
  ShieldCheck, 
  LogIn, 
  Send,
  Star,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Monitor,
  Check,
  SlidersHorizontal,
  LayoutGrid,
  Target,
  LayoutDashboard
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

type ThemeMode = 'light' | 'dark' | 'system'

function applyLandingTheme(t: ThemeMode) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

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

// Najot Ta'lim uslubidagi 3D Harakatlanuvchi Marquee - O'zbek talabalari va ta'lim muhiti suratlari
const heroRow1 = ['/hero/uzbek-1.jpg', '/hero/uzbek-2.jpg', '/hero/uzbek-3.jpg', '/hero/uzbek-4.jpg', '/hero/uzbek-5.jpg']
const heroRow2 = ['/hero/uzbek-6.jpg', '/hero/uzbek-7.jpg', '/hero/uzbek-8.jpg', '/hero/uzbek-9.jpg', '/hero/uzbek-10.jpg']
const heroRow3 = ['/hero/uzbek-3.jpg', '/hero/uzbek-5.jpg', '/hero/uzbek-1.jpg', '/hero/uzbek-7.jpg', '/hero/uzbek-9.jpg']
const heroRow4 = ['/hero/uzbek-2.jpg', '/hero/uzbek-4.jpg', '/hero/uzbek-6.jpg', '/hero/uzbek-8.jpg', '/hero/uzbek-10.jpg']

export default function LandingPage() {
  const token = useAuth((s) => s.accessToken)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [course, setCourse] = useState('Matematika (Milliy sertifikat & DTM)')
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([])
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Tungi va kunduzgi rejim (Dark / Light mode)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return JSON.parse(localStorage.getItem('em-theme') ?? '"system"')
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    applyLandingTheme(theme)
    localStorage.setItem('em-theme', JSON.stringify(theme))
  }, [theme])

  const cycleTheme = () => {
    const next: Record<ThemeMode, ThemeMode> = {
      system: 'light',
      light: 'dark',
      dark: 'system'
    }
    setTheme(next[theme])
  }

  // Yuradigan slayder (carousel) boshqaruvi
  const sliderRef = useRef<HTMLDivElement>(null)
  const [sliderIndex, setSliderIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'slider' | 'grid'>('slider')

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const cardWidth = 330
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -cardWidth : cardWidth,
        behavior: 'smooth'
      })
    }
  }

  const handleSliderScroll = () => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current
      const maxScroll = scrollWidth - clientWidth
      if (maxScroll > 0) {
        const idx = Math.round((scrollLeft / maxScroll) * (courses.length - 1))
        setSliderIndex(Math.max(0, Math.min(courses.length - 1, idx)))
      }
    }
  }

  const handleSelectCourse = (title: string) => {
    setCourse(title)
    const el = document.getElementById('contact')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    api.get<{ id: number; name: string }[]>('/branches/public')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBranches(data)
          setSelectedBranch(data[0].id)
        }
      })
      .catch(() => {
        setBranches([
          { id: 1, name: 'iTeach academy' },
          { id: 2, name: 'iTeach academy - Qarshi' }
        ])
        setSelectedBranch(1)
      })
  }, [])

  function handlePhoneChange(val: string) {
    if (val.length < 5) {
      setPhone('+998 ')
      return
    }
    setPhone(formatUzPhone(val))
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) ||
      e.ctrlKey || e.metaKey
    ) {
      return
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  async function handleApply(e: FormEvent) {
    e.preventDefault()
    const pureDigits = phone.replace(/\D/g, '').replace(/^998/, '')
    if (!name.trim() || pureDigits.length < 9) return
    setSending(true)
    const normalizedPhone = '+998' + pureDigits
    try {
      await api.post('/leads/public', {
        branch_id: selectedBranch,
        first_name: name.trim(),
        phone: normalizedPhone,
        course_name: course,
        note: `Sayt orqali ariza (OTM kursi): ${course}`
      })
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  // OTM ga kirish fanlari va kurslari (Ortiqcha ma'lumotlar olib tashlangan, aniq va lo'nda)
  const courses = [
    {
      id: 'ielts',
      title: 'Ingliz tili (IELTS & CEFR)',
      lessons: 'Haftada 3 kun + Mock imtihonlar',
      icon: Languages,
      color: 'from-sky-500 to-blue-600',
      badge: 'Maksimal DTM balli'
    },
    {
      id: 'math',
      title: 'Matematika (Milliy sertifikat & DTM)',
      lessons: 'Haftada 3 kun, 2 soatdan',
      icon: Calculator,
      color: 'from-indigo-600 to-blue-600',
      badge: 'Eng talabgir'
    },
    {
      id: 'physics',
      title: 'Fizika (Nazariya va Masalalar)',
      lessons: 'Haftada 3 kun, 2 soatdan',
      icon: Atom,
      color: 'from-violet-600 to-indigo-600',
      badge: 'Muhandislik bloki'
    },
    {
      id: 'native',
      title: 'Ona tili va Adabiyot',
      lessons: 'Haftada 3 kun, 2 soatdan',
      icon: BookOpen,
      color: 'from-amber-500 to-orange-500',
      badge: 'Milliy sertifikat'
    },
    {
      id: 'history',
      title: 'Tarix va Huquq',
      lessons: 'Haftada 3 kun, 2 soatdan',
      icon: Scale,
      color: 'from-purple-600 to-indigo-600',
      badge: 'Yurisprudensiya'
    },
    {
      id: 'bio-chem',
      title: 'Biologiya va Kimyo (Tibbiyot)',
      lessons: 'Haftada 4 kun, 2 soatdan',
      icon: Dna,
      color: 'from-emerald-600 to-teal-600',
      badge: 'Tibbiyot yo‘nalishi'
    },
    {
      id: 'mandatory',
      title: 'Majburiy Fanlar Bloki (3 ta fan)',
      lessons: 'Haftada 3 kun, 2 soatdan',
      icon: Target,
      color: 'from-cyan-600 to-blue-600',
      badge: 'Majburiy 30 ball'
    }
  ]

  const stats = [
    { num: '96%', label: 'OTM Talabasi bo‘lganlar' },
    { num: '150+', label: 'Davlat granti sohiblari' },
    { num: '120+', label: 'Milliy sertifikat (A, A+) egalari' },
    { num: '10+ yil', label: 'Tajribali oliy toifali ustozlar' },
  ]

  const benefits = [
    {
      title: 'DTM va Milliy sertifikat kafolati',
      desc: 'Har haftalik DTM standartidagi diagnostik Mock-testlar va xatolar ustida individual ishlash.',
      icon: CheckCircle2
    },
    {
      title: 'Oliy toifali repetitor ustozlar',
      desc: 'Ko‘p yillik tajribaga ega, o‘quvchilari har yili grant asosida talaba bo‘ladigan mutaxassislar.',
      icon: Users
    },
    {
      title: 'Ota-onalarga haftalik monitoring',
      desc: 'Ota-onalar farzandining davomati, test natijalari va o‘zlashtirishini muntazam bilib turadi.',
      icon: ShieldCheck
    },
    {
      title: 'Maxsus metodik qo‘llanmalar',
      desc: 'Barcha fanlar bo‘yicha tushunarli qoidalar, qisqa formulalar va test yechishning tezkor usullari.',
      icon: Award
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="size-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Edu Masters
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Abituriyent & OTM Tayyorlov Markazi
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#courses" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">OTM Fanlari</a>
            <a href="#benefits" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Afzalliklar</a>
            <a href="#stats" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Natijalar</a>
            <a href="#contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Qabulga yozilish</a>
          </nav>

          {/* O'ng tomon: Tungi/Kunduzgi rejim, Telefon va Kursga yozilish */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Tungi va kunduzgi rejim (Theme Toggle) */}
            <button
              type="button"
              onClick={cycleTheme}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title={
                theme === 'dark'
                  ? "Tungi rejim yoqilgan (Kunduzgiga o‘tish)"
                  : theme === 'light'
                  ? "Kunduzgi rejim yoqilgan (Tungiga o‘tish)"
                  : "Tizim rejimi (Mavzuni almashtirish)"
              }
              aria-label="Tungi va kunduzgi rejim"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="size-4 text-indigo-400 fill-indigo-400/20" />
                  <span className="hidden sm:inline text-xs font-semibold">Tungi</span>
                </>
              ) : theme === 'light' ? (
                <>
                  <Sun className="size-4 text-amber-500 fill-amber-500/20" />
                  <span className="hidden sm:inline text-xs font-semibold">Kunduzgi</span>
                </>
              ) : (
                <>
                  <Monitor className="size-4 text-slate-500" />
                  <span className="hidden sm:inline text-xs font-semibold">Avto</span>
                </>
              )}
            </button>

            <a 
              href="tel:+998712000000" 
              className="hidden lg:inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <Phone className="size-3.5 text-indigo-600" />
              <span>+998 (71) 200-00-00</span>
            </a>

            {/* Tizimga kirgan xodim uchun Boshqaruv paneli, oddiy mehmon uchun Kursga yozilish */}
            {token ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md shadow-indigo-600/25 transition-all active:scale-95"
              >
                <LayoutDashboard className="size-4" />
                <span>Boshqaruv paneli</span>
              </Link>
            ) : (
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md shadow-indigo-600/25 transition-all active:scale-95"
              >
                <span>Kursga yozilish</span>
                <ArrowRight className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section (Najot Ta'lim uslubidagi 3D Aylanuvchi Jonli Rasmlar Devori) */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-28 overflow-hidden min-h-[580px] sm:min-h-[660px] flex items-center justify-center bg-slate-950">
        
        {/* 3D Aylanuvchi/Oqib turuvchi Rasmlar Fon Marquee */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute -inset-x-40 -inset-y-56 flex flex-col justify-center gap-4 sm:gap-6 -rotate-6 sm:-rotate-12 scale-110 sm:scale-125 opacity-85 dark:opacity-80 transition-opacity">
            
            {/* 1-Qator: Chapga to'xtovsiz harakat (25s) */}
            <div className="animate-marquee-left flex items-center gap-4 sm:gap-6">
              {[...heroRow1, ...heroRow1, ...heroRow1, ...heroRow1].map((src, i) => (
                <div key={i} className="w-64 sm:w-80 h-36 sm:h-48 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 ring-1 ring-white/10">
                  <img src={src} alt="Edu Masters dars jarayoni" className="w-full h-full object-cover filter brightness-100 contrast-105" loading="eager" />
                </div>
              ))}
            </div>

            {/* 2-Qator: O'ngga to'xtovsiz harakat (22s) */}
            <div className="animate-marquee-right flex items-center gap-4 sm:gap-6">
              {[...heroRow2, ...heroRow2, ...heroRow2, ...heroRow2].map((src, i) => (
                <div key={i} className="w-64 sm:w-80 h-36 sm:h-48 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 ring-1 ring-white/10">
                  <img src={src} alt="Edu Masters ta'lim" className="w-full h-full object-cover filter brightness-100 contrast-105" loading="eager" />
                </div>
              ))}
            </div>

            {/* 3-Qator: Chapga mayin harakat (32s) */}
            <div className="animate-marquee-left-slow flex items-center gap-4 sm:gap-6">
              {[...heroRow3, ...heroRow3, ...heroRow3, ...heroRow3].map((src, i) => (
                <div key={i} className="w-64 sm:w-80 h-36 sm:h-48 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 ring-1 ring-white/10">
                  <img src={src} alt="Edu Masters talabalari" className="w-full h-full object-cover filter brightness-100 contrast-105" loading="eager" />
                </div>
              ))}
            </div>

            {/* 4-Qator: O'ngga mayin harakat (28s) */}
            <div className="animate-marquee-right-slow flex items-center gap-4 sm:gap-6">
              {[...heroRow4, ...heroRow4, ...heroRow4, ...heroRow4].map((src, i) => (
                <div key={i} className="w-64 sm:w-80 h-36 sm:h-48 shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-900 ring-1 ring-white/10">
                  <img src={src} alt="Edu Masters yutuqlari" className="w-full h-full object-cover filter brightness-100 contrast-105" loading="eager" />
                </div>
              ))}
            </div>

          </div>

          {/* Gradiyent va Vinetka qatlami: Rasmlar 100% aniq va jonli harakatlanadi */}
          <div className="absolute inset-0 bg-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/40 to-slate-950/80" />
          
          {/* Matn orqasida markaziy qoramtir halo - matn 100% tiniq o'qilishi uchun */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-4xl h-[420px] bg-slate-950/60 blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[250px] bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none" />
        </div>

        {/* Hero kontenti */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-indigo-400/40 text-indigo-300 text-xs sm:text-sm font-semibold mb-5 shadow-xl shadow-indigo-950/50">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span>2026-yilgi OTM qabuliga intensiv guruhlar ochildi!</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
            OTM Talabasi Bo‘lish —{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-blue-400">
              Edu Masters
            </span>{' '}
            bilan Aniq Va Kafolatli!
          </h1>

          <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-slate-200 max-w-2xl mx-auto font-normal leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            DTM imtihonlari, Milliy sertifikat (A, A+) hamda IELTS & CEFR sertifikatlari bo‘yicha tajribali repetitor ustozlardan chuqurlashtirilgan darslar.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="#contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-sm sm:text-base shadow-xl shadow-indigo-600/40 transition-all active:scale-98"
            >
              <span>Bepul sinov darsiga yozilish</span>
              <ArrowRight className="size-4" />
            </a>

            <a
              href="#courses"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-200 hover:bg-slate-800 font-semibold text-sm sm:text-base shadow-lg transition-all"
            >
              <BookOpen className="size-4 text-indigo-400" />
              <span>OTM Fanlarini ko‘rish</span>
            </a>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-300 font-medium drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-1 text-amber-400 font-semibold">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="text-white ml-1">4.9 / 5.0</span>
            </div>
            <span>•</span>
            <span>96% OTMga kirish natijasi</span>
            <span>•</span>
            <span>Davlat granti kafolati</span>
          </div>
        </div>
      </section>

      {/* 3. Statistika */}
      <section id="stats" className="py-8 sm:py-10 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {stats.map((s, idx) => (
              <div key={idx} className="p-3">
                <div className="text-2xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                  {s.num}
                </div>
                <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. OTM Fanlari va Kurslar (Yuradigan Karusel & Nafis Zamonaviy Dizayn) */}
      <section id="courses" className="py-12 sm:py-20 relative overflow-hidden">
        {/* Orqa fon nur effekti */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Sarlavha va Karusel / Jadval boshqaruv tugmalari */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-3">
                <BookOpen className="size-3.5" />
                <span>Abituriyentlar uchun OTM dasturlari</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                OTM Kirish Imtihoni Fanlari
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-xl">
                Har bir fan chuqurlashtirilgan nazariya, formulalar va DTM test bazasi asosida o‘qitiladi. Kurs ustiga bosib guruhga yoziling.
              </p>
            </div>

            {/* Boshqaruv tugmalari: Oldinga/Orqaga & Ko'rinish rejimi */}
            <div className="flex items-center gap-2.5 self-start md:self-end">
              {/* Rejim: Yuradigan karusel yoki Barcha fanlar jadvali */}
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('slider')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                    viewMode === 'slider'
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                  title="Slayder (yuradigan) ko‘rinish"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Yuradigan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                    viewMode === 'grid'
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                  title="Barcha fanlar birgalikda"
                >
                  <LayoutGrid className="size-3.5" />
                  <span>Katakcha</span>
                </button>
              </div>

              {/* Slayder nav tugmalari (faqat slider rejimida) */}
              {viewMode === 'slider' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollSlider('left')}
                    className="size-9 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-90"
                    aria-label="Oldingi fan"
                    title="Oldingi fan"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollSlider('right')}
                    className="size-9 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center shadow-xs cursor-pointer active:scale-90"
                    aria-label="Keyingi fan"
                    title="Keyingi fan"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kurslar ro'yxati: Yuradigan slayder yoki Katakcha */}
          <div
            ref={sliderRef}
            onScroll={handleSliderScroll}
            className={cn(
              viewMode === 'slider'
                ? "flex items-stretch gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth py-4 px-1"
                : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4"
            )}
          >
            {courses.map((c, idx) => {
              const IconComp = c.icon
              const isSelected = course === c.title
              return (
                <div
                  key={c.id || idx}
                  onClick={() => handleSelectCourse(c.title)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-300 cursor-pointer overflow-hidden",
                    "border backdrop-blur-sm select-none",
                    viewMode === 'slider' && "w-[280px] sm:w-[320px] shrink-0 snap-start",
                    isSelected
                      ? "border-indigo-500 dark:border-indigo-400 bg-gradient-to-b from-indigo-500/5 via-white to-white dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900 shadow-xl shadow-indigo-500/15 ring-2 ring-indigo-500/30"
                      : "border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-400/80 dark:hover:border-indigo-500/60 active:scale-[0.98]"
                  )}
                >
                  {/* Orqa fon nuri */}
                  <div
                    className={cn(
                      "absolute -top-14 -right-14 size-36 rounded-full blur-2xl opacity-15 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-tr",
                      c.color
                    )}
                  />

                  <div>
                    {/* Yuqori qism: Dumaloq nishon va Ikonka */}
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={cn(
                          "size-13 rounded-2xl bg-gradient-to-tr flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300",
                          c.color
                        )}
                      >
                        <IconComp className="size-6 stroke-[2.2]" />
                      </div>
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                        {c.badge}
                      </span>
                    </div>

                    {/* Sarlavha */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                      {c.title}
                    </h3>
                  </div>

                  {/* Pastki qism: Dars tartibi va Guruhga yozilish */}
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Users className="size-3.5 text-indigo-500" />
                        Dars tartibi:
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.lessons}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectCourse(c.title)
                      }}
                      className={cn(
                        "mt-1 w-full py-2.5 rounded-2xl text-xs font-semibold text-center transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95",
                        isSelected
                          ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-blue-600 hover:text-white text-slate-800 dark:text-slate-200"
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Check className="size-3.5 stroke-[2.5]" />
                          <span>Tanlangan ✓</span>
                        </>
                      ) : (
                        <>
                          <span>Guruhga yozilish</span>
                          <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Slayder indikator nuqtalari (faqat slider rejimida) */}
          {viewMode === 'slider' && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {courses.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (sliderRef.current) {
                      const cardWidth = 330
                      sliderRef.current.scrollTo({ left: i * cardWidth, behavior: 'smooth' })
                    }
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300 cursor-pointer",
                    sliderIndex === i
                      ? "w-8 bg-indigo-600 dark:bg-indigo-400"
                      : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                  )}
                  aria-label={`Slayd ${i + 1}`}
                />
              ))}
            </div>
          )}

        </div>
      </section>

      {/* 5. Nega Edu Masters? */}
      <section id="benefits" className="py-12 sm:py-18 bg-slate-100/70 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Nega Abituriyentlar Edu Mastersni Tanlaydi?
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
              Biz faqat mavzu o‘tmaymiz, o‘quvchining har bir xatosi ustida ishlaymiz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b, idx) => {
              const IconComp = b.icon
              return (
                <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                  <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                    <IconComp className="size-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{b.title}</h4>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{b.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 6. Ariza Qoldirish (Sleek, Responsive & Compact Card) */}
      <section id="contact" className="py-12 sm:py-16 relative overflow-hidden">
        <div className="max-w-lg mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl shadow-indigo-950/30 relative overflow-hidden">
            
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/20">
                🎁 Dastlabki sinov darsi bepul!
              </span>
              <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">
                Hoziroq Ro‘yxatdan O‘ting
              </h2>
              <p className="mt-1 text-slate-300 text-xs sm:text-sm">
                Ma‘lumotlaringizni qoldiring, ta‘lim maslahatchimiz siz bilan bog‘lanadi.
              </p>
            </div>

            {sent ? (
              <div className="mt-6 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <CheckCircle2 className="size-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-emerald-300">Arizangiz qabul qilindi!</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Menejerimiz tez orada siz bilan bog‘lanadi.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApply} className="mt-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Ism va Familiyangiz
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Azizbek Aliyev"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Telefon raqamingiz
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+998 (90) 123-45-67"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={handlePhoneKeyDown}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-mono"
                  />
                </div>

                {/* O'quv filiali */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    O‘quv filiali
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBranch ?? ''}
                      onChange={(e) => setSelectedBranch(Number(e.target.value))}
                      className="w-full h-10 px-3.5 pl-9 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all cursor-pointer appearance-none"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                          📍 {b.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-400">
                      <MapPin className="size-3.5" />
                    </div>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                      <ChevronRight className="size-3.5 rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Siz tanlagan fan */}
                <div>
                  <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1.5">
                    Siz tanlagan fan:
                  </label>

                  {/* Tanlangan fanning o'zi aniq ko'rinib turadi */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-indigo-950/90 border border-indigo-500/50 text-white shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                        <GraduationCap className="size-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {course}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      Tanlangan ✓
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full h-10 mt-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70"
                >
                  {sending ? (
                    <span>Yuborilmoqda...</span>
                  ) : (
                    <>
                      <span>Arizani yuborish</span>
                      <Send className="size-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <GraduationCap className="size-4" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">Edu Masters</span>
            <span className="text-xs text-slate-400">© 2026 Barcha huquqlar himoyalangan.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Phone className="size-3.5 text-indigo-500" /> +998 (71) 200-00-00</span>
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-indigo-500" /> Toshkent shahri, Asosiy filial</span>
            
            <Link 
              to="/afdmr2426" 
              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors underline underline-offset-2 ml-2"
              title="Xodimlar va o'qituvchilar kabineti"
            >
              Xodimlar kirishi
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
