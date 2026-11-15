"""Butun tizimni boshidan oxirigacha sinaydigan ketma-ket test (SQLite da)."""
import datetime as dt
from decimal import Decimal
import pytest
from tests.conftest import ADMIN_PASS, ADMIN_PHONE

S: dict = {}  # testlar o'rtasida umumiy holat
TODAY = dt.date.today()
MONTH = TODAY.replace(day=1)
D = Decimal


async def login(client, phone, password):
    r = await client.post("/auth/login", data={"username": phone, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code}: {r.text}"
    return r.json()


# ------------------------------------------------------------------ auth
async def test_01_auth(client):
    assert (await client.get("/health")).json() == {"status": "ok"}
    r = await client.post("/auth/login", data={"username": ADMIN_PHONE, "password": "wrong-pass"})
    assert r.status_code == 401
    S["admin"] = await login(client, ADMIN_PHONE, ADMIN_PASS)
    me = await ok(await client.get("/auth/me", headers=S["admin"]))
    assert me["branch_ids"] is None and me["roles"][0]["code"] == "admin"
    assert (await client.get("/branches/")).status_code == 401          # tokensiz kirib bo'lmaydi
    # refresh token access sifatida ishlamasligi kerak
    r = await client.post("/auth/login", data={"username": "901112233", "password": ADMIN_PASS})  # format normallashadi
    tok = await ok(r)
    bad = await client.get("/auth/me", headers={"Authorization": f"Bearer {tok['refresh_token']}"})
    assert bad.status_code == 401
    ref = await ok(await client.post("/auth/refresh", json={"refresh_token": tok["refresh_token"]}))
    assert ref["access_token"]


# ------------------------------------------------------------------ tashkilot va xodimlar
async def test_02_org_and_staff(client):
    A = S["admin"]
    b1 = (await ok(await client.get("/branches/", headers=A)))[0]
    S["b1"] = b1["id"]
    b2 = await ok(await client.post("/branches/", headers=A, json={
        "name": "Chilonzor", "code": "CHL", "address": "x", "phone": "901234500", "city": "Toshkent",
        "opened_at": "2024-01-01"}), 201)
    S["b2"] = b2["id"]
    assert b2["phone"] == "+998901234500"
    assert (await client.post("/branches/", headers=A, json={**b2, "opened_at": "2024-01-01"})).status_code == 409

    roles = {r["code"]: r["id"] for r in await ok(await client.get("/roles/", headers=A))}
    S["roles"] = roles
    for key, phone, role, pos in [("mgr", "+998900000001", "manager", "Menejer"),
                                  ("tch", "+998900000002", "teacher", "O'qituvchi"),
                                  ("acc", "+998900000003", "accountant", "Buxgalter"),
                                  ("tch2", "+998900000004", "teacher", "O'qituvchi 2")]:
        e = await ok(await client.post("/employees/", headers=A, json={
            "branch_id": S["b1"], "first_name": key, "last_name": "Test", "phone": phone,
            "password": "Passw0rd!!", "position": pos, "hired_at": "2024-01-01"}), 201)
        assert "password" not in e and "password_hash" not in e          # hash hech qachon chiqmaydi
        S[key + "_id"] = e["id"]
        await ok(await client.post("/employee-roles/", headers=A, json={
            "employee_id": e["id"], "role_id": roles[role], "branch_id": S["b1"]}), 201)
        S[key] = await login(client, phone, "Passw0rd!!")

    # dublikat telefon
    assert (await client.post("/employees/", headers=A, json={
        "branch_id": S["b1"], "first_name": "a", "last_name": "b", "phone": "+998900000001",
        "password": "Passw0rd!!", "position": "x", "hired_at": "2024-01-01"})).status_code == 409
    # RBAC
    assert (await client.get("/employees/", headers=S["tch"])).status_code == 403
    assert (await client.get("/employees/", headers=S["acc"])).status_code == 200      # buxgalter maosh uchun ko'ra oladi
    assert (await client.post("/branches/", headers=S["mgr"], json={})).status_code in (403, 422)
    r = await client.post("/employee-roles/", headers=S["mgr"], json={
        "employee_id": S["tch_id"], "role_id": roles["admin"], "branch_id": S["b1"]})
    assert r.status_code == 403                                           # manager admin rolini bera olmaydi
    r = await client.post("/employee-roles/", headers=S["mgr"], json={
        "employee_id": S["tch_id"], "role_id": roles["teacher"], "branch_id": S["b2"]})
    assert r.status_code == 403                                           # boshqa filialga ham
    # manager B2 filialni ko'rmaydi
    assert [b["id"] for b in await ok(await client.get("/branches/", headers=S["mgr"]))] == [S["b1"]]
    assert (await client.get(f"/branches/{S['b2']}", headers=S["mgr"])).status_code == 403
    # update: telefonni o'zgartirmasdan saqlash 409 bermasligi kerak
    await ok(await client.put(f"/employees/{S['mgr_id']}", headers=A, json={"phone": "+998900000001",
                                                                          "position": "Katta menejer"}))
    # oxirgi admin
    admin_id = me_id = (await ok(await client.get("/auth/me", headers=A)))["id"]
    assert (await client.post(f"/employees/{admin_id}/fire", headers=A)).status_code == 409
    # tizim rolini o'chirib bo'lmaydi
    assert (await client.delete(f"/roles/{roles['admin']}", headers=A)).status_code == 409
    # parolni o'zgartirish
    await ok(await client.post("/auth/change-password", headers=S["acc"],
                               json={"old_password": "Passw0rd!!", "new_password": "NewPassw0rd!"}))
    S["acc"] = await login(client, "+998900000003", "NewPassw0rd!")


# ------------------------------------------------------------------ o'quv jarayoni
async def test_03_academic(client):
    A, M = S["admin"], S["mgr"]
    c = await ok(await client.post("/courses/", headers=M, json={
        "name": "Ingliz tili", "duration_months": 6, "lessons_count": 72, "price": "500000"}), 201)
    S["course"] = c["id"]
    assert (await client.post("/courses/", headers=S["tch"], json={
        "name": "x", "duration_months": 1, "lessons_count": 1, "price": "1"})).status_code == 403
    r1 = await ok(await client.post("/rooms/", headers=M, json={"branch_id": S["b1"], "name": "101", "capacity": 10}), 201)
    r2 = await ok(await client.post("/rooms/", headers=M, json={"branch_id": S["b1"], "name": "102", "capacity": 3}), 201)
    S["room1"], S["room2"] = r1["id"], r2["id"]

    # o'qituvchi profili: max_groups ni faqat manager o'zgartiradi
    await ok(await client.post("/teacher-profiles/me", headers=S["tch"], json={"specialization": "IELTS"}), 201)
    assert (await client.put(f"/teacher-profiles/{S['tch_id']}", headers=S["tch"], json={"max_groups": 40})).status_code == 403
    await ok(await client.put(f"/teacher-profiles/{S['tch_id']}", headers=M, json={"max_groups": 2}))

    # xona sig'imidan katta guruh
    r = await client.post("/groups/", headers=M, json={"branch_id": S["b1"], "course_id": S["course"], "name": "G-big",
                                                       "room_id": S["room2"], "max_students": 5})
    assert r.status_code == 400
    # o'qituvchi roli yo'q xodim
    r = await client.post("/groups/", headers=M, json={"branch_id": S["b1"], "course_id": S["course"], "name": "G-bad",
                                                       "teacher_id": S["acc_id"], "max_students": 5})
    assert r.status_code == 400
    g1 = await ok(await client.post("/groups/", headers=M, json={
        "branch_id": S["b1"], "course_id": S["course"], "name": "Eng-1", "teacher_id": S["tch_id"],
        "room_id": S["room1"], "max_students": 2, "status": "active", "start_date": MONTH.isoformat()}), 201)
    S["g1"] = g1["id"]
    assert g1["current_students"] == 0
    # jadval: dushanba(1) va chorshanba(3)
    for wd in (1, 3):
        await ok(await client.post(f"/groups/{S['g1']}/schedules", headers=M, json={
            "weekday": wd, "start_time": "10:00:00", "end_time": "11:30:00"}), 201)
    # ikkinchi guruh, shu o'qituvchi, boshqa xona — vaqt to'qnashadi
    g2 = await ok(await client.post("/groups/", headers=M, json={
        "branch_id": S["b1"], "course_id": S["course"], "name": "Eng-2", "teacher_id": S["tch_id"],
        "room_id": S["room2"], "max_students": 3, "status": "active"}), 201)
    S["g2"] = g2["id"]
    r = await client.post(f"/groups/{S['g2']}/schedules", headers=M, json={
        "weekday": 1, "start_time": "10:30:00", "end_time": "12:00:00"})
    assert r.status_code == 409 and "o'qituvchi" in r.text.lower()
    # o'qituvchi limiti (2 ta guruh): uchinchisi 409
    r = await client.post("/groups/", headers=M, json={"branch_id": S["b1"], "course_id": S["course"], "name": "Eng-3",
                                                       "teacher_id": S["tch_id"], "max_students": 3})
    assert r.status_code == 409
    # o'qituvchi faqat o'z guruhlarini ko'radi
    g_other = await ok(await client.post("/groups/", headers=M, json={
        "branch_id": S["b1"], "course_id": S["course"], "name": "Boshqa", "teacher_id": S["tch2_id"],
        "max_students": 5, "status": "active"}), 201)
    mine = await ok(await client.get("/groups/", headers=S["tch"]))
    assert {g["id"] for g in mine["items"]} == {S["g1"], S["g2"]}
    assert (await client.get(f"/groups/{g_other['id']}", headers=S["tch"])).status_code == 403

    # o'quvchilar
    ids = []
    for fn in ("Ali", "Vali", "Gulnora"):
        s = await ok(await client.post("/students/", headers=M, json={
            "branch_id": S["b1"], "first_name": fn, "last_name": "Karimov", "parent_phone": "90 123 45 6" + str(len(ids))}), 201)
        ids.append(s["id"])
        assert s["status"] == "trial" and D(s["balance"]) == 0
    S["st"] = ids
    assert (await client.post("/students/", headers=M, json={"branch_id": S["b1"], "first_name": "x", "last_name": "y"})).status_code == 422
    # yozilish: narx kursdan
    e1 = await ok(await client.post("/enrollments/", headers=M, json={"student_id": ids[0], "group_id": S["g1"]}), 201)
    assert D(e1["price"]) == 500000
    S["enr1"] = e1["id"]
    assert (await client.post("/enrollments/", headers=M, json={"student_id": ids[0], "group_id": S["g1"]})).status_code == 409
    e2 = await ok(await client.post("/enrollments/", headers=M, json={"student_id": ids[1], "group_id": S["g1"], "price": "400000"}), 201)
    S["enr2"] = e2["id"]
    assert (await client.post("/enrollments/", headers=M, json={"student_id": ids[2], "group_id": S["g1"]})).status_code == 409  # to'lgan
    g = await ok(await client.get(f"/groups/{S['g1']}", headers=M))
    assert g["current_students"] == 2
    assert (await ok(await client.get(f"/students/{ids[0]}", headers=M)))["status"] == "active"
    # max_students ni joriy sondan pastga tushirib bo'lmaydi
    assert (await client.put(f"/groups/{S['g1']}", headers=M, json={"max_students": 1})).status_code == 409
    # o'qituvchi o'z o'quvchilarini ko'radi, boshqasini emas
    lst = await ok(await client.get("/students/", headers=S["tch"]))
    assert {s["id"] for s in lst["items"]} == {ids[0], ids[1]}
    assert (await client.get(f"/students/{ids[2]}", headers=S["tch"])).status_code == 403


# ------------------------------------------------------------------ pul oqimi
async def balance(client, sid):
    return D((await ok(await client.get(f"/students/{sid}", headers=S["admin"])))["balance"])


async def ledger_sum(client, sid):
    page = await ok(await client.get(f"/students/{sid}/balance?limit=200", headers=S["admin"]))
    return sum((D(t["amount"]) for t in page["items"]), D(0)), page["items"]


async def test_04_finance(client):
    A, ACC = S["admin"], S["acc"]
    ids = S["st"]
    methods = {m["code"]: m["id"] for m in await ok(await client.get("/payment-methods/", headers=ACC))}
    S["methods"] = methods
    # 2-o'quvchiga 10% chegirma
    await ok(await client.post("/discounts/", headers=ACC, json={
        "student_id": ids[1], "type": "percent", "value": "10", "reason": "Aka-uka"}), 201)
    assert (await client.post("/discounts/", headers=ACC, json={"student_id": ids[1], "type": "percent", "value": "150"})).status_code == 422

    gen = await ok(await client.post("/invoices/generate", headers=ACC, json={"period_month": TODAY.isoformat()}))
    assert gen == {"created": 2, "skipped_existing": 0}
    gen2 = await ok(await client.post("/invoices/generate", headers=ACC, json={"period_month": MONTH.isoformat()}))
    assert gen2 == {"created": 0, "skipped_existing": 2}                  # dublikat yo'q
    invs = {i["student_id"]: i for i in (await ok(await client.get("/invoices/?limit=100", headers=ACC)))["items"]}
    assert D(invs[ids[0]]["total"]) == 500000 and invs[ids[0]]["status"] in ("unpaid", "overdue")
    assert D(invs[ids[1]]["amount"]) == 400000 and D(invs[ids[1]]["discount_amount"]) == 40000
    assert D(invs[ids[1]]["total"]) == 360000
    assert await balance(client, ids[0]) == -500000 and await balance(client, ids[1]) == -360000
    S["inv1"], S["inv2"] = invs[ids[0]]["id"], invs[ids[1]]["id"]

    # qisman to'lov
    p1 = await ok(await client.post("/payments/", headers=ACC, json={
        "student_id": ids[0], "method_id": methods["cash"], "amount": "200000", "invoice_id": S["inv1"]}), 201)
    assert p1["received_by"] is not None and p1["status"] == "completed"
    inv = await ok(await client.get(f"/invoices/{S['inv1']}", headers=ACC))
    assert inv["status"] in ("partial", "overdue") and D(inv["paid_amount"]) == 200000
    assert await balance(client, ids[0]) == -300000
    # to'liq yopish
    p2 = await ok(await client.post("/payments/", headers=ACC, json={
        "student_id": ids[0], "method_id": methods["cash"], "amount": "300000"}), 201)   # invoice_id yo'q -> FIFO
    inv = await ok(await client.get(f"/invoices/{S['inv1']}", headers=ACC))
    assert inv["status"] == "paid" and D(inv["paid_amount"]) == 500000
    assert await balance(client, ids[0]) == 0
    # onlayn to'lov: transaction_id majburiy va takrorlanmaydi
    assert (await client.post("/payments/", headers=ACC, json={
        "student_id": ids[1], "method_id": methods["click"], "amount": "1000"})).status_code == 400
    c1 = await ok(await client.post("/payments/", headers=ACC, json={
        "student_id": ids[1], "method_id": methods["click"], "amount": "100000", "transaction_id": "TX-1"}), 201)
    assert c1["received_by"] is None
    assert (await client.post("/payments/", headers=ACC, json={
        "student_id": ids[1], "method_id": methods["click"], "amount": "5", "transaction_id": "TX-1"})).status_code == 409
    # kutilayotgan to'lov balansga ta'sir qilmaydi, tasdiqlansa qiladi
    b_before = await balance(client, ids[1])
    pend = await ok(await client.post("/payments/", headers=ACC, json={
        "student_id": ids[1], "method_id": methods["click"], "amount": "10000", "transaction_id": "TX-2",
        "status": "pending"}), 201)
    assert await balance(client, ids[1]) == b_before
    await ok(await client.post(f"/payments/{pend['id']}/confirm", headers=ACC))
    assert await balance(client, ids[1]) == b_before + 10000
    # qaytarish
    b_before = await balance(client, ids[1])
    await ok(await client.post(f"/payments/{c1['id']}/refund", headers=ACC))
    assert await balance(client, ids[1]) == b_before - 100000
    assert (await client.post(f"/payments/{c1['id']}/refund", headers=ACC)).status_code == 409   # ikki marta emas

    # oldindan to'lov (avans) -> keyingi oy hisobi avtomatik yopiladi
    await ok(await client.post("/payments/", headers=ACC, json={
        "student_id": ids[0], "method_id": methods["card"], "amount": "700000"}), 201)
    assert await balance(client, ids[0]) == 700000
    nxt = (MONTH + dt.timedelta(days=32)).replace(day=1)
    await ok(await client.post("/invoices/generate", headers=ACC, json={"period_month": nxt.isoformat(), "student_id": ids[0]}))
    assert await balance(client, ids[0]) == 200000
    lst = (await ok(await client.get(f"/invoices/?student_id={ids[0]}&period_month={nxt}", headers=ACC)))["items"]
    assert lst[0]["status"] == "paid"
    # hisobni bekor qilish: pul qaytadi, hisob 'cancelled'
    await ok(await client.post(f"/invoices/{lst[0]['id']}/cancel", headers=ACC, json={"reason": "xato yozilgan"}))
    assert await balance(client, ids[0]) == 700000
    # qo'lda tuzatish
    await ok(await client.post(f"/students/{ids[2]}/balance/adjust", headers=ACC, json={"amount": "-50000", "reason": "eski qarz"}), 201)
    assert await balance(client, ids[2]) == -50000

    # INVARIANT: har bir o'quvchi uchun balance == ledger yig'indisi, balance_after zanjiri izchil
    for sid in ids:
        total, items = await ledger_sum(client, sid)
        assert total == await balance(client, sid), f"student {sid}: ledger {total}"
        assert D(items[0]["balance_after"]) == total
    # RBAC: o'qituvchi moliyani ko'ra olmaydi
    assert (await client.get("/payments/", headers=S["tch"])).status_code == 403
    assert (await client.post(f"/payments/{p1['id']}/refund", headers=S["mgr"])).status_code == 403  # faqat buxgalter/admin

    # xarajat
    cats = await ok(await client.get("/expense-categories/", headers=ACC))
    await ok(await client.post("/expenses/", headers=ACC, json={
        "branch_id": S["b1"], "category_id": cats[0]["id"], "amount": "1000000", "spent_at": TODAY.isoformat()}), 201)
    # audit log yozilganmi
    logs = await ok(await client.get("/audit-logs/?entity_type=payment", headers=A))
    assert logs["total"] >= 3
    assert (await client.get("/audit-logs/", headers=ACC)).status_code == 403


# ------------------------------------------------------------------ darslar, davomat, maosh
async def test_05_sessions_attendance_payroll(client):
    M, T, ACC = S["mgr"], S["tch"], S["acc"]
    d_from, d_to = MONTH, MONTH + dt.timedelta(days=6)      # 1 hafta: 1 ta dushanba + 1 ta chorshanba
    res = await ok(await client.post("/lesson-sessions/generate", headers=M, json={
        "group_id": S["g1"], "date_from": d_from.isoformat(), "date_to": d_to.isoformat()}))
    assert res["created"] == 2 and res["conflicts"] == []
    res = await ok(await client.post("/lesson-sessions/generate", headers=M, json={
        "group_id": S["g1"], "date_from": d_from.isoformat(), "date_to": d_to.isoformat()}))
    assert res["created"] == 0 and res["skipped_existing"] == 2          # idempotent
    sessions = (await ok(await client.get(f"/lesson-sessions/?group_id={S['g1']}", headers=T)))["items"]
    assert len(sessions) == 2
    # to'qnashuv: o'sha o'qituvchi, o'sha vaqt, boshqa guruh
    r = await client.post("/lesson-sessions/", headers=M, json={
        "group_id": S["g2"], "date": sessions[0]["date"], "start_time": "10:15:00", "end_time": "11:00:00"})
    assert r.status_code == 409
    # davomat: guruhga yozilmagan o'quvchi rad etiladi
    sid = sessions[0]["id"]
    r = await client.put(f"/lesson-sessions/{sid}/attendance", headers=T, json={"items": [
        {"student_id": S["st"][2], "status": "present"}]})
    assert r.status_code == 400
    att = await ok(await client.put(f"/lesson-sessions/{sid}/attendance", headers=T, json={"items": [
        {"student_id": S["st"][0], "status": "present"}, {"student_id": S["st"][1], "status": "absent", "note": "kasal"}]}))
    assert len(att) == 2
    assert (await ok(await client.get(f"/lesson-sessions/{sid}", headers=T)))["status"] == "held"   # avtomatik
    # qayta belgilash yangilaydi (dublikat emas)
    att = await ok(await client.put(f"/lesson-sessions/{sid}/attendance", headers=T, json={"items": [
        {"student_id": S["st"][1], "status": "late"}]}))
    assert len((await ok(await client.get(f"/lesson-sessions/{sid}/attendance", headers=T)))) == 2
    # o'qituvchi sana/xonani o'zgartira olmaydi, lekin holatni o'zgartira oladi
    assert (await client.put(f"/lesson-sessions/{sessions[1]['id']}", headers=T, json={"date": TODAY.isoformat()})).status_code == 403
    await ok(await client.put(f"/lesson-sessions/{sessions[1]['id']}", headers=T, json={"status": "held", "topic": "Unit 2"}))
    # o'tilgan darsni o'chirib bo'lmaydi
    assert (await client.delete(f"/lesson-sessions/{sid}", headers=M)).status_code == 409

    # maosh: darsi uchun 100 000
    await ok(await client.post("/salary-rules/", headers=ACC, json={
        "employee_id": S["tch_id"], "type": "per_lesson", "amount": "100000", "effective_from": "2024-01-01"}), 201)
    pr = await ok(await client.post("/payrolls/calculate", headers=ACC, json={"period_month": MONTH.isoformat(), "employee_id": S["tch_id"]}))
    assert pr[0]["lessons_count"] == 2 and D(pr[0]["base_amount"]) == 200000 and D(pr[0]["total"]) == 200000
    pid = pr[0]["id"]
    p = await ok(await client.patch(f"/payrolls/{pid}", headers=ACC, json={"bonus": "50000", "penalty": "10000"}))
    assert D(p["total"]) == 240000
    # qayta hisoblash bonus/jarimani saqlaydi
    pr = await ok(await client.post("/payrolls/calculate", headers=ACC, json={"period_month": MONTH.isoformat(), "employee_id": S["tch_id"]}))
    assert D(pr[0]["total"]) == 240000
    assert (await client.post(f"/payrolls/{pid}/pay", headers=ACC)).status_code == 409   # avval tasdiqlash kerak
    await ok(await client.post(f"/payrolls/{pid}/approve", headers=ACC))
    paid = await ok(await client.post(f"/payrolls/{pid}/pay", headers=ACC))
    assert paid["status"] == "paid" and paid["paid_at"]
    assert (await client.patch(f"/payrolls/{pid}", headers=ACC, json={"bonus": "1"})).status_code == 409
    # o'qituvchi faqat o'z maoshini ko'radi
    mine = await ok(await client.get("/payrolls/", headers=T))
    assert mine["total"] == 1
    assert (await client.get("/payrolls/", headers=S["tch2"])).json()["total"] == 0


# ------------------------------------------------------------------ imtihon va sertifikat
async def test_06_exams_certificates(client):
    M, T = S["mgr"], S["tch"]
    ex = await ok(await client.post("/exams/", headers=T, json={
        "group_id": S["g1"], "title": "Final", "type": "final", "max_score": 100, "passing_score": 60}), 201)
    st = S["st"]
    r = await client.put(f"/exams/{ex['id']}/results", headers=T, json={"results": [{"student_id": st[0], "score": "150"}]})
    assert r.status_code == 400                                          # max_score dan oshdi
    res = await ok(await client.put(f"/exams/{ex['id']}/results", headers=T, json={"results": [
        {"student_id": st[0], "score": "88.5"}, {"student_id": st[1], "score": "40"}]}))
    assert {r["student_id"]: r["passed"] for r in res} == {st[0]: True, st[1]: False}
    # guruh hali tugamagan
    r = await client.post("/certificates/", headers=M, json={"student_id": st[0], "group_id": S["g1"]})
    assert r.status_code == 400
    await ok(await client.put(f"/groups/{S['g1']}", headers=M, json={"status": "completed"}))
    assert (await client.post("/certificates/", headers=M, json={"student_id": st[1], "group_id": S["g1"]})).status_code == 400  # o'tmagan
    cert = await ok(await client.post("/certificates/", headers=M, json={"student_id": st[0], "group_id": S["g1"]}), 201)
    assert cert["serial_number"].startswith("MAIN-") and cert["serial_number"].endswith("-00001")
    assert (await client.post("/certificates/", headers=M, json={"student_id": st[0], "group_id": S["g1"]})).status_code == 409
    v = await ok(await client.get(f"/certificates/verify/{cert['serial_number']}"))          # tokensiz
    assert v["valid"] and v["student_name"] == "Ali Karimov" and v["course_name"] == "Ingliz tili"
    assert (await ok(await client.get("/certificates/verify/FAKE-1")))["valid"] is False


# ------------------------------------------------------------------ CRM
async def test_07_crm(client):
    M = S["mgr"]
    src = await ok(await client.post("/lead-sources/", headers=M, json={"name": "Instagram", "monthly_budget": "2000000"}), 201)
    lead = await ok(await client.post("/leads/", headers=M, json={
        "branch_id": S["b1"], "first_name": "Nodira", "phone": "93 111 22 33", "source_id": src["id"],
        "assigned_to": S["mgr_id"]}), 201)
    assert lead["phone"] == "+998931112233"
    statuses = {s["name"]: s for s in await ok(await client.get("/lead-statuses/", headers=M))}
    assert lead["status_id"] == statuses["Yangi"]["id"]
    assert (await client.post("/leads/", headers=M, json={"branch_id": S["b1"], "first_name": "X", "phone": "+998931112233"})).status_code == 409
    await ok(await client.post(f"/leads/{lead['id']}/activities", headers=M, json={"type": "call", "result": "Qiziqdi"}), 201)
    # yo'qotilgan -> sabab majburiy
    lost = statuses["Yo'qotildi"]["id"]
    assert (await client.patch(f"/leads/{lead['id']}/status", headers=M, json={"status_id": lost})).status_code == 400
    await ok(await client.patch(f"/leads/{lead['id']}/status", headers=M, json={"status_id": lost, "lost_reason": "Qimmat"}))
    await ok(await client.patch(f"/leads/{lead['id']}/status", headers=M, json={"status_id": statuses["Bog'lanildi"]["id"]}))
    # 'Yozildi' ga faqat convert orqali
    assert (await client.patch(f"/leads/{lead['id']}/status", headers=M, json={"status_id": statuses["Yozildi"]["id"]})).status_code == 400
    # konvertatsiya (familiya kerak), guruhga ham yoziladi
    assert (await client.post(f"/leads/{lead['id']}/convert", headers=M, json={})).status_code == 400
    conv = await ok(await client.post(f"/leads/{lead['id']}/convert", headers=M, json={
        "last_name": "Rustamova", "group_id": S["g2"]}), 201)
    assert conv["status"] == "active" and conv["enrollment_id"] and conv["lead_id"] == lead["id"]
    assert (await client.post(f"/leads/{lead['id']}/convert", headers=M, json={"last_name": "x"})).status_code == 409
    done = await ok(await client.get(f"/leads/{lead['id']}", headers=M))
    assert done["student_id"] == conv["id"] and done["status_id"] == statuses["Yozildi"]["id"]
    # vazifa + bildirishnoma
    await ok(await client.post("/tasks/", headers=M, json={"title": "Qayta qo'ng'iroq", "lead_id": lead["id"],
                                                          "assigned_to": S["acc_id"]}), 201)
    n = await ok(await client.get("/notifications/?unread_only=true", headers=S["acc"]))
    assert n["total"] == 1
    await ok(await client.patch(f"/notifications/{n['items'][0]['id']}/read", headers=S["acc"]))
    assert (await ok(await client.get("/notifications/unread-count", headers=S["acc"])))["unread"] == 0
    assert (await client.get("/leads/", headers=S["tch"])).status_code == 403
    # sinov darsi
    tr = await ok(await client.post("/trial-lessons/", headers=M, json={
        "lead_id": lead["id"], "group_id": S["g2"], "scheduled_at": f"{TODAY}T10:00:00"}), 201)
    await ok(await client.patch(f"/trial-lessons/{tr['id']}/result", headers=M, json={"attended": True, "feedback": "yaxshi"}))


# ------------------------------------------------------------------ SMS, fayl, hisobot
async def test_08_sms_files_reports(client):
    M, ACC = S["mgr"], S["acc"]
    s = await ok(await client.post("/sms/send", headers=ACC, json={
        "student_id": S["st"][2], "template_code": "payment_reminder"}), 201)
    assert s["status"] == "sent" and "50000" in s["body"] and "Gulnora" in s["body"]
    m = await ok(await client.post("/sms/debt-reminders", headers=ACC, json={}))
    assert "SMS yuborildi" in m["msg"]
    assert (await client.post("/sms/send", headers=ACC, json={"student_id": 1, "lead_id": 1, "body": "x"})).status_code == 422

    up = await client.post("/attachments/", headers=M, data={"entity_type": "student", "entity_id": str(S["st"][0])},
                           files={"file": ("shartnoma.pdf", b"%PDF-1.4 test", "application/pdf")})
    att = await ok(up, 201)
    dl = await client.get(f"/attachments/{att['id']}/download", headers=M)
    assert dl.status_code == 200 and dl.content.startswith(b"%PDF")
    bad = await client.post("/attachments/", headers=M, data={"entity_type": "student", "entity_id": str(S["st"][0])},
                            files={"file": ("virus.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 400

    dash = await ok(await client.get("/reports/dashboard", headers=ACC))
    assert dash["students_active"] >= 2 and D(str(dash["debt_total"])) > 0
    assert D(str(dash["expenses_this_month"])) == 1000000
    assert len((await ok(await client.get("/reports/debtors", headers=ACC)))) >= 1
    fun = await ok(await client.get("/reports/lead-funnel", headers=ACC))
    assert sum(x["count"] for x in fun["stages"]) == 1
    src = await ok(await client.get("/reports/lead-sources", headers=ACC))
    assert any(x["name"] == "Instagram" and x["won"] == 1 for x in src["sources"])
    ie = await ok(await client.get("/reports/income-expense", headers=ACC))
    assert D(str(ie["expenses"])) == 1000000


# ------------------------------------------------------------------ ishdan bo'shatish
async def test_09_fire(client):
    A = S["admin"]
    await ok(await client.post(f"/employees/{S['tch2_id']}/fire", headers=A, json={}))
    r = await client.post("/auth/login", data={"username": "+998900000004", "password": "Passw0rd!!"})
    assert r.status_code == 403                                           # bo'shatilgan kira olmaydi
    assert (await client.get("/auth/me", headers=S["tch2"])).status_code == 401   # eski token ham ishlamaydi
    await ok(await client.post(f"/employees/{S['tch2_id']}/reactivate", headers=A))
    assert (await client.post("/auth/login", data={"username": "+998900000004", "password": "Passw0rd!!"})).status_code == 200
