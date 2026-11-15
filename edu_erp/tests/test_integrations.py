"""Click, Payme, Eskiz SMS, yangi qurilma emaili va sertifikat PDF — tashqi xizmatlarsiz (soxta transport bilan)."""
import base64
import datetime as dt
import hashlib
import urllib.parse
from decimal import Decimal
import httpx
import pytest
from sqlalchemy import update
from tests.conftest import ADMIN_PASS, ADMIN_PHONE

TODAY = dt.date.today()
MONTH = TODAY.replace(day=1)
S: dict = {}


async def login(client, phone=ADMIN_PHONE, pw=ADMIN_PASS, **headers):
    r = await client.post("/auth/login", data={"username": phone, "password": pw}, headers=headers)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code}: {r.text}"
    return r.json()


async def make_student(client, A, name, amount="500000", parent="+998901234500"):
    branch = (await ok(await client.get("/branches/", headers=A)))[0]["id"]
    st = await ok(await client.post("/students/", headers=A, json={"branch_id": branch, "first_name": name, "last_name": "Onlayn", "parent_phone": parent}), 201)
    inv = await ok(await client.post("/invoices/", headers=A, json={"student_id": st["id"], "period_month": MONTH.isoformat(), "amount": amount}), 201)
    return st, inv


async def balance(client, A, sid):
    return Decimal((await ok(await client.get(f"/students/{sid}", headers=A)))["balance"])


# ======================================================== CLICK
CLICK = {"service": "111", "merchant": "222", "secret": "click-secret"}


def click_sig(f, complete):
    s = f["click_trans_id"] + f["service_id"] + CLICK["secret"] + f["merchant_trans_id"] + (f["merchant_prepare_id"] if complete else "") + f["amount"] + f["action"] + f["sign_time"]
    return hashlib.md5(s.encode()).hexdigest()


def cform(pid, action, tid="9001", amount="500000.0", prepare_id=None, error="0", sign=None):
    f = {"click_trans_id": tid, "service_id": CLICK["service"], "merchant_trans_id": str(pid), "amount": amount, "action": str(action),
         "sign_time": "2026-11-04 12:00:00", "error": error, "click_paydoc_id": "5551"}
    if prepare_id is not None:
        f["merchant_prepare_id"] = str(prepare_id)
    f["sign_string"] = sign or click_sig(f, action == 1)
    return f


@pytest.fixture
def click_cfg(monkeypatch):
    from app.utils.config import settings
    monkeypatch.setattr(settings, "CLICK_SERVICE_ID", CLICK["service"])
    monkeypatch.setattr(settings, "CLICK_MERCHANT_ID", CLICK["merchant"])
    monkeypatch.setattr(settings, "CLICK_SECRET_KEY", CLICK["secret"])


