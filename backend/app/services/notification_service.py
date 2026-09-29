import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.match import Match
from app.models.claim import Claim
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem

logger = logging.getLogger("tracelt.notifications")


def _dispatch_email_notification(user_id: int, title: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """
    Future extension hook for email delivery.
    When SMTP / SES credentials are configured, an email job can be dispatched
    without altering any of the in-app notification logic.
    """
    logger.info(f"[Email Notification Staging] Prepared email for User #{user_id}: '{title}'")


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    commit: bool = True,
) -> Notification:
    """
    Centralized notification creator with built-in deduplication protection.
    If an active notification with identical (user_id, type, related_entity_type, related_entity_id)
    already exists, it returns the existing notification instead of creating duplicates.
    """
    if related_entity_type and related_entity_id:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.type == type,
                Notification.related_entity_type == related_entity_type,
                Notification.related_entity_id == related_entity_id,
            )
            .first()
        )
        if existing:
            return existing

    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        extra_metadata=metadata or {},
        is_read=False,
    )

    db.add(notification)
    if commit:
        db.commit()
        db.refresh(notification)

    # Trigger future email sender
    _dispatch_email_notification(user_id, title, message, metadata)

    return notification


def notify_match_found(
    db: Session,
    match: Match,
    lost_item: LostItem,
    found_item: FoundItem,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the owner of the Lost Item that a possible match has been found on campus.
    """
    if not lost_item or not lost_item.user_id:
        return None

    title = "🔍 Possible Match Found"
    message = (
        f"We found a possible match for your {lost_item.title} "
        f"({match.total_score}% match with an item found in {found_item.location})."
    )
    metadata = {
        "match_id": match.id,
        "lost_item_id": lost_item.id,
        "found_item_id": found_item.id,
        "score": match.total_score,
    }

    return create_notification(
        db=db,
        user_id=lost_item.user_id,
        type="MATCH_FOUND",
        title=title,
        message=message,
        related_entity_type="match",
        related_entity_id=match.id,
        metadata=metadata,
        commit=commit,
    )


def notify_claim_submitted(
    db: Session,
    claim: Claim,
    match: Match,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the finder (owner of Found Item) that an ownership claim has been submitted.
    """
    if not match or not match.found_item or not match.found_item.user_id:
        return None

    finder_id = match.found_item.user_id
    found_title = match.found_item.title

    title = "📋 New Claim Request"
    message = f"Someone submitted an ownership claim for the {found_title} you reported found."
    metadata = {
        "claim_id": claim.id,
        "match_id": match.id,
        "found_item_id": match.found_item.id,
        "lost_item_id": match.lost_item_id,
    }

    return create_notification(
        db=db,
        user_id=finder_id,
        type="CLAIM_SUBMITTED",
        title=title,
        message=message,
        related_entity_type="claim",
        related_entity_id=claim.id,
        metadata=metadata,
        commit=commit,
    )


def notify_claim_approved(
    db: Session,
    claim: Claim,
    match: Match,
    reviewer_notes: Optional[str] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that their ownership claim was approved.
    """
    if not claim or not claim.claimant_id:
        return None

    found_title = match.found_item.title if match and match.found_item else "the item"

    title = "✓ Claim Approved"
    message = f"Your claim for {found_title} has been approved! Please coordinate return of the item."
    if reviewer_notes:
        message += f" Finder's note: {reviewer_notes}"

    metadata = {
        "claim_id": claim.id,
        "match_id": match.id if match else None,
        "reviewer_notes": reviewer_notes,
    }

    return create_notification(
        db=db,
        user_id=claim.claimant_id,
        type="CLAIM_APPROVED",
        title=title,
        message=message,
        related_entity_type="claim",
        related_entity_id=claim.id,
        metadata=metadata,
        commit=commit,
    )


def notify_claim_rejected(
    db: Session,
    claim: Claim,
    match: Match,
    reviewer_notes: Optional[str] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that their ownership claim was rejected by the finder.
    """
    if not claim or not claim.claimant_id:
        return None

    found_title = match.found_item.title if match and match.found_item else "the item"

    title = "Claim Update"
    message = f"Your claim for {found_title} was rejected by the finder."
    if reviewer_notes:
        message += f' Reviewer\'s note: "{reviewer_notes}"'

    metadata = {
        "claim_id": claim.id,
        "match_id": match.id if match else None,
        "reviewer_notes": reviewer_notes,
    }

    return create_notification(
        db=db,
        user_id=claim.claimant_id,
        type="CLAIM_REJECTED",
        title=title,
        message=message,
        related_entity_type="claim",
        related_entity_id=claim.id,
        metadata=metadata,
        commit=commit,
    )


def notify_claim_cancelled(
    db: Session,
    claim: Claim,
    match: Match,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the finder that a pending claim was cancelled by the claimant.
    """
    if not match or not match.found_item or not match.found_item.user_id:
        return None

    finder_id = match.found_item.user_id
    found_title = match.found_item.title

    title = "Claim Cancelled"
    message = f"The claimant has withdrawn their claim for {found_title}."
    metadata = {
        "claim_id": claim.id,
        "match_id": match.id,
    }

    return create_notification(
        db=db,
        user_id=finder_id,
        type="CLAIM_CANCELLED",
        title=title,
        message=message,
        related_entity_type="claim",
        related_entity_id=claim.id,
        metadata=metadata,
        commit=commit,
    )


def notify_item_recovered(
    db: Session,
    item: LostItem,
    user_id: int,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the lost item owner that their item has been marked as recovered.
    """
    if not item or not user_id:
        return None

    title = "🎉 Item Recovered"
    message = f"Your {item.title} has been marked as recovered."
    metadata = {
        "lost_item_id": item.id,
    }

    return create_notification(
        db=db,
        user_id=user_id,
        type="ITEM_RECOVERED",
        title=title,
        message=message,
        related_entity_type="lost_item",
        related_entity_id=item.id,
        metadata=metadata,
        commit=commit,
    )


def notify_item_returned(
    db: Session,
    recovery: Any,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that the finder has marked their item as returned,
    prompting them to confirm receipt.
    """
    if not recovery or not recovery.claimant_id:
        return None

    item_title = recovery.lost_item.title if recovery.lost_item else "Item"
    title = "🎉 Item Returned"
    message = f"The finder has marked your {item_title} as returned. Please confirm that you received it."
    metadata = {
        "recovery_id": recovery.id,
        "claim_id": recovery.claim_id,
        "return_location": recovery.return_location,
        "item_title": item_title,
    }

    return create_notification(
        db=db,
        user_id=recovery.claimant_id,
        type="ITEM_RETURNED",
        title=title,
        message=message,
        related_entity_type="recovery",
        related_entity_id=recovery.id,
        metadata=metadata,
        commit=commit,
    )


def notify_recovery_confirmed(
    db: Session,
    recovery: Any,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the finder that the claimant has confirmed item recovery.
    """
    if not recovery or not recovery.finder_id:
        return None

    item_title = recovery.found_item.title if recovery.found_item else (recovery.lost_item.title if recovery.lost_item else "Item")
    title = "✓ Recovery Confirmed"
    message = f"The claimant has confirmed that the {item_title} was successfully recovered."
    metadata = {
        "recovery_id": recovery.id,
        "claim_id": recovery.claim_id,
        "item_title": item_title,
    }

    return create_notification(
        db=db,
        user_id=recovery.finder_id,
        type="ITEM_RECOVERED",
        title=title,
        message=message,
        related_entity_type="recovery",
        related_entity_id=recovery.id,
        metadata=metadata,
        commit=commit,
    )


def notify_message_received(
    db: Session,
    recipient_id: int,
    sender_name: str,
    item_title: str,
    conversation_id: int,
    claim_id: int,
    message_content: str,
    message_id: int,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies a participant that they received a new message regarding an item.
    Never notifies the sender.
    """
    if not recipient_id or not conversation_id:
        return None

    preview = message_content[:60] + "..." if len(message_content) > 60 else message_content
    title = "💬 New Message"
    message = f"You received a message from {sender_name} regarding {item_title}: \"{preview}\""
    metadata = {
        "conversation_id": conversation_id,
        "claim_id": claim_id,
        "message_id": message_id,
        "sender_name": sender_name,
        "item_title": item_title,
    }

    return create_notification(
        db=db,
        user_id=recipient_id,
        type="MESSAGE_RECEIVED",
        title=title,
        message=message,
        related_entity_type="message",
        related_entity_id=message_id,
        metadata=metadata,
        commit=commit,
    )

