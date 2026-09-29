from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.recovery import (
    HistoryResponse,
    HistoryStatsResponse,
)
from app.services.recovery_service import (
    get_user_history,
    get_history_stats,
)

router = APIRouter(tags=["Recovery & History"])


@router.get("/history", response_model=HistoryResponse)
def get_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status (RETURN_PENDING, RETURNED, RECOVERED)"),
    role: Optional[str] = Query(None, description="Filter by role (claimant, finder)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Retrieve paginated recovery and return history strictly for the authenticated user.
    """
    items, total, counts = get_user_history(
        db=db,
        current_user=current_user,
        page=page,
        limit=limit,
        status=status,
        role=role,
    )
    return HistoryResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        counts=counts,
    )


@router.get("/history/stats", response_model=HistoryStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Retrieve personal recovery statistics (items recovered, items returned, pending actions).
    """
    return get_history_stats(db=db, current_user=current_user)
