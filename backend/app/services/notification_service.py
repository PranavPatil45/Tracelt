import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.match import Match
from app.models.claim import Claim
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.recovery import Recovery

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
    match: Optional[Match] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the finder (owner of Found Item) that an ownership claim has been submitted.
    """
    found_item = claim.found_item if (claim and claim.found_item) else (match.found_item if match else None)
    if not found_item or not found_item.user_id:
        return None

    finder_id = found_item.user_id
    found_title = found_item.title

    title = "📋 New Claim Request"
    message = f"Someone submitted an ownership claim for the {found_title} you reported found."
    metadata = {
        "claim_id": claim.id,
        "match_id": match.id if match else None,
        "found_item_id": found_item.id,
        "lost_item_id": match.lost_item_id if match else (claim.lost_item_id if claim else None),
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
    match: Optional[Match] = None,
    reviewer_notes: Optional[str] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that their ownership claim was approved.
    """
    if not claim or not claim.claimant_id:
        return None

    found_item = claim.found_item if (claim and claim.found_item) else (match.found_item if match else None)
    found_title = found_item.title if found_item else "the item"

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
    match: Optional[Match] = None,
    reviewer_notes: Optional[str] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that their ownership claim was rejected by the finder.
    """
    if not claim or not claim.claimant_id:
        return None

    found_item = claim.found_item if (claim and claim.found_item) else (match.found_item if match else None)
    found_title = found_item.title if found_item else "the item"

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
    match: Optional[Match] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the finder that a pending claim was cancelled by the claimant.
    """
    found_item = claim.found_item if (claim and claim.found_item) else (match.found_item if match else None)
    if not found_item or not found_item.user_id:
        return None

    finder_id = found_item.user_id
    found_title = found_item.title

    title = "Claim Cancelled"
    message = f"The claimant has withdrawn their claim for {found_title}."
    metadata = {
        "claim_id": claim.id,
        "match_id": match.id if match else None,
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

    item_title = recovery.lost_item.title if recovery.lost_item else (recovery.found_item.title if recovery.found_item else "Item")
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


# -------------------------------------------------------------
# TASK 3: HYBRID REVIEWER, DISPUTE & OTP NOTIFICATIONS
# -------------------------------------------------------------

def _get_admin_and_reviewer_ids(db: Session) -> list[int]:
    """Helper to query all active staff reviewers and administrators."""
    from app.models.user import User
    users = (
        db.query(User.id)
        .filter(
            User.role.in_(["admin", "superadmin", "administrator", "reviewer"]),
            User.is_active.is_(True),
        )
        .all()
    )
    return [u[0] for u in users]


def notify_reviewer_intervention_required(
    db: Session,
    claim: Claim,
    reason: str,
    commit: bool = True,
) -> None:
    """
    Notifies staff reviewers and claim participants that reviewer intervention is required.
    """
    item_title = claim.found_item.title if claim.found_item else "Found Item"
    reason_clean = reason.replace("_", " ").title()

    # 1. Notify Claimant
    create_notification(
        db=db,
        user_id=claim.claimant_id,
        type="REVIEW_REQUIRED",
        title="🛡️ Claim Under Staff Review",
        message=f"Your claim for {item_title} is being reviewed by campus staff ({reason_clean}).",
        related_entity_type="claim",
        related_entity_id=claim.id,
        metadata={"claim_id": claim.id, "reason": reason},
        commit=commit,
    )

    # 2. Notify Finder
    finder_id = claim.found_item.user_id if claim.found_item else None
    if finder_id and finder_id != claim.claimant_id:
        create_notification(
            db=db,
            user_id=finder_id,
            type="REVIEW_REQUIRED",
            title="🛡️ Claim Routed to Staff Review",
            message=f"The claim on your found item ({item_title}) requires campus staff review ({reason_clean}).",
            related_entity_type="claim",
            related_entity_id=claim.id,
            metadata={"claim_id": claim.id, "reason": reason},
            commit=commit,
        )

    # 3. Notify Reviewers & Admins
    for admin_id in _get_admin_and_reviewer_ids(db):
        if admin_id not in (claim.claimant_id, finder_id):
            create_notification(
                db=db,
                user_id=admin_id,
                type="REVIEWER_QUEUE_ENTRY",
                title="📋 New Case Awaiting Staff Review",
                message=f"Claim #{claim.id} for {item_title} requires review ({reason_clean}).",
                related_entity_type="claim",
                related_entity_id=claim.id,
                metadata={"claim_id": claim.id, "reason": reason},
                commit=commit,
            )


def notify_review_decision(
    db: Session,
    claim: Claim,
    action: Optional[str] = None,
    reviewer_notes: Optional[str] = None,
    commit: bool = True,
    decision: Optional[str] = None,
) -> None:
    """
    Notifies participants when a Reviewer approves or rejects a case.
    """
    act = (decision or action or "APPROVE").upper()
    item_title = claim.found_item.title if claim.found_item else "Item"
    notes_preview = f' Notes: "{reviewer_notes}"' if reviewer_notes else ""

    if act in ("APPROVE", "APPROVED"):
        # Claimant
        create_notification(
            db=db,
            user_id=claim.claimant_id,
            type="REVIEW_APPROVED",
            title="✅ Staff Review Approved",
            message=f"A campus reviewer has approved your claim for {item_title}. You may now proceed with return coordination.{notes_preview}",
            related_entity_type="claim",
            related_entity_id=claim.id,
            metadata={"claim_id": claim.id, "action": "APPROVE"},
            commit=commit,
        )
        # Finder
        finder_id = claim.found_item.user_id if claim.found_item else None
        if finder_id and finder_id != claim.claimant_id:
            create_notification(
                db=db,
                user_id=finder_id,
                type="REVIEW_APPROVED",
                title="✅ Staff Review Approved Claim",
                message=f"A campus reviewer has verified ownership for {item_title}. Physical return can now proceed.{notes_preview}",
                related_entity_type="claim",
                related_entity_id=claim.id,
                metadata={"claim_id": claim.id, "action": "APPROVE"},
                commit=commit,
            )
    elif act in ("REJECT", "REJECTED"):
        # Claimant
        create_notification(
            db=db,
            user_id=claim.claimant_id,
            type="REVIEW_REJECTED",
            title="❌ Staff Review Rejected Claim",
            message=f"A campus reviewer has rejected the claim for {item_title}.{notes_preview}",
            related_entity_type="claim",
            related_entity_id=claim.id,
            metadata={"claim_id": claim.id, "action": "REJECT"},
            commit=commit,
        )


def notify_dispute_raised(
    db: Session,
    recovery_id: Optional[int] = None,
    disputer_id: Optional[int] = None,
    disputer_name: Optional[str] = None,
    recipient_id: Optional[int] = None,
    reason: Optional[str] = None,
    commit: bool = True,
    recovery_or_claim: Optional[Any] = None,
    disputed_by_name: Optional[str] = None,
) -> None:
    """
    Notifies the other participant and reviewers when a dispute is raised.
    """
    if recovery_or_claim is not None:
        name = disputed_by_name or disputer_name or "A participant"
        rsn = reason or getattr(recovery_or_claim, "dispute_reason", "") or "Unspecified dispute"

        if isinstance(recovery_or_claim, Recovery):
            rec = recovery_or_claim
            entity_type = "recovery"
            entity_id = rec.id
            d_id = getattr(rec, "disputed_by", None) or getattr(rec, "dispute_raised_by", None)
            r_id = rec.finder_id if d_id == rec.claimant_id else rec.claimant_id
        elif isinstance(recovery_or_claim, Claim):
            cl = recovery_or_claim
            entity_type = "claim"
            entity_id = cl.id
            d_id = getattr(cl, "disputed_by", None) or getattr(cl, "reviewed_by", None)
            finder_id = cl.found_item.user_id if cl.found_item else None
            r_id = finder_id if d_id == cl.claimant_id else cl.claimant_id
        else:
            entity_type = "recovery"
            entity_id = getattr(recovery_or_claim, "id", recovery_id or 0)
            d_id = getattr(recovery_or_claim, "disputed_by", disputer_id)
            r_id = recipient_id
    else:
        name = disputer_name or disputed_by_name or "A participant"
        rsn = reason or "Unspecified dispute"
        entity_type = "recovery"
        entity_id = recovery_id or 0
        d_id = disputer_id
        r_id = recipient_id

    title = f"⚠️ Dispute Raised on {entity_type.capitalize()}"
    message = f"{name} has raised a dispute on {entity_type.capitalize()} #{entity_id}: \"{rsn}\". Case is held pending staff review."

    if r_id:
        create_notification(
            db=db,
            user_id=r_id,
            type="DISPUTE_RAISED",
            title=title,
            message=message,
            related_entity_type=entity_type,
            related_entity_id=entity_id,
            metadata={"id": entity_id, "disputer_id": d_id, "reason": rsn},
            commit=commit,
        )

    for admin_id in _get_admin_and_reviewer_ids(db):
        if admin_id not in (d_id, r_id):
            create_notification(
                db=db,
                user_id=admin_id,
                type="DISPUTE_RAISED",
                title=f"🚨 {entity_type.capitalize()} Dispute Awaiting Review",
                message=f"Dispute raised on {entity_type.capitalize()} #{entity_id} by {name}: \"{rsn}\".",
                related_entity_type=entity_type,
                related_entity_id=entity_id,
                metadata={"id": entity_id, "reason": rsn},
                commit=commit,
            )


def notify_dispute_resolved(
    db: Session,
    recovery_id: Optional[int] = None,
    claimant_id: Optional[int] = None,
    finder_id: Optional[int] = None,
    decision: str = "RESOLVE",
    notes: Optional[str] = None,
    commit: bool = True,
    recovery: Optional[Any] = None,
) -> None:
    """
    Notifies participants when a reviewer resolves a dispute.
    """
    if recovery is not None:
        rec_id = recovery.id
        c_id = recovery.claimant_id
        f_id = recovery.finder_id
    else:
        rec_id = recovery_id or 0
        c_id = claimant_id
        f_id = finder_id

    dec_str = (decision or "RESOLVED").title()
    title = f"⚖️ Dispute Resolved: {dec_str}"
    notes_text = f" Staff notes: {notes}" if notes else ""
    message = f"The dispute on Recovery #{rec_id} has been resolved by campus staff with decision: {dec_str}.{notes_text}"

    for uid in (c_id, f_id):
        if uid:
            create_notification(
                db=db,
                user_id=uid,
                type="DISPUTE_RESOLVED",
                title=title,
                message=message,
                related_entity_type="recovery",
                related_entity_id=rec_id,
                metadata={"recovery_id": rec_id, "decision": decision},
                commit=commit,
            )


def notify_otp_requested(
    db: Session,
    recovery: Recovery,
    requested_by: Any,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the counterpart that OTP handover verification has been requested.
    """
    rec_id = recovery.id
    req_user_id = getattr(requested_by, "id", requested_by)
    req_user_name = getattr(requested_by, "full_name", "A participant")

    if req_user_id == recovery.claimant_id:
        recipient_id = recovery.finder_id
        title = "🔐 Handover OTP Verification Requested"
        message = (
            f"Claimant ({req_user_name}) requested OTP verification for Recovery #{rec_id}. "
            "Physical handover now requires a 6-digit verification code."
        )
    else:
        recipient_id = recovery.claimant_id
        title = "🔐 Handover OTP Verification Requested"
        message = (
            f"Finder ({req_user_name}) requested OTP verification for Recovery #{rec_id}. "
            "Please open your recovery page and generate your 6-digit code before meeting."
        )

    if not recipient_id:
        return None

    return create_notification(
        db=db,
        user_id=recipient_id,
        type="OTP_REQUESTED",
        title=title,
        message=message,
        related_entity_type="recovery",
        related_entity_id=rec_id,
        metadata={"recovery_id": rec_id, "requested_by": req_user_id},
        commit=commit,
    )


def notify_otp_mandatory(
    db: Session,
    recovery: Recovery,
    commit: bool = True,
) -> None:
    """
    Notifies participants that OTP verification is mandatory for this high-risk item.
    """
    rec_id = recovery.id
    title = "🛡️ Mandatory OTP Verification Required"
    message = (
        f"Recovery #{rec_id} involves a high-value or sensitive item. "
        "Secure 6-digit OTP verification is mandatory for physical handover."
    )
    for uid in (recovery.claimant_id, recovery.finder_id):
        if uid:
            create_notification(
                db=db,
                user_id=uid,
                type="OTP_MANDATORY",
                title=title,
                message=message,
                related_entity_type="recovery",
                related_entity_id=rec_id,
                metadata={"recovery_id": rec_id},
                commit=commit,
            )


def notify_otp_generated(
    db: Session,
    recovery: Recovery,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the finder that the claimant has generated an OTP code.
    NEVER includes the plaintext OTP in the notification.
    """
    finder_id = recovery.finder_id
    if not finder_id:
        return None

    title = "🔑 Handover Code Ready"
    message = (
        f"The claimant has generated a secure 6-digit handover code for Recovery #{recovery.id}. "
        "Ask them for the code in person and verify it upon physical meeting."
    )
    return create_notification(
        db=db,
        user_id=finder_id,
        type="OTP_READY",
        title=title,
        message=message,
        related_entity_type="recovery",
        related_entity_id=recovery.id,
        metadata={"recovery_id": recovery.id},
        commit=commit,
    )


def notify_otp_expired(
    db: Session,
    recovery: Recovery,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that their handover OTP has expired and needs regeneration.
    """
    claimant_id = recovery.claimant_id
    if not claimant_id:
        return None

    title = "⏰ Handover OTP Expired"
    message = (
        f"Your handover verification code for Recovery #{recovery.id} has expired. "
        "Please generate a new code before completing the exchange with the finder."
    )
    return create_notification(
        db=db,
        user_id=claimant_id,
        type="OTP_EXPIRED",
        title=title,
        message=message,
        related_entity_type="recovery",
        related_entity_id=recovery.id,
        metadata={"recovery_id": recovery.id},
        commit=commit,
    )


def notify_handover_otp_verified(
    db: Session,
    recovery_or_claimant: Any,
    recovery_id: Optional[int] = None,
    return_location: Optional[str] = None,
    commit: bool = True,
) -> Optional[Notification]:
    """
    Notifies the claimant that the finder successfully verified the handover OTP.
    Does NOT reveal any OTP plaintext.
    """
    if hasattr(recovery_or_claimant, "claimant_id"):
        rec = recovery_or_claimant
        claimant_id = rec.claimant_id
        rec_id = rec.id
        loc = rec.return_location or "the handover location"
    else:
        claimant_id = recovery_or_claimant
        rec_id = recovery_id
        loc = return_location or "the handover location"

    if not claimant_id:
        return None
    title = "🤝 Handover OTP Verified"
    message = f"The finder has successfully verified your handover OTP at {loc}. Please confirm receipt of your item to finalize recovery."
    return create_notification(
        db=db,
        user_id=claimant_id,
        type="OTP_VERIFIED",
        title=title,
        message=message,
        related_entity_type="recovery",
        related_entity_id=rec_id,
        metadata={"recovery_id": rec_id, "location": loc},
        commit=commit,
    )


def notify_competing_claims_detected(
    db: Session,
    found_item_id: int,
    item_title: str,
    claimant_ids: list[int],
    finder_id: Optional[int],
    commit: bool = True,
) -> None:
    """
    Notifies participants and reviewers when competing claims are detected.
    """
    # Notify Reviewers
    for admin_id in _get_admin_and_reviewer_ids(db):
        create_notification(
            db=db,
            user_id=admin_id,
            type="COMPETING_CLAIMS_ALERT",
            title="⚠️ Competing Claims Requiring Staff Review",
            message=f"Multiple active claims detected on Found Item #{found_item_id} ({item_title}). Staff decision required to resolve.",
            related_entity_type="found_item",
            related_entity_id=found_item_id,
            metadata={"found_item_id": found_item_id},
            commit=commit,
        )

    # Notify Finder
    if finder_id:
        create_notification(
            db=db,
            user_id=finder_id,
            type="COMPETING_CLAIMS_ALERT",
            title="⚠️ Multiple Claims on Your Found Item",
            message=f"Multiple claims were submitted for {item_title}. A campus staff reviewer has intervened to resolve ownership.",
            related_entity_type="found_item",
            related_entity_id=found_item_id,
            metadata={"found_item_id": found_item_id},
            commit=commit,
        )

    # Notify Claimants
    for cid in claimant_ids:
        create_notification(
            db=db,
            user_id=cid,
            type="COMPETING_CLAIMS_ALERT",
            title="⚠️ Conflicting Claims Under Review",
            message=f"Your claim for {item_title} is being reviewed alongside competing claims by campus staff.",
            related_entity_type="found_item",
            related_entity_id=found_item_id,
            metadata={"found_item_id": found_item_id},
            commit=commit,
        )


