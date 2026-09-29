from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.match import Match
from app.schemas.match import (
    MatchResponse,
    MatchListResponse,
    MatchItemSummary,
    MatchSignals,
    MatchStatusUpdate,
)
from app.crud.match import (
    get_user_matches,
    get_lost_item_matches,
    get_found_item_matches,
    get_match_by_id,
    update_match_status,
)
from app.services.matching_service import scan_campus_matches

router = APIRouter(tags=["Matching System"])


def _serialize_match(match: Match) -> MatchResponse:
    """Helper to convert Match ORM instance to MatchResponse schema."""
    lost_summary = (
        MatchItemSummary(
            id=match.lost_item.id,
            title=match.lost_item.title,
            category=match.lost_item.category,
            location=match.lost_item.location,
            campus=match.lost_item.campus,
            date=match.lost_item.lost_date,
            time=match.lost_item.lost_time,
            image_url=match.lost_item.image_url,
            status=match.lost_item.status,
            user_id=match.lost_item.user_id,
        )
        if match.lost_item
        else None
    )

    found_summary = (
        MatchItemSummary(
            id=match.found_item.id,
            title=match.found_item.title,
            category=match.found_item.category,
            location=match.found_item.location,
            campus=match.found_item.campus,
            date=match.found_item.found_date,
            time=match.found_item.found_time,
            image_url=match.found_item.image_url,
            status=match.found_item.status,
            user_id=match.found_item.user_id,
        )
        if match.found_item
        else None
    )

    signals = MatchSignals(
        category=match.category_score,
        location=match.location_score,
        date=match.date_score,
        time=match.time_score,
        description=match.description_score,
    )

    return MatchResponse(
        id=match.id,
        lost_item_id=match.lost_item_id,
        found_item_id=match.found_item_id,
        score=match.total_score,
        status=match.status,
        signals=signals,
        reasons=match.reasons or [],
        lost_item=lost_summary,
        found_item=found_summary,
        created_at=match.created_at,
        updated_at=match.updated_at,
    )


@router.get(
    "/matches",
    response_model=MatchListResponse,
    summary="Get possible matches for authenticated user's reports",
)
@router.get(
    "/users/me/matches",
    response_model=MatchListResponse,
    summary="Get possible matches for authenticated user (alias)",
)
def list_user_matches(
    match_type: str = Query("all", alias="type", description="Filter by 'all', 'lost', or 'found'"),
    status_filter: str = Query("all", alias="status", description="Filter by 'all', 'POSSIBLE', 'REVIEWED', 'REJECTED'"),
    min_score: int = Query(60, ge=0, le=100, description="Minimum match score threshold"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Returns high-confidence possible matches relevant to the authenticated user.
    Only returns matches where the user owns either the Lost item or Found item.
    """
    matches, total = get_user_matches(
        db=db,
        user_id=current_user.id,
        match_type=match_type,
        status_filter=status_filter,
        min_score=min_score,
        skip=skip,
        limit=limit,
    )

    return MatchListResponse(
        matches=[_serialize_match(m) for m in matches],
        total=total,
    )


@router.get(
    "/lost-items/{lost_item_id}/matches",
    response_model=List[MatchResponse],
    summary="Get possible matches for a specific lost item report",
)
def get_matches_for_lost_item(
    lost_item_id: int,
    min_score: int = Query(60, ge=0, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns candidate found items matching this lost report."""
    matches = get_lost_item_matches(db=db, lost_item_id=lost_item_id, min_score=min_score)
    return [_serialize_match(m) for m in matches]


@router.get(
    "/found-items/{found_item_id}/matches",
    response_model=List[MatchResponse],
    summary="Get possible matches for a specific found item report",
)
def get_matches_for_found_item(
    found_item_id: int,
    min_score: int = Query(60, ge=0, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns candidate lost items matching this found report."""
    matches = get_found_item_matches(db=db, found_item_id=found_item_id, min_score=min_score)
    return [_serialize_match(m) for m in matches]


@router.get(
    "/matches/{match_id}",
    response_model=MatchResponse,
    summary="Get detailed match by ID",
)
def get_single_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieves full match information. Requires ownership of either item."""
    match = get_match_by_id(db=db, match_id=match_id)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found.",
        )

    # Permission check: must be owner of either the lost or found report
    is_owner = (
        (match.lost_item and match.lost_item.user_id == current_user.id)
        or (match.found_item and match.found_item.user_id == current_user.id)
    )
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this match.",
        )

    return _serialize_match(match)


@router.patch(
    "/matches/{match_id}/status",
    response_model=MatchResponse,
    summary="Update match status (e.g. REVIEWED, REJECTED, POSSIBLE)",
)
def change_match_status(
    match_id: int,
    status_update: MatchStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Allows report owner to acknowledge (REVIEWED) or dismiss (REJECTED) a possible match."""
    match = get_match_by_id(db=db, match_id=match_id)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found.",
        )

    # Permission check: must be owner of either the lost or found report
    is_owner = (
        (match.lost_item and match.lost_item.user_id == current_user.id)
        or (match.found_item and match.found_item.user_id == current_user.id)
    )
    if not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this match.",
        )

    updated = update_match_status(db=db, match=match, new_status=status_update.status)
    return _serialize_match(updated)


@router.post(
    "/matches/scan",
    summary="Trigger on-demand matching scan for campus",
)
def trigger_scan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Manually triggers the rule-based matching engine for the user's campus."""
    matches_count = scan_campus_matches(db=db, campus=current_user.campus)
    return {
        "status": "success",
        "campus": current_user.campus,
        "matches_evaluated": matches_count,
    }
