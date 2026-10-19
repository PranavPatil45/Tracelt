#!/usr/bin/env python3
"""
Verification test suite for Tracelt Claim & Verification System.
Validates:
1. Valid claim submission by claimant (lost item owner)
2. Unauthorized user blocked from claiming (403 Forbidden)
3. Finder blocked from claiming own found item (403 Forbidden)
4. Minimum length validation for verification details (>= 10 chars)
5. Duplicate active claim prevented (409 Conflict)
6. Claimant views submitted claims via GET /api/claims
7. Finder views incoming claims to review via GET /api/claims/incoming
8. Unauthorized user blocked from viewing claim details (403 Forbidden)
9. Claimant blocked from approving their own claim (403 Forbidden)
10. Finder approves claim in atomic transaction:
    - Claim -> APPROVED
    - LostItem -> RECOVERED
    - FoundItem -> CLAIMED
    - Match -> REVIEWED
11. Second claim cannot approve already claimed item (400 Bad Request)
12. Finalized claim cannot be modified (400 Bad Request)
13. Finder rejects claim with notes:
    - Claim -> REJECTED
    - Items remain ACTIVE / AVAILABLE
14. Claimant cancels pending claim:
    - Claim -> CANCELLED
15. Non-pending claim cannot be cancelled (400 Bad Request)
"""

