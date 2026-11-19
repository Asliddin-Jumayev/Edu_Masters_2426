"""Starlette-Admin — Kuchli admin panel integratsiyasi.

SQLAlchemy modellarini avtomatik ko'rish, qidirish, filtrlash va tahrirlash uchun
zamonaviy admin paneli (Django admin paneliga o'xshash).

O'rnatish:
    pip install starlette-admin

Ishlatish:
    main.py da:
    from app.admin.admin_setup import setup_admin
    setup_admin(app, engine)
"""
import logging
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

log = logging.getLogger("admin")


def setup_admin(app: FastAPI, engine) -> None:
    """Starlette-Admin panelini FastAPI ilovasiga ulaydi."""
    try:
        from starlette_admin.contrib.sqla import Admin, ModelView
        from starlette_admin.views import CustomView

        from app.models.branches import Branch
        from app.models.courses import Course
        from app.models.employees import Employee
        from app.models.finance import Payment, Invoice
        from app.models.groups import Group
        from app.models.students import Student

        admin = Admin(
            engine,
            title="Edu Masters Admin Panel",
            base_url="/admin",
            index_view=CustomView(label="Boshqaruv", icon="fa fa-home", name="home"),
        )

        # Modellarni admin panelga qo'shamiz
        admin.add_view(ModelView(Student, label="O'quvchilar", icon="fa fa-graduation-cap"))
        admin.add_view(ModelView(Employee, label="Xodimlar", icon="fa fa-users"))
        admin.add_view(ModelView(Course, label="Kurslar", icon="fa fa-book"))
        admin.add_view(ModelView(Group, label="Guruhlar", icon="fa fa-users-rectangle"))
        admin.add_view(ModelView(Branch, label="Filiallar", icon="fa fa-building"))
        admin.add_view(ModelView(Payment, label="To'lovlar", icon="fa fa-money-bill"))
        admin.add_view(ModelView(Invoice, label="Hisoblar", icon="fa fa-file-invoice-dollar"))

        # Admin panelni mount qilamiz
        admin.mount_to(app)
        log.info("Starlette-Admin muvaffaqiyatli /admin manziliga ulandi.")

    except ImportError:
        log.info("starlette-admin paketi o'rnatilmagan (`pip install starlette-admin`). Fallback admin sahifasi faollashtirildi.")

        @app.get("/admin", response_class=HTMLResponse, tags=["Admin Panel"], include_in_schema=False)
        async def admin_fallback():
            return """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Edu Masters Admin</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; padding: 40px; border-radius: 12px; border: 1px solid #334155; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                    h2 { margin-top: 0; color: #38bdf8; font-size: 24px; }
                    p { color: #94a3b8; line-height: 1.6; }
                    code { background: #0f172a; color: #f43f5e; padding: 4px 8px; border-radius: 4px; font-size: 14px; }
                    .btn { display: inline-block; background: #38bdf8; color: #0f172a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>⚙️ Starlette-Admin Paneli</h2>
                    <p>Ushbu admin panel <b>Starlette-Admin</b> moduli orqali ishlaydi. To'liq grafik panelni faollashtirish uchun terminalda quyidagini o'rnating:</p>
                    <p><code>pip install starlette-admin</code></p>
                    <p>O'rnatilgandan so'ng, ushbu sahifada avtomatik ravishda barcha modellar (O'quvchilar, Xodimlar, Kurslar, Guruhlar, Filiallar, To'lovlar) bo'yicha to'liq CRUD grafik boshqaruv paneli ochiladi.</p>
                    <a href="/docs" class="btn">Swagger Dokumentatsiyaga O'tish</a>
                </div>
            </body>
            </html>
            """
