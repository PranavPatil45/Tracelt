from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from fastapi import HTTPException, status

from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.models.claim import Claim
from app.models.recovery import Recovery
from app.models.report import Report
from app.models.admin_audit_log import AdminAuditLog
from app.schemas.admin import (
    AdminStatsResponse,
    CategoryCount,
    LocationCount,
    AdminActivityItem,
    AdminActivityResponse,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserDetailResponse,
    AdminUserUpdate,
    AdminLostItemSummary,
    AdminLostItemListResponse,
    AdminFoundItemSummary,
    AdminFoundItemListResponse,
    AdminMatchItem,
    AdminMatchListResponse,
    AdminClaimItem,
    AdminClaimListResponse,
    AdminRecoveryItem,
    AdminRecoveryListResponse,
    AdminReportItem,
    AdminReportListResponse,
    AdminAuditLogItem,
    AdminAuditLogListResponse,
)


def log_admin_action(
    db: Session,
    admin_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
) -> AdminAuditLog:
    """Records an administrative intervention into the audit log."""
    audit = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit


def get_admin_stats(db: Session, campus_scope: Optional[str]) -> AdminStatsResponse:
    """Calculates live metrics and statistics scoped to the administrator's campus."""
    has_campus = bool(campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL")
    clean_campus = campus_scope.strip() if has_campus else None

    # Users
    user_q = db.query(User)
    if clean_campus:
        user_q = user_q.filter(User.campus == clean_campus)
    total_users = user_q.count()

    # Lost Items
    lost_q = db.query(LostItem)
    if clean_campus:
        lost_q = lost_q.filter(LostItem.campus == clean_campus)
    total_lost_items = lost_q.count()

    # Found Items
    found_q = db.query(FoundItem)
    if clean_campus:
        found_q = found_q.filter(FoundItem.campus == clean_campus)
    total_found_items = found_q.count()

    # Active Matches
    match_q = db.query(Match).filter(Match.status == "POSSIBLE")
    if clean_campus:
        match_q = match_q.join(LostItem, Match.lost_item_id == LostItem.id).filter(LostItem.campus == clean_campus)
    active_matches = match_q.count()

    # Pending Claims
    claim_q = db.query(Claim).filter(Claim.status.in_(["PENDING", "UNDER_REVIEW"]))
    if clean_campus:
        claim_q = (
            claim_q.join(Match, Claim.match_id == Match.id)
            .join(LostItem, Match.lost_item_id == LostItem.id)
            .filter(LostItem.campus == clean_campus)
        )
    pending_claims = claim_q.count()

    # Recovered Items
    rec_q = db.query(Recovery).filter(Recovery.status == "RECOVERED")
    if clean_campus:
        rec_q = rec_q.join(LostItem, Recovery.lost_item_id == LostItem.id).filter(LostItem.campus == clean_campus)
    recovered_items = rec_q.count()
    if recovered_items == 0:
        # Fallback to checking lost_items status
        lost_rec_q = db.query(LostItem).filter(LostItem.status == "RECOVERED")
        if clean_campus:
            lost_rec_q = lost_rec_q.filter(LostItem.campus == clean_campus)
        recovered_items = lost_rec_q.count()

    # Active Reports
    rep_q = db.query(Report).filter(Report.status == "PENDING")
    active_reports = rep_q.count()

    # Recovery Rate = (recovered_items / total_lost_items * 100)
    recovery_rate = round((recovered_items / total_lost_items * 100.0), 1) if total_lost_items > 0 else 0.0

    # Top Categories (Aggregation across Lost and Found items)
    cat_lost = db.query(LostItem.category, func.count(LostItem.id).label("c"))
    if clean_campus:
        cat_lost = cat_lost.filter(LostItem.campus == clean_campus)
    cat_lost = cat_lost.group_by(LostItem.category).all()

    cat_found = db.query(FoundItem.category, func.count(FoundItem.id).label("c"))
    if clean_campus:
        cat_found = cat_found.filter(FoundItem.campus == clean_campus)
    cat_found = cat_found.group_by(FoundItem.category).all()

    category_counts: Dict[str, int] = {}
    for cat, count in cat_lost:
        if cat:
            category_counts[cat] = category_counts.get(cat, 0) + count
    for cat, count in cat_found:
        if cat:
            category_counts[cat] = category_counts.get(cat, 0) + count

    sorted_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    top_categories = [CategoryCount(category=cat, count=cnt) for cat, cnt in sorted_categories]

    # Top Locations
    loc_lost = db.query(LostItem.location, func.count(LostItem.id).label("c"))
    if clean_campus:
        loc_lost = loc_lost.filter(LostItem.campus == clean_campus)
    loc_lost = loc_lost.group_by(LostItem.location).all()

    location_counts: Dict[str, int] = {}
    for loc, count in loc_lost:
        if loc:
            location_counts[loc] = location_counts.get(loc, 0) + count

    sorted_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    top_locations = [LocationCount(location=loc, count=cnt) for loc, cnt in sorted_locations]

    return AdminStatsResponse(
        total_users=total_users,
        total_lost_items=total_lost_items,
        total_found_items=total_found_items,
        active_matches=active_matches,
        pending_claims=pending_claims,
        recovered_items=recovered_items,
        active_reports=active_reports,
        recovery_rate=recovery_rate,
        top_categories=top_categories,
        top_locations=top_locations,
        campus_scope=clean_campus or "ALL",
    )


def get_admin_activity(
    db: Session,
    campus_scope: Optional[str],
    page: int = 1,
    limit: int = 20,
) -> AdminActivityResponse:
    """Aggregates real events from database tables to produce a unified activity feed."""
    has_campus = bool(campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL")
    clean_campus = campus_scope.strip() if has_campus else None

    events: List[AdminActivityItem] = []

    # 1. Lost items reported
    lost_q = db.query(LostItem)
    if clean_campus:
        lost_q = lost_q.filter(LostItem.campus == clean_campus)
    lost_items = lost_q.order_by(desc(LostItem.created_at)).limit(30).all()
    for item in lost_items:
        u_name = item.user.full_name if item.user else "Unknown User"
        events.append(
            AdminActivityItem(
                id=f"lost_{item.id}",
                type="LOST_ITEM_CREATED",
                title="Lost item reported",
                description=f"'{item.title}' reported lost at {item.location}",
                created_at=item.created_at,
                related_entity_type="lost_item",
                related_entity_id=item.id,
                user_name=u_name,
                campus=item.campus,
            )
        )

    # 2. Found items reported
    found_q = db.query(FoundItem)
    if clean_campus:
        found_q = found_q.filter(FoundItem.campus == clean_campus)
    found_items = found_q.order_by(desc(FoundItem.created_at)).limit(30).all()
    for item in found_items:
        u_name = item.user.full_name if item.user else "Unknown User"
        events.append(
            AdminActivityItem(
                id=f"found_{item.id}",
                type="FOUND_ITEM_CREATED",
                title="Found item reported",
                description=f"'{item.title}' spotted/turned in at {item.location}",
                created_at=item.created_at,
                related_entity_type="found_item",
                related_entity_id=item.id,
                user_name=u_name,
                campus=item.campus,
            )
        )

    # 3. Matches found
    match_q = db.query(Match)
    if clean_campus:
        match_q = match_q.join(LostItem, Match.lost_item_id == LostItem.id).filter(LostItem.campus == clean_campus)
    matches = match_q.order_by(desc(Match.created_at)).limit(30).all()
    for m in matches:
        l_title = m.lost_item.title if m.lost_item else "Lost Item"
        f_title = m.found_item.title if m.found_item else "Found Item"
        events.append(
            AdminActivityItem(
                id=f"match_{m.id}",
                type="MATCH_CREATED",
                title="Possible match identified",
                description=f"Match ({m.total_score}%): '{l_title}' <-> '{f_title}'",
                created_at=m.created_at,
                related_entity_type="match",
                related_entity_id=m.id,
                user_name=None,
                campus=m.lost_item.campus if m.lost_item else None,
            )
        )

    # 4. Claims submitted / reviewed
    claim_q = db.query(Claim)
    if clean_campus:
        claim_q = (
            claim_q.join(Match, Claim.match_id == Match.id)
            .join(LostItem, Match.lost_item_id == LostItem.id)
            .filter(LostItem.campus == clean_campus)
        )
    claims = claim_q.order_by(desc(Claim.created_at)).limit(30).all()
    for c in claims:
        c_name = c.claimant.full_name if c.claimant else "Claimant"
        l_title = c.match.lost_item.title if (c.match and c.match.lost_item) else "Item"
        action_type = f"CLAIM_{c.status}" if c.status in ("APPROVED", "REJECTED") else "CLAIM_SUBMITTED"
        action_title = (
            "Claim approved" if c.status == "APPROVED" else ("Claim rejected" if c.status == "REJECTED" else "New claim submitted")
        )
        events.append(
            AdminActivityItem(
                id=f"claim_{c.id}",
                type=action_type,
                title=action_title,
                description=f"Claim on '{l_title}' by {c_name} (Status: {c.status})",
                created_at=c.reviewed_at or c.created_at,
                related_entity_type="claim",
                related_entity_id=c.id,
                user_name=c_name,
                campus=c.match.lost_item.campus if (c.match and c.match.lost_item) else None,
            )
        )

    # 5. Recoveries confirmed
    rec_q = db.query(Recovery)
    if clean_campus:
        rec_q = rec_q.join(LostItem, Recovery.lost_item_id == LostItem.id).filter(LostItem.campus == clean_campus)
    recoveries = rec_q.order_by(desc(Recovery.created_at)).limit(30).all()
    for r in rec_q.all():
        l_title = r.lost_item.title if r.lost_item else "Item"
        c_name = r.claimant.full_name if r.claimant else "Owner"
        f_name = r.finder.full_name if r.finder else "Finder"
        r_type = "ITEM_RECOVERED" if r.status == "RECOVERED" else "ITEM_RETURNED"
        r_title = "Item recovered" if r.status == "RECOVERED" else "Item return in progress"
        events.append(
            AdminActivityItem(
                id=f"rec_{r.id}",
                type=r_type,
                title=r_title,
                description=f"'{l_title}' returned by {f_name} to {c_name}",
                created_at=r.confirmed_at or r.returned_at or r.created_at,
                related_entity_type="recovery",
                related_entity_id=r.id,
                user_name=c_name,
                campus=r.lost_item.campus if r.lost_item else None,
            )
        )

    # 6. Reports submitted
    rep_q = db.query(Report).order_by(desc(Report.created_at)).limit(20)
    for rep in rep_q.all():
        r_name = rep.reporter.full_name if rep.reporter else "User"
        events.append(
            AdminActivityItem(
                id=f"rep_{rep.id}",
                type="REPORT_SUBMITTED",
                title="Moderation report submitted",
                description=f"Report on {rep.entity_type} #{rep.entity_id}: {rep.reason}",
                created_at=rep.created_at,
                related_entity_type="report",
                related_entity_id=rep.id,
                user_name=r_name,
                campus=None,
            )
        )

    # Sort all events chronologically descending
    events.sort(key=lambda x: x.created_at or datetime.min, reverse=True)

    total = len(events)
    start = (page - 1) * limit
    end = start + limit
    paged_items = events[start:end]

    return AdminActivityResponse(
        items=paged_items,
        total=total,
        page=page,
        limit=limit,
    )


def get_admin_users(
    db: Session,
    campus_scope: Optional[str],
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminUserListResponse:
    """Retrieves paginated user accounts with role, campus, and name search."""
    q = db.query(User)

    if campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL":
        q = q.filter(User.campus == campus_scope.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(or_(User.full_name.ilike(term), User.email.ilike(term), User.department.ilike(term)))

    if role and role.strip() and role.strip().upper() != "ALL":
        q = q.filter(User.role == role.strip().lower())

    if is_active is not None:
        q = q.filter(User.is_active == is_active)

    total = q.count()
    users = q.order_by(desc(User.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = [
        AdminUserItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            campus=u.campus,
            department=u.department,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]

    return AdminUserListResponse(users=items, total=total, page=page, limit=limit)


def get_admin_user_detail(db: Session, user_id: int) -> AdminUserDetailResponse:
    """Retrieves profile and item counts for an individual user."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    lost_c = db.query(LostItem).filter(LostItem.user_id == user_id).count()
    found_c = db.query(FoundItem).filter(FoundItem.user_id == user_id).count()
    claims_c = db.query(Claim).filter(Claim.claimant_id == user_id).count()
    rec_c = db.query(Recovery).filter(or_(Recovery.claimant_id == user_id, Recovery.finder_id == user_id)).count()

    return AdminUserDetailResponse(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        campus=u.campus,
        department=u.department,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at,
        lost_items_count=lost_c,
        found_items_count=found_c,
        claims_count=claims_c,
        recoveries_count=rec_c,
    )


def update_admin_user(
    db: Session,
    user_id: int,
    current_admin: User,
    update_data: AdminUserUpdate,
) -> AdminUserItem:
    """Updates user role or active status with safety checks against self-demotion."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Guard: Cannot remove admin access or deactivate own account
    if u.id == current_admin.id:
        if update_data.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own administrator account.",
            )
        if update_data.role and update_data.role.strip().lower() != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove administrative privileges from your own account.",
            )

    changes = []
    if update_data.role is not None:
        new_role = update_data.role.strip().lower()
        if new_role not in ("student", "contributor", "reviewer", "admin"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be student, contributor, reviewer, or admin.",
            )
        old_role = u.role
        u.role = new_role
        changes.append(f"Role changed from {old_role} to {new_role}")

    if update_data.is_active is not None:
        old_active = u.is_active
        u.is_active = update_data.is_active
        action_word = "activated" if update_data.is_active else "suspended"
        changes.append(f"Account {action_word}")

    db.add(u)
    db.commit()
    db.refresh(u)

    # Log action
    if changes:
        log_admin_action(
            db=db,
            admin_id=current_admin.id,
            action="USER_UPDATED",
            entity_type="user",
            entity_id=u.id,
            details="; ".join(changes),
        )

    return AdminUserItem(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        campus=u.campus,
        department=u.department,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at,
    )


def get_admin_lost_items(
    db: Session,
    campus_scope: Optional[str],
    search: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminLostItemListResponse:
    """Lists lost items with filtering and owner info for admin moderation."""
    q = db.query(LostItem).join(User, LostItem.user_id == User.id)

    if campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL":
        q = q.filter(LostItem.campus == campus_scope.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                LostItem.title.ilike(term),
                LostItem.location.ilike(term),
                LostItem.description.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )

    if category and category.strip() and category.strip().upper() != "ALL":
        q = q.filter(LostItem.category == category.strip())

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        q = q.filter(LostItem.status == status_filter.strip().upper())

    total = q.count()
    items = q.order_by(desc(LostItem.created_at)).offset((page - 1) * limit).limit(limit).all()

    summary_items = [
        AdminLostItemSummary(
            id=item.id,
            title=item.title,
            category=item.category,
            location=item.location,
            campus=item.campus,
            lost_date=item.lost_date,
            lost_time=item.lost_time,
            status=item.status,
            image_url=item.image_url,
            user_id=item.user_id,
            user_name=item.user.full_name if item.user else "Unknown",
            user_email=item.user.email if item.user else "",
            created_at=item.created_at,
        )
        for item in items
    ]

    return AdminLostItemListResponse(items=summary_items, total=total, page=page, limit=limit)


def get_admin_found_items(
    db: Session,
    campus_scope: Optional[str],
    search: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminFoundItemListResponse:
    """Lists found items with filtering and owner info for admin moderation."""
    q = db.query(FoundItem).join(User, FoundItem.user_id == User.id)

    if campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL":
        q = q.filter(FoundItem.campus == campus_scope.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                FoundItem.title.ilike(term),
                FoundItem.location.ilike(term),
                FoundItem.description.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )

    if category and category.strip() and category.strip().upper() != "ALL":
        q = q.filter(FoundItem.category == category.strip())

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        q = q.filter(FoundItem.status == status_filter.strip().upper())

    total = q.count()
    items = q.order_by(desc(FoundItem.created_at)).offset((page - 1) * limit).limit(limit).all()

    summary_items = [
        AdminFoundItemSummary(
            id=item.id,
            title=item.title,
            category=item.category,
            location=item.location,
            campus=item.campus,
            found_date=item.found_date,
            found_time=item.found_time,
            status=item.status,
            image_url=item.image_url,
            user_id=item.user_id,
            user_name=item.user.full_name if item.user else "Unknown",
            user_email=item.user.email if item.user else "",
            created_at=item.created_at,
        )
        for item in items
    ]

    return AdminFoundItemListResponse(items=summary_items, total=total, page=page, limit=limit)


def update_item_status(
    db: Session,
    item_type: str,
    item_id: int,
    current_admin: User,
    new_status: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates status of a lost or found item for moderation (e.g., CLOSED, HIDDEN, REMOVED)."""
    type_norm = item_type.strip().lower()
    valid_statuses = ("ACTIVE", "AVAILABLE", "MATCHED", "CLAIMED", "RECOVERED", "CLOSED", "HIDDEN", "REMOVED")
    status_norm = new_status.strip().upper()

    if status_norm not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{new_status}'. Allowed: {', '.join(valid_statuses)}",
        )

    if type_norm in ("lost", "lost-items", "lost_item"):
        item = db.query(LostItem).filter(LostItem.id == item_id).first()
        entity_name = "lost_item"
    elif type_norm in ("found", "found-items", "found_item"):
        item = db.query(FoundItem).filter(FoundItem.id == item_id).first()
        entity_name = "found_item"
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid item type.")

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item #{item_id} not found.")

    old_status = item.status
    item.status = status_norm
    db.add(item)
    db.commit()
    db.refresh(item)

    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action="ITEM_MODERATED",
        entity_type=entity_name,
        entity_id=item.id,
        details=f"Status changed from {old_status} to {status_norm}. Reason: {reason or 'None'}",
    )

    return {
        "success": True,
        "item_id": item.id,
        "old_status": old_status,
        "new_status": status_norm,
        "reason": reason,
    }


def get_admin_matches(
    db: Session,
    campus_scope: Optional[str],
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminMatchListResponse:
    """Lists matches with real rule scores and item associations."""
    q = db.query(Match).join(LostItem, Match.lost_item_id == LostItem.id).join(FoundItem, Match.found_item_id == FoundItem.id)

    if campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL":
        q = q.filter(LostItem.campus == campus_scope.strip())

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        q = q.filter(Match.status == status_filter.strip().upper())

    total = q.count()
    matches = q.order_by(desc(Match.total_score), desc(Match.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = []
    for m in matches:
        items.append(
            AdminMatchItem(
                id=m.id,
                lost_item_id=m.lost_item_id,
                lost_item_title=m.lost_item.title if m.lost_item else "Lost Item",
                lost_item_category=m.lost_item.category if m.lost_item else "General",
                found_item_id=m.found_item_id,
                found_item_title=m.found_item.title if m.found_item else "Found Item",
                found_item_category=m.found_item.category if m.found_item else "General",
                total_score=m.total_score,
                category_score=m.category_score,
                location_score=m.location_score,
                date_score=m.date_score,
                time_score=m.time_score,
                description_score=m.description_score,
                reasons=m.reasons or [],
                status=m.status,
                created_at=m.created_at,
            )
        )

    return AdminMatchListResponse(matches=items, total=total, page=page, limit=limit)


def get_admin_claims(
    db: Session,
    campus_scope: Optional[str],
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminClaimListResponse:
    """Lists ownership claims with claimant, finder, and verification details."""
    q = db.query(Claim).join(Match, Claim.match_id == Match.id).join(LostItem, Match.lost_item_id == LostItem.id)

    if campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL":
        q = q.filter(LostItem.campus == campus_scope.strip())

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        q = q.filter(Claim.status == status_filter.strip().upper())

    total = q.count()
    claims = q.order_by(desc(Claim.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = []
    for c in claims:
        finder = c.match.found_item.user if (c.match and c.match.found_item) else None
        items.append(
            AdminClaimItem(
                id=c.id,
                match_id=c.match_id,
                claimant_id=c.claimant_id,
                claimant_name=c.claimant.full_name if c.claimant else "Claimant",
                claimant_email=c.claimant.email if c.claimant else "",
                finder_id=finder.id if finder else None,
                finder_name=finder.full_name if finder else None,
                lost_item_id=c.match.lost_item_id if c.match else 0,
                lost_item_title=c.match.lost_item.title if (c.match and c.match.lost_item) else "Item",
                found_item_id=c.match.found_item_id if c.match else 0,
                found_item_title=c.match.found_item.title if (c.match and c.match.found_item) else "Item",
                verification_details=c.verification_details,
                additional_message=c.additional_message,
                status=c.status,
                reviewed_by_name=c.reviewer.full_name if c.reviewer else None,
                reviewed_at=c.reviewed_at,
                reviewer_notes=c.reviewer_notes,
                created_at=c.created_at,
            )
        )

    return AdminClaimListResponse(claims=items, total=total, page=page, limit=limit)


def get_admin_recoveries(
    db: Session,
    campus_scope: Optional[str],
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminRecoveryListResponse:
    """Lists recovery tracking records."""
    q = db.query(Recovery).join(LostItem, Recovery.lost_item_id == LostItem.id)

    if campus_scope and campus_scope.strip() and campus_scope.strip().upper() != "ALL":
        q = q.filter(LostItem.campus == campus_scope.strip())

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        q = q.filter(Recovery.status == status_filter.strip().upper())

    total = q.count()
    recs = q.order_by(desc(Recovery.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = []
    for r in recs:
        items.append(
            AdminRecoveryItem(
                id=r.id,
                claim_id=r.claim_id,
                lost_item_id=r.lost_item_id,
                lost_item_title=r.lost_item.title if r.lost_item else "Lost Item",
                found_item_id=r.found_item_id,
                found_item_title=r.found_item.title if r.found_item else "Found Item",
                claimant_id=r.claimant_id,
                claimant_name=r.claimant.full_name if r.claimant else "Claimant",
                finder_id=r.finder_id,
                finder_name=r.finder.full_name if r.finder else "Finder",
                status=r.status,
                return_location=r.return_location,
                return_notes=r.return_notes,
                returned_at=r.returned_at,
                confirmed_at=r.confirmed_at,
                created_at=r.created_at,
            )
        )

    return AdminRecoveryListResponse(recoveries=items, total=total, page=page, limit=limit)


def get_admin_reports(
    db: Session,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> AdminReportListResponse:
    """Lists moderation reports."""
    q = db.query(Report)

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        q = q.filter(Report.status == status_filter.strip().upper())

    total = q.count()
    reports = q.order_by(desc(Report.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = []
    for rep in reports:
        items.append(
            AdminReportItem(
                id=rep.id,
                reporter_id=rep.reporter_id,
                reporter_name=rep.reporter.full_name if rep.reporter else "Unknown",
                entity_type=rep.entity_type,
                entity_id=rep.entity_id,
                reason=rep.reason,
                description=rep.description,
                status=rep.status,
                reviewed_by_name=rep.reviewer.full_name if rep.reviewer else None,
                reviewed_at=rep.reviewed_at,
                admin_notes=rep.admin_notes,
                created_at=rep.created_at,
            )
        )

    return AdminReportListResponse(reports=items, total=total, page=page, limit=limit)


def update_admin_report(
    db: Session,
    report_id: int,
    current_admin: User,
    status_update: str,
    admin_notes: Optional[str] = None,
) -> AdminReportItem:
    """Resolves or updates a moderation report."""
    rep = db.query(Report).filter(Report.id == report_id).first()
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    rep.status = status_update.strip().upper()
    rep.reviewed_by = current_admin.id
    rep.reviewed_at = datetime.now(timezone.utc)
    if admin_notes is not None:
        rep.admin_notes = admin_notes

    db.add(rep)
    db.commit()
    db.refresh(rep)

    log_admin_action(
        db=db,
        admin_id=current_admin.id,
        action="REPORT_RESOLVED",
        entity_type="report",
        entity_id=rep.id,
        details=f"Report #{rep.id} marked as {rep.status}. Notes: {admin_notes or 'None'}",
    )

    return AdminReportItem(
        id=rep.id,
        reporter_id=rep.reporter_id,
        reporter_name=rep.reporter.full_name if rep.reporter else "Unknown",
        entity_type=rep.entity_type,
        entity_id=rep.entity_id,
        reason=rep.reason,
        description=rep.description,
        status=rep.status,
        reviewed_by_name=current_admin.full_name,
        reviewed_at=rep.reviewed_at,
        admin_notes=rep.admin_notes,
        created_at=rep.created_at,
    )


def get_admin_audit_logs(
    db: Session,
    page: int = 1,
    limit: int = 20,
) -> AdminAuditLogListResponse:
    """Lists audit logs of sensitive administrator actions."""
    q = db.query(AdminAuditLog)
    total = q.count()
    logs = q.order_by(desc(AdminAuditLog.created_at)).offset((page - 1) * limit).limit(limit).all()

    items = [
        AdminAuditLogItem(
            id=log.id,
            admin_id=log.admin_id,
            admin_name=log.admin.full_name if log.admin else "System / Removed",
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return AdminAuditLogListResponse(logs=items, total=total, page=page, limit=limit)
