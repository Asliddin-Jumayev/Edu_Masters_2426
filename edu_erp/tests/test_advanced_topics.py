"""Advanced Topics bo'yicha to'liq testlar to'plami.

Sinovdan o'tkaziladigan mavzular:
1. API Versioning (/api/v1/)
2. WebSocket (/ws/notifications, /ws/status)
3. Streaming & SSE (/stream/notifications/sse, /stream/export/csv-demo)
4. Sub-applications va Mounting (/internal/metrics, /internal/metrics/xml-export)
5. Custom Responses (PrettyJSONResponse, XMLResponse)
6. AI / LLM Integratsiyasi (/ai/analyze-lead, /ai/student-report, /ai/assistant)
7. Redis Caching & Fallback (cache get/set/decorator)
8. SOLID Repository va Service Layer (StudentRepository, StudentService)
9. Fon vazifalari (Celery / Background tasks fallback)
10. gRPC Service Handler & Client
"""
import pytest
from tests.conftest import ADMIN_PASS, ADMIN_PHONE


async def login(client, phone=ADMIN_PHONE, pw=ADMIN_PASS):
    r = await client.post("/auth/login", data={"username": phone, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ─── 1. API Versioning (/api/v1/) ─────────────────────────────────────────────
async def test_api_versioning(client):
    auth_header = await login(client)

    # V1 auth
    r = await client.post("/api/v1/auth/login", data={"username": ADMIN_PHONE, "password": ADMIN_PASS})
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert token

    # V1 branches
    r = await client.get("/api/v1/branches/", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── 2. Sub-applications & Mounting (/internal/metrics) ───────────────────────
async def test_subapp_mounting_and_custom_responses(client):
    # Sub-app root endpoint (PrettyJSONResponse)
    r = await client.get("/internal/metrics/")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    data = r.json()
    assert data["service"] == "edu_masters_metrics"
    assert data["status"] == "operational"

    # XMLResponse
    r_xml = await client.get("/internal/metrics/xml-export")
    assert r_xml.status_code == 200
    assert "application/xml" in r_xml.headers["content-type"]
    assert "<?xml" in r_xml.text
    assert "<status>success</status>" in r_xml.text

    # Starlette-Admin paneli (/admin)
    r_admin = await client.get("/admin")
    assert r_admin.status_code == 200
    assert "Admin" in r_admin.text


# ─── 3. Streaming & SSE ───────────────────────────────────────────────────────
async def test_streaming_and_sse(client):
    auth_header = await login(client)

    # StreamingResponse (CSV Export)
    r_csv = await client.get("/stream/export/csv-demo", headers=auth_header)
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]
    assert "attachment; filename=students.csv" in r_csv.headers.get("content-disposition", "")
    assert "id,first_name,balance" in r_csv.text
    assert "Talaba-1" in r_csv.text

    # SSE endpoint test (limit=1 parametri bilan 1 ta heartbeat dan so'ng yakunlanadi)
    r_sse = await client.get("/stream/notifications/sse?limit=1", headers=auth_header)
    assert r_sse.status_code == 200
    assert "text/event-stream" in r_sse.headers["content-type"]
    assert "event: connected" in r_sse.text


# ─── 4. WebSocket Status Endpoint ─────────────────────────────────────────────
async def test_websocket_status(client):
    r = await client.get("/ws/status")
    assert r.status_code == 200
    data = r.json()
    assert "connected_users" in data
    assert "mode" in data


# ─── 5. AI / LLM Integratsiyasi ───────────────────────────────────────────────
async def test_ai_integration(client):
    auth_header = await login(client)

    # 1. Lead Analysis
    lead_payload = {
        "name": "Nodira Rustamova",
        "notes": "IELTS kursiga to'lov qilib ertaga kelmoqchi",
        "source": "Instagram",
    }
    r = await client.post("/ai/analyze-lead", json=lead_payload, headers=auth_header)
    assert r.status_code == 200
    data = r.json()
    assert data["score"] >= 80
    assert data["interest_level"] == "Yuqori"
    assert "recommended_action" in data

    # 2. Student Report
    report_payload = {
        "student_name": "Ali Karimov",
        "course_name": "IELTS Foundation",
        "attendance_percent": 95.0,
        "exam_scores": [85.0, 90.0, 88.0],
        "notes": "Faol qatnashadi",
    }
    r = await client.post("/ai/student-report", json=report_payload, headers=auth_header)
    assert r.status_code == 200
    rep = r.json()
    assert rep["overall_status"] == "A'lo"
    assert len(rep["strengths"]) > 0
    assert rep["ai_recommendation"]

    # 3. Universal Assistant
    r = await client.post("/ai/assistant", json={"prompt": "Salom"}, headers=auth_header)
    assert r.status_code == 200
    assert "response" in r.json()


# ─── 6. Redis Caching & In-Memory Fallback ────────────────────────────────────
async def test_cache_functionality():
    from app.utils.cache import cached, delete, get, set as cache_set

    # To'g'ridan-to'g'ri get/set (Redis yo'q bo'lsa xatosiz None qaytadi)
    await cache_set("test_key", {"foo": "bar"}, ttl=10)
    # Delete
    await delete("test_key")

    # @cached dekoratori sinovi
    calls = 0

    @cached("computed:{x}", ttl=5)
    async def compute(x: int):
        nonlocal calls
        calls += 1
        return {"val": x * 2}

    res1 = await compute(x=5)
    assert res1 == {"val": 10}


# ─── 7. Repository & Service Layer (SOLID) ────────────────────────────────────
async def test_repository_and_service_layer(client):
    from app.database.connection import SessionLocal
    from app.repositories.student import StudentRepository, StudentService

    async with SessionLocal() as db:
        repo = StudentRepository(db)
        service = StudentService(repo)

        # Count
        total_students = await repo.count()
        assert total_students >= 0

        # Debtors
        debtors = await repo.get_debtors(limit=5)
        assert isinstance(debtors, list)


# ─── 8. Celery & Fon Vazifalar Fallback ───────────────────────────────────────
def test_celery_fallback(client):
    from app.celery_app import enqueue_bulk_sms

    # Redis bo'lmaganda ham funksiya xatosiz sinxron ishlaydi
    res = enqueue_bulk_sms(student_ids=[999999], body="Sinov SMS")
    assert "sent" in res or "queued" in res


# ─── 9. gRPC Service Handler ─────────────────────────────────────────────────
async def test_grpc_handler(client):
    from app.grpc_service.service import StudentGrpcClient, StudentGrpcHandler

    # Mavjud bo'lmagan talaba
    info = await StudentGrpcHandler.get_student_info(student_id=999999)
    assert info["student_id"] == 999999
    assert info["status"] == "not_found"

    # Client orqali chaqirish
    client_grpc = StudentGrpcClient()
    res = await client_grpc.get_student(student_id=999999)
    assert res["is_active"] is False


# ─── 10. 2FA (Two-Factor Authentication) ─────────────────────────────────────
async def test_two_factor_auth_flow(client):
    from app.services.two_factor import get_totp_code
    auth_header = await login(client)

    # 1. 2FA status
    st = (await client.get("/auth/2fa/status", headers=auth_header)).json()
    assert "enabled" in st

    # 2. Setup (secret va uri olish)
    setup = (await client.post("/auth/2fa/setup", headers=auth_header)).json()
    secret = setup["secret"]
    assert len(secret) >= 16
    assert "otpauth://" in setup["otpauth_url"]

    # 3. Noto'g'ri kod bilan enable qilish
    bad_res = await client.post("/auth/2fa/enable", json={"secret": secret, "code": "000000"}, headers=auth_header)
    assert bad_res.status_code == 400

    # 4. To'g'ri TOTP kod bilan enable qilish
    valid_code = get_totp_code(secret)
    ok_res = await client.post("/auth/2fa/enable", json={"secret": secret, "code": valid_code}, headers=auth_header)
    assert ok_res.status_code == 200

    # Status endi True bo'lishi kerak
    st_now = (await client.get("/auth/2fa/status", headers=auth_header)).json()
    assert st_now["enabled"] is True

    # 5. Disable qilish
    dis = await client.post("/auth/2fa/disable", json={"password": ADMIN_PASS}, headers=auth_header)
    assert dis.status_code == 200
    assert (await client.get("/auth/2fa/status", headers=auth_header)).json()["enabled"] is False


# ─── 11. Excel Export (openpyxl) ─────────────────────────────────────────────
async def test_excel_export(client):
    auth_header = await login(client)
    res = await client.get("/reports/export/debtors-excel", headers=auth_header)
    assert res.status_code == 200
    assert "spreadsheetml.sheet" in res.headers["content-type"]
    assert res.headers["content-disposition"].endswith('.xlsx"')
    # Excel fayl imzosi: PK zip boshlanishi (b"PK\x03\x04")
    assert res.content.startswith(b"PK\x03\x04")


# ─── 12. Telegram Webhook ────────────────────────────────────────────────────
async def test_telegram_webhook(client):
    auth_header = await login(client)

    # Status
    st = (await client.get("/telegram/status", headers=auth_header)).json()
    assert "configured" in st

    # /start
    res_start = await client.post("/telegram/webhook", json={
        "message": {"chat": {"id": 123456789}, "text": "/start"}
    })
    assert res_start.status_code == 200
    assert res_start.json()["action"] == "start_prompt"
