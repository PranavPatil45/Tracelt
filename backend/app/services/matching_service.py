import re
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match

# Configurable matching threshold (0 - 100)
MATCH_THRESHOLD = 60

# Common English stop words to filter out during text similarity calculation
STOP_WORDS = {
    "a", "about", "above", "after", "again", "all", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "could", "did", "do", "does", "doing", "down", "during",
    "each", "few", "for", "from", "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is",
    "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not",
    "now", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves",
    "out", "over", "own", "please", "same", "should", "so", "some", "such", "than", "that",
    "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were",
    "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you",
    "your", "yours", "yourself", "yourselves", "item", "lost", "found", "around", "near", "inside"
}


def calculate_category_score(lost_cat: str, found_cat: str) -> Tuple[int, Optional[str]]:
    """
    Compare item categories (25% weight).
    Exact match = 25 points.
    Different category = 0 points.
    """
    c1 = (lost_cat or "").strip().lower()
    c2 = (found_cat or "").strip().lower()

    if c1 and c2 and c1 == c2:
        return 25, "Same category"
    return 0, None


def calculate_location_score(lost_loc: str, found_loc: str) -> Tuple[int, Optional[str]]:
    """
    Compare campus locations (25% weight).
    Exact match = 25 points.
    Partial overlap (shared core location keyword) = 15 points.
    Mismatch = 0 points.
    """
    l1 = (lost_loc or "").strip().lower()
    l2 = (found_loc or "").strip().lower()

    if not l1 or not l2:
        return 0, None

    if l1 == l2:
        return 25, "Same campus location"

    # Check for meaningful keyword overlap (e.g., 'Library' in 'Central Library')
    words1 = {w for w in re.split(r"\W+", l1) if len(w) >= 3 and w not in STOP_WORDS}
    words2 = {w for w in re.split(r"\W+", l2) if len(w) >= 3 and w not in STOP_WORDS}

    if words1 & words2:
        return 15, "Nearby or related campus location"

    return 0, None


