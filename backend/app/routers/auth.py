import uuid
from pathlib import Path
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.models.claim import Claim
from app.models.notification import Notification
from app.services import messaging_service
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    UserOut,
    Token,
    UserDashboardStats,
    UserProfileUpdate,
)
from app.crud.user import get_user_by_email, create_user, update_user_profile
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user
from app.core.file_storage import UPLOADS_DIR

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

router = APIRouter(tags=["Authentication"])


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(user_in: UserRegister, db: Session = Depends(get_db)) -> Any:
    """
    Registers a new user and returns an access token along with the user profile.
    Returns HTTP 409 if the email is already registered.
    """
    existing_user = get_user_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = create_user(db, user_in)
    access_token = create_access_token(subject=user.id)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    summary="Sign in with email and password",
)
def login(login_data: UserLogin, db: Session = Depends(get_db)) -> Any:
    """
    Authenticates user credentials and returns an access token along with user profile.
    Returns HTTP 401 if credentials do not match.
    """
    user = get_user_by_email(db, email=login_data.email)
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated.",
        )

    expires_delta = None
    if login_data.remember:
        expires_delta = timedelta(days=30)

    access_token = create_access_token(subject=user.id, expires_delta=expires_delta)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post(
    "/token",
    summary="OAuth2 compatible token login for Swagger UI documentation",
)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Any:
    """
    OAuth2 standard password flow endpoint enabling Swagger UI 'Authorize' button.
    Username field corresponds to email.
    """
    user = get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get(
    "/users/me",
    response_model=UserOut,
    summary="Retrieve current authenticated user profile",
)
@router.get(
    "/me",
    response_model=UserOut,
    summary="Retrieve current authenticated user profile (alias)",
)
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    """Returns profile information for the user authenticated via Bearer token."""
    return UserOut.model_validate(current_user)


@router.patch(
    "/users/me",
    response_model=UserOut,
    summary="Update current authenticated user profile",
)
@router.patch(
    "/me",
    response_model=UserOut,
    summary="Update current authenticated user profile (alias)",
)
def update_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Updates the authenticated user's profile details.
    Only permitted fields (full_name, phone, bio, campus, department, profile_image) are updated.
    Security: Privileged fields like id, email, role, is_active cannot be modified here.
    """
    update_data = profile_in.model_dump(exclude_unset=True)

    if "full_name" in update_data:
        name = (update_data["full_name"] or "").strip()
        if not name or len(name) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name must be at least 2 characters.",
            )
        update_data["full_name"] = name

    if "phone" in update_data:
        phone = (update_data["phone"] or "").strip()
        update_data["phone"] = phone if phone else None

    if "bio" in update_data:
        bio = (update_data["bio"] or "").strip()
        update_data["bio"] = bio if bio else None

    if "campus" in update_data:
        campus = (update_data["campus"] or "").strip()
        if not campus:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campus cannot be empty.",
            )
        update_data["campus"] = campus

    if "department" in update_data:
        dept = (update_data["department"] or "").strip()
        update_data["department"] = dept if dept else None

    if "profile_image" in update_data:
        img = update_data["profile_image"]
        update_data["profile_image"] = img.strip() if img and isinstance(img, str) else None

    updated_user = update_user_profile(db=db, user=current_user, profile_data=update_data)
    return UserOut.model_validate(updated_user)


@router.post(
    "/users/me/avatar",
    response_model=UserOut,
    summary="Upload profile picture for current user",
)
@router.post(
    "/me/avatar",
    response_model=UserOut,
    summary="Upload profile picture for current user (alias)",
)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Uploads a profile picture for the authenticated user.
    Validates file extension and MIME type.
    Saves to uploads directory and updates profile_image.
    """
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP.",
        )

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid image file.",
        )

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

    unique_filename = f"avatar_{uuid.uuid4().hex}{file_ext}"
    destination = UPLOADS_DIR / unique_filename

    try:
        with open(destination, "wb") as f:
            f.write(contents)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save avatar image on server.",
        )

    current_user.profile_image = f"/uploads/{unique_filename}"
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.delete(
    "/users/me/avatar",
    response_model=UserOut,
    summary="Remove profile picture for current user",
)
@router.delete(
    "/me/avatar",
    response_model=UserOut,
    summary="Remove profile picture for current user (alias)",
)
def remove_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Removes current user's profile photo."""
    current_user.profile_image = None
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.get(
    "/users/me/dashboard-stats",
    response_model=UserDashboardStats,
    summary="Get unified dashboard statistics and badge counts for current user",
)
@router.get(
    "/users/me/stats",
    response_model=UserDashboardStats,
    summary="Get unified dashboard statistics and badge counts for current user (alias)",
)
@router.get(
    "/dashboard/stats",
    response_model=UserDashboardStats,
    summary="Get unified dashboard statistics and badge counts for current user (alias)",
)
def get_user_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Returns database-backed statistics and badge counts strictly scoped to the authenticated user."""
    # 1. Lost items reported by current user
    lost_items_count = db.query(LostItem).filter(LostItem.user_id == current_user.id).count()

    # 2. Found items reported by current user
    found_items_count = db.query(FoundItem).filter(FoundItem.user_id == current_user.id).count()

    # 3. Active, valid matches relevant to the user (user owns lost or found item, score >= 60, not rejected)
    matches_count = (
        db.query(Match)
        .join(LostItem, Match.lost_item_id == LostItem.id)
        .join(FoundItem, Match.found_item_id == FoundItem.id)
        .filter(
            or_(LostItem.user_id == current_user.id, FoundItem.user_id == current_user.id),
            Match.status != "REJECTED",
            Match.total_score >= 60,
        )
        .count()
    )

    # 4. Claims relevant to user (claims submitted by user or incoming claims on user's found items)
    claims_count = (
        db.query(Claim)
        .join(Match, Claim.match_id == Match.id)
        .join(FoundItem, Match.found_item_id == FoundItem.id)
        .filter(
            or_(
                Claim.claimant_id == current_user.id,
                FoundItem.user_id == current_user.id,
            ),
            Claim.status.in_(["PENDING", "UNDER_REVIEW"]),
        )
        .distinct()
        .count()
    )

    # 5. Items successfully recovered by current user (lost items with status RECOVERED)
    recovered_count = (
        db.query(LostItem)
        .filter(LostItem.user_id == current_user.id, LostItem.status == "RECOVERED")
        .count()
    )

    # 6. Unread incoming messages
    unread_messages_count = messaging_service.get_total_unread_messages_count(db=db, current_user=current_user)

    # 7. Unread notifications
    unread_notifications_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )

    return UserDashboardStats(
        lost_items=lost_items_count,
        found_items=found_items_count,
        matches=matches_count,
        claims=claims_count,
        recovered=recovered_count,
        unread_messages=unread_messages_count,
        unread_notifications=unread_notifications_count,
    )
