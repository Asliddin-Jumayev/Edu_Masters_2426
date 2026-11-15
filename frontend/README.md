# Edu Masters — Frontend

O'quv markaz ERP/CRM uchun veb-interfeys. **React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · React Router**.
Backend (FastAPI) bilan to'liq mos: API turlari backend OpenAPI sxemasidan generatsiya qilingan.

## Ishga tushirish
```bash
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```
**Backend `.env` da** `CORS_ORIGINS=http://localhost:5173` bo'lishi shart (vergul bilan bir nechta manzil mumkin).
Birinchi kirish: backendda `python -m app.seed` yaratgan admin telefoni va paroli.
To'ldirilgan holda ko'rish uchun backend papkasida: `python scripts/demo_data.py` (xodimlar paroli: `Demo12345`).

| Buyruq | Vazifasi |
|---|---|
| `npm run build` | Tur tekshiruvi + production build (`dist/`) |
| `npm run gen:api` | Ishlayotgan backenddan API turlarini yangilash (`src/api/schema.d.ts`) |
| `npm run check:endpoints` | Frontend chaqiradigan har bir yo'l va metod backend sxemasida borligini tekshiradi |
| `npm test` | Haqiqiy backendga ulangan integratsion testlar (jsdom, 43 ta). Backend 8000-portda + demo ma'lumotlar kerak (quyida) |