def calculate_date_score(lost_date_str: str, found_date_str: str) -> Tuple[int, Optional[str]]:
    """
    Compare lost and found dates (20% weight).
    Same day = 20 points.
    1 day apart = 15 points.
    2 days apart = 10 points.
    3 days apart = 5 points.
    > 3 days apart = 0 points.
    """
    try:
        d1 = datetime.strptime((lost_date_str or "").strip(), "%Y-%m-%d").date()
        d2 = datetime.strptime((found_date_str or "").strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return 0, None

    diff_days = abs((d1 - d2).days)

    if diff_days == 0:
        return 20, "Reported on the same date"
    elif diff_days == 1:
        return 15, "Reported 1 day apart"
    elif diff_days == 2:
        return 10, "Reported 2 days apart"
    elif diff_days <= 3:
        return 5, "Reported within 3 days"
    else:
        return 0, None


def _parse_time_to_minutes(time_str: Optional[str]) -> Optional[int]:
    """Helper to convert time string (HH:MM or 12-hour AM/PM) into minutes from midnight."""
    if not time_str:
        return None
    cleaned = time_str.strip().lower()

    # Try 24-hour HH:MM
    match24 = re.match(r"^(\d{1,2}):(\d{2})$", cleaned)
    if match24:
        h, m = int(match24.group(1)), int(match24.group(2))
        if 0 <= h < 24 and 0 <= m < 60:
            return h * 60 + m

    # Try 12-hour with am/pm (e.g., 2:30 pm or 11 am)
    match12 = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$", cleaned)
    if match12:
        h = int(match12.group(1))
        m = int(match12.group(2) or 0)
        meridiem = match12.group(3)
        if 1 <= h <= 12 and 0 <= m < 60:
            if meridiem == "pm" and h != 12:
                h += 12
            elif meridiem == "am" and h == 12:
                h = 0
            return h * 60 + m

    return None


def calculate_time_score(lost_time_str: Optional[str], found_time_str: Optional[str]) -> Tuple[int, Optional[str]]:
    """
    Compare reported times (10% weight).
    If both times available:
      <= 1 hour apart -> 10 points
      <= 3 hours apart -> 7 points
      <= 6 hours apart -> 4 points
      > 6 hours apart -> 0 points
    If one or both times unavailable:
      Neutral 5 points (does not penalize missing data).
      Reason: 'Time information unavailable'
    """
    t1 = _parse_time_to_minutes(lost_time_str)
    t2 = _parse_time_to_minutes(found_time_str)

    if t1 is None or t2 is None:
        return 5, "Time information unavailable"

    diff_mins = abs(t1 - t2)
    # Consider wraparound at midnight if applicable
    diff_mins = min(diff_mins, 1440 - diff_mins)

    if diff_mins <= 60:
        return 10, "Occurred around the same time"
    elif diff_mins <= 180:
        return 7, "Occurred within 3 hours"
    elif diff_mins <= 360:
        return 4, "Occurred in the same part of day"
    else:
        return 0, None


def _tokenize_text(text: str) -> List[str]:
    """Tokenize and filter stop words from text."""
    clean = re.sub(r"[^\w\s]", " ", (text or "").lower())
    tokens = [w for w in clean.split() if len(w) >= 2 and w not in STOP_WORDS]
    return tokens


def calculate_text_similarity(lost_text: str, found_text: str) -> Tuple[int, Optional[str]]:
    """
    Compare title and description text using keyword overlap (20% weight).
    Computes token intersection over union (Jaccard) + overlap ratio.
    Scales to 0-20 points.
    """
    t1 = set(_tokenize_text(lost_text))
    t2 = set(_tokenize_text(found_text))

    if not t1 or not t2:
        return 0, None

    intersection = t1 & t2
    union = t1 | t2

    if not intersection:
        return 0, None

    jaccard = len(intersection) / len(union)
    min_overlap = len(intersection) / min(len(t1), len(t2))

    # Balanced similarity score between 0.0 and 1.0
    combined_ratio = (0.5 * jaccard) + (0.5 * min_overlap)
    score = int(round(combined_ratio * 20))
    score = max(0, min(20, score))

    if score >= 14:
        return score, "High title & description similarity"
    elif score >= 8:
        return score, "Similar description keywords"
    elif score > 0:
        return score, "Some shared keywords"

    return 0, None


def calculate_match_score(lost_item: LostItem, found_item: FoundItem) -> Dict[str, Any]:
    """
    Calculates rule-based signals and aggregate total score between a LostItem and FoundItem.
    Returns:
    {
        "category_score": int,
        "location_score": int,
        "date_score": int,
        "time_score": int,
        "description_score": int,
        "total_score": int,
        "reasons": List[str]
    }
    """
    reasons: List[str] = []

    # 1. Category Score (max 25)
    cat_score, cat_reason = calculate_category_score(lost_item.category, found_item.category)
    if cat_reason:
        reasons.append(cat_reason)

    # 2. Location Score (max 25)
    loc_score, loc_reason = calculate_location_score(lost_item.location, found_item.location)
    if loc_reason:
        reasons.append(loc_reason)

    # 3. Date Score (max 20)
    date_score, date_reason = calculate_date_score(lost_item.lost_date, found_item.found_date)
    if date_reason:
        reasons.append(date_reason)

    # 4. Time Score (max 10)
    time_score, time_reason = calculate_time_score(lost_item.lost_time, found_item.found_time)
    if time_reason:
        reasons.append(time_reason)

    # 5. Text Similarity Score (max 20)
    lost_full_text = f"{lost_item.title} {lost_item.description}"
    found_full_text = f"{found_item.title} {found_item.description}"
    desc_score, desc_reason = calculate_text_similarity(lost_full_text, found_full_text)
    if desc_reason:
        reasons.append(desc_reason)

    total_score = cat_score + loc_score + date_score + time_score + desc_score
    total_score = max(0, min(100, total_score))

    return {
        "category_score": cat_score,
        "location_score": loc_score,
        "date_score": date_score,
        "time_score": time_score,
        "description_score": desc_score,
        "total_score": total_score,
        "reasons": reasons,
    }


def evaluate_and_save_match(
    db: Session,
    lost_item: LostItem,
    found_item: FoundItem,
    threshold: int = MATCH_THRESHOLD,
) -> Optional[Match]:
    """
    Evaluates eligibility and computes score.
    If total_score >= threshold, creates or updates the Match record idempotently.
    """
    # 1. Eligibility: Same campus scope check
    if (lost_item.campus or "").strip().lower() != (found_item.campus or "").strip().lower():
        return None

    # 2. Avoid Self-Matching: Report owner cannot match with their own find
    if lost_item.user_id == found_item.user_id:
        return None

    # 3. Active status check
    if (lost_item.status or "").upper() != "ACTIVE":
        return None
    if (found_item.status or "").upper() not in ("AVAILABLE", "ACTIVE"):
        return None

    # 4. Calculate score
    scores = calculate_match_score(lost_item, found_item)
    total_score = scores["total_score"]

    if total_score < threshold:
        # If a prior match existed and score dropped below threshold, we leave it or skip
        return None

    # 5. Idempotent Upsert: Check if match already exists
    existing_match = (
        db.query(Match)
        .filter(Match.lost_item_id == lost_item.id, Match.found_item_id == found_item.id)
        .first()
    )

    if existing_match:
        existing_match.category_score = scores["category_score"]
        existing_match.location_score = scores["location_score"]
        existing_match.date_score = scores["date_score"]
        existing_match.time_score = scores["time_score"]
        existing_match.description_score = scores["description_score"]
        existing_match.total_score = total_score
        existing_match.reasons = scores["reasons"]
        db.commit()
        db.refresh(existing_match)
        return existing_match

    new_match = Match(
        lost_item_id=lost_item.id,
        found_item_id=found_item.id,
        category_score=scores["category_score"],
        location_score=scores["location_score"],
        date_score=scores["date_score"],
        time_score=scores["time_score"],
        description_score=scores["description_score"],
        total_score=total_score,
        reasons=scores["reasons"],
        status="POSSIBLE",
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)

    # Trigger notification for lost item owner
    from app.services.notification_service import notify_match_found
    notify_match_found(db, match=new_match, lost_item=lost_item, found_item=found_item)

    return new_match


def find_matches_for_lost_item(
    db: Session,
    lost_item_id: int,
    threshold: int = MATCH_THRESHOLD,
) -> List[Match]:
    """
    Finds and saves matches for a newly created or updated LostItem against all eligible FoundItems.
    """
    lost_item = db.query(LostItem).filter(LostItem.id == lost_item_id).first()
    if not lost_item or (lost_item.status or "").upper() != "ACTIVE":
        return []

    # Query eligible FoundItems on the same campus and different user
    query = (
        db.query(FoundItem)
        .filter(
            FoundItem.user_id != lost_item.user_id,
            FoundItem.status.in_(["AVAILABLE", "ACTIVE"]),
        )
    )
    if lost_item.campus:
        query = query.filter(FoundItem.campus == lost_item.campus)

    candidates = query.all()
    created_or_updated_matches: List[Match] = []

    for found in candidates:
        match = evaluate_and_save_match(db, lost_item, found, threshold=threshold)
        if match:
            created_or_updated_matches.append(match)

    return created_or_updated_matches


def find_matches_for_found_item(
    db: Session,
    found_item_id: int,
    threshold: int = MATCH_THRESHOLD,
) -> List[Match]:
    """
    Finds and saves matches for a newly created or updated FoundItem against all eligible LostItems.
    """
    found_item = db.query(FoundItem).filter(FoundItem.id == found_item_id).first()
    if not found_item or (found_item.status or "").upper() not in ("AVAILABLE", "ACTIVE"):
        return []

    # Query eligible LostItems on the same campus and different user
    query = (
        db.query(LostItem)
        .filter(
            LostItem.user_id != found_item.user_id,
            LostItem.status == "ACTIVE",
        )
    )
    if found_item.campus:
        query = query.filter(LostItem.campus == found_item.campus)

    candidates = query.all()
    created_or_updated_matches: List[Match] = []

    for lost in candidates:
        match = evaluate_and_save_match(db, lost, found_item, threshold=threshold)
        if match:
            created_or_updated_matches.append(match)

    return created_or_updated_matches


def scan_campus_matches(
    db: Session,
    campus: Optional[str] = None,
    threshold: int = MATCH_THRESHOLD,
) -> int:
    """
    Scans all active Lost and Found items within a campus and evaluates matches.
    Returns the count of created/updated matches.
    """
    lost_q = db.query(LostItem).filter(LostItem.status == "ACTIVE")
    found_q = db.query(FoundItem).filter(FoundItem.status.in_(["AVAILABLE", "ACTIVE"]))

    if campus:
        lost_q = lost_q.filter(LostItem.campus == campus)
        found_q = found_q.filter(FoundItem.campus == campus)

    lost_items = lost_q.all()
    found_items = found_q.all()

    count = 0
    for lost in lost_items:
        for found in found_items:
            match = evaluate_and_save_match(db, lost, found, threshold=threshold)
            if match:
                count += 1

    return count
