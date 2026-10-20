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
    import app.models  # Ensure all models are registered
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
            if columns and "google_sub" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)")
                conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users(google_sub)")
                conn.commit()
            if columns and "auth_provider" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'email' NOT NULL")
                conn.commit()
            if columns and "email_verified" not in columns:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0 NOT NULL")
                conn.commit()

            # Matches table schema evolution for Gemini visual matching
            match_result = conn.exec_driver_sql("PRAGMA table_info(matches)")
            match_cols = [row[1] for row in match_result.fetchall()]
            if match_cols:
                if "visual_score" not in match_cols:
                    conn.exec_driver_sql("ALTER TABLE matches ADD COLUMN visual_score INTEGER")
                if "visual_verdict" not in match_cols:
                    conn.exec_driver_sql("ALTER TABLE matches ADD COLUMN visual_verdict VARCHAR(50)")
                if "visual_confidence" not in match_cols:
                    conn.exec_driver_sql("ALTER TABLE matches ADD COLUMN visual_confidence FLOAT")
                if "visual_reasons" not in match_cols:
                    conn.exec_driver_sql("ALTER TABLE matches ADD COLUMN visual_reasons JSON")
                conn.commit()

            # Claims table schema evolution for direct claims
            claim_result = conn.exec_driver_sql("PRAGMA table_info(claims)")
            claim_cols_info = claim_result.fetchall()
            claim_cols = [row[1] for row in claim_cols_info]
            if claim_cols:
                match_id_info = next((row for row in claim_cols_info if row[1] == "match_id"), None)
                if match_id_info and match_id_info[3] == 1:
                    logger.info("Migrating claims table to make match_id nullable and add found_item_id/lost_item_id...")
                    conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
                    conn.exec_driver_sql("BEGIN TRANSACTION")
                    conn.exec_driver_sql("""
                        CREATE TABLE claims_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            match_id INTEGER,
                            found_item_id INTEGER,
                            lost_item_id INTEGER,
                            claimant_id INTEGER NOT NULL,
                            verification_details TEXT NOT NULL,
                            additional_message TEXT,
                            status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                            reviewed_by INTEGER,
                            reviewed_at DATETIME,
                            reviewer_notes TEXT,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME,
                            FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
                            FOREIGN KEY(found_item_id) REFERENCES found_items(id) ON DELETE CASCADE,
                            FOREIGN KEY(lost_item_id) REFERENCES lost_items(id) ON DELETE SET NULL,
                            FOREIGN KEY(claimant_id) REFERENCES users(id) ON DELETE CASCADE,
                            FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
                        )
                    """)
                    conn.exec_driver_sql("""
                        INSERT INTO claims_new (
                            id, match_id, claimant_id, verification_details, additional_message,
                            status, reviewed_by, reviewed_at, reviewer_notes, created_at, updated_at
                        )
                        SELECT id, match_id, claimant_id, verification_details, additional_message,
                            status, reviewed_by, reviewed_at, reviewer_notes, created_at, updated_at
                        FROM claims
                    """)
                    conn.exec_driver_sql("""
                        UPDATE claims_new
                        SET found_item_id = (SELECT found_item_id FROM matches WHERE matches.id = claims_new.match_id),
                            lost_item_id = (SELECT lost_item_id FROM matches WHERE matches.id = claims_new.match_id)
                        WHERE match_id IS NOT NULL
                    """)
                    conn.exec_driver_sql("DROP TABLE claims")
                    conn.exec_driver_sql("ALTER TABLE claims_new RENAME TO claims")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_id ON claims (id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_match_id ON claims (match_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_found_item_id ON claims (found_item_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_lost_item_id ON claims (lost_item_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_claimant_id ON claims (claimant_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_status ON claims (status)")
                    conn.commit()
                    conn.exec_driver_sql("PRAGMA foreign_keys=ON")
                else:
                    if "found_item_id" not in claim_cols:
                        conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN found_item_id INTEGER REFERENCES found_items(id) ON DELETE CASCADE")
                        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_found_item_id ON claims (found_item_id)")
                        conn.commit()
                    if "lost_item_id" not in claim_cols:
                        conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN lost_item_id INTEGER REFERENCES lost_items(id) ON DELETE SET NULL")
                        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_lost_item_id ON claims (lost_item_id)")
                        conn.commit()

            # Recoveries table schema evolution for direct claim recovery
            recovery_result = conn.exec_driver_sql("PRAGMA table_info(recoveries)")
            rec_cols_info = recovery_result.fetchall()
            rec_cols = [row[1] for row in rec_cols_info]
            if rec_cols:
                match_id_info = next((row for row in rec_cols_info if row[1] == "match_id"), None)
                lost_id_info = next((row for row in rec_cols_info if row[1] == "lost_item_id"), None)
                if (match_id_info and match_id_info[3] == 1) or (lost_id_info and lost_id_info[3] == 1):
                    logger.info("Migrating recoveries table to make match_id and lost_item_id nullable...")
                    conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
                    conn.exec_driver_sql("BEGIN TRANSACTION")
                    conn.exec_driver_sql("""
                        CREATE TABLE recoveries_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            claim_id INTEGER NOT NULL UNIQUE,
                            match_id INTEGER,
                            lost_item_id INTEGER,
                            found_item_id INTEGER NOT NULL,
                            claimant_id INTEGER NOT NULL,
                            finder_id INTEGER NOT NULL,
                            status VARCHAR(50) NOT NULL DEFAULT 'RETURN_PENDING',
                            return_location VARCHAR(255),
                            return_notes TEXT,
                            returned_at DATETIME,
                            confirmed_at DATETIME,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME,
                            FOREIGN KEY(claim_id) REFERENCES claims(id) ON DELETE CASCADE,
                            FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE SET NULL,
                            FOREIGN KEY(lost_item_id) REFERENCES lost_items(id) ON DELETE SET NULL,
                            FOREIGN KEY(found_item_id) REFERENCES found_items(id) ON DELETE CASCADE,
                            FOREIGN KEY(claimant_id) REFERENCES users(id) ON DELETE CASCADE,
                            FOREIGN KEY(finder_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """)
                    conn.exec_driver_sql("""
                        INSERT INTO recoveries_new (
                            id, claim_id, match_id, lost_item_id, found_item_id, claimant_id, finder_id,
                            status, return_location, return_notes, returned_at, confirmed_at, created_at, updated_at
                        )
                        SELECT id, claim_id, match_id, lost_item_id, found_item_id, claimant_id, finder_id,
                            status, return_location, return_notes, returned_at, confirmed_at, created_at, updated_at
                        FROM recoveries
                    """)
                    conn.exec_driver_sql("DROP TABLE recoveries")
                    conn.exec_driver_sql("ALTER TABLE recoveries_new RENAME TO recoveries")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_id ON recoveries (id)")
                    conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ix_recoveries_claim_id ON recoveries (claim_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_match_id ON recoveries (match_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_lost_item_id ON recoveries (lost_item_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_found_item_id ON recoveries (found_item_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_claimant_id ON recoveries (claimant_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_finder_id ON recoveries (finder_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_status ON recoveries (status)")
                    conn.commit()
                    conn.exec_driver_sql("PRAGMA foreign_keys=ON")

            # Conversations table schema evolution for direct claims
            conv_result = conn.exec_driver_sql("PRAGMA table_info(conversations)")
            conv_cols_info = conv_result.fetchall()
            conv_cols = [row[1] for row in conv_cols_info]
            if conv_cols:
                match_id_info = next((row for row in conv_cols_info if row[1] == "match_id"), None)
                if match_id_info and match_id_info[3] == 1:
                    logger.info("Migrating conversations table to make match_id nullable...")
                    conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
                    conn.exec_driver_sql("BEGIN TRANSACTION")
                    conn.exec_driver_sql("""
                        CREATE TABLE conversations_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            claim_id INTEGER NOT NULL UNIQUE,
                            match_id INTEGER,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME,
                            last_message_at DATETIME,
                            FOREIGN KEY(claim_id) REFERENCES claims(id) ON DELETE CASCADE,
                            FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE SET NULL
                        )
                    """)
                    conn.exec_driver_sql("""
                        INSERT INTO conversations_new (
                            id, claim_id, match_id, created_at, updated_at, last_message_at
                        )
                        SELECT id, claim_id, match_id, created_at, updated_at, last_message_at
                        FROM conversations
                    """)
                    conn.exec_driver_sql("DROP TABLE conversations")
                    conn.exec_driver_sql("ALTER TABLE conversations_new RENAME TO conversations")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_conversations_id ON conversations (id)")
                    conn.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS ix_conversations_claim_id ON conversations (claim_id)")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_conversations_match_id ON conversations (match_id)")
                    conn.commit()
                    conn.exec_driver_sql("PRAGMA foreign_keys=ON")

            # Claims table schema evolution for Hybrid Reviewer Workflow (Task 3)
            c_res = conn.exec_driver_sql("PRAGMA table_info(claims)")
            c_cols = [row[1] for row in c_res.fetchall()]
            if c_cols:
                if "review_status" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN review_status VARCHAR(50) DEFAULT 'NOT_REQUIRED' NOT NULL")
                if "review_reason" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN review_reason VARCHAR(100)")
                if "review_decision_notes" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN review_decision_notes TEXT")
                if "review_decision_by" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN review_decision_by INTEGER REFERENCES users(id) ON DELETE SET NULL")
                if "review_decision_at" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN review_decision_at DATETIME")
                if "handover_method" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN handover_method VARCHAR(50) DEFAULT 'DIRECT' NOT NULL")
                if "is_mandatory_review" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN is_mandatory_review BOOLEAN DEFAULT 0 NOT NULL")
                if "is_mandatory_otp" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN is_mandatory_otp BOOLEAN DEFAULT 0 NOT NULL")
                if "assigned_reviewer_id" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN assigned_reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_claims_assigned_reviewer_id ON claims (assigned_reviewer_id)")
                if "assigned_at" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN assigned_at DATETIME")
                if "assigned_by_id" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
                if "assignment_notes" not in c_cols:
                    conn.exec_driver_sql("ALTER TABLE claims ADD COLUMN assignment_notes TEXT")
                conn.commit()

            # Recoveries table schema evolution for Hybrid Reviewer Workflow and OTP Handover (Task 3)
            r_res = conn.exec_driver_sql("PRAGMA table_info(recoveries)")
            r_cols = [row[1] for row in r_res.fetchall()]
            if r_cols:
                if "review_status" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN review_status VARCHAR(50) DEFAULT 'NOT_REQUIRED' NOT NULL")
                if "review_reason" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN review_reason VARCHAR(100)")
                if "review_decision_notes" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN review_decision_notes TEXT")
                if "review_decision_by" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN review_decision_by INTEGER REFERENCES users(id) ON DELETE SET NULL")
                if "review_decision_at" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN review_decision_at DATETIME")
                if "handover_method" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN handover_method VARCHAR(50) DEFAULT 'DIRECT' NOT NULL")
                if "is_mandatory_review" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN is_mandatory_review BOOLEAN DEFAULT 0 NOT NULL")
                if "is_mandatory_otp" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN is_mandatory_otp BOOLEAN DEFAULT 0 NOT NULL")
                if "otp_hash" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN otp_hash VARCHAR(255)")
                if "otp_salt" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN otp_salt VARCHAR(64)")
                if "otp_expires_at" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN otp_expires_at DATETIME")
                if "otp_attempts" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN otp_attempts INTEGER DEFAULT 0 NOT NULL")
                if "otp_verified_at" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN otp_verified_at DATETIME")
                if "dispute_reason" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN dispute_reason TEXT")
                if "disputed_by" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN disputed_by INTEGER REFERENCES users(id) ON DELETE SET NULL")
                if "disputed_at" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN disputed_at DATETIME")
                if "assigned_reviewer_id" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN assigned_reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
                    conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_recoveries_assigned_reviewer_id ON recoveries (assigned_reviewer_id)")
                if "assigned_at" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN assigned_at DATETIME")
                if "assigned_by_id" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
                if "assignment_notes" not in r_cols:
                    conn.exec_driver_sql("ALTER TABLE recoveries ADD COLUMN assignment_notes TEXT")
                conn.commit()

            # Ensure reviewer_assignments table exists
            conn.exec_driver_sql("""
                CREATE TABLE IF NOT EXISTS reviewer_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_type VARCHAR(50) NOT NULL,
                    case_id INTEGER NOT NULL,
                    claim_id INTEGER REFERENCES claims(id) ON DELETE CASCADE,
                    recovery_id INTEGER REFERENCES recoveries(id) ON DELETE CASCADE,
                    reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    assignment_action VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
                    notes TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_reviewer_assignments_case_type ON reviewer_assignments (case_type)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_reviewer_assignments_case_id ON reviewer_assignments (case_id)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_reviewer_assignments_claim_id ON reviewer_assignments (claim_id)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_reviewer_assignments_recovery_id ON reviewer_assignments (recovery_id)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_reviewer_assignments_reviewer_id ON reviewer_assignments (reviewer_id)")
            conn.commit()
        except Exception as e:
            logger.warning(f"Database migration check warning: {e}")


