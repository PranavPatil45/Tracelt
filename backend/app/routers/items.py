from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud.lost_item import get_lost_item_by_id
from app.crud.found_item import get_found_item_by_id
from app.schemas.explore import ExploreItem
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(tags=["Items"])


@router.get(
    "/items/{item_type}/{item_id}",
    response_model=ExploreItem,
    summary="Get unified item details by type and ID",
)
def get_unified_item_details(
    item_type: str,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Returns normalized item details for a lost or found report by ID.
    Enforces that type is either 'lost' or 'found'.
    """
    norm_type = item_type.lower().strip()
    if norm_type not in ("lost", "found"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item type. Must be 'lost' or 'found'.",
        )

    if norm_type == "lost":
        item = get_lost_item_by_id(db=db, item_id=item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lost item not found.",
            )
        return ExploreItem(
            id=item.id,
            type="LOST",
            title=item.title,
            category=item.category,
            description=item.description,
            location=item.location,
            campus=item.campus,
            date=item.lost_date,
            time=item.lost_time,
            image_url=item.image_url,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
            user_id=item.user_id,
        )
    else:
        item = get_found_item_by_id(db=db, item_id=item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Found item not found.",
            )
        return ExploreItem(
            id=item.id,
            type="FOUND",
            title=item.title,
            category=item.category,
            description=item.description,
            location=item.location,
            campus=item.campus,
            date=item.found_date,
            time=item.found_time,
            image_url=item.image_url,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
            user_id=item.user_id,
        )
