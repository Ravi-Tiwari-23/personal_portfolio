import os
from datetime import timedelta
from pathlib import Path


# ============================================================
# BASE DIRECTORY
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

INSTANCE_DIR = BASE_DIR / "instance"
UPLOAD_DIR = INSTANCE_DIR / "uploads"
RESUME_DIR = INSTANCE_DIR / "resume"


# Create local runtime directories if they do not exist.
# This is useful for local development.
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESUME_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# DATABASE URL
# ============================================================

database_url = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{INSTANCE_DIR / 'portfolio.sqlite3'}",
)

# Some hosting/database providers still return:
#
# postgres://...
#
# SQLAlchemy expects postgresql://...
#
# This project uses Psycopg 3, therefore:
#
# postgresql+psycopg://...
#
if database_url.startswith("postgres://"):
    database_url = database_url.replace(
        "postgres://",
        "postgresql+psycopg://",
        1,
    )

elif database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://",
        "postgresql+psycopg://",
        1,
    )


# ============================================================
# MAIN CONFIGURATION
# ============================================================

class Config:

    # --------------------------------------------------------
    # SECURITY
    # --------------------------------------------------------

    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        "dev-only-change-me",
    )

    # --------------------------------------------------------
    # DATABASE
    # --------------------------------------------------------

    SQLALCHEMY_DATABASE_URI = database_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Helps avoid stale PostgreSQL connections after a DB
    # connection has been closed by the provider.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    # --------------------------------------------------------
    # FILE UPLOADS
    # --------------------------------------------------------

    # Default: 10 MB
    MAX_CONTENT_LENGTH = int(
        os.getenv(
            "MAX_CONTENT_LENGTH",
            10 * 1024 * 1024,
        )
    )

    UPLOAD_FOLDER = Path(
        os.getenv(
            "UPLOAD_FOLDER",
            str(UPLOAD_DIR),
        )
    )

    RESUME_FOLDER = Path(
        os.getenv(
            "RESUME_FOLDER",
            str(RESUME_DIR),
        )
    )

    # --------------------------------------------------------
    # SESSION SECURITY
    # --------------------------------------------------------

    SESSION_COOKIE_HTTPONLY = True

    SESSION_COOKIE_SAMESITE = "Lax"

    SESSION_COOKIE_SECURE = (
        os.getenv(
            "SESSION_COOKIE_SECURE",
            "0",
        )
        == "1"
    )

    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)

    # --------------------------------------------------------
    # REMEMBER-ME COOKIE
    # --------------------------------------------------------

    REMEMBER_COOKIE_HTTPONLY = True

    REMEMBER_COOKIE_SAMESITE = "Lax"

    REMEMBER_COOKIE_SECURE = (
        os.getenv(
            "SESSION_COOKIE_SECURE",
            "0",
        )
        == "1"
    )

    # --------------------------------------------------------
    # CSRF
    # --------------------------------------------------------

    WTF_CSRF_TIME_LIMIT = 2 * 60 * 60

    # --------------------------------------------------------
    # RATE LIMITING
    # --------------------------------------------------------

    RATELIMIT_STORAGE_URI = os.getenv(
        "RATELIMIT_STORAGE_URI",
        "memory://",
    )

    # --------------------------------------------------------
    # APPLICATION SETTINGS
    # --------------------------------------------------------

    AUTO_SEED = (
        os.getenv(
            "AUTO_SEED",
            "1",
        )
        == "1"
    )


# ============================================================
# DEVELOPMENT CONFIGURATION
# ============================================================

class DevelopmentConfig(Config):

    DEBUG = True

    SESSION_COOKIE_SECURE = False

    REMEMBER_COOKIE_SECURE = False


# ============================================================
# PRODUCTION CONFIGURATION
# ============================================================

class ProductionConfig(Config):

    DEBUG = False

    TESTING = False

    # Render will serve the application over HTTPS.
    SESSION_COOKIE_SECURE = True

    REMEMBER_COOKIE_SECURE = True

    # Do not automatically insert seed/demo data every time
    # the production application starts.
    AUTO_SEED = (
        os.getenv(
            "AUTO_SEED",
            "0",
        )
        == "1"
    )


# ============================================================
# TEST CONFIGURATION
# ============================================================

class TestConfig(Config):

    TESTING = True

    WTF_CSRF_ENABLED = False

    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

    SQLALCHEMY_ENGINE_OPTIONS = {}

    AUTO_SEED = False

    SESSION_COOKIE_SECURE = False

    REMEMBER_COOKIE_SECURE = False

    SERVER_NAME = "localhost"


# ============================================================
# CONFIGURATION MAP
# ============================================================

config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestConfig,
    "default": Config,
}
