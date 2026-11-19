"""Excel eksport xizmati (openpyxl).

Qarzdorlar ro'yxati, moliyaviy hisobotlar va tahliliy jadvallarni
formatlangan professional Excel (.xlsx) fayl sifatida generatsiya qiladi.
"""
import io
import datetime as dt
from decimal import Decimal
from typing import Any, Sequence

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


def _header_style():
    fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")  # To'q ko'k
    font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="medium", color="0F172A"),
    )
    return fill, font, align, border


def _cell_border():
    return Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )


def export_debtors_to_excel(debtors: Sequence[dict[str, Any]], center_name: str = "Edu Masters") -> bytes:
    """Qarzdorlar ro'yxatini chiroyli formatlangan Excel faylga aylantiradi."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Qarzdorlar"

    # Sarlavha
    ws.merge_cells("A1:E1")
    title_cell = ws["A1"]
    title_cell.value = f"{center_name} — Qarzdor O'quvchilar Ro'yxati"
    title_cell.font = Font(name="Segoe UI", size=15, bold=True, color="1E3A8A")
    title_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[1].height = 30

    # Sana
    ws["A2"] = f"Hisobot shakllantirilgan sana: {dt.datetime.now().strftime('%d.%m.%Y %H:%M')}"
    ws["A2"].font = Font(name="Segoe UI", size=9, italic=True, color="64748B")
    ws.row_dimensions[2].height = 18

    # Ustun sarlavhalari
    headers = ["№", "O'quvchi F.I.Sh", "Telefon", "Ota-onasi telefoni", "Qarzdorlik (so'm)"]
    h_fill, h_font, h_align, h_border = _header_style()

    ws.row_dimensions[4].height = 26
    for col_idx, text in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_idx, value=text)
        cell.fill = h_fill
        cell.font = h_font
        cell.alignment = h_align
        cell.border = h_border

    # Ma'lumot qatorlari
    b_border = _cell_border()
    num_font = Font(name="Segoe UI", size=10)
    text_font = Font(name="Segoe UI", size=10)
    debt_font = Font(name="Segoe UI", size=10, bold=True, color="DC2626")  # Qizil qarz

    total_debt = Decimal("0")
    start_row = 5

    for idx, d in enumerate(debtors, 1):
        r = start_row + idx - 1
        ws.row_dimensions[r].height = 22
        debt_val = Decimal(str(d.get("debt", 0)))
        total_debt += debt_val

        c1 = ws.cell(row=r, column=1, value=idx)
        c1.alignment = Alignment(horizontal="center", vertical="center")
        c1.font = num_font
        c1.border = b_border

        c2 = ws.cell(row=r, column=2, value=d.get("name", ""))
        c2.alignment = Alignment(horizontal="left", vertical="center")
        c2.font = text_font
        c2.border = b_border

        c3 = ws.cell(row=r, column=3, value=d.get("phone", "") or "-")
        c3.alignment = Alignment(horizontal="center", vertical="center")
        c3.font = num_font
        c3.border = b_border

        c4 = ws.cell(row=r, column=4, value=d.get("parent_phone", "") or "-")
        c4.alignment = Alignment(horizontal="center", vertical="center")
        c4.font = num_font
        c4.border = b_border

        c5 = ws.cell(row=r, column=5, value=float(debt_val))
        c5.alignment = Alignment(horizontal="right", vertical="center")
        c5.font = debt_font
        c5.number_format = '#,##0 "so\'m"'
        c5.border = b_border

    # Jami qator
    end_row = start_row + len(debtors)
    ws.row_dimensions[end_row].height = 24
    ws.merge_cells(start_row=end_row, start_column=1, end_row=end_row, end_column=4)
    total_lbl = ws.cell(row=end_row, column=1, value="JAMI QARZDORLIK:")
    total_lbl.font = Font(name="Segoe UI", size=11, bold=True)
    total_lbl.alignment = Alignment(horizontal="right", vertical="center")

    total_val = ws.cell(row=end_row, column=5, value=float(total_debt))
    total_val.font = Font(name="Segoe UI", size=11, bold=True, color="DC2626")
    total_val.alignment = Alignment(horizontal="right", vertical="center")
    total_val.number_format = '#,##0 "so\'m"'
    total_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    total_lbl.fill = total_fill
    total_val.fill = total_fill

    # Ustun kengliklarini avtomatik to'g'irlash
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
