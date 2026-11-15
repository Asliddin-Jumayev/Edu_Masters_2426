"""Demo ma'lumotlar: ishlayotgan backendga API orqali yozadi (UI ni to'ldirilgan holda ko'rish uchun).
Ishlatish:  python scripts/demo_data.py  [--url http://localhost:8000] [--phone +998901112233] [--password ...]
Xodimlar paroli: Demo12345"""
import argparse
import datetime as dt
import sys

import httpx

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://localhost:8000")
ap.add_argument("--phone", default="+998901112233")
ap.add_argument("--password", default="AdminPass123")
a = ap.parse_args()

c = httpx.Client(base_url=a.url, timeout=30)
r = c.post("/auth/login", data={"username": a.phone, "password": a.password})
r.raise_for_status()
c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"


def call(method, path, **kw):
    r = c.request(method, path, **kw)
    if r.status_code >= 400:
        sys.exit(f"{method} {path} -> {r.status_code}: {r.text}")
    return r.json()


today = dt.date.today()
month = today.replace(day=1)
branch = call("GET", "/branches/")[0]["id"]
roles = {x["code"]: x["id"] for x in call("GET", "/roles/")}

staff = {}
for key, first, last, phone, role, pos in [
    ("mgr", "Dilshod", "Karimov", "+998900000001", "manager", "Menejer"),
    ("acc", "Malika", "Yusupova", "+998900000002", "accountant", "Buxgalter"),
    ("t1", "Sardor", "Rahimov", "+998900000003", "teacher", "Ingliz tili o'qituvchisi"),
    ("t2", "Nigora", "Aliyeva", "+998900000004", "teacher", "Matematika o'qituvchisi"),
]:
    e = call("POST", "/employees/", json={"branch_id": branch, "first_name": first, "last_name": last, "phone": phone, "email": f"{key}@example.uz",
                                          "password": "Demo12345", "position": pos, "hired_at": "2024-09-01"})
    call("POST", "/employee-roles/", json={"employee_id": e["id"], "role_id": roles[role], "branch_id": branch})
    staff[key] = e["id"]
for t in ("t1", "t2"):
    call("POST", "/teacher-profiles/", json={"employee_id": staff[t], "specialization": "Umumiy", "experience_years": 5, "max_groups": 4})

courses = {n: call("POST", "/courses/", json={"name": n, "duration_months": 6, "lessons_count": 72, "price": p})["id"]
           for n, p in [("Ingliz tili", "500000"), ("Matematika", "400000"), ("IELTS", "800000")]}
rooms = [call("POST", "/rooms/", json={"branch_id": branch, "name": n, "capacity": cap})["id"] for n, cap in [("101-xona", 12), ("102-xona", 8), ("Katta zal", 20)]]

groups = []
for name, course, teacher, room, days in [
    ("Ingliz tili A1 — 18:00", "Ingliz tili", "t1", rooms[0], (1, 3, 5)),
    ("Matematika 9-sinf", "Matematika", "t2", rooms[1], (2, 4)),
    ("IELTS Intensive", "IELTS", "t1", rooms[2], (2, 4)),
]:
    g = call("POST", "/groups/", json={"branch_id": branch, "course_id": courses[course], "name": name, "teacher_id": staff[teacher],
                                       "room_id": room, "max_students": 8, "status": "active", "start_date": month.isoformat()})
    for d in days:
        hour = "18:00:00" if name.startswith("Ingliz") else "16:00:00" if name.startswith("Mat") else "10:00:00"
        end = "19:30:00" if name.startswith("Ingliz") else "17:30:00" if name.startswith("Mat") else "11:30:00"
        call("POST", f"/groups/{g['id']}/schedules", json={"weekday": d, "start_time": hour, "end_time": end})
    call("POST", "/lesson-sessions/generate", json={"group_id": g["id"], "date_from": month.isoformat(), "date_to": (today + dt.timedelta(days=14)).isoformat()})
    groups.append(g["id"])

