"""AI / LLM router — o'quv markazi xodimlari uchun sun'iy intellekt xizmatlari."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.services.ai_service import (
    LeadAnalysisResult,
    StudentPerformanceReport,
    get_ai_service,
)
from app.utils.permissions import AuthUser

router = APIRouter(prefix="/ai", tags=["AI & LLM"])


class LeadAnalysisRequest(BaseModel):
    name: str = Field(..., example="Nodira Rustamova")
    notes: str = Field(..., example="IELTS kursiga yozilmoqchi, haftada 3 kun soat 18:00 dan keyin qulay")
    source: str = Field(default="Instagram", example="Instagram")


class StudentReportRequest(BaseModel):
    student_name: str = Field(..., example="Ali Karimov")
    course_name: str = Field(..., example="General English Intermediate")
    attendance_percent: float = Field(..., ge=0, le=100, example=92.5)
    exam_scores: list[float] = Field(default_factory=list, example=[85.0, 90.0, 88.5])
    notes: str | None = Field(default=None, example="Uy vazifalarini doimiy bajaradi")


class AskAssistantRequest(BaseModel):
    prompt: str = Field(..., example="O'quv markazida qarzdorlikni kamaytirish bo'yicha 3 ta amaliy maslahat bering")


@router.post("/analyze-lead", response_model=LeadAnalysisResult, summary="Lidni AI orqali tahlil qilish")
async def analyze_lead_endpoint(data: LeadAnalysisRequest, user: AuthUser):
    """
    CRM lidi matnini tahlil qilib, qiziqish darajasini (score 0-100),
    qiziqish darajasini va eng maqbul keyingi qadamni belgilaydi.
    """
    ai = get_ai_service()
    return await ai.analyze_lead(data.name, data.notes, data.source)


@router.post("/student-report", response_model=StudentPerformanceReport, summary="O'quvchi ko'rsatkichlarini AI tahlili")
async def student_report_endpoint(data: StudentReportRequest, user: AuthUser):
    """
    O'quvchining davomati va imtihon natijalari asosida
    kuchli tomonlari, rivojlantirish kerak bo'lgan sohalari va AI tavsiyalarini shakllantiradi.
    """
    ai = get_ai_service()
    return await ai.generate_student_report(
        student_name=data.student_name,
        course_name=data.course_name,
        attendance_percent=data.attendance_percent,
        exam_scores=data.exam_scores,
        notes=data.notes,
    )


@router.post("/assistant", summary="O'quv markazi AI yordamchisi")
async def assistant_endpoint(data: AskAssistantRequest, user: AuthUser):
    """Xodimlar uchun universal AI maslahatchi."""
    ai = get_ai_service()
    answer = await ai.generate_text(
        prompt=data.prompt,
        system_prompt="Siz tajribali o'quv markazi boshqaruvchisi va metodistisiz.",
    )
    return {"prompt": data.prompt, "response": answer}
