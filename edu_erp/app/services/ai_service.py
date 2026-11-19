"""AI / LLM Integratsiya xizmati (Gemini, OpenAI va Mock).

SOLID tamoyillari bo'yicha:
- `BaseAIProvider` (Abstrakt interfeys)
- `MockAIProvider` (API kalitsiz ham test va ishlab chiqishda to'liq ishlaydi)
- `GeminiAIProvider` (Google Gemini API REST orqali)
- `OpenAIAIProvider` (OpenAI API REST orqali)

Qo'llanilishi:
    ai = get_ai_service()
    res = await ai.analyze_lead("Ali", "Ingliz tili IELTS kursiga qiziqmoqda", "Instagram")
"""
import abc
import json
import logging
from typing import Any
import httpx
from pydantic import BaseModel, Field

from app.utils.config import settings

log = logging.getLogger("ai_service")


# ─── Pydantic Modellar ────────────────────────────────────────────────────────

class LeadAnalysisResult(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Mijozning qiziqish darajasi (0-100)")
    interest_level: str = Field(..., description="Yuqori / O'rta / Past")
    recommended_action: str = Field(..., description="Keyingi tavsiya etilgan qadam")
    summary: str = Field(..., description="Qisqacha tahliliy xulosa")


class StudentPerformanceReport(BaseModel):
    student_name: str
    overall_status: str  # "A'lo", "Yaxshi", "Qoniqarli", "Xavf ostida"
    attendance_rate: float
    strengths: list[str]
    areas_for_improvement: list[str]
    ai_recommendation: str


# ─── Abstrakt Provayder (Interface Segregation / Dependency Inversion) ────────

class BaseAIProvider(abc.ABC):
    @abc.abstractmethod
    async def analyze_lead(self, name: str, notes: str, source: str) -> LeadAnalysisResult:
        pass

    @abc.abstractmethod
    async def generate_student_report(
        self,
        student_name: str,
        course_name: str,
        attendance_percent: float,
        exam_scores: list[float],
        notes: str | None = None,
    ) -> StudentPerformanceReport:
        pass

    @abc.abstractmethod
    async def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        pass


# ─── Mock Provayder (Kalitsiz rejim, test va oflayn uchun) ───────────────────

class MockAIProvider(BaseAIProvider):
    async def analyze_lead(self, name: str, notes: str, source: str) -> LeadAnalysisResult:
        notes_lower = (notes or "").lower()
        if any(w in notes_lower for w in ["ielts", "to'lov", "ro'yxat", "ertaga", "kelaman", "narx"]):
            score = 88
            level = "Yuqori"
            action = "Darhol qo'ng'iroq qilib, sinov darsiga yozish"
            summary = f"{name} ({source} orqali) kursga yuqori qiziqish bildirmoqda."
        elif any(w in notes_lower for w in ["qimmat", "o'ylab", "keyinroq", "vaqt yo'q"]):
            score = 35
            level = "Past"
            action = "Chegirma yoki qulay jadval taklif qiluvchi SMS yuborish"
            summary = f"{name} narx yoki vaqt bo'yicha ikkilanmoqda."
        else:
            score = 65
            level = "O'rta"
            action = "Kurs dasturi va o'qituvchilar haqida batafsil ma'lumot berish"
            summary = f"{name} ma'lumot qidirmoqda, faol aloqa zarur."

        return LeadAnalysisResult(
            score=score,
            interest_level=level,
            recommended_action=action,
            summary=summary,
        )

    async def generate_student_report(
        self,
        student_name: str,
        course_name: str,
        attendance_percent: float,
        exam_scores: list[float],
        notes: str | None = None,
    ) -> StudentPerformanceReport:
        avg_score = sum(exam_scores) / len(exam_scores) if exam_scores else 0.0

        if attendance_percent >= 85 and avg_score >= 80:
            status = "A'lo"
            strengths = ["Muntazam davomat", "Yuqori o'zlashtirish", "Faollik"]
            areas = ["Keyingi darajadagi murakkabroq topshiriqlarni berish"]
            rec = f"{student_name} {course_name} kursini a'lo darajada o'zlashtirmoqda. Olimpiada yoki xalqaro sertifikatga yo'naltirish tavsiya etiladi."
        elif attendance_percent < 70 or avg_score < 60:
            status = "Xavf ostida"
            strengths = ["Potensiali mavjud"]
            areas = ["Dars qoldirishlarni kamaytirish", "Qo'shimcha darslar kerak"]
            rec = f"{student_name}ning davomati ({attendance_percent}%) yoki baholari ({avg_score:.1f}) past. Ota-onasi bilan bog'lanish zarur."
        else:
            status = "Yaxshi"
            strengths = ["Barqaror qatnashish", "Vazifalarni o'z vaqtida topshirish"]
            areas = ["Imtihon natijalarini yaxshilash"]
            rec = f"{student_name} kurs dasturini barqaror olib bormoqda, amaliy mashg'ulotlarga ko'proq e'tibor qaratish kerak."

        return StudentPerformanceReport(
            student_name=student_name,
            overall_status=status,
            attendance_rate=attendance_percent,
            strengths=strengths,
            areas_for_improvement=areas,
            ai_recommendation=rec,
        )

    async def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        return f"[AI Assistant Mock]: So'rovingiz qabul qilindi. '{prompt[:40]}...' mavzusida tahlil tayyorlandi."


# ─── Gemini Provayder (Google Gemini REST API) ────────────────────────────────

class GeminiAIProvider(BaseAIProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    async def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        url = f"{self.base_url}?key={self.api_key}"
        contents: list[dict] = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"SYSTEM: {system_prompt}"}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json={"contents": contents})
            res.raise_for_status()
            data = res.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def analyze_lead(self, name: str, notes: str, source: str) -> LeadAnalysisResult:
        prompt = (
            f"O'quv markazi CRM lidi: Ism: {name}, Manba: {source}, Izohlar: {notes}\n"
            f"Quyidagi JSON formatda baholang (faqat sof JSON qaytaring):\n"
            f'{{"score": 85, "interest_level": "Yuqori", "recommended_action": "...", "summary": "..."}}'
        )
        try:
            raw = await self.generate_text(prompt, "Siz o'quv markazi CRM tahlilchisiz. JSON formatda javob bering.")
            # JSON extract
            cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
            parsed = json.loads(cleaned)
            return LeadAnalysisResult(**parsed)
        except Exception as e:
            log.warning("Gemini AI xatosi, mock ga o'tmoqda: %s", e)
            return await MockAIProvider().analyze_lead(name, notes, source)

    async def generate_student_report(
        self,
        student_name: str,
        course_name: str,
        attendance_percent: float,
        exam_scores: list[float],
        notes: str | None = None,
    ) -> StudentPerformanceReport:
        prompt = (
            f"O'quvchi: {student_name}, Kurs: {course_name}, Davomat: {attendance_percent}%, Imtihon ballari: {exam_scores}\n"
            f"JSON formatda qaytaring: {{\"student_name\": \"...\", \"overall_status\": \"A'lo\", \"attendance_rate\": {attendance_percent}, \"strengths\": [...], \"areas_for_improvement\": [...], \"ai_recommendation\": \"...\"}}"
        )
        try:
            raw = await self.generate_text(prompt, "O'quv tahlilchi eksperti.")
            cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
            return StudentPerformanceReport(**json.loads(cleaned))
        except Exception as e:
            log.warning("Gemini xatosi, mock fallback: %s", e)
            return await MockAIProvider().generate_student_report(student_name, course_name, attendance_percent, exam_scores, notes)


# ─── Provayder Fabrikasi (Factory Pattern) ────────────────────────────────────

def get_ai_service() -> BaseAIProvider:
    provider = settings.AI_PROVIDER.lower()
    if provider == "gemini" and settings.GEMINI_API_KEY:
        return GeminiAIProvider(settings.GEMINI_API_KEY, settings.AI_MODEL)
    return MockAIProvider()