async def test_click_full_flow(client, click_cfg):
    A = await login(client)
    st, inv = await make_student(client, A, "Clicker")
    assert await balance(client, A, st["id"]) == -500000
    co = await ok(await client.post("/payments/online/checkout", headers=A, json={"student_id": st["id"], "amount": "500000", "provider": "click", "invoice_id": inv["id"], "return_url": "https://x.uz/back"}), 201)
    q = urllib.parse.parse_qs(urllib.parse.urlparse(co["url"]).query)
    assert co["url"].startswith("https://my.click.uz/services/pay?")
    assert q["service_id"] == ["111"] and q["merchant_id"] == ["222"] and q["amount"] == ["500000.00"] and q["transaction_param"] == [str(co["payment_id"])]
    pid = co["payment_id"]
    pay = await ok(await client.get(f"/payments/{pid}", headers=A))
    assert pay["status"] == "pending" and pay["received_by"] is None

    post = lambda f: client.post("/webhooks/click", data=f)
    assert (await ok(await post(cform(pid, 0, sign="0" * 32))))["error"] == -1                       # imzo noto'g'ri
    assert (await ok(await post(cform(pid, 0, amount="1000.0"))))["error"] == -2                     # summa noto'g'ri
    assert (await ok(await post(cform(999999, 0))))["error"] == -5                                   # buyurtma yo'q
    bad_action = cform(pid, 0); bad_action["action"] = "7"
    assert (await ok(await post(bad_action)))["error"] == -3
    p1 = await ok(await post(cform(pid, 0)))
    assert p1["error"] == 0 and p1["merchant_prepare_id"] and p1["click_trans_id"] == 9001
    assert (await ok(await post(cform(pid, 0))))["merchant_prepare_id"] == p1["merchant_prepare_id"]   # takroriy prepare — idempotent
    assert await balance(client, A, st["id"]) == -500000                                              # hali pul tushmadi
    assert (await ok(await post(cform(pid, 1, prepare_id=424242))))["error"] == -6                    # tranzaksiya yo'q
    c1 = await ok(await post(cform(pid, 1, prepare_id=p1["merchant_prepare_id"])))
    assert c1["error"] == 0 and c1["merchant_confirm_id"]
    pay = await ok(await client.get(f"/payments/{pid}", headers=A))
    assert pay["status"] == "completed" and pay["transaction_id"] == "9001"
    assert await balance(client, A, st["id"]) == 0
    assert (await ok(await client.get(f"/invoices/{inv['id']}", headers=A)))["status"] == "paid"      # hisob avtomatik yopildi
    assert (await ok(await post(cform(pid, 1, prepare_id=p1["merchant_prepare_id"]))))["error"] == -4  # ikki marta to'lanmaydi
    assert (await ok(await post(cform(pid, 0))))["error"] == -4

    # Click o'z tomonida xato bildirsa: to'lov bekor, balans o'zgarmaydi
    co2 = await ok(await client.post("/payments/online/checkout", headers=A, json={"student_id": st["id"], "amount": "100000", "provider": "click"}), 201)
    p2 = await ok(await post(cform(co2["payment_id"], 0, tid="9002", amount="100000.0")))
    bal = await balance(client, A, st["id"])
    r = await ok(await post(cform(co2["payment_id"], 1, tid="9002", amount="100000.0", prepare_id=p2["merchant_prepare_id"], error="-5")))
    assert r["error"] == -9
    assert (await ok(await client.get(f"/payments/{co2['payment_id']}", headers=A)))["status"] == "failed" and await balance(client, A, st["id"]) == bal

    txs = await ok(await client.get("/payments/online/transactions?provider=click", headers=A))
    assert {t["state"] for t in txs["items"] if t["payment_id"] in (pid, co2["payment_id"])} == {2, -1}


async def test_click_unconfigured_rejects(client, monkeypatch):
    from app.utils.config import settings
    monkeypatch.setattr(settings, "CLICK_SECRET_KEY", "")
    r = await ok(await client.post("/webhooks/click", data=cform(1, 0)))
    assert r["error"] == -8
    A = await login(client)
    st, _ = await make_student(client, A, "NoCfg")
    assert (await client.post("/payments/online/checkout", headers=A, json={"student_id": st["id"], "amount": "1000", "provider": "click"})).status_code == 400


# ======================================================== PAYME
PAYME_KEY, PAYME_MERCHANT = "payme-key", "mrch-1"
PAUTH = {"Authorization": "Basic " + base64.b64encode(f"Paycom:{PAYME_KEY}".encode()).decode()}


@pytest.fixture
def payme_cfg(monkeypatch):
    from app.utils.config import settings
    monkeypatch.setattr(settings, "PAYME_MERCHANT_ID", PAYME_MERCHANT)
    monkeypatch.setattr(settings, "PAYME_KEY", PAYME_KEY)


async def rpc(client, method, params, headers=PAUTH):
    r = await ok(await client.post("/webhooks/payme", json={"jsonrpc": "2.0", "id": 7, "method": method, "params": params}, headers=headers))
    assert r["id"] == 7
    return r


