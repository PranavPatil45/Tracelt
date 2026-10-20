from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.claim import Claim
from app.schemas.claim import (
    ClaimCreate,
    DirectClaimCreate,
    ClaimReview,
    ClaimDisputeRequest,
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
    get_active_claim_for_found_item,
)
from app.services.claim_service import (
    create_claim,
    create_direct_claim,
    review_claim,
    raise_claim_dispute,
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

    target_lost = claim.lost_item or (claim.match.lost_item if claim.match else None)
    if target_lost:
        lost_summary = ClaimItemSummary(
            id=target_lost.id,
            title=target_lost.title,
            category=target_lost.category,
            location=target_lost.location,
            campus=target_lost.campus,
            date=target_lost.lost_date,
            image_url=target_lost.image_url,
            status=target_lost.status,
            user_id=target_lost.user_id,
        )

    target_found = claim.found_item or (claim.match.found_item if claim.match else None)
    if target_found:
        found_summary = ClaimItemSummary(
            id=target_found.id,
            title=target_found.title,
            category=target_found.category,
            location=target_found.location,
            campus=target_found.campus,
            date=target_found.found_date,
            image_url=target_found.image_url,
            status=target_found.status,
            user_id=target_found.user_id,
        )

    if claim.match:
        match_score = claim.match.total_score

    return ClaimResponse(
        id=claim.id,
        match_id=claim.match_id,
        found_item_id=target_found.id if target_found else claim.found_item_id,
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
        review_status=claim.review_status or "NOT_REQUIRED",
        review_reason=claim.review_reason,
        review_decision_notes=claim.review_decision_notes,
        review_decision_by=claim.review_decision_by,
        review_decision_at=claim.review_decision_at,
        handover_method=claim.handover_method or "DIRECT",
        is_mandatory_review=bool(claim.is_mandatory_review),
        is_mandatory_otp=bool(claim.is_mandatory_otp),
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
    Submits ownership verification evidence for a found item via automated match.
    Claimant ID is strictly derived from the authenticated token.
    """
    claim = create_claim(
        db=db,
        match_id=match_id,
        claimant=current_user,
        verification_details=claim_in.verification_details,
        additional_message=claim_in.additional_message,
        preferred_handover_method=getattr(claim_in, "preferred_handover_method", "DIRECT"),
    )
    return _serialize_claim(claim)


@router.post(
    "/found-items/{found_item_id}/claim",
    response_model=ClaimResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a direct ownership claim for a found item",
)
def submit_direct_claim(
    found_item_id: int,
    claim_in: ClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Submits ownership verification evidence directly for a found item
    without requiring an automated match record.
    Claimant ID is strictly derived from the authenticated token.
    """
    claim = create_direct_claim(
        db=db,
        found_item_id=found_item_id,
        claimant=current_user,
        verification_details=claim_in.verification_details,
        additional_message=claim_in.additional_message,
        preferred_handover_method=getattr(claim_in, "preferred_handover_method", "DIRECT"),
    )
    return _serialize_claim(claim)


@router.post(
    "/lost-items/{lost_item_id}/claim",
    status_code=status.HTTP_400_BAD_REQUEST,
    summary="Reject claim attempts on lost items",
)
def reject_lost_item_claim(
    lost_item_id: int,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Explicitly rejects any attempt to submit an ownership claim for a lost item report.
    Only found items can be claimed.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Cannot claim a lost item report. Ownership claims can only be submitted for found items.",
    )


@router.post(
    "/claims",
    response_model=ClaimResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Unified claim creation (direct or match-based)",
)
def submit_claim_unified(
    claim_in: DirectClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Submits an ownership claim either by found_item_id (direct) or match_id (match-based).
    """
    if getattr(claim_in, "lost_item_id", None) and not claim_in.match_id and not claim_in.found_item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot claim a lost item report. Ownership claims can only be submitted for found items.",
        )

    if claim_in.match_id:
        claim = create_claim(
            db=db,
            match_id=claim_in.match_id,
            claimant=current_user,
            verification_details=claim_in.verification_details,
            additional_message=claim_in.additional_message,
            preferred_handover_method=getattr(claim_in, "preferred_handover_method", "DIRECT"),
        )
    elif claim_in.found_item_id:
        claim = create_direct_claim(
            db=db,
            found_item_id=claim_in.found_item_id,
            claimant=current_user,
            verification_details=claim_in.verification_details,
            additional_message=claim_in.additional_message,
            preferred_handover_method=getattr(claim_in, "preferred_handover_method", "DIRECT"),
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either found_item_id or match_id is required to submit a claim.",
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
    target_found = claim.found_item or (claim.match.found_item if claim.match else None)
    is_finder = target_found is not None and target_found.user_id == current_user.id

    if not (is_claimant or is_finder):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this claim.",
        )

    return _serialize_claim(claim)


@router.put(
    "/claims/{claim_id}/review",
    response_model=ClaimResponse,
    summary="Review claim (Finder or Reviewer action)",
)
def review_claim_endpoint(
    claim_id: int,
    review_in: ClaimReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Processes finder or reviewer action on an ownership claim.
    Supports routine direct approval, finder review request, and dispute.
    """
    updated_claim = review_claim(
        db=db,
        claim_id=claim_id,
        reviewer=current_user,
        action=review_in.action,
        reviewer_notes=review_in.reviewer_notes,
        requires_reviewer=review_in.requires_reviewer,
        handover_method=review_in.handover_method,
        review_reason=review_in.review_reason,
    )
    return _serialize_claim(updated_claim)


@router.post(
    "/claims/{claim_id}/dispute",
    response_model=ClaimResponse,
    summary="Raise a dispute on an ownership claim",
)
def dispute_claim_endpoint(
    claim_id: int,
    dispute_in: ClaimDisputeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Raises a dispute on a claim request.
    Transitions review_status to DISPUTED and halts routine processing.
    """
    disputed_claim = raise_claim_dispute(
        db=db,
        claim_id=claim_id,
        current_user=current_user,
        reason=dispute_in.reason,
    )
    return _serialize_claim(disputed_claim)


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


@router.get(
    "/found-items/{found_item_id}/active-claim",
    summary="Check active claim status for a found item",
)
def check_found_item_active_claim(
    found_item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns active claim if exists for this found item for current user, else null."""
    claim = get_active_claim_for_found_item(db, found_item_id=found_item_id, claimant_id=current_user.id)
    if not claim:
        return {"has_active_claim": False, "claim": None}
    return {
        "has_active_claim": True,
        "claim": _serialize_claim(claim),
    }
