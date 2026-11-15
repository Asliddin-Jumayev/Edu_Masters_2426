# O'quv markaz ERP/CRM — Backend (FastAPI + SQLAlchemy 2 async + MySQL)

36 jadval, ~160 endpoint. Swagger: `http://localhost:8000/docs`

## Ishga tushirish
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # qiymatlarni to'ldiring (SECRET_KEY uzun, tasodifiy bo'lsin)
alembic revision --autogenerate -m "erp schema"   # ⚠ avval pastdagi "Migratsiya" bo'limini o'qing
alembic upgrade head
python -m app.seed              # rollar, bosqichlar, to'lov usullari, birinchi admin
uvicorn app.main:app --reload
```
Demo ma'lumotlar (ishlayotgan backendga): `python scripts/demo_data.py`
Test (SQLite, MySQL kerak emas): `pip install -r requirements-dev.txt && pytest`

## Migratsiya (mavjud bazangiz bor bo'lsa)
Eski 8 jadvalda o'zgarishlar bor. Agar bazada kerakli ma'lumot YO'Q bo'lsa — eng oson yo'l: bazani o'chirib qayta yarating,
`alembic revision --autogenerate`, `upgrade head`, `python -m app.seed`.
Ma'lumotni saqlamoqchi bo'lsangiz, autogenerate qilingan faylni **qo'lda tahrirlang** (u ustun nomini o'zgartirishni
"drop + add" deb ko'radi va parollarni o'chirib yuboradi!):
```python
op.alter_column("employees", "password", new_column_name="password_hash", existing_type=sa.String(255), existing_nullable=False)
op.alter_column("employees", "photo_url", existing_type=sa.String(255), type_=sa.Text(), nullable=True)
op.alter_column("employees", "birth_date", existing_type=sa.Date(), nullable=True)
# employee_roles: PK (employee_id, role_id) -> surrogat id + UNIQUE(employee_id, role_id, branch_id)
# (MySQL da avval FK larni olib tashlash kerak bo'lishi mumkin; bo'sh jadval bo'lsa jadvalni qayta yaratish osonroq)
```
Enum ustunlari endi **qiymat** (`planned`) saqlaydi, nom (`PLANNED`) emas — `groups.status` da ma'lumot bo'lsa:
`UPDATE groups SET status = LOWER(status)` (ustun turini o'zgartirgach).

## ERD ga kiritilgan o'zgarishlar
| O'zgarish | Sabab |
|---|---|
| `employees.password` → `password_hash`; `photo_url`, `birth_date` nullable | hujjatga mos; rasmsiz xodim qo'shish mumkin bo'lsin |
| `employee_roles` ga surrogat `id`; `UNIQUE(employee_id, role_id, branch_id)` | bir rolni ikki filialda berish uchun |
| `students.lead_id` **olib tashlandi** (qoldi: `leads.student_id`) | aylana FK va ikki marta saqlash yo'q |
| `payments.status` (pending/completed/failed), `refunded_at` qo'shildi | Click/Payme ikki bosqichli; qaytarish sanasi |
| `UNIQUE(enrollment_id, period_month)` invoices da; `UNIQUE(method_id, transaction_id)` payments da | dublikat hisob / tranzaksiya bo'lmasin |
| `UNIQUE` lesson_sessions(group,date,start), attendances(session,student), exam_results(exam,student), certificates(student,group), payrolls(employee,month) | dublikatlar bazaning o'zida to'silgan |
| `CHECK` (summa > 0 va h.k.) | MySQL 8.0.16+ da ishlaydi |

## Pul modeli (muhim)
Haqiqat manbai — `student_balance_transactions` (faqat INSERT). `students.balance` — kesh, manfiy = qarz.
`invoices.paid_amount/status` har o'zgarishda ledgerdan **qayta hisoblanadi** (drift bo'lmaydi):
`invoice_id` ko'rsatilgan to'lov avval o'sha hisobga, qolgani eng eski hisobdan (FIFO). Balans o'zgarishida
o'quvchi qatori `SELECT … FOR UPDATE` bilan qulflanadi. Chegirma hisob yozilganda hisoblanadi va qotadi.

## Ruxsatlar
`admin` hamma narsaga. Rol filial doirasida beriladi (`employee_roles.branch_id`, NULL = hamma filial); ma'lumot
shu doiradan tashqarida ko'rinmaydi va o'zgarmaydi.
| Rol | Nimaga ruxsat |
|---|---|
| manager | xodim/rol (admin rolidan tashqari), xona, kurs, guruh, o'quvchi, yozilish, lid/CRM, dars, sertifikat, to'lov qabul qilish, hisob/chegirma/xarajat |
| accountant | hisob-faktura, to'lov (tasdiqlash/qaytarish), chegirma, xarajat, maosh qoidasi/hisoblash/to'lash, SMS |
| teacher | faqat o'z guruhi/o'quvchisi: dars holati, davomat, imtihon va natijalar, o'z profili va maoshi |

## Qaror qilingan taxminlar (xohlasangiz o'zgartiramiz)
- Student va guruh filiali bir xil bo'lishi shart. Guruhga yozilganda `trial → active`.
- Maosh: `per_lesson` — faqat `held` darslar; `hourly` — soatlar; `percent` — o'qituvchi guruhlarining shu oy uchun **to'langan** summasidan.
- Davomat belgilansa `planned` dars avtomatik `held` bo'ladi. Sertifikat: guruh/yozilish tugagan + yakuniy imtihondan o'tgan bo'lishi kerak (admin `force`).
- Barcha vaqtlar UTC (naive) saqlanadi. Summalar JSON da satr ("500000.00") — aniqlik uchun.
- `overdue` holatini soatlik fon vazifasi yangilaydi (`BACKGROUND_TASKS=false` bilan o'chiriladi).

## Tashqi integratsiyalar (.env.example da hamma o'zgaruvchi)
Admin panelda **Sozlamalar → Integratsiyalar** (`GET /system/integrations`) holat va kabinetga kiritiladigan manzillarni ko'rsatadi.

**Click** — kabinetda Prepare va Complete URL ikkalasiga ham `https://<API>/webhooks/click` kiriting. Imzo (`md5`) tekshiriladi, xato kodlari
Click hujjatiga mos (-1…-9). **Payme** — Endpoint URL: `https://<API>/webhooks/payme` (JSON-RPC 2.0, `Basic Paycom:<KEY>`): CheckPerform/Create/Perform/Cancel/
CheckTransaction/GetStatement, summa tiyinda, 12 soatlik timeout. Buyurtma raqami = `payments.id`.
To'lov havolasi: `POST /payments/online/checkout` (xodim yaratadi, ixtiyoriy SMS bilan ota-onaga yuboradi) → webhook to'lovni avtomatik yopadi
(balans + hisob). Kuzatuv: `GET /payments/online/transactions`.

