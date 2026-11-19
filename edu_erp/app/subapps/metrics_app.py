"""Sub-applications va Mounting hamda Custom Response klasslari.

FastAPI da mustaqil sub-ilovalarni (`app.mount`) ulash:
- Sub-app o'zining Swagger dokumentatsiyasi, middleware va routerlariga ega bo'ladi
- Katta loyihalarni modullashtirish uchun qulay (masalan alohida admin yoki monitoring portali)

Custom Response klasslari:
- `PrettyJSONResponse`: JSON ni formatlab (indent=2) qaytaradi
- `XMLResponse`: Tashqi integratsiyalar yoki eski tizimlar uchun XML javob qaytaradi
"""
import json
from typing import Any
from fastapi import FastAPI, Response
from starlette.responses import Response

# ─── Custom Response klasslari ───────────────────────────────────────────────

class PrettyJSONResponse(Response):
    """JSON javobini 2 probel bilan chiroyli formatlab qaytaruvchi klass."""
    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=2,
            default=str,
        ).encode("utf-8")


class XMLResponse(Response):
    """XML formatdagi javob klassi."""
    media_type = "application/xml"

    def render(self, content: Any) -> bytes:
        if isinstance(content, str):
            return content.encode("utf-8")
        # Oddiy dict dan XML yasash
        xml = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<response>"]
        if isinstance(content, dict):
            for k, v in content.items():
                xml.append(f"  <{k}>{v}</{k}>")
        xml.append("</response>")
        return "\n".join(xml).encode("utf-8")


# ─── Sub-Application ─────────────────────────────────────────────────────────

metrics_subapp = FastAPI(
    title="Edu Masters Internal Metrics & Admin API",
    description="Asosiy ilovaga 'mount' qilingan ichki tizim monitoring sub-ilovasi",
    version="1.0",
    docs_url="/docs",
)


@metrics_subapp.get("/", response_class=PrettyJSONResponse)
async def metrics_root():
    """Ichki monitoring va tizim ko'rsatkichlari (PrettyJSONResponse bilan)."""
    return {
        "service": "edu_masters_metrics",
        "status": "operational",
        "features": [
            "FastAPI sub-applications & mounting",
            "Custom responses (PrettyJSON, XML, Streaming)",
            "Redis caching",
            "WebSockets & SSE",
        ],
    }


@metrics_subapp.get("/xml-export", response_class=XMLResponse)
async def xml_demo():
    """Custom XMLResponse namoyishi."""
    return {
        "status": "success",
        "code": "200",
        "message": "XML formatdagi javob",
    }
