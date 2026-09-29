from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.models.match import Match
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem


def get_user_matches(
    db: Session,
    user_id: int,
    match_type: str = "all",
    status_filter: str = "all",
    min_score: int = 60,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Match], int]:
    """
    Returns matches relevant to the authenticated user (user is owner of lost_item OR found_item).
    Filters by type ('all', 'lost', 'found'), status, and min_score.
    """
    query = (
        db.query(Match)
        .join(LostItem, Match.lost_item_id == LostItem.id)
        .join(FoundItem, Match.found_item_id == FoundItem.id)
        .options(
            joinedload(Match.lost_item),
            joinedload(Match.found_item),
        )
    )

    # Scoping to user ownership
    type_clean = (match_type or "all").lower().strip()
    if type_clean == "lost":
        query = query.filter(LostItem.user_id == user_id)
    elif type_clean == "found":
        query = query.filter(FoundItem.user_id == user_id)
    else:
        query = query.filter(or_(LostItem.user_id == user_id, FoundItem.user_id == user_id))

    # Status filter
    status_clean = (status_filter or "all").upper().strip()
    if status_clean != "ALL":
        query = query.filter(Match.status == status_clean)
    else:
        # By default exclude REJECTED from the main view unless explicitly asked
        query = query.filter(Match.status != "REJECTED")

    # Minimum score filter
    query = query.filter(Match.total_score >= min_score)

    total = query.count()
    matches = (
        query.order_by(Match.total_score.desc(), Match.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return matches, total


def get_lost_item_matches(
    db: Session,
    lost_item_id: int,
    min_score: int = 60,
) -> List[Match]:
    """Returns matches for a specific LostItem, ordered by score descending."""
    return (
        db.query(Match)
        .filter(
            Match.lost_item_id == lost_item_id,
            Match.total_score >= min_score,
            Match.status != "REJECTED",
        )
        .options(
            joinedload(Match.lost_item),
            joinedload(Match.found_item),
        )
        .order_by(Match.total_score.desc())
        .all()
    )


def get_found_item_matches(
    db: Session,
    found_item_id: int,
    min_score: int = 60,
) -> List[Match]:
    """Returns matches for a specific FoundItem, ordered by score descending."""
    return (
        db.query(Match)
        .filter(
            Match.found_item_id == found_item_id,
            Match.total_score >= min_score,
            Match.status != "REJECTED",
        )
        .options(
            joinedload(Match.lost_item),
            joinedload(Match.found_item),
        )
        .order_by(Match.total_score.desc())
        .all()
    )


def get_match_by_id(db: Session, match_id: int) -> Optional[Match]:
    """Fetches a match by its primary key with eager-loaded items."""
    return (
        db.query(Match)
        .filter(Match.id == match_id)
        .options(
            joinedload(Match.lost_item),
            joinedload(Match.found_item),
        )
        .first()
    )


def update_match_status(
    db: Session,
    match: Match,
    new_status: str,
) -> Match:
    """Updates the match status (e.g., POSSIBLE -> REVIEWED or REJECTED)."""
    match.status = new_status.upper().strip()
    db.commit()
    db.refresh(match)
    return match