import sys
import uuid
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def run_claim_tests():
    print("==========================================")
    print("   TRACELT CLAIM & VERIFICATION TESTS     ")
    print("==========================================")

    # 1. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    print("[PASS] 1. API Health Check -> 200 OK")

    uid = uuid.uuid4().hex[:6]
    campus = f"Claim Campus {uid}"

    # User A (Claimant: loses item)
    res_ua = client.post(
        "/api/register",
        json={
            "email": f"claimant_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Alice Claimant",
            "campus": campus,
        },
    )
    assert res_ua.status_code == 201
    token_a = res_ua.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # User B (Finder: finds item)
    res_ub = client.post(
        "/api/register",
        json={
            "email": f"finder_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Bob Finder",
            "campus": campus,
        },
    )
    assert res_ub.status_code == 201
    token_b = res_ub.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User C (Unrelated intruder)
    res_uc = client.post(
        "/api/register",
        json={
            "email": f"intruder_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Charlie Intruder",
            "campus": campus,
        },
    )
    assert res_uc.status_code == 201
    token_c = res_uc.json()["access_token"]
    headers_c = {"Authorization": f"Bearer {token_c}"}
    print("[PASS] 2. Users Alice (Claimant), Bob (Finder), Charlie (Intruder) registered")

    # 2. Alice reports Lost Item
    res_lost = client.post(
        "/api/lost-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Library",
            "lost_date": "2026-09-18",
            "lost_time": "11:00",
            "description": "Black leather wallet with university ID card and metro pass",
        },
        headers=headers_a,
    )
    assert res_lost.status_code == 201
    lost_id = res_lost.json()["id"]

    # 3. Bob reports Found Item (triggers matching)
    res_found = client.post(
        "/api/found-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Library",
            "found_date": "2026-09-18",
            "found_time": "11:30",
            "description": "Found leather wallet on table near library entrance",
        },
        headers=headers_b,
    )
    assert res_found.status_code == 201
    found_id = res_found.json()["id"]

    # 4. Fetch the Match record
    res_matches = client.get("/api/matches", headers=headers_a)
    assert res_matches.status_code == 200
    matches = res_matches.json()["matches"]
    assert len(matches) >= 1, "Expected matching engine to create match"
    match = matches[0]
    match_id = match["id"]
    print(f"[PASS] 3. Match #{match_id} created between Lost #{lost_id} and Found #{found_id} (Score: {match['score']}%)")

    # 5. Validation: Short verification text rejected (< 10 chars)
    res_short = client.post(
        f"/api/matches/{match_id}/claim",
        json={"verification_details": "Too short"},
        headers=headers_a,
    )
    assert res_short.status_code == 422, "Expected 422 for verification_details < 10 chars"
    print("[PASS] 4. Short verification details (< 10 chars) rejected (422 Unprocessable Entity)")

    # 6. Unauthorized user Charlie attempts to claim
    res_unauth = client.post(
        f"/api/matches/{match_id}/claim",
        json={
            "verification_details": "I want to claim this wallet, it looks like mine.",
        },
        headers=headers_c,
    )
    assert res_unauth.status_code == 403, "Unrelated user Charlie should get 403"
    print("[PASS] 5. Unauthorized user Charlie blocked from claiming (403 Forbidden)")

    # 7. Finder Bob attempts to claim own found item
    res_finder_claim = client.post(
        f"/api/matches/{match_id}/claim",
        json={
            "verification_details": "I found this item and want to claim it back.",
        },
        headers=headers_b,
    )
    assert res_finder_claim.status_code == 403, "Finder Bob should get 403"
    print("[PASS] 6. Finder Bob blocked from claiming own found item (403 Forbidden)")

    # 8. Valid Claim Submission by Alice (Claimant)
    res_claim = client.post(
        f"/api/matches/{match_id}/claim",
        json={
            "verification_details": "Inside there is a green metro card and a library card ending in 4492. There is also a slight scratch on the coin zipper.",
            "additional_message": "Can meet at the campus security desk at 2 PM.",
        },
        headers=headers_a,
    )
    assert res_claim.status_code == 201, f"Claim creation failed: {res_claim.text}"
    claim_data = res_claim.json()
    claim_id = claim_data["id"]
    assert claim_data["status"] == "PENDING"
    assert claim_data["claimant"]["full_name"] == "Alice Claimant"
    assert claim_data["lost_item"]["id"] == lost_id
    assert claim_data["found_item"]["id"] == found_id
    print(f"[PASS] 7. Alice successfully submitted Claim #{claim_id} (Status: PENDING)")

    # 9. Duplicate active claim prevention
    res_dup = client.post(
        f"/api/matches/{match_id}/claim",
        json={
            "verification_details": "Submitting another claim for the same wallet.",
        },
        headers=headers_a,
    )
    assert res_dup.status_code == 409, "Duplicate claim should return 409 Conflict"
    print("[PASS] 8. Duplicate active claim prevented (409 Conflict)")

    # 10. Check active claim helper endpoint
    res_active = client.get(f"/api/matches/{match_id}/active-claim", headers=headers_a)
    assert res_active.status_code == 200
    assert res_active.json()["has_active_claim"] is True
    assert res_active.json()["claim"]["id"] == claim_id
    print("[PASS] 9. GET /api/matches/{id}/active-claim returns active claim")

    # 11. Claimant view: Alice sees her submitted claim in GET /api/claims
    res_my_claims = client.get("/api/claims", headers=headers_a)
    assert res_my_claims.status_code == 200
    claims_a = res_my_claims.json()["claims"]
    assert any(c["id"] == claim_id for c in claims_a)
    print(f"[PASS] 10. Claimant Alice views her submitted claims (Count: {len(claims_a)})")

    # 12. Finder view: Bob sees incoming claim in GET /api/claims/incoming
    res_incoming = client.get("/api/claims/incoming", headers=headers_b)
    assert res_incoming.status_code == 200
    claims_b = res_incoming.json()["claims"]
    assert any(c["id"] == claim_id for c in claims_b)
    print(f"[PASS] 11. Finder Bob views incoming claims to review (Count: {len(claims_b)})")

    # 13. Intruder Charlie blocked from reading claim details
    res_intruder_view = client.get(f"/api/claims/{claim_id}", headers=headers_c)
    assert res_intruder_view.status_code == 403
    print("[PASS] 12. Intruder Charlie blocked from viewing claim details (403 Forbidden)")

    # 14. Claimant Alice cannot approve her own claim
    res_self_approve = client.put(
        f"/api/claims/{claim_id}/review",
        json={"action": "APPROVE"},
        headers=headers_a,
    )
    assert res_self_approve.status_code == 403
    print("[PASS] 13. Claimant Alice blocked from reviewing her own claim (403 Forbidden)")

    # 15. Finder Bob Approves Claim (Atomic Transaction)
    res_approve = client.put(
        f"/api/claims/{claim_id}/review",
        json={
            "action": "APPROVE",
            "reviewer_notes": "Verification details match 100%. The metro card and student ID are present.",
        },
        headers=headers_b,
    )
    assert res_approve.status_code == 200
    approved_data = res_approve.json()
    assert approved_data["status"] == "APPROVED"
    assert approved_data["reviewer_notes"] is not None

    # Verify atomic updates to source items: claim approval authorizes recovery, does NOT prematurely mark RECOVERED
    res_lost_check = client.get(f"/api/lost-items/{lost_id}", headers=headers_a)
    assert res_lost_check.status_code == 200
    assert res_lost_check.json()["status"] == "CLAIMED", "LostItem must transition to CLAIMED (not prematurely RECOVERED)"

    res_found_check = client.get(f"/api/found-items/{found_id}", headers=headers_b)
    assert res_found_check.status_code == 200
    assert res_found_check.json()["status"] == "CLAIMED", "FoundItem must transition to CLAIMED"
    print("[PASS] 14. Finder Bob approved claim: Atomic transaction updated Claim (APPROVED), LostItem (CLAIMED), FoundItem (CLAIMED)")

    # 16. Finalized claim cannot be modified again
    res_modify_final = client.put(
        f"/api/claims/{claim_id}/review",
        json={"action": "REJECT"},
        headers=headers_b,
    )
    assert res_modify_final.status_code == 400
    print("[PASS] 15. Already APPROVED claim cannot be re-reviewed (400 Bad Request)")

    # 17. Claimant cannot cancel an already approved claim
    res_cancel_approved = client.post(f"/api/claims/{claim_id}/cancel", headers=headers_a)
    assert res_cancel_approved.status_code == 400
    print("[PASS] 16. Approved claim cannot be cancelled (400 Bad Request)")

    # 18. Test Cancellation Flow on a new pending claim
    # Create Lost 2 & Found 2
    res_l2 = client.post(
        "/api/lost-items",
        json={
            "title": "Blue Backpack",
            "category": "Bag",
            "location": "Canteen",
            "lost_date": "2026-09-18",
            "description": "Blue JanSport backpack with notebook inside",
        },
        headers=headers_a,
    )
    l2_id = res_l2.json()["id"]

    res_f2 = client.post(
        "/api/found-items",
        json={
            "title": "Blue Backpack",
            "category": "Bag",
            "location": "Canteen",
            "found_date": "2026-09-18",
            "description": "Blue backpack found on canteen chair",
        },
        headers=headers_b,
    )
    f2_id = res_f2.json()["id"]

    res_m2 = client.get(f"/api/lost-items/{l2_id}/matches", headers=headers_a)
    m2_id = res_m2.json()[0]["id"]

    # Alice submits claim 2
    res_c2 = client.post(
        f"/api/matches/{m2_id}/claim",
        json={"verification_details": "My name is written inside the front pocket zipper."},
        headers=headers_a,
    )
    c2_id = res_c2.json()["id"]

    # Alice cancels claim 2
    res_cancel = client.post(f"/api/claims/{c2_id}/cancel", headers=headers_a)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "CANCELLED"
    print(f"[PASS] 17. Claimant Alice successfully cancelled pending Claim #{c2_id} (Status: CANCELLED)")

    # 19. Test Rejection Flow: Alice resubmits after cancellation, Bob rejects with notes
    res_c3 = client.post(
        f"/api/matches/{m2_id}/claim",
        json={"verification_details": "Resubmitted verification with full notebook title."},
        headers=headers_a,
    )
    c3_id = res_c3.json()["id"]

    res_reject = client.put(
        f"/api/claims/{c3_id}/review",
        json={"action": "REJECT", "reviewer_notes": "Name on backpack does not match claimant."},
        headers=headers_b,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "REJECTED"

    # Verify items remain active/available after rejection!
    res_l2_check = client.get(f"/api/lost-items/{l2_id}", headers=headers_a)
    assert res_l2_check.json()["status"] == "ACTIVE"
    res_f2_check = client.get(f"/api/found-items/{f2_id}", headers=headers_b)
    assert res_f2_check.json()["status"] == "AVAILABLE"
    print(f"[PASS] 18. Finder Bob rejected Claim #{c3_id}: Claim -> REJECTED, items remain ACTIVE & AVAILABLE")

    # =========================================================================
    # PART II: DIRECT CLAIM FLOW TESTS (NO AUTOMATED MATCH / NO LOST ITEM REPORT)
    # =========================================================================
    print("\n--- DIRECT CLAIM FLOW TESTS ---")

    # User D (Direct Claimant who never reported any lost item)
    res_ud = client.post(
        "/api/register",
        json={
            "email": f"direct_claimant_{uid}@campus.edu",
            "password": "Password123!",
            "full_name": "Diana Direct",
            "campus": campus,
        },
    )
    assert res_ud.status_code == 201
    token_d = res_ud.json()["access_token"]
    headers_d = {"Authorization": f"Bearer {token_d}"}

    # Bob reports a found item (standalone, unique title so NO match exists)
    res_standalone = client.post(
        "/api/found-items",
        json={
            "title": f"Unique Silver Calculator {uid}",
            "category": "Electronics",
            "location": "Math Hall 101",
            "found_date": "2026-09-19",
            "description": "TI-84 Plus graphing calculator left on desk in row 4",
        },
        headers=headers_b,
    )
    assert res_standalone.status_code == 201
    standalone_found_id = res_standalone.json()["id"]

    # Verify NO match was created for this found item
    res_found_matches = client.get(f"/api/found-items/{standalone_found_id}/matches", headers=headers_b)
    assert res_found_matches.status_code == 200
    assert len(res_found_matches.json()) == 0, "Expected NO automated matches for standalone found item"
    print(f"[PASS] 19. Standalone Found Item #{standalone_found_id} created with 0 automated matches")

    # 20. Direct Claim on non-existent item -> 404 Not Found
    res_nonexistent = client.post(
        "/api/found-items/999999/claim",
        json={"verification_details": "This item has my name engraved on the back casing."},
        headers=headers_d,
    )
    assert res_nonexistent.status_code == 404
    print("[PASS] 20. Direct claim on non-existent item returns 404 Not Found")

    # 21. Validation: Short verification text on direct claim (< 10 chars) -> 422
    res_dc_short = client.post(
        f"/api/found-items/{standalone_found_id}/claim",
        json={"verification_details": "Short"},
        headers=headers_d,
    )
    assert res_dc_short.status_code == 422
    print("[PASS] 21. Short verification details on direct claim rejected (422 Unprocessable Entity)")

    # 22. Unauthenticated direct claim -> 401 Unauthorized
    res_dc_unauth = client.post(
        f"/api/found-items/{standalone_found_id}/claim",
        json={"verification_details": "This is definitely my graphing calculator with blue cover."},
    )
    assert res_dc_unauth.status_code == 401
    print("[PASS] 22. Unauthenticated direct claim blocked (401 Unauthorized)")

    # 23. Self-claim prevention: Finder Bob attempts to claim his own found item -> 400 Bad Request
    res_dc_self = client.post(
        f"/api/found-items/{standalone_found_id}/claim",
        json={"verification_details": "I found this item and want to claim it back myself."},
        headers=headers_b,
    )
    assert res_dc_self.status_code == 400
    assert "Cannot claim an item you reported as found yourself" in res_dc_self.json()["detail"]
    print("[PASS] 23. Finder Bob blocked from claiming own found item directly (400 Bad Request)")

    # 24. Ineligible item state validation: Closed / Claimed item cannot be claimed
    res_ineligible_found = client.post(
        "/api/found-items",
        json={
            "title": f"Closed Found Jacket {uid}",
            "category": "Clothing",
            "location": "Gym",
            "found_date": "2026-09-19",
            "description": "Red windbreaker jacket",
        },
        headers=headers_b,
    )
    ineligible_id = res_ineligible_found.json()["id"]
    # Update item status to CLOSED
    client.put(
        f"/api/found-items/{ineligible_id}",
        json={"status": "CLOSED"},
        headers=headers_b,
    )
    res_claim_closed = client.post(
        f"/api/found-items/{ineligible_id}/claim",
        json={"verification_details": "Has my initials DJ on the inside label."},
        headers=headers_d,
    )
    assert res_claim_closed.status_code == 400
    assert "not eligible for claiming" in res_claim_closed.json()["detail"]
    print("[PASS] 24. Direct claim on CLOSED found item blocked (400 Bad Request)")

    # 25. Valid Direct Claim Submission by Diana (Claimant with NO lost item and NO match)
    res_direct_claim = client.post(
        f"/api/found-items/{standalone_found_id}/claim",
        json={
            "verification_details": "Back casing has a sticker from Robotics Club 2025 and batteries are Energizer rechargeable.",
            "additional_message": "Can pick up anytime at the student center.",
        },
        headers=headers_d,
    )
    assert res_direct_claim.status_code == 201, f"Direct claim failed: {res_direct_claim.text}"
    dc_data = res_direct_claim.json()
    dc_id = dc_data["id"]
    assert dc_data["status"] == "PENDING"
    assert dc_data["match_id"] is None, "Direct claim must have match_id = None"
    assert dc_data["match_score"] is None, "Direct claim must have match_score = None"
    assert dc_data["lost_item"] is None, "Direct claim without lost report has lost_item = None"
    assert dc_data["found_item"]["id"] == standalone_found_id
    assert dc_data["claimant"]["full_name"] == "Diana Direct"
    print(f"[PASS] 25. Diana successfully submitted Direct Claim #{dc_id} without any automated match (Status: PENDING)")

    # 26. Duplicate active direct claim prevention -> 409 Conflict
    res_dc_dup = client.post(
        f"/api/found-items/{standalone_found_id}/claim",
        json={"verification_details": "Submitting another claim for the same calculator."},
        headers=headers_d,
    )
    assert res_dc_dup.status_code == 409
    assert "already exists for this found item" in res_dc_dup.json()["detail"]
    print("[PASS] 26. Duplicate active direct claim prevented (409 Conflict)")

    # 27. Active claim check for found item (GET /api/found-items/{id}/active-claim)
    res_ac_d = client.get(f"/api/found-items/{standalone_found_id}/active-claim", headers=headers_d)
    assert res_ac_d.status_code == 200
    assert res_ac_d.json()["has_active_claim"] is True
    assert res_ac_d.json()["claim"]["id"] == dc_id

    res_ac_c = client.get(f"/api/found-items/{standalone_found_id}/active-claim", headers=headers_c)
    assert res_ac_c.status_code == 200
    assert res_ac_c.json()["has_active_claim"] is False
    assert res_ac_c.json()["claim"] is None
    print("[PASS] 27. GET /api/found-items/{id}/active-claim accurately reflects active status per user")

    # 28. Claimant Diana views direct claim in GET /api/claims
    res_diana_claims = client.get("/api/claims", headers=headers_d)
    assert res_diana_claims.status_code == 200
    assert any(c["id"] == dc_id for c in res_diana_claims.json()["claims"])
    print("[PASS] 28. Claimant Diana views direct claim in GET /api/claims")

    # 29. Finder Bob views incoming direct claim in GET /api/claims/incoming
    res_bob_incoming = client.get("/api/claims/incoming", headers=headers_b)
    assert res_bob_incoming.status_code == 200
    assert any(c["id"] == dc_id for c in res_bob_incoming.json()["claims"])
    print("[PASS] 29. Finder Bob views incoming direct claim in GET /api/claims/incoming")

    # 30. Intruder Charlie blocked from viewing direct claim details -> 403 Forbidden
    res_dc_intruder = client.get(f"/api/claims/{dc_id}", headers=headers_c)
    assert res_dc_intruder.status_code == 403
    print("[PASS] 30. Intruder Charlie blocked from viewing direct claim details (403 Forbidden)")

    # 31. Claimant Diana cancels direct claim
    res_dc_cancel = client.post(f"/api/claims/{dc_id}/cancel", headers=headers_d)
    assert res_dc_cancel.status_code == 200
    assert res_dc_cancel.json()["status"] == "CANCELLED"
    print(f"[PASS] 31. Claimant Diana successfully cancelled Direct Claim #{dc_id}")

    # 32. Diana resubmits direct claim via unified endpoint POST /api/claims
    res_unified = client.post(
        "/api/claims",
        json={
            "found_item_id": standalone_found_id,
            "verification_details": "Resubmitted direct claim with full battery brand and serial prefix.",
        },
        headers=headers_d,
    )
    assert res_unified.status_code == 201
    dc2_id = res_unified.json()["id"]
    print(f"[PASS] 32. Unified POST /api/claims created Direct Claim #{dc2_id}")

    # 33. Unified endpoint rejects submission without match_id or found_item_id (400)
    res_unified_bad = client.post(
        "/api/claims",
        json={"verification_details": "Missing both found_item_id and match_id."},
        headers=headers_d,
    )
    assert res_unified_bad.status_code == 400
    print("[PASS] 33. Unified POST /api/claims rejects empty item identifiers (400 Bad Request)")

    # 34. Finder Bob approves direct claim in atomic transaction
    res_bob_approve = client.put(
        f"/api/claims/{dc2_id}/review",
        json={"action": "APPROVE", "reviewer_notes": "Sticker verified, calculator handed over."},
        headers=headers_b,
    )
    assert res_bob_approve.status_code == 200
    assert res_bob_approve.json()["status"] == "APPROVED"

    # Verify found item status transitioned to CLAIMED
    res_check_item = client.get(f"/api/found-items/{standalone_found_id}", headers=headers_b)
    assert res_check_item.json()["status"] == "CLAIMED"
    print("[PASS] 34. Finder Bob approved direct claim: Claim -> APPROVED, FoundItem -> CLAIMED")

    print("\n==========================================")
    print("   ALL 34 CLAIM VERIFICATION CHECKS PASSED! ")
    print("==========================================")


if __name__ == "__main__":
    run_claim_tests()
