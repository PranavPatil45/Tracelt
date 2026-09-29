from app.routers.auth import router as auth_router
from app.routers.lost_items import router as lost_items_router
from app.routers.found_items import router as found_items_router
from app.routers.explore import router as explore_router
from app.routers.items import router as items_router
from app.routers.matches import router as matches_router
from app.routers.claims import router as claims_router
from app.routers.notifications import router as notifications_router

__all__ = [
    "auth_router",
    "lost_items_router",
    "found_items_router",
    "explore_router",
    "items_router",
    "matches_router",
    "claims_router",
    "notifications_router",
]

