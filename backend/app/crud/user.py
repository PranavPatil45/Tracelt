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