async def test_payme_full_flow(client, payme_cfg):
    A = await login(client)
    st, inv = await make_student(client, A, "Payer", amount="300000")
    co = await ok(await client.post("/payments/online/checkout", headers=A, json={"student_id": st["id"], "amount": "300000", "provider": "payme", "invoice_id": inv["id"]}), 201)
    pid = co["payment_id"]
    assert co["url"].startswith("https://checkout.paycom.uz/")
    decoded = base64.b64decode(co["url"].rsplit("/", 1)[1]).decode()
    assert decoded == f"m={PAYME_MERCHANT};ac.order_id={pid};a=30000000"
    acc = {"order_id": pid}

    # autentifikatsiya
    assert (await rpc(client, "CheckPerformTransaction", {}, headers={}))["error"]["code"] == -32504
    assert (await rpc(client, "CheckPerformTransaction", {}, headers={"Authorization": "Basic " + base64.b64encode(b"Paycom:wrong").decode()}))["error"]["code"] == -32504
    assert (await rpc(client, "Nope", {}))["error"]["code"] == -32601

    assert (await rpc(client, "CheckPerformTransaction", {"amount": 1, "account": acc}))["error"]["code"] == -31001
    assert (await rpc(client, "CheckPerformTransaction", {"amount": 30000000, "account": {"order_id": 987654}}))["error"]["code"] == -31050
    assert (await rpc(client, "CheckPerformTransaction", {"amount": 30000000, "account": acc}))["result"] == {"allow": True}

    t0 = int(dt.datetime.now().timestamp() * 1000)
    c1 = (await rpc(client, "CreateTransaction", {"id": "pm-1", "time": t0, "amount": 30000000, "account": acc}))["result"]
    assert c1["state"] == 1 and c1["transaction"] and c1["create_time"] > 0
    assert (await rpc(client, "CreateTransaction", {"id": "pm-1", "time": t0, "amount": 30000000, "account": acc}))["result"] == c1   # idempotent
    assert (await rpc(client, "CreateTransaction", {"id": "pm-2", "time": t0, "amount": 30000000, "account": acc}))["error"]["code"] == -31008  # boshqa faol tranzaksiya
    chk = (await rpc(client, "CheckTransaction", {"id": "pm-1"}))["result"]
    assert chk["state"] == 1 and chk["perform_time"] == 0 and chk["cancel_time"] == 0 and chk["reason"] is None
    assert await balance(client, A, st["id"]) == -300000

    pf = (await rpc(client, "PerformTransaction", {"id": "pm-1"}))["result"]
    assert pf["state"] == 2 and pf["perform_time"] > 0 and pf["transaction"] == c1["transaction"]
    assert (await rpc(client, "PerformTransaction", {"id": "pm-1"}))["result"] == pf                                  # idempotent
    assert (await ok(await client.get(f"/payments/{pid}", headers=A)))["status"] == "completed"
    assert await balance(client, A, st["id"]) == 0
    assert (await ok(await client.get(f"/invoices/{inv['id']}", headers=A)))["status"] == "paid"
    assert (await rpc(client, "CheckPerformTransaction", {"amount": 30000000, "account": acc}))["error"]["code"] == -31051   # to'langan buyurtma

    st_ = (await rpc(client, "GetStatement", {"from": t0 - 60000, "to": t0 + 3_600_000}))["result"]["transactions"]
    mine = next(t for t in st_ if t["id"] == "pm-1")
    assert mine["amount"] == 30000000 and mine["account"] == {"order_id": str(pid)} and mine["state"] == 2

    # bajarilgandan keyin bekor qilish = qaytarish
    cn = (await rpc(client, "CancelTransaction", {"id": "pm-1", "reason": 5}))["result"]
    assert cn["state"] == -2 and cn["cancel_time"] > 0
    assert (await ok(await client.get(f"/payments/{pid}", headers=A)))["is_refunded"] is True
    assert await balance(client, A, st["id"]) == -300000
    chk = (await rpc(client, "CheckTransaction", {"id": "pm-1"}))["result"]
    assert chk["state"] == -2 and chk["reason"] == 5
    assert (await rpc(client, "CancelTransaction", {"id": "pm-1", "reason": 5}))["result"]["state"] == -2             # idempotent
    assert (await rpc(client, "CheckTransaction", {"id": "no-such"}))["error"]["code"] == -31003


