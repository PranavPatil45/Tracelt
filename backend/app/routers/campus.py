from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func, desc

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.recovery import Recovery
from app.schemas.campus import CampusActivityItem, ReconnectedItemResponse

router = APIRouter(tags=["Campus & User Activity"])


def get_category_icon(category: Optional[str]) -> str:
    """Returns a friendly emoji icon corresponding to the item category."""
    cat = (category or "").lower()
    if any(k in cat for k in ["bag", "backpack", "luggage", "purse"]):
        return "🎒"
    if any(k in cat for k in ["phone", "laptop", "electronic", "earbud", "headphone", "device", "calc"]):
        return "💻"
    if any(k in cat for k in ["card", "id", "wallet", "pass"]):
        return "💳"
    if any(k in cat for k in ["key", "keys"]):
        return "🔑"
    if any(k in cat for k in ["cloth", "jacket", "hoodie", "shirt", "coat", "wear"]):
        return "👕"
    if any(k in cat for k in ["book", "notebook", "document", "paper"]):
        return "📚"
    if any(k in cat for k in ["bottle", "flask", "tumbler", "mug"]):
        return "🍶"
    if any(k in cat for k in ["watch", "jewelry", "ring"]):
        return "⌚"
    if any(k in cat for k in ["umbrella"]):
        return "☂️"
    return "📦"


def format_time_ago(dt: Optional[datetime]) -> str:
    """Generates human-friendly relative time strings (e.g., '12 min ago', 'Yesterday')."""
    if not dt:
        return "Recently"
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago" if minutes > 1 else "1 min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hr ago" if hours > 1 else "1 hr ago"
    days = hours // 24
    if days == 1:
        return "Yesterday"
    if days < 7:
        return f"{days}d ago"
    return dt.strftime("%b %d")


