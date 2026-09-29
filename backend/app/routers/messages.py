from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.deps import get_current_user
from app.schemas.conversation import UnreadMessagesCountResponse
from app.services import messaging_service

router = APIRouter(tags=["Messages"])


@router.get(
    "/messages/unread-count",
    response_model=UnreadMessagesCountResponse,
    summary="Get total count of unread messages across all user conversations",
)
def get_unread_messages_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Returns total unread incoming message count for badge displays in sidebar and header.
    """
    count = messaging_service.get_total_unread_messages_count(db=db, current_user=current_user)
    return {"count": count}
