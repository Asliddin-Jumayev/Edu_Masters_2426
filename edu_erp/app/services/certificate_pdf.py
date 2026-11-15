"""Sertifikat PDF (A4 albom). Shriftlar loyiha ichida (app/assets/fonts) — serverga bog'liq emas, oʻ/gʻ belgilari to'g'ri chiqadi."""
import datetime as dt
from io import BytesIO
from pathlib import Path
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"
INK, BRAND, MARK, MUTED, LINE = HexColor("#19214F"), HexColor("#2B3A9C"), HexColor("#FFDF4D"), HexColor("#5B6488"), HexColor("#D8DCEC")
_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
_registered = False


def _fonts():
    global _registered
    if not _registered:
        for name, file in (("Sans", "DejaVuSans.ttf"), ("Sans-B", "DejaVuSans-Bold.ttf"), ("Serif", "DejaVuSerif.ttf"), ("Serif-B", "DejaVuSerif-Bold.ttf")):
            pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
        _registered = True


def uz_date(d: dt.date) -> str:
    return f"{d.year}-yil {d.day}-{_MONTHS[d.month - 1]}"


def _spaced_center(c: canvas.Canvas, text: str, cx: float, y: float, font: str, size: float, space: float):
    w = pdfmetrics.stringWidth(text, font, size) + space * (len(text) - 1)
    c.saveState()  # harf oralig'i (Tc) grafik holatga tegishli — keyingi matnlarga o'tib ketmasin
    t = c.beginText(cx - w / 2, y)
    t.setFont(font, size)
    t.setCharSpace(space)
    t.textOut(text)
    c.drawText(t)
    c.restoreState()


def build_certificate_pdf(*, student_name: str, course_name: str, group_name: str, serial: str, issued_at: dt.date,
                          center_name: str, branch_name: str, verify_url: str, teacher_name: str | None = None) -> bytes:
    _fonts()
    W, H = landscape(A4)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(W, H))
    c.setTitle(f"Sertifikat {serial}")
    c.setAuthor(center_name)
    c.setSubject(f"{student_name} — {course_name}")
    cx = W / 2

    # ramka: qalin siyoh-ko'k + ingichka ichki, burchaklarda marker kvadratlari
    c.setFillColor(HexColor("#FBFCFF"))
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setStrokeColor(INK); c.setLineWidth(3); c.rect(22, 22, W - 44, H - 44)
    c.setStrokeColor(BRAND); c.setLineWidth(0.8); c.rect(31, 31, W - 62, H - 62)
    c.setFillColor(MARK)
    for x, y in ((22, 22), (W - 22, 22), (22, H - 22), (W - 22, H - 22)):
        c.rect(x - 9, y - 9, 18, 18, stroke=0, fill=1)

    # sarlavha
    c.setFillColor(INK)
    _spaced_center(c, center_name.upper(), cx, H - 78, "Sans-B", 13, 3.2)
    c.setFillColor(MUTED); c.setFont("Sans", 10)
    c.drawCentredString(cx, H - 94, branch_name)
    c.setFillColor(INK)
    _spaced_center(c, "SERTIFIKAT", cx, H - 160, "Serif-B", 54, 7)
    c.setFillColor(MUTED); c.setFont("Serif", 14)
    c.drawCentredString(cx, H - 190, "ushbu sertifikat egasiga topshiriladi")

    # ism: avtomatik kichraytiriladi, ostida marker surtmasi
    size = 40
    while size > 20 and pdfmetrics.stringWidth(student_name, "Serif-B", size) > W - 220:
        size -= 1
    name_w = pdfmetrics.stringWidth(student_name, "Serif-B", size)
    base = H - 252
    x0, x1 = cx - name_w / 2 - 18, cx + name_w / 2 + 18
    p = c.beginPath()
    p.moveTo(x0, base - 2); p.lineTo(x1, base - 5); p.lineTo(x1 + 4, base + size * 0.42); p.lineTo(x0 - 3, base + size * 0.36); p.close()
    c.setFillColor(MARK); c.drawPath(p, stroke=0, fill=1)
    c.setFillColor(INK); c.setFont("Serif-B", size)
    c.drawCentredString(cx, base + 6, student_name)

    # kurs
    c.setFont("Serif", 16)
    y = base - 42
    for line in simpleSplit(f"«{course_name}» kursini muvaffaqiyatli tamomlagani uchun", "Serif", 16, W - 150):
        c.drawCentredString(cx, y, line)
        y -= 24
    c.setFillColor(MUTED); c.setFont("Sans", 11)
    c.drawCentredString(cx, y - 6, f"Guruh: {group_name}   ·   Berilgan sana: {uz_date(issued_at)}")

    # pastki qism: imzo, QR, imzo
    bottom = 92
    c.setStrokeColor(INK); c.setLineWidth(0.8)
    c.line(90, bottom, 270, bottom); c.line(W - 270, bottom, W - 90, bottom)
    c.setFillColor(MUTED); c.setFont("Sans", 9.5)
    c.drawCentredString(180, bottom - 14, "Oʻquv markazi direktori")
    c.drawCentredString(W - 180, bottom - 14, "Oʻqituvchi" + (f": {teacher_name}" if teacher_name else ""))

    w = qr.QrCodeWidget(verify_url)
    b = w.getBounds()
    qs = 74
    d = Drawing(qs, qs, transform=[qs / (b[2] - b[0]), 0, 0, qs / (b[3] - b[1]), 0, 0])
    d.add(w)
    renderPDF.draw(d, c, cx - qs / 2, bottom - 20)
    c.setFillColor(INK); c.setFont("Sans-B", 10)
    c.drawCentredString(cx, bottom - 34, f"№ {serial}")
    c.setFillColor(MUTED); c.setFont("Sans", 7.5)
    c.drawCentredString(cx, bottom - 45, "Haqiqiyligini tekshirish: QR kodni skanerlang")
    c.drawCentredString(cx, bottom - 55, verify_url)

    c.showPage()
    c.save()
    return buf.getvalue()