async def test_payme_cancel_before_perform_and_timeout(client, payme_cfg):
    from app.database.connection import SessionLocal
    from app.models.online import ProviderTransaction
    A = await login(client)
    st, _ = await make_student(client, A, "Payer2", amount="100000")
    new = lambda: client.post("/payments/online/checkout", headers=A, json={"student_id": st["id"], "amount": "100000", "provider": "payme"})
    t0 = int(dt.datetime.now().timestamp() * 1000)

    p1 = (await ok(await new(), 201))["payment_id"]
    await rpc(client, "CreateTransaction", {"id": "pm-c1", "time": t0, "amount": 10000000, "account": {"order_id": p1}})
    assert (await rpc(client, "CancelTransaction", {"id": "pm-c1", "reason": 3}))["result"]["state"] == -1
    assert (await ok(await client.get(f"/payments/{p1}", headers=A)))["status"] == "failed"
    assert (await rpc(client, "PerformTransaction", {"id": "pm-c1"}))["error"]["code"] == -31008                    # bekor qilinganni bajarib bo'lmaydi
    assert (await rpc(client, "CheckPerformTransaction", {"amount": 10000000, "account": {"order_id": p1}}))["error"]["code"] == -31051

    p2 = (await ok(await new(), 201))["payment_id"]
    await rpc(client, "CreateTransaction", {"id": "pm-t1", "time": t0, "amount": 10000000, "account": {"order_id": p2}})
    async with SessionLocal() as db:                       # tranzaksiya 13 soat oldin yaratilgan bo'lsin
        await db.execute(update(ProviderTransaction).where(ProviderTransaction.provider_trans_id == "pm-t1").values(created_at=dt.datetime.utcnow() - dt.timedelta(hours=13)))
        await db.commit()
    assert (await rpc(client, "PerformTransaction", {"id": "pm-t1"}))["error"]["code"] == -31008
    chk = (await rpc(client, "CheckTransaction", {"id": "pm-t1"}))["result"]
    assert chk["state"] == -1 and chk["reason"] == 4                                                                   # timeout bekor qilishi saqlandi
    assert (await ok(await client.get(f"/payments/{p2}", headers=A)))["status"] == "failed"

    # staff bekor qilishi
    p3 = (await ok(await new(), 201))["payment_id"]
    await ok(await client.post(f"/payments/online/{p3}/cancel", headers=A))
    assert (await client.post(f"/payments/online/{p3}/cancel", headers=A)).status_code == 409
    assert await balance(client, A, st["id"]) == -100000                                                                # hech narsa to'lanmagan


