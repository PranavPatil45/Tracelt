from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.found_item import FoundItem
from app.models.user import User
from app.schemas.found_item import FoundItemCreate, FoundItemUpdate


def create_found_item(db: Session, item_in: FoundItemCreate, user: User) -> FoundItem:
    """Creates a new found item associated with the authenticated user."""
    db_item = FoundItem(
        user_id=user.id,
        campus=user.campus,
        title=item_in.title,
        category=item_in.category,
        description=item_in.description,
        location=item_in.location,
        found_date=item_in.found_date,
        found_time=item_in.found_time,
        image_url=item_in.image_url,
        status="AVAILABLE",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_found_item_by_id(db: Session, item_id: int) -> Optional[FoundItem]:
    """Retrieves a found item by ID."""
    return db.query(FoundItem).filter(FoundItem.id == item_id).first()


def get_found_items(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    location: Optional[str] = None,
    status: Optional[str] = None,
    campus: Optional[str] = None,
    search: Optional[str] = None,
) -> List[FoundItem]:
    """Retrieves a list of found items with optional filtering and search."""
    query = db.query(FoundItem)

    if category:
        query = query.filter(FoundItem.category.ilike(f"%{category}%"))
    if location:
        query = query.filter(FoundItem.location.ilike(f"%{location}%"))
    if status:
        query = query.filter(FoundItem.status == status.upper())
    if campus:
        query = query.filter(FoundItem.campus.ilike(f"%{campus}%"))
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                FoundItem.title.ilike(search_pattern),
                FoundItem.description.ilike(search_pattern),
                FoundItem.location.ilike(search_pattern),
                FoundItem.category.ilike(search_pattern),
            )
        )

    return query.order_by(FoundItem.created_at.desc()).offset(skip).limit(limit).all()


def get_user_found_items(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
) -> List[FoundItem]:
    """Retrieves all found items reported by a specific user."""
    return (
        db.query(FoundItem)
        .filter(FoundItem.user_id == user_id)
        .order_by(FoundItem.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_found_item(
    db: Session,
    db_item: FoundItem,
    item_update: FoundItemUpdate,
) -> FoundItem:
    """Updates an existing found item."""
    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)

    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_found_item(db: Session, db_item: FoundItem) -> None:
    """Deletes a found item, associated matches/claims, and its uploaded image if unreferenced."""
    from app.models.match import Match
    from app.models.claim import Claim
    from app.core.file_storage import delete_uploaded_file_if_unreferenced

    matches = db.query(Match).filter(Match.found_item_id == db_item.id).all()
    match_ids = [m.id for m in matches]
    if match_ids:
        db.query(Claim).filter(Claim.match_id.in_(match_ids)).delete(synchronize_session=False)
        db.query(Match).filter(Match.id.in_(match_ids)).delete(synchronize_session=False)

    image_url = db_item.image_url
    item_id = db_item.id

    db.delete(db_item)
    db.commit()

    if image_url:
        delete_uploaded_file_if_unreferenced(db, image_url, exclude_found_item_id=item_id)
