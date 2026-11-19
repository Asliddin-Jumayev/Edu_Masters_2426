from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DB_USERNAME: str = "root"
    DB_PASSWORD: str = ""
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "edu_masters"
    DATABASE_URL: str | None = None  # to'liq URL berilsa (masalan testda) shu ishlatiladi

    SECRET_KEY: str = Field(min_length=16)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 30
    REFRESH_TOKEN_DAYS: int = 1
    CORS_ORIGINS: str = ""

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 10
    INVOICE_DUE_DAYS: int = 10
    BACKGROUND_TASKS: bool = True
    LOG_LEVEL: str = "INFO"
    LOGIN_RATE_LIMIT: str = "5/minute"

    # --- Umumiy ---
    PUBLIC_API_URL: str = ""             # webhook manzillari shu asosda ko'rsatiladi (masalan https://api.example.uz)
    FRONTEND_URL: str = "http://localhost:5173"
    CENTER_NAME: str = "Edu Masters"
    TRUST_PROXY: bool = False            # True bo'lsa mijoz IP si X-Forwarded-For dan olinadi (nginx orqasida)
    TIMEZONE_OFFSET_HOURS: int = 5       # xabarlarda ko'rsatiladigan vaqt (Toshkent = UTC+5)

    # --- Redis & Celery ---
    REDIS_URL: str = ""                  # masalan redis://localhost:6379/0 (bo'sh bo'lsa kesh va WS xotirada ishlaydi)
    CELERY_BROKER_URL: str = ""          # bo'sh bo'lsa REDIS_URL olinadi

    # --- AI / LLM Integratsiyasi ---
    AI_PROVIDER: str = "mock"            # mock | gemini | openai
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_MODEL: str = "gemini-1.5-flash"

    # --- gRPC ---
    GRPC_PORT: int = 50051

    # --- Telegram Bot ---
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = ""

    # --- Click (Shop API) ---
    CLICK_SERVICE_ID: str = ""
    CLICK_MERCHANT_ID: str = ""
    CLICK_SECRET_KEY: str = ""
    # --- Payme (Merchant API) ---
    PAYME_MERCHANT_ID: str = ""
    PAYME_KEY: str = ""
    PAYME_CHECKOUT_URL: str = "https://checkout.paycom.uz"   # sinov: https://test.paycom.uz

    # --- SMS ---
    SMS_PROVIDER: str = "console"        # console | eskiz
    ESKIZ_EMAIL: str = ""
    ESKIZ_PASSWORD: str = ""
    ESKIZ_FROM: str = "4546"
    ESKIZ_BASE_URL: str = "https://notify.eskiz.uz/api"
    SMS_CALLBACK_TOKEN: str = ""         # Eskiz yetkazish holati callback ini himoyalaydi

    # --- Email ---
    EMAIL_BACKEND: str = "auto"          # auto | smtp | console | memory
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_STARTTLS: bool = True
    SMTP_SSL: bool = False               # 465-port uchun True
    NEW_DEVICE_ALERT_ON_FIRST_LOGIN: bool = False

    ADMIN_PHONE: str | None = None
    ADMIN_PASSWORD: str | None = None

    def _url(self, driver: str) -> URL:
        return URL.create(
            driver, username=self.DB_USERNAME, password=self.DB_PASSWORD,
            host=self.DB_HOST, port=self.DB_PORT, database=self.DB_NAME,
            query={"charset": "utf8mb4"},
        )

    @property
    def async_database_url(self):
        return self.DATABASE_URL or self._url("mysql+aiomysql")

    @property
    def sync_database_url(self):
        # Alembic uchun (sinxron drayver)
        return self._url("mysql+pymysql")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