# ======================================================== ESKIZ SMS
async def test_eskiz_provider_and_callback(client, monkeypatch):
    from app.services.sms_providers import EskizProvider, set_provider
    from app.utils.config import settings
    monkeypatch.setattr(settings, "SMS_CALLBACK_TOKEN", "cbtoken")
    seen: list = []
    state = {"mode": "ok", "tokens": 0}

    def handler(req: httpx.Request):
        body = urllib.parse.parse_qs(req.content.decode())
        seen.append((req.url.path, req.headers.get("authorization"), body))
        if req.url.path.endswith("/auth/login"):
            state["tokens"] += 1
            assert body["email"] == ["me@x.uz"] and body["password"] == ["pw"]
            return httpx.Response(200, json={"message": "token_generated", "data": {"token": f"TKN{state['tokens']}"}, "token_type": "Bearer"})
        if state["mode"] == "expired" and req.headers["authorization"] == "Bearer TKN1":
            return httpx.Response(401, json={"message": "Expired"})
        if state["mode"] == "reject":
            return httpx.Response(400, json={"status": "error", "message": "Matn shabloniga mos emas"})
        return httpx.Response(200, json={"id": f"msg-{len(seen)}", "message": "Waiting for SMS provider", "status": "waiting"})

    set_provider(EskizProvider("me@x.uz", "pw", "4546", "https://notify.eskiz.uz/api", "https://api.x/webhooks/sms/eskiz?token=cbtoken", transport=httpx.MockTransport(handler)))
    try:
        A = await login(client)
        st, _ = await make_student(client, A, "Smsr")
        s1 = await ok(await client.post("/sms/send", headers=A, json={"student_id": st["id"], "body": "Salom"}), 201)
        assert s1["status"] == "sent" and s1["provider_message_id"] and s1["error"] is None
        send_call = [c for c in seen if c[0].endswith("/message/sms/send")][0]
        assert send_call[1] == "Bearer TKN1"
        assert send_call[2]["mobile_phone"] == ["998901234500"] and send_call[2]["from"] == ["4546"] and send_call[2]["message"] == ["Salom"]
        assert send_call[2]["callback_url"] == ["https://api.x/webhooks/sms/eskiz?token=cbtoken"]
        await ok(await client.post("/sms/send", headers=A, json={"student_id": st["id"], "body": "Yana"}), 201)
        assert state["tokens"] == 1                                                                # token keshlanadi

        state["mode"] = "expired"                                                                  # token eskirdi -> avtomatik qayta kirish
        s2 = await ok(await client.post("/sms/send", headers=A, json={"student_id": st["id"], "body": "Eskirgan token"}), 201)
        assert s2["status"] == "sent" and state["tokens"] == 2

        state["mode"] = "reject"
        s3 = await ok(await client.post("/sms/send", headers=A, json={"student_id": st["id"], "body": "Rad"}), 201)
        assert s3["status"] == "failed" and "shablon" in s3["error"] and s3["provider_message_id"] is None
        state["mode"] = "ok"
        s3r = await ok(await client.post(f"/sms/{s3['id']}/retry", headers=A))
        assert s3r["status"] == "sent" and s3r["error"] is None
        assert (await client.post(f"/sms/{s3['id']}/retry", headers=A)).status_code == 409         # yuborilganni qayta yuborib bo'lmaydi

        # yetkazish holati callback i
        mid = s1["provider_message_id"]
        assert (await client.post("/webhooks/sms/eskiz?token=wrong", json={"message_id": mid, "status": "DELIVRD"})).status_code == 403
        assert (await client.post("/webhooks/sms/eskiz", json={"message_id": mid, "status": "DELIVRD"})).status_code == 403
        r = await ok(await client.post("/webhooks/sms/eskiz?token=cbtoken", json={"message_id": mid, "status": "DELIVRD"}))
        assert r["updated"] is True
        logs = (await ok(await client.get(f"/sms/logs?student_id={st['id']}", headers=A)))["items"]
        assert next(x for x in logs if x["id"] == s1["id"])["status"] == "delivered"
        await ok(await client.post("/webhooks/sms/eskiz?token=cbtoken", data={"request_id": mid, "status": "waiting"}))     # orqaga qaytarmaydi
        logs = (await ok(await client.get(f"/sms/logs?student_id={st['id']}", headers=A)))["items"]
        assert next(x for x in logs if x["id"] == s1["id"])["status"] == "delivered"

        # test-sms (admin) va integratsiyalar holati
        t = await ok(await client.post("/system/integrations/test-sms", headers=A, json={"phone": "90 111 22 33"}))
        assert t["ok"] is True
    finally:
        set_provider(None)


async def test_sms_provider_network_error(client, monkeypatch):
    from app.services.sms_providers import EskizProvider, set_provider

    def boom(req):
        raise httpx.ConnectError("down")
    set_provider(EskizProvider("a@b.c", "pw", transport=httpx.MockTransport(boom)))
    try:
        A = await login(client)
        st, _ = await make_student(client, A, "Neterr")
        s = await ok(await client.post("/sms/send", headers=A, json={"student_id": st["id"], "body": "x"}), 201)
        assert s["status"] == "failed" and "aloqa" in s["error"]
    finally:
        set_provider(None)


async def test_integrations_status_hides_secrets(client, click_cfg, payme_cfg):
    A = await login(client)
    r = await client.get("/system/integrations", headers=A)
    data = await ok(r)
    assert data["click"]["configured"] and data["payme"]["configured"]
    assert data["click"]["urls"]["prepare_url"].endswith("/webhooks/click") and data["payme"]["urls"]["endpoint_url"].endswith("/webhooks/payme")
    assert CLICK["secret"] not in r.text and PAYME_KEY not in r.text                                  # maxfiy kalitlar chiqmaydi
    # manager integratsiyalar sahifasini ko'ra olmaydi (faqat admin)
    mgr = await make_employee(client, A, "+998900003333", "mgr@example.uz")
    tok = await login(client, "+998900003333", "Passw0rd!!")
    assert (await client.get("/system/integrations", headers=tok)).status_code == 403
    assert mgr["id"]


# ======================================================== YANGI QURILMA EMAILI
UA_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
DEV_A, DEV_B = "device-A-0123456789abcdef", "device-B-0123456789abcdef"


