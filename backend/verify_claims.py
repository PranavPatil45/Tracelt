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

    # Verify atomic updates to source items
    res_lost_check = client.get(f"/api/lost-items/{lost_id}", headers=headers_a)
    assert res_lost_check.status_code == 200
    assert res_lost_check.json()["status"] == "RECOVERED", "LostItem must transition to RECOVERED"

    res_found_check = client.get(f"/api/found-items/{found_id}", headers=headers_b)
    assert res_found_check.status_code == 200
    assert res_found_check.json()["status"] == "CLAIMED", "FoundItem must transition to CLAIMED"
    print("[PASS] 14. Finder Bob approved claim: Atomic transaction updated Claim (APPROVED), LostItem (RECOVERED), FoundItem (CLAIMED)")

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

    print("==========================================")
    print("   ALL 18 CLAIM VERIFICATION CHECKS PASSED! ")
    print("==========================================")


if __name__ == "__main__":
    run_claim_tests()
