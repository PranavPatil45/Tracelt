from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func, desc

from app.models.user import User
from app.models.claim import Claim
from app.models.match import Match
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.conversation import Conversation
from app.models.conversation_participant import ConversationParticipant
from app.models.message import Message


def check_conversation_closure(claim: Optional[Claim], lost_item: Optional[LostItem], found_item: Optional[FoundItem]) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a conversation is in read-only / closed status.
    - Recovered item (found_item status == RECOVERED, or lost_item RECOVERED without approved claim) -> closed
    - Rejected / Cancelled claim -> closed
    - Active claim (PENDING, UNDER_REVIEW, APPROVED with item pending handover) -> active
    """
    if found_item and (found_item.status or "").upper() in ("RECOVERED", "RETURNED"):
        return True, "This conversation is closed because the item has been marked as recovered."

    if claim:
        claim_status = (claim.status or "").upper()
        if claim_status in ("REJECTED", "CANCELLED"):
            return True, f"This conversation is closed because the claim was {claim.status.lower()}."

        # If lost item was marked recovered and claim is not approved, it was recovered elsewhere
        if lost_item and (lost_item.status or "").upper() == "RECOVERED" and claim_status != "APPROVED":
            return True, "This conversation is closed because the item has been marked as recovered."

    return False, None


def get_or_create_conversation_for_claim(
    db: Session,
    claim_id: int,
    current_user: User,
) -> Conversation:
    """
    Idempotently returns or creates a conversation for a valid Claim.
    Only the Claimant or Finder can access.
    """
    claim = (
        db.query(Claim)
        .filter(Claim.id == claim_id)
        .options(
            joinedload(Claim.match).joinedload(Match.lost_item),
            joinedload(Claim.match).joinedload(Match.found_item),
            joinedload(Claim.claimant),
        )
        .first()
    )

    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Claim record not found.",
        )

    if not claim.match or not claim.match.found_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associated item report is missing or corrupted.",
        )

    claimant_id = claim.claimant_id
    finder_id = claim.match.found_item.user_id

    if current_user.id not in (claimant_id, finder_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to participate in conversations for this claim.",
        )

    # Check for existing conversation
    conv = (
        db.query(Conversation)
        .filter(Conversation.claim_id == claim.id)
        .options(
            joinedload(Conversation.participants),
            joinedload(Conversation.messages),
        )
        .first()
    )

    if conv:
        # Ensure participants exist
        existing_pids = {p.user_id for p in conv.participants}
        for uid in (claimant_id, finder_id):
            if uid not in existing_pids:
                new_p = ConversationParticipant(conversation_id=conv.id, user_id=uid)
                db.add(new_p)
        db.commit()
        db.refresh(conv)
        return conv

    # Create new conversation
    conv = Conversation(
        claim_id=claim.id,
        match_id=claim.match_id,
        last_message_at=func.now(),
    )
    db.add(conv)
    db.flush()

    p_claimant = ConversationParticipant(conversation_id=conv.id, user_id=claimant_id)
    p_finder = ConversationParticipant(conversation_id=conv.id, user_id=finder_id)
    db.add(p_claimant)
    db.add(p_finder)

    db.commit()
    db.refresh(conv)
    return conv


def get_conversation_by_id(db: Session, conversation_id: int) -> Optional[Conversation]:
    """Fetches conversation with eagerly loaded relationships."""
    return (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .options(
            joinedload(Conversation.claim).joinedload(Claim.claimant),
            joinedload(Conversation.match).joinedload(Match.lost_item),
            joinedload(Conversation.match).joinedload(Match.found_item),
            joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
            joinedload(Conversation.messages).joinedload(Message.sender),
        )
        .first()
    )


def format_conversation_summary(conv: Conversation, current_user: User, db: Session) -> Dict[str, Any]:
    """Constructs a front-end friendly summary of a conversation."""
    claim = conv.claim
    match = conv.match
    lost_item = match.lost_item if match else None
    found_item = match.found_item if match else None

    # Other participant
    other_user = None
    for p in conv.participants:
        if p.user_id != current_user.id:
            other_user = p.user
            break

    other_role = "Finder" if (claim and other_user and other_user.id == (found_item.user_id if found_item else None)) else "Claimant"
    other_summary = {
        "id": other_user.id,
        "full_name": other_user.full_name,
        "campus": other_user.campus or "Campus",
        "role": other_role,
    } if other_user else {
        "id": 0,
        "full_name": "Campus User",
        "campus": "Campus",
        "role": "User",
    }

    # Item summary
    item_source = found_item or lost_item
    item_summary = {
        "id": item_source.id if item_source else 0,
        "title": item_source.title if item_source else "Item Report",
        "category": item_source.category if item_source else "General",
        "location": item_source.location if item_source else "Campus",
        "status": item_source.status if item_source else "ACTIVE",
        "image_url": item_source.image_url if item_source else None,
        "item_type": "FOUND" if item_source == found_item else "LOST",
    } if item_source else None

    # Last message
    last_msg = None
    if conv.messages:
        sorted_msgs = sorted(conv.messages, key=lambda m: m.created_at, reverse=True)
        if sorted_msgs:
            lm = sorted_msgs[0]
            last_msg = {
                "id": lm.id,
                "conversation_id": lm.conversation_id,
                "sender_id": lm.sender_id,
                "sender_name": lm.sender.full_name if lm.sender else "User",
                "content": lm.content,
                "is_read": lm.is_read,
                "read_at": lm.read_at,
                "created_at": lm.created_at,
                "is_current_user": lm.sender_id == current_user.id,
            }

    # Unread count
    unread_count = sum(
        1 for m in conv.messages if m.sender_id != current_user.id and not m.is_read
    )

    # Closed status
    is_closed, close_reason = check_conversation_closure(claim, lost_item, found_item)

    return {
        "id": conv.id,
        "claim_id": conv.claim_id,
        "match_id": conv.match_id,
        "claim_status": claim.status if claim else "UNKNOWN",
        "item": item_summary,
        "other_participant": other_summary,
        "last_message": last_msg,
        "unread_count": unread_count,
        "is_closed": is_closed,
        "close_reason": close_reason,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at or conv.created_at,
    }


def get_user_conversations(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Dict[str, Any]], int, int]:
    """Lists conversations where current user is an active participant."""
    conv_query = (
        db.query(Conversation)
        .join(ConversationParticipant)
        .filter(ConversationParticipant.user_id == current_user.id)
        .options(
            joinedload(Conversation.claim).joinedload(Claim.claimant),
            joinedload(Conversation.match).joinedload(Match.lost_item),
            joinedload(Conversation.match).joinedload(Match.found_item),
            joinedload(Conversation.participants).joinedload(ConversationParticipant.user),
            joinedload(Conversation.messages).joinedload(Message.sender),
        )
        .order_by(desc(func.coalesce(Conversation.last_message_at, Conversation.created_at)))
    )

    total = conv_query.count()
    conversations = conv_query.offset(skip).limit(limit).all()

    formatted = [format_conversation_summary(c, current_user, db) for c in conversations]
    unread_total = get_total_unread_messages_count(db, current_user)

    return formatted, total, unread_total


def get_conversation_detail(db: Session, conversation_id: int, current_user: User) -> Dict[str, Any]:
    """Retrieves full conversation details including messages and source items."""
    conv = get_conversation_by_id(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    p_ids = [p.user_id for p in conv.participants]
    if current_user.id not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this conversation.",
        )

    summary = format_conversation_summary(conv, current_user, db)

    # Format messages
    sorted_msgs = sorted(conv.messages, key=lambda m: m.created_at)
    formatted_msgs = [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.full_name if m.sender else "User",
            "content": m.content,
            "is_read": m.is_read,
            "read_at": m.read_at,
            "created_at": m.created_at,
            "is_current_user": m.sender_id == current_user.id,
        }
        for m in sorted_msgs
    ]

    lost_item = conv.match.lost_item if conv.match else None
    found_item = conv.match.found_item if conv.match else None

    return {
        "id": conv.id,
        "claim_id": conv.claim_id,
        "match_id": conv.match_id,
        "claim_status": summary["claim_status"],
        "item": summary["item"],
        "other_participant": summary["other_participant"],
        "lost_item": {
            "id": lost_item.id,
            "title": lost_item.title,
            "category": lost_item.category,
            "location": lost_item.location,
            "status": lost_item.status,
            "image_url": lost_item.image_url,
        } if lost_item else None,
        "found_item": {
            "id": found_item.id,
            "title": found_item.title,
            "category": found_item.category,
            "location": found_item.location,
            "status": found_item.status,
            "image_url": found_item.image_url,
        } if found_item else None,
        "is_closed": summary["is_closed"],
        "close_reason": summary["close_reason"],
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "messages": formatted_msgs,
    }


def send_message(
    db: Session,
    conversation_id: int,
    current_user: User,
    content: str,
) -> Message:
    """
    Sends a message within an active conversation.
    Enforces participant authorization, character limits, and read-only checks.
    Notifies recipient via Notification service.
    """
    conv = get_conversation_by_id(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    p_ids = [p.user_id for p in conv.participants]
    if current_user.id not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to send messages in this conversation.",
        )

    # Check closure status
    claim = conv.claim
    lost_item = conv.match.lost_item if conv.match else None
    found_item = conv.match.found_item if conv.match else None
    is_closed, close_reason = check_conversation_closure(claim, lost_item, found_item)
    if is_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=close_reason or "This conversation is closed and no longer accepts messages.",
        )

    # Validate content
    if not content or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message content cannot be empty or whitespace.",
        )

    clean_content = content.strip()
    if len(clean_content) > 2000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message content cannot exceed 2000 characters.",
        )

    now = datetime.now(timezone.utc)
    message = Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=clean_content,
        is_read=False,
    )
    db.add(message)

    # Update conversation timestamps
    conv.last_message_at = now
    conv.updated_at = now

    # Update sender participant's last_read_at
    for p in conv.participants:
        if p.user_id == current_user.id:
            p.last_read_at = now
            break

    db.commit()
    db.refresh(message)

    # Notify other participant
    other_p = next((p for p in conv.participants if p.user_id != current_user.id), None)
    if other_p:
        item_title = found_item.title if found_item else (lost_item.title if lost_item else "Lost Item")
        from app.services.notification_service import notify_message_received
        notify_message_received(
            db=db,
            recipient_id=other_p.user_id,
            sender_name=current_user.full_name,
            item_title=item_title,
            conversation_id=conv.id,
            claim_id=conv.claim_id,
            message_content=clean_content,
            message_id=message.id,
            commit=True,
        )

    return message


def get_conversation_messages(
    db: Session,
    conversation_id: int,
    current_user: User,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[Dict[str, Any]], int]:
    """Retrieves paginated messages ordered oldest to newest."""
    conv = get_conversation_by_id(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    p_ids = [p.user_id for p in conv.participants]
    if current_user.id not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view messages in this conversation.",
        )

    query = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .options(joinedload(Message.sender))
        .order_by(Message.created_at.asc())
    )

    total = query.count()
    offset = (max(page, 1) - 1) * limit
    messages = query.offset(offset).limit(limit).all()

    formatted = [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.full_name if m.sender else "User",
            "content": m.content,
            "is_read": m.is_read,
            "read_at": m.read_at,
            "created_at": m.created_at,
            "is_current_user": m.sender_id == current_user.id,
        }
        for m in messages
    ]

    return formatted, total


def mark_conversation_as_read(
    db: Session,
    conversation_id: int,
    current_user: User,
) -> int:
    """Marks all unread incoming messages in the conversation as read."""
    conv = get_conversation_by_id(db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    p_ids = [p.user_id for p in conv.participants]
    if current_user.id not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this conversation.",
        )

    now = datetime.now(timezone.utc)
    unread_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        )
        .all()
    )

    marked_count = len(unread_messages)
    for m in unread_messages:
        m.is_read = True
        m.read_at = now

    for p in conv.participants:
        if p.user_id == current_user.id:
            p.last_read_at = now
            break

    db.commit()
    return marked_count


def get_total_unread_messages_count(db: Session, current_user: User) -> int:
    """Returns the total number of unread messages across all active user conversations."""
    return (
        db.query(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .join(ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id)
        .filter(
            ConversationParticipant.user_id == current_user.id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        )
        .count()
    )
