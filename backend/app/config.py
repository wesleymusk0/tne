import os

FIREBASE_CRED_PATH = os.environ.get(
    "FIREBASE_CRED_PATH", "/home/systematrix/backend/firebase-service-account.json"
)
FIREBASE_DB_URL = os.environ.get(
    "FIREBASE_DB_URL", "https://systematrix-apps-default-rtdb.firebaseio.com/"
)

MERCADO_PAGO_ACCESS_TOKEN = os.environ.get("MERCADO_PAGO_ACCESS_TOKEN", "")
MERCADO_PAGO_WEBHOOK_SECRET = os.environ.get("MERCADO_PAGO_WEBHOOK_SECRET", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "Systematrix <noreply@systematrix.com.br>")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://systematrix.com.br")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS", "https://systematrix.com.br,http://localhost:3000"
    ).split(",")
    if o.strip()
]

DEFAULT_TOLERANCIA_DIAS = 7