@router.get(
    "/campus/activity",
    response_model=List[CampusActivityItem],
    summary="Get recent campus activity feed for lost & found items",
)
def get_campus_activity(
    campus: Optional[str] = Query(None, description="Campus filter; defaults to user's registered campus"),
    limit: int = Query(15, ge=1, le=50, description="Max activities to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Returns real-time activity stream of recently reported lost and found items.
    Filters by the specified campus or the current authenticated user's campus.
    Handles missing or unrecognized campus filters gracefully by falling back to campus-wide items.
    """
    target_campus = campus.strip() if campus and campus.strip() else (current_user.campus.strip() if current_user.campus else None)

    # 1. Query with target campus if available
    lost_items: List[LostItem] = []
    found_items: List[FoundItem] = []

    if target_campus:
        lost_items = (
            db.query(LostItem)
            .filter(func.lower(LostItem.campus) == target_campus.lower())
            .order_by(desc(LostItem.created_at))
            .limit(limit)
            .all()
        )
        found_items = (
            db.query(FoundItem)
            .filter(func.lower(FoundItem.campus) == target_campus.lower())
            .order_by(desc(FoundItem.created_at))
            .limit(limit)
            .all()
        )

    # 2. Graceful fallback: If campus query yields no reports, fetch general recent reports
    if not lost_items and not found_items:
        lost_items = (
            db.query(LostItem)
            .order_by(desc(LostItem.created_at))
            .limit(limit)
            .all()
        )
        found_items = (
            db.query(FoundItem)
            .order_by(desc(FoundItem.created_at))
            .limit(limit)
            .all()
        )

    # 3. Combine and serialize into unified activity feed
    activity_entries: List[dict] = []

    for l in lost_items:
        activity_entries.append({
            "id": f"act-lost-{l.id}",
            "icon": get_category_icon(l.category),
            "title": l.title,
            "type": "lost",
            "location": l.location,
            "campus": l.campus,
            "category": l.category,
            "timeAgo": format_time_ago(l.created_at),
            "detail": l.description or f"Reported lost at {l.location}",
            "created_at": l.created_at,
            "image_url": l.image_url,
            "raw_id": l.id,
        })

    for f in found_items:
        activity_entries.append({
            "id": f"act-found-{f.id}",
            "icon": get_category_icon(f.category),
            "title": f.title,
            "type": "found",
            "location": f.location,
            "campus": f.campus,
            "category": f.category,
            "timeAgo": format_time_ago(f.created_at),
            "detail": f.description or f"Reported found at {f.location}",
            "created_at": f.created_at,
            "image_url": f.image_url,
            "raw_id": f.id,
        })

    # Sort newest first
    activity_entries.sort(
        key=lambda x: x["created_at"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    return activity_entries[:limit]


@router.get(
    "/users/me/reconnected",
    response_model=List[ReconnectedItemResponse],
    summary="Get reconnected / recovered items for the authenticated user",
)
def get_user_reconnected_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Returns successfully recovered/reconnected items for the authenticated user.
    Includes items where the user was either the Claimant or the Finder.
    Returns an empty array if no reconnected items exist.
    """
    # 1. Recoveries involving the user where status is RECOVERED or RETURNED
    recoveries = (
        db.query(Recovery)
        .filter(
            (Recovery.claimant_id == current_user.id) | (Recovery.finder_id == current_user.id),
            Recovery.status.in_(["RECOVERED", "RETURNED"]),
        )
        .options(
            joinedload(Recovery.lost_item),
            joinedload(Recovery.found_item),
            joinedload(Recovery.finder),
            joinedload(Recovery.claimant),
        )
        .order_by(desc(Recovery.confirmed_at), desc(Recovery.returned_at), desc(Recovery.created_at))
        .all()
    )

    # 2. Also check direct user LostItems with status RECOVERED
    user_lost = (
        db.query(LostItem)
        .filter(LostItem.user_id == current_user.id, LostItem.status == "RECOVERED")
        .order_by(desc(LostItem.updated_at))
        .all()
    )

    # 3. Also check direct user FoundItems with status RETURNED
    user_found = (
        db.query(FoundItem)
        .filter(FoundItem.user_id == current_user.id, FoundItem.status.in_(["RETURNED", "RECOVERED"]))
        .order_by(desc(FoundItem.updated_at))
        .all()
    )

    reconnected_list: List[ReconnectedItemResponse] = []
    seen_recovery_ids = set()
    seen_lost_ids = set()
    seen_found_ids = set()

    for rec in recoveries:
        seen_recovery_ids.add(rec.id)
        if rec.lost_item_id:
            seen_lost_ids.add(rec.lost_item_id)
        if rec.found_item_id:
            seen_found_ids.add(rec.found_item_id)

        title = rec.lost_item.title if rec.lost_item else (rec.found_item.title if rec.found_item else "Recovered Item")
        cat = rec.lost_item.category if rec.lost_item else (rec.found_item.category if rec.found_item else None)
        lost_loc = rec.lost_item.location if rec.lost_item else "Campus"
        match_loc = rec.return_location or (rec.found_item.location if rec.found_item else "Campus")
        comp_date = rec.confirmed_at or rec.returned_at or rec.created_at

        founder_text = "Verified by Campus Community"
        if rec.finder and rec.finder.full_name:
            founder_text = f"Verified by {rec.finder.full_name}"
        elif rec.claimant and rec.claimant.full_name:
            founder_text = f"Reconnected with {rec.claimant.full_name}"

        rec_img = (rec.lost_item.image_url if rec.lost_item else None) or (rec.found_item.image_url if rec.found_item else None)

        reconnected_list.append(
            ReconnectedItemResponse(
                id=f"rec-{rec.id}",
                icon=get_category_icon(cat),
                title=title,
                lostLocation=lost_loc,
                matchedLocation=match_loc,
                status="Recovered" if rec.status == "RECOVERED" else "Returned",
                date=format_time_ago(comp_date),
                founder=founder_text,
                recovery_id=rec.id,
                lost_item_id=rec.lost_item_id,
                found_item_id=rec.found_item_id,
                image_url=rec_img,
            )
        )

    # Append direct user lost items if not already included in recovery records
    for l in user_lost:
        if l.id not in seen_lost_ids:
            seen_lost_ids.add(l.id)
            reconnected_list.append(
                ReconnectedItemResponse(
                    id=f"lost-{l.id}",
                    icon=get_category_icon(l.category),
                    title=l.title,
                    lostLocation=l.location,
                    matchedLocation="Campus Security / Office",
                    status="Recovered",
                    date=format_time_ago(l.updated_at or l.created_at),
                    founder="Verified & Reunited",
                    recovery_id=None,
                    lost_item_id=l.id,
                    found_item_id=None,
                    image_url=l.image_url,
                )
            )

    # Append direct user found items if not already included in recovery records
    for f in user_found:
        if f.id not in seen_found_ids:
            seen_found_ids.add(f.id)
            reconnected_list.append(
                ReconnectedItemResponse(
                    id=f"found-{f.id}",
                    icon=get_category_icon(f.category),
                    title=f.title,
                    lostLocation=f.location,
                    matchedLocation="Handed Over to Owner",
                    status="Returned",
                    date=format_time_ago(f.updated_at or f.created_at),
                    founder="Returned by You",
                    recovery_id=None,
                    lost_item_id=None,
                    found_item_id=f.id,
                    image_url=f.image_url,
                )
            )

    return reconnected_list


PREDEFINED_CAMPUSES = [
    "ABC University",
    "KITCoEK",
    "Example Institute of Technology",
    "Northbridge State University",
    "Lakeside Community College",
]

PREDEFINED_DEPARTMENTS = [
    "Computer Engineering",
    "Mechanical Engineering",
    "Electronics",
    "Civil Engineering",
    "Science",
    "Management",
]


@router.get("/campuses", response_model=List[str], summary="List predefined institution campuses")
def get_predefined_campuses() -> List[str]:
    """Returns verified campus directories for user profile selection."""
    return PREDEFINED_CAMPUSES


@router.get("/departments", response_model=List[str], summary="List predefined academic departments")
def get_predefined_departments() -> List[str]:
    """Returns verified departments for user profile selection."""
    return PREDEFINED_DEPARTMENTS

