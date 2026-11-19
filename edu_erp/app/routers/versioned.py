"""API Versioning — /api/v1/ prefiks orqali versiyalash.

Strategiya: "prefix versioning" — eng keng tarqalgan va sodda usul.
  - /api/v1/auth/login  (joriy)
  - /api/v2/auth/login  (kelajakda)

V1 routerlari mavjud routerlardan proxy sifatida ishlaydi —
hech qanday logikani qayta yozmaslik kerak.

Qo'shish:
    main.py da `app.include_router(v1_router)` qo'shing.
"""
from fastapi import APIRouter

from app.routers import (
    auth, branches, communication, courses, crm, employee_roles,
    employees, enrollments, exams, files, finance, groups, lessons,
    audit_logs, online_payments, payroll, reports, roles, rooms,
    students, system, teacher_profiles, webhooks, ai, two_factor, telegram,
)
from app.routers.ws import router as ws_router
from app.routers.streaming import router as streaming_router

# ─── V1 Router ───────────────────────────────────────────────────────────────
v1_router = APIRouter(prefix="/api/v1")

# Barcha mavjud routerlarni /api/v1/ ostiga qo'shamiz
_v1_routers = [
    auth.router,
    branches.router,
    rooms.router,
    roles.router,
    employee_roles.router,
    employees.router,
    teacher_profiles.router,
    courses.router,
    groups.router,
    students.router,
    enrollments.router,
    lessons.router,
    lessons.attendance_router,
    exams.router,
    exams.cert_router,
    crm.sources_router,
    crm.statuses_router,
    crm.router,
    crm.tasks_router,
    crm.trials_router,
    finance.methods_router,
    finance.invoices_router,
    online_payments.router,
    finance.payments_router,
    finance.discounts_router,
    finance.categories_router,
    finance.expenses_router,
    payroll.rules_router,
    payroll.router,
    communication.templates_router,
    communication.sms_router,
    communication.notif_router,
    files.router,
    audit_logs.router,
    reports.router,
    webhooks.router,
    system.router,
    # Yangi routerlar
    ws_router,
    streaming_router,
    ai.router,
    two_factor.router,
    telegram.router,
]

for r in _v1_routers:
    v1_router.include_router(r)
