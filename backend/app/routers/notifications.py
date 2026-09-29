from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    MarkReadResponse,
)
from app.routers.auth import get_current_user

router = APIRouter(tags=["Notifications"])


@router.get(
    "/notifications",
    response_model=NotificationListResponse,
    summary="Get paginated notifications for authenticated user",
)
def list_notifications(
    page: int = Query(1, ge=1, description="Page number starting at 1"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    filter: Optional[str] = Query(None, description="Filter: all, unread, matches, claims, recoveries"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns paginated notifications strictly scoped to the authenticated user.
    """
    base_query = db.query(Notification).filter(Notification.user_id == current_user.id)

    # Filter by category/state
    if filter:
        f = filter.strip().lower()
        if f == "unread":
            base_query = base_query.filter(Notification.is_read.is_(False))
        elif f == "matches":
            base_query = base_query.filter(Notification.type == "MATCH_FOUND")
        elif f == "claims":
            base_query = base_query.filter(
                Notification.type.in_([
                    "CLAIM_SUBMITTED",
                    "CLAIM_APPROVED",
                    "CLAIM_REJECTED",
                    "CLAIM_CANCELLED",
                ])
            )
        elif f == "messages":
            base_query = base_query.filter(Notification.type == "MESSAGE_RECEIVED")
        elif f == "recoveries":
            base_query = base_query.filter(Notification.type == "ITEM_RECOVERED")

    total = base_query.count()

    # Total unread count for this user
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )

    offset = (page - 1) * limit
    notifications = (
        base_query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "notifications": notifications,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "limit": limit,
    }


@router.get(
    "/notifications/unread-count",
    response_model=UnreadCountResponse,
    summary="Get count of unread notifications for badge",
)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns unread notification count for the notification bell.
    """
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .count()
    )
    return {"count": count}


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark single notification as read",
)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks a single notification as read. Enforces user ownership.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this notification.",
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)

    return notification


@router.patch(
    "/notifications/read-all",
    response_model=MarkReadResponse,
    summary="Mark all unread notifications as read for current user",
)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks all notifications for the authenticated user as read.
    """
    now = datetime.now(timezone.utc)
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .update(
            {"is_read": True, "read_at": now},
            synchronize_session=False,
        )
    )
    db.commit()
    return {"updated": updated}


@router.delete(
    "/notifications/{notification_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a notification (owner only)",
)
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a notification. Only the owner is permitted.
    """
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this notification.",
        )

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted successfully"}