**Testlarni ishga tushirish** (backend papkasida, Click/Payme sozlangan holda — testlar webhooklarni o'zi simulyatsiya qiladi):
```bash
export CLICK_SERVICE_ID=111 CLICK_MERCHANT_ID=222 CLICK_SECRET_KEY=click-secret PAYME_MERCHANT_ID=mrch-1 PAYME_KEY=payme-key \
       SMS_CALLBACK_TOKEN=cbtoken PUBLIC_API_URL=http://localhost:8000 EMAIL_BACKEND=console CORS_ORIGINS=http://localhost:5173
uvicorn app.main:app --port 8000 &  python scripts/demo_data.py  &&  (cd ../frontend && npm test)
```
(email testi serverning logini `/tmp/uvicorn.log` dan o'qiydi: `uvicorn ... > /tmp/uvicorn.log 2>&1`.)

Backend o'zgarsa: `npm run gen:api` → `npm run build` (TypeScript mos kelmay qolgan joylarni darhol ko'rsatadi) → `npm run check:endpoints`.

## Sahifalar va rollar
| Bo'lim | Sahifalar | Kimga |
|---|---|---|
| Bosh sahifa | statistika, voronka, xarajat diagrammasi, qarzdorlar, bugungi darslar, vazifalar | hamma (teacher: o'z darslari) |
| O'quv jarayoni | O'quvchilar (+kartochka: guruh, hisob, to'lov, balans tarixi, chegirma, davomat, fayl), Guruhlar (+jadval, darslar, imtihon natijalari), Darslar va davomat, Sertifikatlar | hamma; teacher faqat o'z guruhi |
| Qabul | Lidlar (Kanban, sudrab o'tkazish, faoliyat, sinov darsi, o'quvchiga aylantirish), Vazifalar | manager+ / hamma |
| Moliya | Hisoblar, To'lovlar, Qarzdorlar (+SMS eslatma), Xarajatlar, Maosh | manager, accountant (teacher: faqat o'z maoshi) |
| Aloqa | SMS jurnali va yuborish | manager, accountant |
| Sozlamalar | Filial, xona, kurs, xodim (rol biriktirish, ishdan bo'shatish, parol tiklash), rol, ma'lumotnomalar, **integratsiyalar** (Click/Payme/SMS/email holati, webhook manzillari, test yuborish, onlayn tranzaksiyalar — faqat admin), audit jurnali | manager / admin |
| Ochiq | `/verify/:serial` — sertifikatni tekshirish (kirish shart emas) | hamma |

Ruxsatlar backendnikiga aynan mos (`src/lib/permissions.ts`); frontend faqat menyuni yashiradi, haqiqiy himoya backendda.
Yuqoridagi filial almashtirgichi tanlangan filial bo'yicha ro'yxat va hisobotlarni filtrlaydi.

## Tuzilma
```
src/
  api/        client.ts (token yangilash, xato formatlash) · hooks.ts · types.ts · schema.d.ts (generatsiya)
  lib/        auth (zustand) · permissions · labels (O'zbekcha holat nomlari) · utils
  components/ ui.tsx (Button, Modal, DataTable...) · resource.tsx (universal CRUD) · dialogs.tsx · pickers.tsx · AppShell
  features/   har bir bo'lim uchun sahifalar
```
**Yangi oddiy CRUD sahifa** ~25 qator: `ResourcePage` ga `endpoint`, `columns`, `fields` bering (qarang: `features/settings/CoursesPage.tsx`).

## Onlayn to'lov, PDF, xavfsizlik xabarnomalari
- **Onlayn to'lov havolasi** (o'quvchi kartochkasi va To'lovlar sahifasi): Click yoki Payme tanlanadi, summa (yoki hisob qoldig'i) kiritiladi, havola nusxalanadi yoki ota-onaga SMS bilan yuboriladi.
  To'lov "Kutilmoqda" bo'lib turadi va Click/Payme webhooki kelgach avtomatik "Muvaffaqiyatli" bo'ladi (balans va hisob yangilanadi). Tashlab ketilgan havolani "Havolani bekor qilish" bilan yopish mumkin.
- **Sertifikat PDF**: Sertifikatlar sahifasida "PDF" tugmasi (A4, QR kod → `/verify/<seriya>`).
- **SMS**: xato bilan tugaganlar sababi bilan ko'rinadi va "Qayta yuborish" tugmasi bor.
- **Yangi qurilmadan kirish**: har so'rovda `X-Device-Id` (brauzerda bir marta yaratiladigan UUID, `localStorage` da `em-device`) yuboriladi.
  Profil sahifasida email (parol bilan tasdiqlanadi), "Test xat" va "Kirgan qurilmalarim" (har birini olib tashlash mumkin). Email kiritilmagan bo'lsa tepada eslatma chizig'i chiqadi.
  Xabarnoma qo'ng'iroq ikonkasida ham ko'rinadi (qizil qalqon belgisi bilan).
  Eslatma: brauzer ma'lumotlari tozalansa yoki boshqa brauzer ochilsa — u yangi qurilma hisoblanadi.

## Dizayn
Mavzu — "daftar va siyoh": yengil katakli qog'oz fon, siyoh-ko'k asosiy rang, faol menyu bandi marker surtmasi, qarz esa qizil ruchka rangida.
Qorong'i rejim — "doska". Sarlavhalar Fraunces, matn Onest (ikkalasi ham lotin-kengaytma/kirill bilan, `oʻ gʻ` uchun). Ranglar `src/index.css` dagi CSS o'zgaruvchilarida.
Klaviatura va ekran o'qigich uchun: modal oynalar `<dialog>`, fokus halqasi, `aria-*`, `prefers-reduced-motion` hurmat qilinadi.

## Eslatmalar
- **Brauzerda vizual tekshirilmagan.** Sinov muhitida brauzer yo'q edi: mantiq, ma'lumot oqimi va ruxsatlar jsdom orqali haqiqiy backendga ulab tekshirilgan, lekin ko'rinish (joylashuv, ranglar, mobil, qorong'i rejim) ni o'zingiz ko'zdan kechiring.
- Tokenlar `localStorage` da saqlanadi (oddiy va ishlaydi; XSS xavfi bor — kerak bo'lsa httpOnly cookie ga o'tkazish backend o'zgarishini talab qiladi). Access token 30 daqiqa, muddati tugasa refresh avtomatik.
- Pul summalari backenddan satr ("500000.00") keladi — aniqlik uchun; ko'rsatishda formatlanadi.
- Sana/vaqt: server vaqt tamg'alari (UTC) mahalliy vaqtga o'giriladi; foydalanuvchi kiritgan vaqtlar (dars, sinov, muddat) o'zgarishsiz ko'rsatiladi.
- Ro'yxatlar 200 tagacha tanlov (select) uchun yuklanadi; katta bazada o'quvchi/lid tanlash qidiruv orqali ishlaydi.
