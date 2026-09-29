from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine, init_db
from app.models import (
    User,
    LostItem,
    FoundItem,
    Match,
    Claim,
    Notification,
    Conversation,
    ConversationParticipant,
    Message,
    Recovery,
    AdminAuditLog,
    Report,
)  # Ensure all models are registered with Base
from app.routers.auth import router as auth_router
from app.routers.lost_items import router as lost_items_router
from app.routers.found_items import router as found_items_router
from app.routers.explore import router as explore_router
from app.routers.items import router as items_router
from app.routers.matches import router as matches_router
from app.routers.claims import router as claims_router
from app.routers.notifications import router as notifications_router
from app.routers.conversations import router as conversations_router
from app.routers.messages import router as messages_router
from app.routers.recoveries import router as recoveries_router
from app.routers.history import router as history_router
from app.routers.campus import router as campus_router
from app.routers.admin import router as admin_router

from app.core.file_storage import UPLOADS_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema and migrations are executed on startup
    init_db()
    yield


# Ensure tables and columns exist immediately upon import
init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for Tracelt Smart Lost & Found Portal with JWT Authentication",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for static file serving
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="api_uploads")

# Include routers under both /api and root to guarantee seamless compatibility
app.include_router(auth_router, prefix="/api")
app.include_router(auth_router)

app.include_router(lost_items_router, prefix="/api")
app.include_router(lost_items_router)

app.include_router(found_items_router, prefix="/api")
app.include_router(found_items_router)

app.include_router(explore_router, prefix="/api")
app.include_router(explore_router)

app.include_router(items_router, prefix="/api")
app.include_router(items_router)

app.include_router(matches_router, prefix="/api")
app.include_router(matches_router)

app.include_router(claims_router, prefix="/api")
app.include_router(claims_router)

app.include_router(notifications_router, prefix="/api")
app.include_router(notifications_router)

app.include_router(conversations_router, prefix="/api")
app.include_router(conversations_router)

app.include_router(messages_router, prefix="/api")
app.include_router(messages_router)

app.include_router(recoveries_router, prefix="/api")
app.include_router(recoveries_router)

app.include_router(history_router, prefix="/api")
app.include_router(history_router)

app.include_router(campus_router, prefix="/api")
app.include_router(campus_router)

app.include_router(admin_router, prefix="/api")
app.include_router(admin_router)



@app.get("/", tags=["Health"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
