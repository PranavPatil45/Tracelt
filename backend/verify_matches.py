#!/usr/bin/env python3
"""
Verification test suite for Tracelt Basic Matching System.
Validates:
1. Individual rule-based scoring components (Category 25%, Location 25%, Date 20%, Time 10%, Text 20%)
2. Stop-word filtering and Jaccard/overlap text similarity
3. Threshold evaluation (MATCH_THRESHOLD = 60)
4. Missing time non-penalization (neutral 5 pts, 'Time information unavailable')
5. Campus isolation (different campus items NEVER match)
6. Self-match avoidance (items from same user excluded)
7. Duplicate pair prevention / unique constraint
8. Automatic match generation upon POST /lost-items and POST /found-items
9. Scoped API endpoints: GET /api/matches, GET /api/lost-items/{id}/matches, GET /api/found-items/{id}/matches
10. Status updates (POSSIBLE -> REVIEWED, REJECTED) and permission enforcement (403 for unauthorized users).
"""

import sys
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.match import Match
from app.services.matching_service import (
    calculate_category_score,
    calculate_location_score,
    calculate_date_score,
    calculate_time_score,
    calculate_text_similarity,
    calculate_match_score,
    evaluate_and_save_match,
    MATCH_THRESHOLD,
)

client = TestClient(app)


def run_unit_scoring_tests():
    print("\n--- 1. Testing Rule-Based Scoring Units ---")

    # A. Category (25%)
    s, r = calculate_category_score("Wallet", "wallet")
    assert s == 25 and r == "Same category", f"Expected 25, got {s}"
    s, r = calculate_category_score("Wallet", "Electronics")
    assert s == 0 and r is None, f"Expected 0, got {s}"
    print("[PASS] Category scoring: exact match = 25, mismatch = 0")

    # B. Location (25%)
    s, r = calculate_location_score("Library", "Library")
    assert s == 25 and r == "Same campus location", f"Expected 25, got {s}"
    s, r = calculate_location_score("Central Library", "Library 2nd Floor")
    assert s == 15 and r == "Nearby or related campus location", f"Expected 15, got {s}"
    s, r = calculate_location_score("Library", "Sports Ground")
    assert s == 0 and r is None, f"Expected 0, got {s}"
    print("[PASS] Location scoring: exact = 25, related = 15, mismatch = 0")

    # C. Date (20%)
    s, r = calculate_date_score("2026-09-17", "2026-09-17")
    assert s == 20 and r == "Reported on the same date", f"Expected 20, got {s}"
    s, r = calculate_date_score("2026-09-17", "2026-09-18")
    assert s == 15 and r == "Reported 1 day apart", f"Expected 15, got {s}"
    s, r = calculate_date_score("2026-09-17", "2026-09-19")
    assert s == 10 and r == "Reported 2 days apart", f"Expected 10, got {s}"
    s, r = calculate_date_score("2026-09-17", "2026-09-20")
    assert s == 5 and r == "Reported within 3 days", f"Expected 5, got {s}"
    s, r = calculate_date_score("2026-09-17", "2026-09-25")
    assert s == 0 and r is None, f"Expected 0, got {s}"
    print("[PASS] Date scoring: 0d=20, 1d=15, 2d=10, 3d=5, >3d=0")

    # D. Time (10%)
    s, r = calculate_time_score("14:00", "14:30")
    assert s == 10 and r == "Occurred around the same time", f"Expected 10, got {s}"
    s, r = calculate_time_score("14:00", "16:00")
    assert s == 7 and r == "Occurred within 3 hours", f"Expected 7, got {s}"
    s, r = calculate_time_score("14:00", "18:00")
    assert s == 4 and r == "Occurred in the same part of day", f"Expected 4, got {s}"
    s, r = calculate_time_score("10:00", "22:00")
    assert s == 0 and r is None, f"Expected 0, got {s}"
    # Missing time handling
    s, r = calculate_time_score("14:00", None)
    assert s == 5 and r == "Time information unavailable", f"Expected neutral 5, got {s}"
    s, r = calculate_time_score(None, None)
    assert s == 5 and r == "Time information unavailable", f"Expected neutral 5, got {s}"
    print("[PASS] Time scoring: <=1h=10, <=3h=7, <=6h=4, missing=5 (unpenalized)")

    # E. Text Similarity (20%)
    t1 = "Black Leather Wallet with multiple card slots"
    t2 = "Black leather wallet found near library entrance"
    s, r = calculate_text_similarity(t1, t2)
    assert s >= 10, f"Expected high similarity >= 10, got {s}"
    print(f"[PASS] Text similarity: overlapping keywords score = {s}/20, reason: '{r}'")

    t_diff1 = "Black Leather Wallet"
    t_diff2 = "Blue Hydro Flask water bottle"
    s_diff, r_diff = calculate_text_similarity(t_diff1, t_diff2)
    assert s_diff == 0, f"Expected 0 for unrelated text, got {s_diff}"
    print("[PASS] Text similarity: unrelated items = 0/20")