async def make_employee(client, A, phone, email):
    branch = (await ok(await client.get("/branches/", headers=A)))[0]["id"]
    roles = {r["code"]: r["id"] for r in await ok(await client.get("/roles/", headers=A))}
    e = await ok(await client.post("/employees/", headers=A, json={"branch_id": branch, "first_name": "Ali", "last_name": "Valiyev", "phone": phone, "email": email,
                                                                  "password": "Passw0rd!!", "position": "Menejer", "hired_at": "2024-01-01"}), 201)
    await ok(await client.post("/employee-roles/", headers=A, json={"employee_id": e["id"], "role_id": roles["manager"], "branch_id": branch}), 201)
    return e


async def test_new_device_email_flow(client, monkeypatch):
    from app.services.email import OUTBOX
    from app.utils.config import settings
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "memory")
    OUTBOX.clear()
    A = await login(client)
    e = await make_employee(client, A, "+998900001111", "ali@example.uz")
    phone = "+998900001111"

    await login(client, phone, "Passw0rd!!", **{"X-Device-Id": DEV_A, "User-Agent": UA_WIN})
    assert OUTBOX == []                                                    # birinchi qurilma — xabarnoma yo'q
    await login(client, phone, "Passw0rd!!", **{"X-Device-Id": DEV_A, "User-Agent": UA_WIN})
    assert OUTBOX == []                                                    # o'sha qurilma

    tok_b = await login(client, phone, "Passw0rd!!", **{"X-Device-Id": DEV_B, "User-Agent": UA_IPHONE})
    assert len(OUTBOX) == 1                                                # YANGI qurilma — email
    m = OUTBOX[0]
    assert m.to == "ali@example.uz" and "yangi qurilmadan" in m.subject.lower()
    assert "Safari · iOS" in m.text and "Safari · iOS" in m.html and "IP manzil" in m.text and "UTC+5" in m.text
    assert "/profile" in m.text and "Agar bu siz bo'lmasangiz" in m.text
    await login(client, phone, "Passw0rd!!", **{"X-Device-Id": DEV_B, "User-Agent": UA_IPHONE})
    assert len(OUTBOX) == 1                                                # qayta yuborilmaydi

    notes = await ok(await client.get("/notifications/?unread_only=true", headers=tok_b))
    assert any(n["type"] == "security" and "Yangi qurilma" in n["title"] for n in notes["items"])
    logs = await ok(await client.get("/audit-logs/?action=login_new_device", headers=A))
    assert logs["total"] >= 1

    devs = await ok(await client.get("/auth/devices", headers={**tok_b, "X-Device-Id": DEV_B}))
    assert len(devs) == 2 and [d["is_current"] for d in devs].count(True) == 1 and next(d for d in devs if d["is_current"])["label"] == "Safari · iOS"
    assert next(d for d in devs if d["label"] == "Chrome · Windows")["login_count"] == 2

    await ok(await client.delete(f"/auth/devices/{next(d['id'] for d in devs if d['is_current'])}", headers=tok_b))
    await login(client, phone, "Passw0rd!!", **{"X-Device-Id": DEV_B, "User-Agent": UA_IPHONE})
    assert len(OUTBOX) == 2                                                # unutilgan qurilma yana "yangi"
    assert (await client.delete("/auth/devices/999999", headers=tok_b)).status_code == 404

    # email o'zgartirish parol bilan, test xat
    assert (await client.put("/auth/me/email", headers=tok_b, json={"email": "new@example.uz", "password": "xato"})).status_code == 400
    assert (await client.put("/auth/me/email", headers=tok_b, json={"email": "not-an-email", "password": "Passw0rd!!"})).status_code == 422
    await ok(await client.put("/auth/me/email", headers=tok_b, json={"email": "new@example.uz", "password": "Passw0rd!!"}))
    await ok(await client.post("/auth/me/test-email", headers=tok_b))
    assert OUTBOX[-1].to == "new@example.uz" and "test" in OUTBOX[-1].subject.lower()
    assert e["id"]


