import logging
import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

logger = logging.getLogger("tracelt.database")

# SQLite needs check_same_thread: False for multiple threads in FastAPI
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def log_database_diagnostics():
    """Prints and logs database connection diagnostics on startup."""
    cwd = os.getcwd()
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        sqlite_file = Path(db_url[len("sqlite:///"):])
        file_exists = sqlite_file.exists()
        size_bytes = sqlite_file.stat().st_size if file_exists else 0
        abs_path = str(sqlite_file.resolve())
    else:
        abs_path = "N/A (remote database)"
        file_exists = True
        size_bytes = 0

    diag_msg = (
        "\n" + "=" * 65 + "\n"
        "=== TRACELT DATABASE CONNECTION DIAGNOSTICS ===\n"
        f"  Current Working Directory : {cwd}\n"
        f"  Absolute Database Path    : {abs_path}\n"
        f"  Settings DATABASE_URL     : {db_url}\n"
        f"  Database File Exists      : {file_exists}\n"
        f"  Database File Size        : {size_bytes} bytes\n"
        f"  SQLAlchemy Engine URL     : {engine.url}\n"
        + "=" * 65
    )
    print(diag_msg)
    logger.info(diag_msg)


def get_db():
    """Dependency that yields a database session and safely closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Ensures all tables and required columns exist and logs database path diagnostics."""
    log_database_diagnostics()
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            result = conn.exec_driver_sql("PRAGMA table_info(users)")
            columns = [row[1] for row in result.fetchall()]
            if columns and "role" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'student' NOT NULL")
                conn.commit()
            if columns and "phone" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN phone VARCHAR(50)")
                conn.commit()
            if columns and "bio" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN bio VARCHAR(500)")
                conn.commit()
            if columns and "profile_image" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN profile_image VARCHAR(500)")
                conn.commit()
        except Exception:
            pass


