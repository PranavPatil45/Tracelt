from typing import Optional, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.explore import ExploreResponse
from app.crud.explore import search_explore_items
from app.core.deps import get_current_user

router = APIRouter(tags=["Explore"])


@router.get(
    "/explore",
    response_model=ExploreResponse,
    summary="Explore & search unified campus lost and found catalog",
)
def explore_items(
    search: Optional[str] = Query(None, description="Search term for title, description, category, or location"),
    type: Optional[str] = Query("all", description="Type filter: all, lost, or found"),
    category: Optional[str] = Query(None, description="Category filter"),
    location: Optional[str] = Query(None, description="Campus location filter"),
    date_preset: Optional[str] = Query(None, description="Date filter preset: today, 7days, 30days, all"),
    date_from: Optional[str] = Query(None, description="Start date formatted as YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="End date formatted as YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Status filter: e.g. ACTIVE, AVAILABLE, or 'all'"),
    sort: Optional[str] = Query("newest", description="Sort order: newest, oldest, date_newest, date_oldest"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(12, ge=1, le=100, description="Items per page"),
    campus: Optional[str] = Query(None, description="Campus filter; defaults to user's registered campus"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Returns a unified, sorted, paginated feed of Lost and Found items.
    Scoped by default to the authenticated user's campus.
    """
    effective_campus = campus.strip() if campus and campus.strip() else current_user.campus

    results = search_explore_items(
        db=db,
        search=search,
        item_type=type or "all",
        category=category,
        location=location,
        date_preset=date_preset,
        date_from=date_from,
        date_to=date_to,
        status=status,
        sort=sort or "newest",
        page=page,
        limit=limit,
        campus=effective_campus,
    )
    return results