names = [("Aziza", "Karimova"), ("Bobur", "Tursunov"), ("Gulnora", "Saidova"), ("Jasur", "Ismoilov"), ("Madina", "Ergasheva"), ("Otabek", "Normatov"),
         ("Sevara", "Qodirova"), ("Timur", "Abdullayev"), ("Umida", "Nazarova"), ("Farhod", "Xolmatov"), ("Zilola", "Rashidova"), ("Shaxzod", "Mirzayev")]
students = []
for i, (fn, ln) in enumerate(names):
    s = call("POST", "/students/", json={"branch_id": branch, "first_name": fn, "last_name": ln, "parent_phone": f"90 123 45 {i:02d}", "phone": f"91 234 56 {i:02d}"})
    students.append(s["id"])
    call("POST", "/enrollments/", json={"student_id": s["id"], "group_id": groups[i % 3]})
call("POST", "/discounts/", json={"student_id": students[1], "type": "percent", "value": "10", "reason": "Aka-uka"})
call("POST", "/invoices/generate", json={"period_month": month.isoformat()})
methods = {m["code"]: m["id"] for m in call("GET", "/payment-methods/")}
for sid, amt in [(students[0], "500000"), (students[3], "200000"), (students[4], "500000"), (students[6], "100000")]:
    call("POST", "/payments/", json={"student_id": sid, "method_id": methods["cash"], "amount": amt})

# darslarni o'tkazilgan deb belgilash va davomat
sessions = call("GET", f"/lesson-sessions/?group_id={groups[0]}&date_to={today}&limit=3")["items"]
for ses in sessions:
    stu = call("GET", f"/groups/{groups[0]}/students")
    call("PUT", f"/lesson-sessions/{ses['id']}/attendance", json={"items": [{"student_id": x["id"], "status": "present" if k % 3 else "absent"} for k, x in enumerate(stu)]})

# CRM
sources = {n: call("POST", "/lead-sources/", json={"name": n, "monthly_budget": b})["id"] for n, b in [("Instagram", "2000000"), ("Telegram", "1000000"), ("Tanishlar tavsiyasi", "0")]}
status = {s["name"]: s["id"] for s in call("GET", "/lead-statuses/")}
for i, (fn, phone, src, st) in enumerate([("Nodira", "93 111 22 33", "Instagram", "Yangi"), ("Anvar", "93 222 33 44", "Instagram", "Yangi"), ("Laylo", "93 333 44 55", "Telegram", "Bog'lanildi"),
                                          ("Rustam", "93 444 55 66", "Tanishlar tavsiyasi", "Sinov darsiga yozildi"), ("Kamola", "93 555 66 77", "Instagram", "Bog'lanildi")]):
    lead = call("POST", "/leads/", json={"branch_id": branch, "first_name": fn, "phone": phone, "source_id": sources[src], "assigned_to": staff["mgr"], "comment": "Ingliz tiliga qiziqadi"})
    if st != "Yangi":
        call("PATCH", f"/leads/{lead['id']}/status", json={"status_id": status[st]})
    call("POST", f"/leads/{lead['id']}/activities", json={"type": "call", "result": "Qiziqdi", "note": "Ertaga qayta qo'ng'iroq"})
call("POST", "/tasks/", json={"title": "Ota-onasiga qo'ng'iroq qilish", "student_id": students[3], "assigned_to": staff["mgr"], "priority": "high"})

# moliya
cats = call("GET", "/expense-categories/")
for cat, amt in zip(cats[:3], ["3000000", "800000", "1200000"]):
    call("POST", "/expenses/", json={"branch_id": branch, "category_id": cat["id"], "amount": amt, "spent_at": today.isoformat()})
for t in ("t1", "t2"):
    call("POST", "/salary-rules/", json={"employee_id": staff[t], "type": "per_lesson", "amount": "120000", "effective_from": "2024-09-01"})
print(f"Demo ma'lumotlar tayyor: {len(students)} o'quvchi, {len(groups)} guruh. Xodimlar paroli: Demo12345")
