from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.found_item import FoundItem
from app.schemas.found_item import (
    FoundItemCreate,
    FoundItemUpdate,
    FoundItemResponse,
)
from app.crud.found_item import (
    create_found_item,
    get_found_item_by_id,
    get_found_items,
    get_user_found_items,
    update_found_item,
    delete_found_item,
)
from app.core.deps import get_current_user
from app.services.matching_service import find_matches_for_found_item

router = APIRouter(tags=["Found Items"])


@router.post(
    "/found-items",
    response_model=FoundItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a new found item",
)
def report_found_item(
    item_in: FoundItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Creates a new found item report belonging to the authenticated user.
    The finder user_id is strictly derived from the authenticated JWT token.
    Initial status is set to AVAILABLE.
    Automatically evaluates matching against eligible lost items on campus.
    """
    db_item = create_found_item(db=db, item_in=item_in, user=current_user)
    # Trigger matching engine against eligible lost items on campus
    find_matches_for_found_item(db=db, found_item_id=db_item.id)
    return db_item


@router.get(
    "/found-items",
    response_model=List[FoundItemResponse],
    summary="List found items with optional filters",
)
def list_found_items(
    category: Optional[str] = Query(None, description="Filter by category"),
    location: Optional[str] = Query(None, description="Filter by location"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (AVAILABLE, MATCHED, etc.)"),
    campus: Optional[str] = Query(None, description="Filter by campus"),
    search: Optional[str] = Query(None, description="Search across title, description, and location"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieves all public found item reports with pagination and filtering."""
    items = get_found_items(
        db=db,
        skip=skip,
        limit=limit,
        category=category,
        location=location,
        status=status_filter,
        campus=campus,
        search=search,
    )
    return items


@router.get(
    "/users/me/found-items",
    response_model=List[FoundItemResponse],
    summary="Retrieve found items reported by current user",
)
def get_my_found_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns all found items reported by the currently authenticated user."""
    items = get_user_found_items(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return items


@router.get(
    "/found-items/{id}",
    response_model=FoundItemResponse,
    summary="Get single found item by ID",
)
def get_single_found_item(
    id: int,
    db: Session = Depends(get_db),
) -> Any:
    """Returns details of a specific found item report."""
    item = get_found_item_by_id(db=db, item_id=id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Found item not found.",
        )
    return item


@router.put(
    "/found-items/{id}",
    response_model=FoundItemResponse,
    summary="Update a found item report (owner only)",
)
def edit_found_item(
    id: int,
    item_in: FoundItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Updates an existing found item report.
    Only the user who reported the item is authorized to update it.
    """
    db_item = get_found_item_by_id(db=db, item_id=id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Found item not found.",
        )

    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this report.",
        )

    updated_item = update_found_item(db=db, db_item=db_item, item_update=item_in)
    return updated_item


@router.delete(
    "/found-items/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a found item report (owner only)",
)
def remove_found_item(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Deletes a found item report.
    Only the user who reported the item is authorized to delete it.
    """
    db_item = get_found_item_by_id(db=db, item_id=id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Found item not found.",
        )

    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this report.",
        )

    delete_found_item(db=db, db_item=db_item)
    return {"message": "Found item report deleted successfully.", "id": id}