**SMS** — `SMS_PROVIDER=eskiz`: token avtomatik olinadi/yangilanadi, xato bo'lsa log `failed` + sabab, `POST /sms/{id}/retry` bilan qayta yuboriladi.
Yetkazish holati: Eskiz'ga callback `https://<API>/webhooks/sms/eskiz?token=<SMS_CALLBACK_TOKEN>`.

**Sertifikat PDF** — `GET /certificates/{id}/pdf` (A4 albom, QR → `FRONTEND_URL/verify/<seriya>`). Shriftlar `app/assets/fonts` da (DejaVu).

**Yangi qurilmadan kirish** — frontend har loginda `X-Device-Id` yuboradi; qurilma ro'yxatga olinadi (xom ID emas, sha256 saqlanadi).
Yangi qurilmada: ichki xabarnoma + audit + (email bor bo'lsa) email (fon vazifasida — login sekinlashmaydi va SMTP xatosi loginni buzmaydi).
Birinchi qurilma (hisobdagi eng birinchi kirish) xabarnoma yubormaydi (`NEW_DEVICE_ALERT_ON_FIRST_LOGIN=true` bilan yoqiladi).
`GET /auth/devices`, `DELETE /auth/devices/{id}`, `PUT /auth/me/email` (parol bilan), `POST /auth/me/test-email`.

⚠ **Migratsiya:** yangi jadvallar `provider_transactions`, `login_devices` va `sms_logs` ga `provider_message_id`, `error` ustunlari qo'shildi → `alembic revision --autogenerate`.

## Hali qilinmagan (ataylab)
- Click/Payme/Eskiz **haqiqiy kabinetlarda sinalmagan** (sandboxda tashqi tarmoq yo'q): protokol hujjat bo'yicha yozilgan va soxta server bilan testlangan —
  ishga tushirishdan oldin Click/Payme **test kabinetida** to'liq sinab ko'ring (ayniqsa Eskiz callback maydon nomlari va Payme fiskal `detail`).
- Token bekor qilish (logout) ro'yxati; Telegram bot; Payme fiskal cheklar.
