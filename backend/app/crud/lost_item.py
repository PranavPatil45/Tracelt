from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.lost_item import LostItem
from app.models.user import User
from app.schemas.lost_item import LostItemCreate, LostItemUpdate


def create_lost_item(db: Session, item_in: LostItemCreate, user: User) -> LostItem:
    """Creates a new lost item associated with the authenticated user."""
    db_item = LostItem(
        user_id=user.id,
        campus=user.campus,
        title=item_in.title,
        category=item_in.category,
        description=item_in.description,
        location=item_in.location,
        lost_date=item_in.lost_date,
        lost_time=item_in.lost_time,
        image_url=item_in.image_url,
        status="ACTIVE",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_lost_item_by_id(db: Session, item_id: int) -> Optional[LostItem]:
    """Retrieves a lost item by ID."""
    return db.query(LostItem).filter(LostItem.id == item_id).first()


def get_lost_items(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    location: Optional[str] = None,
    status: Optional[str] = None,
    campus: Optional[str] = None,
    search: Optional[str] = None,
) -> List[LostItem]:
    """Retrieves a list of lost items with optional filtering and search."""
    query = db.query(LostItem)

    if category:
        query = query.filter(LostItem.category.ilike(f"%{category}%"))
    if location:
        query = query.filter(LostItem.location.ilike(f"%{location}%"))
    if status:
        query = query.filter(LostItem.status == status.upper())
    if campus:
        query = query.filter(LostItem.campus.ilike(f"%{campus}%"))
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                LostItem.title.ilike(search_pattern),
                LostItem.description.ilike(search_pattern),
                LostItem.location.ilike(search_pattern),
                LostItem.category.ilike(search_pattern),
            )
        )

    return query.order_by(LostItem.created_at.desc()).offset(skip).limit(limit).all()


def get_user_lost_items(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
) -> List[LostItem]:
    """Retrieves all lost items reported by a specific user."""
    return (
        db.query(LostItem)
        .filter(LostItem.user_id == user_id)
        .order_by(LostItem.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_lost_item(
    db: Session,
    db_item: LostItem,
    item_update: LostItemUpdate,
) -> LostItem:
    """Updates an existing lost item."""
    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)

    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_lost_item(db: Session, db_item: LostItem) -> None:
    """Deletes a lost item, associated matches/claims, and its uploaded image if unreferenced."""
    from app.models.match import Match
    from app.models.claim import Claim
    from app.core.file_storage import delete_uploaded_file_if_unreferenced

    matches = db.query(Match).filter(Match.lost_item_id == db_item.id).all()
    match_ids = [m.id for m in matches]
    if match_ids:
        db.query(Claim).filter(Claim.match_id.in_(match_ids)).delete(synchronize_session=False)
        db.query(Match).filter(Match.id.in_(match_ids)).delete(synchronize_session=False)

    image_url = db_item.image_url
    item_id = db_item.id

    db.delete(db_item)
    db.commit()

    if image_url:
        delete_uploaded_file_if_unreferenced(db, image_url, exclude_lost_item_id=item_id)
