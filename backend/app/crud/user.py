from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.auth import UserRegister
from app.core.security import get_password_hash


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieves a user by lowercase trimmed email."""
    return db.query(User).filter(User.email == email.lower().strip()).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieves a user by primary key ID."""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_in: UserRegister) -> User:
    """Creates a new user record with securely hashed password."""
    hashed_password = get_password_hash(user_in.password)
    user_role = (getattr(user_in, "role", None) or "student").strip().lower()
    db_user = User(
        email=user_in.email.lower().strip(),
        full_name=user_in.full_name.strip(),
        hashed_password=hashed_password,
        campus=user_in.campus.strip(),
        department=user_in.department.strip() if user_in.department else None,
        role=user_role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_google_sub(db: Session, google_sub: str) -> Optional[User]:
    """Retrieves a user by unique Google subject identifier."""
    if not google_sub:
        return None
    return db.query(User).filter(User.google_sub == str(google_sub).strip()).first()


def create_google_user(
    db: Session,
    google_data: dict,
    campus: Optional[str] = None,
    department: Optional[str] = None,
) -> User:
    """
    Creates a new user record authenticated via Google Identity Services.
    - Stable Google sub stored in `google_sub`
    - Email marked as verified
    - Default role is strictly 'student'
    - Hashed password is set to an unusable random marker to satisfy DB constraints safely
    """
    import uuid

    email = google_data["email"].lower().strip()
    full_name = google_data.get("name") or email.split("@")[0]
    sub = google_data["sub"]
    picture = google_data.get("picture")

    resolved_campus = (campus or "").strip() or "Not Specified"
    resolved_dept = (department or "").strip() or None

    # Unusable password placeholder for accounts created directly via Google
    placeholder_password = f"!google_oauth_{uuid.uuid4().hex}"

    db_user = User(
        email=email,
        full_name=full_name,
        hashed_password=placeholder_password,
        campus=resolved_campus,
        department=resolved_dept,
        role="student",  # Always default user role
        google_sub=sub,
        auth_provider="google",
        email_verified=True,
        profile_image=picture,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def link_google_account(
    db: Session,
    user: User,
    google_sub: str,
    email_verified: bool = True,
    profile_image: Optional[str] = None,
) -> User:
    """Links a verified Google subject identifier to an existing user."""
    user.google_sub = str(google_sub).strip()
    if email_verified:
        user.email_verified = True
    if user.has_usable_password:
        user.auth_provider = "both"
    else:
        user.auth_provider = "google"
    if profile_image and not user.profile_image:
        user.profile_image = profile_image
    db.commit()
    db.refresh(user)
    return user


def unlink_google_account(db: Session, user: User) -> User:
    """Unlinks Google identity from user account."""
    user.google_sub = None
    user.auth_provider = "email"
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(db: Session, user: User, profile_data: dict) -> User:
    """
    Updates permitted profile fields for the authenticated user.
    Strictly filters against allowed profile fields.
    """
    allowed_fields = {"full_name", "phone", "bio", "campus", "department", "profile_image"}
    for key, value in profile_data.items():
        if key in allowed_fields:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user

