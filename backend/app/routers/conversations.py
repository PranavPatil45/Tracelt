from typing import Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.deps import get_current_user
from app.schemas.conversation import (
    ConversationListResponse,
    ConversationDetailResponse,
    ConversationSummary,
    MarkReadResponse,
)
from app.schemas.message import (
    MessageCreate,
    MessageResponse,
    MessageListResponse,
)
from app.services import messaging_service

router = APIRouter(tags=["Conversations"])


@router.post(
    "/claims/{claim_id}/conversation",
    response_model=ConversationSummary,
    status_code=status.HTTP_200_OK,
    summary="Get or create conversation for a claim",
)
def get_or_create_claim_conversation(
    claim_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Finds or creates a conversation between Claimant and Finder for an eligible claim.
    Only the Claimant or Finder can access.
    """
    conv = messaging_service.get_or_create_conversation_for_claim(
        db=db,
        claim_id=claim_id,
        current_user=current_user,
    )
    return messaging_service.format_conversation_summary(conv, current_user, db)


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List user's active conversations",
)
def list_user_conversations(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Returns all conversations belonging to the authenticated user with unread counts
    and last message previews.
    """
    skip = (page - 1) * limit
    conversations, total, unread_total = messaging_service.get_user_conversations(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
    )
    return {
        "conversations": conversations,
        "total": total,
        "unread_total": unread_total,
    }


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Get single conversation details",
)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Returns complete conversation info, participant profiles, source item data,
    and message history. Only participants can access.
    """
    return messaging_service.get_conversation_detail(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="Get paginated messages for a conversation",
)
def get_messages(
    conversation_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Retrieves message history for a conversation, ordered oldest to newest.
    """
    messages, total = messaging_service.get_conversation_messages(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        page=page,
        limit=limit,
    )
    return {
        "items": messages,
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a message in a conversation",
)
def send_message(
    conversation_id: int,
    message_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Sends a message within an active conversation.
    Rejects if user is unauthorized, message is empty, or conversation is closed (e.g. item recovered).
    """
    msg = messaging_service.send_message(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
        content=message_in.content,
    )
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.full_name,
        "content": msg.content,
        "is_read": msg.is_read,
        "read_at": msg.read_at,
        "created_at": msg.created_at,
        "is_current_user": True,
    }


@router.patch(
    "/conversations/{conversation_id}/read",
    response_model=MarkReadResponse,
    summary="Mark messages in a conversation as read",
)
def mark_conversation_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Marks all unread incoming messages in the conversation as read for the current user.
    """
    marked = messaging_service.mark_conversation_as_read(
        db=db,
        conversation_id=conversation_id,
        current_user=current_user,
    )
    return {
        "success": True,
        "marked_count": marked,
    }
