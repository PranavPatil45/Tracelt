from typing import List, Optional, Tuple
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from app.models.claim import Claim
from app.models.match import Match
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem


def get_claim_by_id(db: Session, claim_id: int) -> Optional[Claim]:
    """Retrieve claim with eager-loaded match, items, and claimant."""
    return (
        db.query(Claim)
        .filter(Claim.id == claim_id)
        .options(
            joinedload(Claim.match).joinedload(Match.lost_item),
            joinedload(Claim.match).joinedload(Match.found_item),
            joinedload(Claim.found_item),
            joinedload(Claim.lost_item),
            joinedload(Claim.claimant),
        )
        .first()
    )


def get_active_claim_for_match(
    db: Session,
    match_id: int,
    claimant_id: Optional[int] = None,
) -> Optional[Claim]:
    """Checks if an active claim already exists on a given match."""
    query = db.query(Claim).filter(
        Claim.match_id == match_id,
        Claim.status.in_(["PENDING", "UNDER_REVIEW", "APPROVED"]),
    )
    if claimant_id is not None:
        query = query.filter(Claim.claimant_id == claimant_id)
    return query.first()


def get_active_claim_for_found_item(
    db: Session,
    found_item_id: int,
    claimant_id: Optional[int] = None,
) -> Optional[Claim]:
    """Checks if an active claim already exists on a given found item (direct or match-based)."""
    query = (
        db.query(Claim)
        .outerjoin(Match, Claim.match_id == Match.id)
        .filter(
            or_(
                Claim.found_item_id == found_item_id,
                and_(Claim.found_item_id.is_(None), Match.found_item_id == found_item_id),
            ),
            Claim.status.in_(["PENDING", "UNDER_REVIEW", "APPROVED"]),
        )
    )
    if claimant_id is not None:
        query = query.filter(Claim.claimant_id == claimant_id)
    return query.first()


def get_claimant_claims(
    db: Session,
    claimant_id: int,
    status_filter: str = "all",
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Claim], int]:
    """Retrieve claims submitted by the authenticated user (Claimant view)."""
    query = (
        db.query(Claim)
        .filter(Claim.claimant_id == claimant_id)
        .options(
            joinedload(Claim.match).joinedload(Match.lost_item),
            joinedload(Claim.match).joinedload(Match.found_item),
            joinedload(Claim.found_item),
            joinedload(Claim.lost_item),
            joinedload(Claim.claimant),
        )
    )

    clean_status = (status_filter or "all").upper().strip()
    if clean_status != "ALL":
        query = query.filter(Claim.status == clean_status)

    total = query.count()
    claims = (
        query.order_by(Claim.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return claims, total


def get_finder_claims(
    db: Session,
    finder_user_id: int,
    status_filter: str = "all",
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Claim], int]:
    """Retrieve incoming claims submitted on items found by this user (Finder view)."""
    query = (
        db.query(Claim)
        .outerjoin(Match, Claim.match_id == Match.id)
        .join(
            FoundItem,
            or_(
                Claim.found_item_id == FoundItem.id,
                and_(Claim.found_item_id.is_(None), Match.found_item_id == FoundItem.id),
            ),
        )
        .filter(FoundItem.user_id == finder_user_id)
        .options(
            joinedload(Claim.match).joinedload(Match.lost_item),
            joinedload(Claim.match).joinedload(Match.found_item),
            joinedload(Claim.found_item),
            joinedload(Claim.lost_item),
            joinedload(Claim.claimant),
        )
    )

    clean_status = (status_filter or "all").upper().strip()
    if clean_status != "ALL":
        query = query.filter(Claim.status == clean_status)

    total = query.count()
    claims = (
        query.order_by(Claim.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return claims, total
