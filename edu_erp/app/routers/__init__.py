from app.routers import (auth, branches, communication, courses, crm, employee_roles, employees, enrollments, exams,
                         files, finance, groups, lessons, audit_logs, online_payments, payroll, reports, roles, rooms,
                         students, system, teacher_profiles, webhooks, ws, streaming, ai, two_factor, telegram)

all_routers = [
    auth.router, branches.router, rooms.router, roles.router, employee_roles.router, employees.router,
    teacher_profiles.router, courses.router, groups.router, students.router, enrollments.router,
    lessons.router, lessons.attendance_router, exams.router, exams.cert_router,
    crm.sources_router, crm.statuses_router, crm.router, crm.tasks_router, crm.trials_router,
    finance.methods_router, finance.invoices_router, online_payments.router, finance.payments_router, finance.discounts_router,
    finance.categories_router, finance.expenses_router,
    payroll.rules_router, payroll.router,
    communication.templates_router, communication.sms_router, communication.notif_router,
    files.router, audit_logs.router, reports.router, webhooks.router, system.router,
    ws.router, streaming.router, ai.router, two_factor.router, telegram.router,
]
