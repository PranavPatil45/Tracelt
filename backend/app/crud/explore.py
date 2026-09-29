import math
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, literal, union_all, desc, asc, func, or_, and_

from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.schemas.explore import ExploreItem, ExploreResponse


def search_explore_items(
    db: Session,
    search: Optional[str] = None,
    item_type: str = "all",
    category: Optional[str] = None,
    location: Optional[str] = None,
    date_preset: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    sort: str = "newest",
    page: int = 1,
    limit: int = 12,
    campus: Optional[str] = None,
) -> ExploreResponse:
    """
    Unified search and discovery engine across LostItem and FoundItem tables.
    Applies campus scoping, text search, multi-faceted filtering, sorting, and pagination.
    """
    # 1. Resolve date presets if provided
    if date_preset and date_preset.lower() != "all":
        today = date.today()
        preset_clean = date_preset.lower().strip()
        if preset_clean == "today":
            date_from = today.isoformat()
            date_to = today.isoformat()
        elif preset_clean in ("7days", "week", "last_7_days"):
            date_from = (today - timedelta(days=7)).isoformat()
            date_to = today.isoformat()
        elif preset_clean in ("30days", "month", "last_30_days"):
            date_from = (today - timedelta(days=30)).isoformat()
            date_to = today.isoformat()

    # Normalize category / location ignores
    if category and category.strip().lower() in ("all", "all categories"):
        category = None
    if location and location.strip().lower() in ("all", "all locations"):
        location = None

    # 2. Build LostItem filters
    lost_filters = []
    if campus:
        lost_filters.append(LostItem.campus.ilike(f"%{campus.strip()}%"))
    if category:
        lost_filters.append(LostItem.category.ilike(f"%{category.strip()}%"))
    if location:
        lost_filters.append(LostItem.location.ilike(f"%{location.strip()}%"))
    if search and search.strip():
        pat = f"%{search.strip()}%"
        lost_filters.append(
            or_(
                LostItem.title.ilike(pat),
                LostItem.description.ilike(pat),
                LostItem.category.ilike(pat),
                LostItem.location.ilike(pat),
            )
        )
    if date_from:
        lost_filters.append(LostItem.lost_date >= date_from)
    if date_to:
        lost_filters.append(LostItem.lost_date <= date_to)
    if status and status.lower() != "all":
        lost_filters.append(LostItem.status == status.upper().strip())
    elif not status:
        # Default active public discovery
        lost_filters.append(LostItem.status.in_(["ACTIVE", "MATCHED"]))

    # 3. Build FoundItem filters
    found_filters = []
    if campus:
        found_filters.append(FoundItem.campus.ilike(f"%{campus.strip()}%"))
    if category:
        found_filters.append(FoundItem.category.ilike(f"%{category.strip()}%"))
    if location:
        found_filters.append(FoundItem.location.ilike(f"%{location.strip()}%"))
    if search and search.strip():
        pat = f"%{search.strip()}%"
        found_filters.append(
            or_(
                FoundItem.title.ilike(pat),
                FoundItem.description.ilike(pat),
                FoundItem.category.ilike(pat),
                FoundItem.location.ilike(pat),
            )
        )
    if date_from:
        found_filters.append(FoundItem.found_date >= date_from)
    if date_to:
        found_filters.append(FoundItem.found_date <= date_to)
    if status and status.lower() != "all":
        found_filters.append(FoundItem.status == status.upper().strip())
    elif not status:
        # Default active public discovery
        found_filters.append(FoundItem.status.in_(["AVAILABLE", "MATCHED"]))

    # 4. Formulate SELECT statements for each table
    q_lost = select(
        LostItem.id.label("id"),
        literal("LOST").label("type"),
        LostItem.title.label("title"),
        LostItem.category.label("category"),
        LostItem.description.label("description"),
        LostItem.location.label("location"),
        LostItem.campus.label("campus"),
        LostItem.lost_date.label("date"),
        LostItem.lost_time.label("time"),
        LostItem.image_url.label("image_url"),
        LostItem.status.label("status"),
        LostItem.created_at.label("created_at"),
        LostItem.user_id.label("user_id"),
    )
    if lost_filters:
        q_lost = q_lost.where(and_(*lost_filters))

    q_found = select(
        FoundItem.id.label("id"),
        literal("FOUND").label("type"),
        FoundItem.title.label("title"),
        FoundItem.category.label("category"),
        FoundItem.description.label("description"),
        FoundItem.location.label("location"),
        FoundItem.campus.label("campus"),
        FoundItem.found_date.label("date"),
        FoundItem.found_time.label("time"),
        FoundItem.image_url.label("image_url"),
        FoundItem.status.label("status"),
        FoundItem.created_at.label("created_at"),
        FoundItem.user_id.label("user_id"),
    )
    if found_filters:
        q_found = q_found.where(and_(*found_filters))

    # 5. Determine union subquery based on item_type
    norm_type = (item_type or "all").lower().strip()
    if norm_type == "lost":
        subq = q_lost.subquery()
    elif norm_type == "found":
        subq = q_found.subquery()
    else:
        subq = union_all(q_lost, q_found).subquery()

    # 6. Count total matches
    count_stmt = select(func.count()).select_from(subq)
    total = db.scalar(count_stmt) or 0

    # 7. Sorting
    sort_clean = (sort or "newest").lower().strip()
    if sort_clean == "oldest":
        order_clause = asc(subq.c.created_at)
    elif sort_clean == "date_newest":
        order_clause = desc(subq.c.date)
    elif sort_clean == "date_oldest":
        order_clause = asc(subq.c.date)
    else:  # default newest
        order_clause = desc(subq.c.created_at)

    # 8. Pagination
    safe_page = max(1, page)
    safe_limit = max(1, min(limit, 100))
    offset_val = (safe_page - 1) * safe_limit

    stmt = select(subq).order_by(order_clause).offset(offset_val).limit(safe_limit)
    rows = db.execute(stmt).mappings().all()

    items = [
        ExploreItem(
            id=r["id"],
            type=r["type"],
            title=r["title"],
            category=r["category"],
            description=r["description"],
            location=r["location"],
            campus=r["campus"],
            date=r["date"],
            time=r["time"],
            image_url=r["image_url"],
            status=r["status"],
            created_at=r["created_at"],
            user_id=r["user_id"],
        )
        for r in rows
    ]

    pages = max(1, math.ceil(total / safe_limit)) if total > 0 else 1

    return ExploreResponse(
        items=items,
        total=total,
        page=safe_page,
        limit=safe_limit,
        pages=pages,
    )