async def test_new_device_without_email_and_email_failure(client, monkeypatch):
    from app.services.email import OUTBOX
    from app.utils.config import settings
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "memory")
    A = await login(client)
    await make_employee(client, A, "+998900002222", None)
    n = len(OUTBOX)
    await login(client, "+998900002222", "Passw0rd!!", **{"X-Device-Id": DEV_A, "User-Agent": UA_WIN})
    tok = await login(client, "+998900002222", "Passw0rd!!", **{"X-Device-Id": DEV_B, "User-Agent": UA_IPHONE})
    assert len(OUTBOX) == n                                                                       # email yo'q -> yuborilmaydi
    notes = await ok(await client.get("/notifications/", headers=tok))
    assert any(x["type"] == "security" for x in notes["items"])                                   # lekin ichki xabarnoma bor

    # SMTP ishlamasa ham login muvaffaqiyatli
    await ok(await client.put("/auth/me/email", headers=tok, json={"email": "z@example.uz", "password": "Passw0rd!!"}))
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "127.0.0.1")
    monkeypatch.setattr(settings, "SMTP_PORT", 1)
    await login(client, "+998900002222", "Passw0rd!!", **{"X-Device-Id": "device-C-0123456789abcdef", "User-Agent": UA_WIN})
    r = await client.post("/auth/me/test-email", headers=tok)
    assert r.status_code == 502                                                                   # test-emailda esa aniq xato ko'rsatiladi


async def test_ua_fallback_and_email_escaping(client, monkeypatch):
    from app.services.devices import parse_ua
    from app.services.email import new_device_message
    assert parse_ua(UA_WIN)["label"] == "Chrome · Windows" and parse_ua(UA_IPHONE)["kind"] == "mobile"
    assert parse_ua(None)["label"] == "Noma'lum qurilma"
    _, _, html = new_device_message(name="<b>Ali</b>", label="<script>alert(1)</script>", ip="1.2.3.4", when="now", profile_url='http://x/"><img src=x>')
    assert "<script>" not in html and "&lt;script&gt;" in html and "<b>Ali</b>" not in html and '"><img' not in html


# ======================================================== SERTIFIKAT PDF
async def test_certificate_pdf(client):
    from io import BytesIO
    from pypdf import PdfReader
    A = await login(client)
    branch = (await ok(await client.get("/branches/", headers=A)))[0]["id"]
    course = await ok(await client.post("/courses/", headers=A, json={"name": "Ingliz tili (IELTS)", "duration_months": 6, "lessons_count": 72, "price": "500000"}), 201)
    grp = await ok(await client.post("/groups/", headers=A, json={"branch_id": branch, "course_id": course["id"], "name": "PDF guruh", "max_students": 5, "status": "completed"}), 201)
    st = await ok(await client.post("/students/", headers=A, json={"branch_id": branch, "first_name": "Gʻayrat", "last_name": "Oʻktamov", "parent_phone": "+998901234599"}), 201)
    cert = await ok(await client.post("/certificates/", headers=A, json={"student_id": st["id"], "group_id": grp["id"], "force": True}), 201)
    r = await client.get(f"/certificates/{cert['id']}/pdf", headers=A)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert cert["serial_number"] in r.headers["content-disposition"] and r.content[:5] == b"%PDF-"
    text = PdfReader(BytesIO(r.content)).pages[0].extract_text()
    for needle in ("SERTIFIKAT", "Gʻayrat Oʻktamov", "Ingliz tili (IELTS)", cert["serial_number"], "PDF guruh"):
        assert needle in text, f"PDF da topilmadi: {needle!r}"
    assert (await client.get(f"/certificates/{cert['id']}/pdf")).status_code == 401
    assert (await client.get("/certificates/999999/pdf", headers=A)).status_code == 404


async def test_login_survives_device_tracking_failure(client, monkeypatch):
    """Qurilmani qayd etish bazada xato bersa ham login muvaffaqiyatli bo'lishi shart (regressiya: rollback obyektni eskirtirardi)."""
    import app.routers.auth as auth_router
    from sqlalchemy.exc import OperationalError

    async def broken(*a, **k):
        raise OperationalError("INSERT login_devices", {}, Exception("no such table: login_devices"))
    monkeypatch.setattr(auth_router, "record_login", broken)
    r = await client.post("/auth/login", data={"username": ADMIN_PHONE, "password": ADMIN_PASS})
    assert r.status_code == 200 and r.json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.status_code == 200 and "email" in me.json()
