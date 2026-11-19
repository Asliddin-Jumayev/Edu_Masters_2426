# Edu Masters — O'quv Markazi Boshqaruv Tizimi (ERP / CRM & Landing Page)

**Edu Masters** — zamonaviy o‘quv markazlari va akademiyalar uchun mo‘ljallangan to‘liq avtomatlashtirilgan veb-platforma. Loyiha o‘z ichiga **Najot Ta'lim uslubidagi jozibador Bosh sahifa (Landing Page)** va xodimlar uchun **yopiq, xavfsiz ERP/CRM boshqaruv tizimini** oladi.

---

## 🌟 Asosiy Xususiyatlar

### 1. 🌐 Zamonaviy Uslubidagi Bosh Sahifa (`/`)
* **Zamonaviy vizual interfeys:** Kurslar katalogi, mentorlar, markaz afzalliklari va qulay lokatsiyalar.
* **Onlayn Ariza (Lid) olish:** Saytga kirgan mijozlar ism va telefonlarini qoldirishi mumkin. Ariza to‘g‘ridan-to‘g‘ri ichki CRM tizimiga tushadi va menejerlarga biriktiriladi.
* **Sertifikat tekshirish:** Sayt orqali har qanday tashrif buyuruvchi sertifikat seriya raqamini kiritib yoki QR-kodni skanerlab, sertifikatning haqiqiyligini onlayn tasdiqlashi mumkin.

### 2. 🔐 Yopiq Xodimlar va Admin Portali 
* **Mustahkam xavfsizlik:** Saytda begona foydalanuvchilar o‘zicha xodim sifatida ro‘yxatdan o‘ta olmaydi (`Self-registration yo'q`).
* **Barcha xodimlarni Bosh Administrator yaratadi:** Admin tizim ichidan (`/settings/employees`) xodimlarni qo‘shadi va ularga tegishli rollarni (Menejer, O‘qituvchi, Buxgalter) biriktiradi.
* **Rolga asoslangan kirish huquqi (RBAC):**
  * **Super Admin:** Barcha filiallar, sozlamalar, xodimlar va integratsiyalar ustidan to‘liq nazorat.
  * **Menejer:** O‘z filiali bo‘yicha talabalar, guruhlar, lidlar va dars jadvallarini boshqarish.
  * **O‘qituvchi:** O‘ziga biriktirilgan guruhlar, darslar, davomat olish va imtihon natijalari.
  * **Buxgalter:** To‘lovlar, hisob-fakturalar, chegirmalar, xarajatlar va oylik maoshlar hisob-kitobi.

### 3. 💳 Moliya va To‘lov Integratsiyalari
* **Ledger mexanizmi:** Talabalar balansi va qarzdorligi xavfsiz, o‘zgarmas (audit qilinadigan) yozuvlar orqali yuritiladi.
* **Click & Payme Shop API:** To‘lov havolalari yaratish, MD5 va HMAC orqali webhook orqali avtomatik to‘lovni tasdiqlash.
* **Eskiz.uz SMS:** Qarz eslatmalari, yangi dars bildirishnomalari va davomat bo‘yicha ota-onalarga SMS xabarnomalar.

---

## 🚀 Ishga Tushirish (Docker orqali — Tavsiya etiladi)

Loyihada Docker va Docker Compose to‘liq sozlangan. Bitta buyruq bilan MySQL, Backend va Frontendni ko‘tarish mumkin:

```bash
docker-compose up --build -d
```

Ishga tushgach:
* **Asosiy sayt (Landing Page):** `http://localhost:3000/`
* **Xodimlar kabineti:** Boshqaruv paneliga kirish (faqat vakolatli xodimlar uchun)
* **Backend API (Swagger Docs):** `http://localhost:8000/`

Dastlabki administrator va ma'lumotlarni yuklash (seed):
```bash
docker exec -it edu_masters_backend python -m app.seed
```

---

## 🛠 Qo‘lda Ishga Tushirish (Manual Setup)

### 1. Backend (`edu_erp`)
```bash
cd edu_erp

# Virtual muhit yaratish
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Bog'liqliklarni o'rnatish
pip install -r requirements.txt

# .env faylini yaratish
cp .env.example .env

# Ma'lumotlar bazasi migratsiyasi
alembic upgrade head

# Dastlabki admin va rollarni yaratish
python -m app.seed

# Serverni ishga tushirish
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (`frontend`)
```bash
cd frontend

# Bog'liqliklarni o'rnatish
npm install

# Ishga tushirish (Vite Dev Server)
npm run dev
```

Brauzerda `http://localhost:5173/` ochiladi.

---

## 📂 Loyiha Tuzilishi

```text
├── edu_erp/                   # FastAPI Backend
│   ├── app/
│   │   ├── database/          # SQLAlchemy bazaga ulanish
│   │   ├── models/            # Ma'lumotlar modellari (MySQL)
│   │   ├── routers/           # API yo'llari (Auth, CRM, Finance, Exams...)
│   │   ├── schemes/           # Pydantic v2 validatsiya sxemalari
│   │   ├── services/          # Biznes mantiq (PDF generator, to'lovlar, email)
│   │   └── utils/             # Xavfsizlik, RBAC, limitlar, vaqt utilitalari
│   ├── alembic/               # Ma'lumotlar bazasi migratsiyalari
│   └── tests/                 # Avtotestlar (Pytest / SQLite)
│
├── frontend/                  # React + TypeScript + Tailwind Frontend
│   ├── src/
│   │   ├── api/               # API mijoz va React Query hooklari
│   │   ├── components/        # Umumiy UI komponentlar (AppShell, modal, button)
│   │   ├── features/
│   │   │   ├── landing/       # Najot Ta'lim uslubidagi Bosh sahifa
│   │   │   ├── auth/          # Kirish sahifasi
│   │   │   ├── dashboard/     # ERP asosiy boshqaruv paneli
│   │   │   ├── students/      # O'quvchilar va shaxsiy kartochkalar
│   │   │   ├── groups/        # Guruhlar va dars jadvallari
│   │   │   ├── finance/       # To'lovlar, hisoblar, qarzlar
│   │   │   └── settings/      # Xodimlar, rollar, filiallar
│   │   └── lib/               # Ruxsatlar, autentifikatsiya holati
│   └── scripts/               # Endpoint tekshiruv skriptlari
│
├── docker-compose.yml         # MySQL + Backend + Frontend orkestratsiyasi
└── README.md                  # Hujjatlashtirish
```

---

## 🔒 Xavfsizlik Qoidalari

1. `.env` faylidagi `SECRET_KEY` kamida 32 ta belgidan iborat tasodifiy qator bo‘lishi lozim.
2. Tashqi SMTP (Gmail) yoki SMS provayder parollari hech qachon kodga yozilmaydi, faqat `.env` da saqlanadi.
3. Barcha moliyaviy tranzaksiyalar va sertifikat berish amallari audit jurnaliga (`audit_logs`) to‘liq qayd etiladi.
