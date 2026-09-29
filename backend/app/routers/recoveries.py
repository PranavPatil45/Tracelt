from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.recovery import (
    RecoveryResponse,
    RecoveryReturnRequest,
)
from app.services.recovery_service import (
    get_recovery_by_id,
    get_recovery_for_claim,
    format_recovery_response,
    mark_item_returned,
    confirm_recovery,
)

router = APIRouter(tags=["Recovery"])


@router.get("/recoveries/{recovery_id}", response_model=RecoveryResponse)
def get_recovery(
    recovery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Retrieve recovery details, status, participants, and progress timeline.
    Only accessible to the claimant or finder involved in this recovery.
    """
    recovery = get_recovery_by_id(db, recovery_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery record not found.",
        )

    if current_user.id not in (recovery.claimant_id, recovery.finder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this recovery process.",
        )

    return format_recovery_response(recovery, current_user, db)


@router.get("/claims/{claim_id}/recovery", response_model=RecoveryResponse)
def get_claim_recovery(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Look up the recovery record associated with a specific claim.
    Only accessible to the claimant or finder.
    """
    recovery = get_recovery_for_claim(db, claim_id)
    if not recovery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recovery tracking record found for this claim.",
        )

    if current_user.id not in (recovery.claimant_id, recovery.finder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this recovery process.",
        )

    return format_recovery_response(recovery, current_user, db)


@router.post("/recoveries/{recovery_id}/returned", response_model=RecoveryResponse)
def mark_returned(
    recovery_id: int,
    payload: RecoveryReturnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Mark an item as physically returned/handed over.
    Only the Finder can perform this action while recovery is in RETURN_PENDING status.
    """
    recovery = mark_item_returned(
        db=db,
        recovery_id=recovery_id,
        current_user=current_user,
        return_location=payload.return_location,
        return_notes=payload.return_notes,
    )
    return format_recovery_response(recovery, current_user, db)


@router.post("/recoveries/{recovery_id}/confirm", response_model=RecoveryResponse)
def confirm_item_recovery(
    recovery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Confirm receipt of the lost item, officially marking it RECOVERED.
    Only the Claimant can perform this action while recovery is in RETURNED status.
    """
    recovery = confirm_recovery(
        db=db,
        recovery_id=recovery_id,
        current_user=current_user,
    )
    return format_recovery_response(recovery, current_user, db)
