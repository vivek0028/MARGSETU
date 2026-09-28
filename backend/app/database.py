import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("railoptiblock.database")

# Load .env from backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_PG_URL = "postgresql://postgres@localhost:5433/railoptiblock"
SQLITE_FALLBACK_URL = f"sqlite:///{BACKEND_DIR / 'railblock.db'}"

def _build_database_engine():
    raw_env_url = os.getenv("DATABASE_URL", "").strip().strip("\"'").strip()
    
    # 1. If explicit DATABASE_URL is configured in environment
    if raw_env_url:
        # Handle Heroku/Render legacy postgres:// prefix
        if raw_env_url.startswith("postgres://"):
            raw_env_url = raw_env_url.replace("postgres://", "postgresql://", 1)
        
        try:
            connect_args = {"check_same_thread": False} if "sqlite" in raw_env_url else {}
            kwargs = {"pool_pre_ping": True}
            if "sqlite" not in raw_env_url:
                kwargs.update({"pool_size": 10, "max_overflow": 20})
            engine = create_engine(raw_env_url, connect_args=connect_args, **kwargs)
            logger.info("Database engine initialized from DATABASE_URL: %s", raw_env_url.split("@")[-1] if "@" in raw_env_url else "sqlite")
            return engine, raw_env_url
        except Exception as exc:
            logger.warning("Failed to initialize engine from DATABASE_URL (%s). Falling back: %s", raw_env_url, exc)

    # 2. Check if local PostgreSQL default is reachable (local dev on port 5433)
    if "pytest" not in sys.modules:
        try:
            pg_engine = create_engine(
                DEFAULT_PG_URL,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20
            )
            # Test quick connection ping
            with pg_engine.connect() as conn:
                pass
            logger.info("Connected to local PostgreSQL database on port 5433.")
            return pg_engine, DEFAULT_PG_URL
        except Exception:
            pass

    # 3. Graceful fallback to SQLite (guarantees server never crashes on startup)
    logger.info("Initializing SQLite database fallback at: %s", SQLITE_FALLBACK_URL)
    sqlite_engine = create_engine(
        SQLITE_FALLBACK_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )
    return sqlite_engine, SQLITE_FALLBACK_URL

engine, DB_PATH = _build_database_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