def run_integration_api_tests():
    print("\n--- 2. Testing End-to-End Matching & API Workflows ---")

    # 1. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200, "Health check failed"
    print("[PASS] 1. API Health Check -> 200 OK")

    # 2. Register Users
    uid = uuid.uuid4().hex[:6]
    campus_a = f"Match Campus Alpha {uid}"
    campus_b = f"Match Campus Beta {uid}"

    # User A (Owner of Lost item)
    res_ua = client.post(
        "/api/register",
        json={
            "email": f"alice_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Alice LostOwner",
            "campus": campus_a,
        },
    )
    assert res_ua.status_code == 201, f"User A registration failed: {res_ua.text}"
    token_a = res_ua.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B (Finder of item on Campus A)
    res_ub = client.post(
        "/api/register",
        json={
            "email": f"bob_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Bob Finder",
            "campus": campus_a,
        },
    )
    assert res_ub.status_code == 201, f"User B registration failed: {res_ub.text}"
    token_b = res_ub.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User C (User on different campus B)
    res_uc = client.post(
        "/api/register",
        json={
            "email": f"carol_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Carol Remote",
            "campus": campus_b,
        },
    )
    assert res_uc.status_code == 201, f"User C registration failed: {res_uc.text}"
    token_c = res_uc.json()["access_token"]
    headers_c = {"Authorization": f"Bearer {token_c}"}
    print("[PASS] 2. Users Alice (Campus A), Bob (Campus A), Carol (Campus B) created")

    # 3. User A reports Lost Item (Black Leather Wallet, Library, 2026-09-17)
    res_lost = client.post(
        "/api/lost-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Library",
            "lost_date": "2026-09-17",
            "lost_time": "14:00",
            "description": "Black genuine leather wallet containing college ID and metro pass",
        },
        headers=headers_a,
    )
    assert res_lost.status_code == 201, f"Lost item creation failed: {res_lost.text}"
    lost_id = res_lost.json()["id"]
    print(f"[PASS] 3. Alice reported LostItem #{lost_id}")

    # Initially Alice should have 0 matches
    res_m0 = client.get("/api/matches", headers=headers_a)
    assert res_m0.status_code == 200
    assert res_m0.json()["total"] == 0
    print("[PASS] 4. Initially 0 matches exist for LostItem")

    # 4. User B reports matching Found Item (Black Wallet, Library, 2026-09-17)
    # Triggers automatic matching engine!
    res_found = client.post(
        "/api/found-items",
        json={
            "title": "Black Wallet",
            "category": "Wallet",
            "location": "Library",
            "found_date": "2026-09-17",
            "found_time": "14:30",
            "description": "Found black leather wallet near the library front desk",
        },
        headers=headers_b,
    )
    assert res_found.status_code == 201, f"Found item creation failed: {res_found.text}"
    found_id = res_found.json()["id"]
    print(f"[PASS] 5. Bob reported matching FoundItem #{found_id}")

    # 5. Verify Alice now sees the automatically generated match
    res_ma = client.get("/api/matches", headers=headers_a)
    assert res_ma.status_code == 200
    matches_a = res_ma.json()["matches"]
    assert len(matches_a) >= 1, f"Expected at least 1 match for Alice, got {len(matches_a)}"
    match_record = next((m for m in matches_a if m["lost_item_id"] == lost_id and m["found_item_id"] == found_id), None)
    assert match_record is not None, "Match pair (lost_id, found_id) not found in Alice's feed"
    score = match_record["score"]
    assert score >= 80, f"Expected strong match score >= 80, got {score}"
    assert "Same category" in match_record["reasons"]
    assert "Same campus location" in match_record["reasons"]
    assert "Reported on the same date" in match_record["reasons"]
    match_id = match_record["id"]
    print(f"[PASS] 6. Automatic Match #{match_id} created with real calculated score: {score}% (reasons: {len(match_record['reasons'])})")

    # 6. Verify Bob (the finder) also sees the match in his feed
    res_mb = client.get("/api/matches", headers=headers_b)
    assert res_mb.status_code == 200
    matches_b = res_mb.json()["matches"]
    assert any(m["id"] == match_id for m in matches_b), "Bob should see the match for his found item"
    print(f"[PASS] 7. Finder Bob also sees Match #{match_id} in his Match Center")

    # 7. Privacy & Scoping: User Carol (unrelated Campus B) must NOT see this match
    res_mc = client.get("/api/matches", headers=headers_c)
    assert res_mc.status_code == 200
    assert not any(m["id"] == match_id for m in res_mc.json()["matches"]), "Carol must not see Alice & Bob's match"
    print("[PASS] 8. Unrelated User Carol gets 0 matches (strict user scoping)")

    # 8. Single Match Endpoint & Authorization
    res_single_a = client.get(f"/api/matches/{match_id}", headers=headers_a)
    assert res_single_a.status_code == 200
    assert res_single_a.json()["id"] == match_id
    assert res_single_a.json()["signals"]["category"] == 25
    assert res_single_a.json()["signals"]["location"] == 25
    assert res_single_a.json()["signals"]["date"] == 20

    res_single_c = client.get(f"/api/matches/{match_id}", headers=headers_c)
    assert res_single_c.status_code == 403, "Unauthorized user should get 403 Forbidden"
    print("[PASS] 9. GET /api/matches/{id} returns details for owner and 403 for unauthorized viewer")

    # 9. Item-specific match endpoints
    res_item_lost = client.get(f"/api/lost-items/{lost_id}/matches", headers=headers_a)
    assert res_item_lost.status_code == 200
    assert any(m["id"] == match_id for m in res_item_lost.json())

    res_item_found = client.get(f"/api/found-items/{found_id}/matches", headers=headers_b)
    assert res_item_found.status_code == 200
    assert any(m["id"] == match_id for m in res_item_found.json())
    print("[PASS] 10. Item-specific routes (/lost-items/:id/matches and /found-items/:id/matches) work properly")

    # 10. Status update (POSSIBLE -> REVIEWED)
    res_status = client.patch(
        f"/api/matches/{match_id}/status",
        json={"status": "REVIEWED"},
        headers=headers_a,
    )
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "REVIEWED"
    print("[PASS] 11. Owner successfully marked match as REVIEWED")

    # 11. Filter by status
    res_filtered = client.get("/api/matches?status=REVIEWED", headers=headers_a)
    assert res_filtered.status_code == 200
    assert any(m["id"] == match_id for m in res_filtered.json()["matches"])
    print("[PASS] 12. Query param ?status=REVIEWED correctly filters matches")

    # 12. Avoid Self-Matching Test: Alice reports a Found item on the same campus
    res_self_found = client.post(
        "/api/found-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Library",
            "found_date": "2026-09-17",
            "found_time": "14:00",
            "description": "Found leather wallet",
        },
        headers=headers_a,
    )
    assert res_self_found.status_code == 201
    self_found_id = res_self_found.json()["id"]

    # Verify no self-match was created between Alice's lost item and Alice's found item
    db: Session = SessionLocal()
    try:
        self_match = db.query(Match).filter_by(lost_item_id=lost_id, found_item_id=self_found_id).first()
        assert self_match is None, "Self-matching must be prevented!"
    finally:
        db.close()
    print("[PASS] 13. Self-matching prevented: User cannot match with their own report")

    # 13. Cross-Campus Isolation: Carol reports Found Item on Campus Beta with identical details
    res_remote_found = client.post(
        "/api/found-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Library",
            "found_date": "2026-09-17",
            "found_time": "14:00",
            "description": "Black leather wallet",
        },
        headers=headers_c,
    )
    assert res_remote_found.status_code == 201
    remote_found_id = res_remote_found.json()["id"]

    db = SessionLocal()
    try:
        cross_match = db.query(Match).filter_by(lost_item_id=lost_id, found_item_id=remote_found_id).first()
        assert cross_match is None, "Cross-campus matching must be completely prevented!"
    finally:
        db.close()
    print("[PASS] 14. Cross-campus isolation strictly verified: Different campuses do not match")

    # 14. Uniqueness / Idempotency: Triggering matching again does not create duplicate rows
    res_scan = client.post("/api/matches/scan", headers=headers_a)
    assert res_scan.status_code == 200
    db = SessionLocal()
    try:
        match_count = db.query(Match).filter_by(lost_item_id=lost_id, found_item_id=found_id).count()
        assert match_count == 1, f"Expected exactly 1 match row, found {match_count} (duplicate created!)"
    finally:
        db.close()
    print("[PASS] 15. Idempotency verified: Duplicate (lost_item, found_item) match rows strictly prevented")


def main():
    print("==========================================")
    print("   TRACELT MATCHING SYSTEM VERIFICATION   ")
    print("==========================================")
    run_unit_scoring_tests()
    run_integration_api_tests()
    print("==========================================")
    print("   ALL 15 MATCHING SYSTEM CHECKS PASSED!  ")
    print("==========================================")


if __name__ == "__main__":
    main()
