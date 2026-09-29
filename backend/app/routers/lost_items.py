import os
import uuid
from pathlib import Path
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.lost_item import LostItem
from app.schemas.lost_item import (
    LostItemCreate,
    LostItemUpdate,
    LostItemResponse,
)
from app.crud.lost_item import (
    create_lost_item,
    get_lost_item_by_id,
    get_lost_items,
    get_user_lost_items,
    update_lost_item,
    delete_lost_item,
)
from app.core.deps import get_current_user
from app.services.matching_service import find_matches_for_lost_item

router = APIRouter(tags=["Lost Items"])

from app.core.file_storage import UPLOADS_DIR as UPLOAD_DIR

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post(
    "/lost-items",
    response_model=LostItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a new lost item",
)
def report_lost_item(
    item_in: LostItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Creates a new lost item report belonging to the authenticated user.
    The owner user_id is strictly derived from the authenticated JWT token.
    Automatically evaluates matching against eligible found items on campus.
    """
    db_item = create_lost_item(db=db, item_in=item_in, user=current_user)
    # Trigger matching engine against eligible found items on campus
    find_matches_for_lost_item(db=db, lost_item_id=db_item.id)
    return db_item


@router.get(
    "/lost-items",
    response_model=List[LostItemResponse],
    summary="List lost items with optional filters",
)
def list_lost_items(
    category: Optional[str] = Query(None, description="Filter by category"),
    location: Optional[str] = Query(None, description="Filter by location"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    campus: Optional[str] = Query(None, description="Filter by campus"),
    search: Optional[str] = Query(None, description="Search across title, description, and location"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> Any:
    """Retrieves all public lost item reports with pagination and filtering."""
    items = get_lost_items(
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
    "/users/me/lost-items",
    response_model=List[LostItemResponse],
    summary="Retrieve lost items reported by current user",
)
def get_my_lost_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns all lost items reported by the currently authenticated user."""
    items = get_user_lost_items(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return items


@router.get(
    "/lost-items/{id}",
    response_model=LostItemResponse,
    summary="Get single lost item by ID",
)
def get_single_lost_item(
    id: int,
    db: Session = Depends(get_db),
) -> Any:
    """Returns details of a specific lost item report."""
    item = get_lost_item_by_id(db=db, item_id=id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lost item not found.",
        )
    return item


@router.put(
    "/lost-items/{id}",
    response_model=LostItemResponse,
    summary="Update a lost item report (owner only)",
)
def edit_lost_item(
    id: int,
    item_in: LostItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Updates an existing lost item report.
    Only the user who reported the item is authorized to update it.
    """
    db_item = get_lost_item_by_id(db=db, item_id=id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lost item not found.",
        )

    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this report.",
        )

    old_status = (db_item.status or "").upper()
    updated_item = update_lost_item(db=db, db_item=db_item, item_update=item_in)
    if (updated_item.status or "").upper() == "RECOVERED" and old_status != "RECOVERED":
        from app.services.notification_service import notify_item_recovered
        notify_item_recovered(db=db, item=updated_item, user_id=current_user.id)

    return updated_item


@router.delete(
    "/lost-items/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a lost item report (owner only)",
)
def remove_lost_item(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Deletes a lost item report.
    Only the user who reported the item is authorized to delete it.
    """
    db_item = get_lost_item_by_id(db=db, item_id=id)
    if not db_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lost item not found.",
        )

    if db_item.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this report.",
        )

    delete_lost_item(db=db, db_item=db_item)
    return {"message": "Lost item report deleted successfully.", "id": id}


@router.post(
    "/upload-image",
    summary="Upload item image for lost or found reports",
)
@router.post(
    "/lost-items/upload-image",
    summary="Alias upload endpoint for item images",
)
async def upload_item_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Validates and stores an item photo on the local server.
    Accepts JPG, JPEG, PNG, WEBP files up to 5MB.
    Generates a secure UUID filename to prevent path traversal.
    """
    # 1. Validate file extension
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Only JPG, JPEG, PNG, and WEBP formats are accepted.",
        )

    # 2. Validate content type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid image.",
        )

    # 3. Read file contents and validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 5MB limit. Please choose a smaller image.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # 4. Generate safe unique filename
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    destination = UPLOAD_DIR / unique_filename

    # 5. Save file safely
    try:
        with open(destination, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store uploaded image on server.",
        )

    # 6. Return image URL
    return {
        "image_url": f"/uploads/{unique_filename}",
        "filename": unique_filename,
    }
