from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.claim import Claim
from app.schemas.claim import (
    ClaimCreate,
    ClaimReview,
    ClaimResponse,
    ClaimListResponse,
    ClaimUserSummary,
    ClaimItemSummary,
)
from app.crud.claim import (
    get_claim_by_id,
    get_claimant_claims,
    get_finder_claims,
    get_active_claim_for_match,
)
from app.services.claim_service import (
    create_claim,
    review_claim,
    cancel_claim,
)

router = APIRouter(tags=["Claims & Verification"])


def _serialize_claim(claim: Claim) -> ClaimResponse:
    """Helper to convert Claim ORM model to ClaimResponse schema."""
    claimant_summary = (
        ClaimUserSummary(
            id=claim.claimant.id,
            full_name=claim.claimant.full_name,
            campus=claim.claimant.campus,
        )
        if claim.claimant
        else None
    )

    lost_summary = None
    found_summary = None
    match_score = None

    if claim.match:
        match_score = claim.match.total_score
        if claim.match.lost_item:
            lost_summary = ClaimItemSummary(
                id=claim.match.lost_item.id,
                title=claim.match.lost_item.title,
                category=claim.match.lost_item.category,
                location=claim.match.lost_item.location,
                campus=claim.match.lost_item.campus,
                date=claim.match.lost_item.lost_date,
                image_url=claim.match.lost_item.image_url,
                status=claim.match.lost_item.status,
                user_id=claim.match.lost_item.user_id,
            )
        if claim.match.found_item:
            found_summary = ClaimItemSummary(
                id=claim.match.found_item.id,
                title=claim.match.found_item.title,
                category=claim.match.found_item.category,
                location=claim.match.found_item.location,
                campus=claim.match.found_item.campus,
                date=claim.match.found_item.found_date,
                image_url=claim.match.found_item.image_url,
                status=claim.match.found_item.status,
                user_id=claim.match.found_item.user_id,
            )

    return ClaimResponse(
        id=claim.id,
        match_id=claim.match_id,
        claimant_id=claim.claimant_id,
        claimant=claimant_summary,
        verification_details=claim.verification_details,
        additional_message=claim.additional_message,
        status=claim.status,
        reviewed_by=claim.reviewed_by,
        reviewed_at=claim.reviewed_at,
        reviewer_notes=claim.reviewer_notes,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
        lost_item=lost_summary,
        found_item=found_summary,
        match_score=match_score,
    )


@router.post(
    "/matches/{match_id}/claim",
    response_model=ClaimResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an ownership claim for a possible match",
)
def submit_match_claim(
    match_id: int,
    claim_in: ClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Submits ownership verification evidence for a found item.
    Claimant ID is strictly derived from the authenticated token.
    """
    claim = create_claim(
        db=db,
        match_id=match_id,
        claimant=current_user,
        verification_details=claim_in.verification_details,
        additional_message=claim_in.additional_message,
    )
    return _serialize_claim(claim)


@router.get(
    "/claims",
    response_model=ClaimListResponse,
    summary="List claims submitted by the current user (Claimant view)",
)
def list_my_submitted_claims(
    status_filter: str = Query("all", alias="status", description="Filter by status (PENDING, APPROVED, etc.)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieves all claims submitted by the authenticated user."""
    claims, total = get_claimant_claims(
        db=db,
        claimant_id=current_user.id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return ClaimListResponse(
        claims=[_serialize_claim(c) for c in claims],
        total=total,
    )


@router.get(
    "/claims/incoming",
    response_model=ClaimListResponse,
    summary="List claims awaiting review on items found by the current user (Finder view)",
)
@router.get(
    "/claims/to-review",
    response_model=ClaimListResponse,
    summary="List claims awaiting review (alias)",
)
def list_incoming_claims_to_review(
    status_filter: str = Query("all", alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieves all claims submitted by others on items reported as found by this user."""
    claims, total = get_finder_claims(
        db=db,
        finder_user_id=current_user.id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return ClaimListResponse(
        claims=[_serialize_claim(c) for c in claims],
        total=total,
    )


@router.get(
    "/claims/{claim_id}",
    response_model=ClaimResponse,
    summary="Get single claim details",
)
def get_claim_detail(
    claim_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Retrieves full claim details.
    Restricted to either the claimant or the finder of the item.
    """
    claim = get_claim_by_id(db, claim_id=claim_id)
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim request not found.",
        )

    # Authorization: claimant OR finder
    is_claimant = claim.claimant_id == current_user.id
    is_finder = (
        claim.match
        and claim.match.found_item
        and claim.match.found_item.user_id == current_user.id
    )

    if not (is_claimant or is_finder):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this claim.",
        )

    return _serialize_claim(claim)


@router.put(
    "/claims/{claim_id}/review",
    response_model=ClaimResponse,
    summary="Review claim (Finder action: APPROVE, REJECT, or UNDER_REVIEW)",
)
def review_claim_endpoint(
    claim_id: int,
    review_in: ClaimReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Processes finder approval or rejection of an ownership claim.
    Approval updates item statuses atomically.
    """
    updated_claim = review_claim(
        db=db,
        claim_id=claim_id,
        reviewer=current_user,
        action=review_in.action,
        reviewer_notes=review_in.reviewer_notes,
    )
    return _serialize_claim(updated_claim)


@router.post(
    "/claims/{claim_id}/cancel",
    response_model=ClaimResponse,
    summary="Cancel a pending claim (Claimant action)",
)
def cancel_claim_endpoint(
    claim_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Allows the claimant to withdraw a pending claim request."""
    cancelled = cancel_claim(db=db, claim_id=claim_id, claimant=current_user)
    return _serialize_claim(cancelled)


@router.get(
    "/matches/{match_id}/active-claim",
    summary="Check active claim status for a match",
)
def check_match_active_claim(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns active claim if exists for this match, else null."""
    claim = get_active_claim_for_match(db, match_id=match_id)
    if not claim:
        return {"has_active_claim": False, "claim": None}
    return {
        "has_active_claim": True,
        "claim": _serialize_claim(claim),
    }
