import os
import sys
import uuid
from datetime import datetime
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.models.claim import Claim
from app.models.recovery import Recovery

client = TestClient(app)

def create_user_token(email: str, name: str, campus: str = "Downtown", role: str = "user"):
    password = "SecurePassword123!"
    reg_res = client.post("/api/register", json={
        "email": email,
        "password": password,
        "full_name": name,
        "campus": campus,
    })
    assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    user_info = reg_res.json()["user"]
    if role != "user":
        db = SessionLocal()
        u = db.query(User).filter(User.id == user_info["id"]).first()
        if u:
            u.role = role
            db.commit()
            db.refresh(u)
            user_info["role"] = role
        db.close()
    return {"headers": {"Authorization": f"Bearer {token}"}, "user": user_info}

def run_tests():
    print("=" * 65)
    print("   TASK 2: COMPETING CLAIMS & RECOVERY LIFECYCLE VERIFICATION   ")
    print("=" * 65)

    uid = uuid.uuid4().hex[:6]
    alice = create_user_token(f"alice_{uid}@example.com", "Alice Claimant")
    bob = create_user_token(f"bob_{uid}@example.com", "Bob Finder")
    charlie = create_user_token(f"charlie_{uid}@example.com", "Charlie Competitor")
    dave = create_user_token(f"dave_{uid}@example.com", "Dave Intruder")

    print("[PASS] 1. Test users registered (Alice, Bob, Charlie, Dave)")

    # -------------------------------------------------------------
    # TEST SUITE 1: PREMATURE RECOVERY PROTECTION & STATUS LIFECYCLE
    # -------------------------------------------------------------
    # Alice reports lost laptop
    lost_res = client.post("/api/lost-items", json={
        "title": f"MacBook Pro M2 {uid}",
        "category": "Electronics",
        "description": "Silver 14-inch MacBook with stickers",
        "location": "Science Library",
        "lost_date": "2026-10-18",
    }, headers=alice["headers"])
    assert lost_res.status_code == 201
    lost_id = lost_res.json()["id"]

    # Bob reports found laptop
    found_res = client.post("/api/found-items", json={
        "title": f"MacBook Pro {uid}",
        "category": "Electronics",
        "description": "Found silver laptop in library cubicle",
        "location": "Science Library",
        "found_date": "2026-10-18",
    }, headers=bob["headers"])
    assert found_res.status_code == 201
    found_id = found_res.json()["id"]

    # Check match
    matches_res = client.get(f"/api/lost-items/{lost_id}/matches", headers=alice["headers"])
    assert matches_res.status_code == 200
    match_list = matches_res.json()
    assert len(match_list) > 0
    match_id = match_list[0]["id"]

    # Alice submits claim on match
    claim_res = client.post(f"/api/matches/{match_id}/claim", json={
        "verification_details": "Laptop has a GitHub sticker on top and serial starts with C02.",
    }, headers=alice["headers"])
    assert claim_res.status_code == 201
    claim_id = claim_res.json()["id"]
    print(f"[PASS] 2. Alice submitted Claim #{claim_id} on Match #{match_id}")

    # Bob approves claim
    approve_res = client.put(f"/api/claims/{claim_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Sticker details confirmed.",
    }, headers=bob["headers"])
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "APPROVED"

    # CRITICAL CHECK: Item must NOT be RECOVERED upon claim approval!
    check_lost = client.get(f"/api/lost-items/{lost_id}", headers=alice["headers"])
    assert check_lost.status_code == 200
    assert check_lost.json()["status"] == "CLAIMED", f"Expected CLAIMED, got {check_lost.json()['status']}"

    check_found = client.get(f"/api/found-items/{found_id}", headers=bob["headers"])
    assert check_found.status_code == 200
    assert check_found.json()["status"] == "CLAIMED", f"Expected CLAIMED, got {check_found.json()['status']}"
    print("[PASS] 3. Claim approval DOES NOT prematurely mark item RECOVERED (LostItem=CLAIMED, FoundItem=CLAIMED)")

    # Verify recovery record was created with RETURN_PENDING
    rec_res = client.get(f"/api/claims/{claim_id}/recovery", headers=alice["headers"])
    assert rec_res.status_code == 200
    rec = rec_res.json()
    rec_id = rec["id"]
    assert rec["status"] == "RETURN_PENDING"
    print(f"[PASS] 4. Recovery record #{rec_id} auto-created with status RETURN_PENDING")

    # -------------------------------------------------------------
    # TEST SUITE 2: SAFE HANDOVER ORDER & PERMISSIONS
    # -------------------------------------------------------------
    # Out-of-order: Alice tries to confirm before item is marked returned -> 409 Conflict
    premature_confirm = client.post(f"/api/recoveries/{rec_id}/confirm", headers=alice["headers"])
    assert premature_confirm.status_code == 409
    print("[PASS] 5. Out-of-order confirm blocked before item is returned (409 Conflict)")

    # Dave (unauthorized) tries to mark returned -> 403 Forbidden
    dave_mark = client.post(f"/api/recoveries/{rec_id}/returned", json={"return_location": "Desk"}, headers=dave["headers"])
    assert dave_mark.status_code == 403
    print("[PASS] 6. Unauthorized user blocked from marking item returned (403 Forbidden)")

    # Alice (claimant) tries to mark returned -> 403 Forbidden
    alice_mark = client.post(f"/api/recoveries/{rec_id}/returned", json={"return_location": "Desk"}, headers=alice["headers"])
    assert alice_mark.status_code == 403
    print("[PASS] 7. Claimant blocked from marking item returned (403 Forbidden)")

    # Finder Bob marks returned
    bob_mark = client.post(f"/api/recoveries/{rec_id}/returned", json={
        "return_location": "Science Library Security Desk",
        "return_notes": "Handed to Officer Smith.",
    }, headers=bob["headers"])
    assert bob_mark.status_code == 200
    assert bob_mark.json()["status"] == "RETURNED"

    # Repeated mark returned returns 409 Conflict
    bob_dup_mark = client.post(f"/api/recoveries/{rec_id}/returned", json={"return_location": "Desk"}, headers=bob["headers"])
    assert bob_dup_mark.status_code == 409
    print("[PASS] 8. Finder marked item RETURNED and repeated return calls blocked (409 Conflict)")

    # Bob (finder) tries to confirm recovery -> 403 Forbidden
    bob_confirm = client.post(f"/api/recoveries/{rec_id}/confirm", headers=bob["headers"])
    assert bob_confirm.status_code == 403
    print("[PASS] 9. Finder blocked from confirming receipt (403 Forbidden)")

    # Claimant Alice confirms recovery
    alice_confirm = client.post(f"/api/recoveries/{rec_id}/confirm", headers=alice["headers"])
    assert alice_confirm.status_code == 200
    assert alice_confirm.json()["status"] == "RECOVERED"

    # Repeated confirm returns 409 Conflict
    alice_dup_confirm = client.post(f"/api/recoveries/{rec_id}/confirm", headers=alice["headers"])
    assert alice_dup_confirm.status_code == 409
    print("[PASS] 10. Claimant confirmed recovery and repeated confirm calls blocked (409 Conflict)")

    # Verify final item statuses
    check_lost_final = client.get(f"/api/lost-items/{lost_id}", headers=alice["headers"])
    assert check_lost_final.json()["status"] == "RECOVERED"
    check_found_final = client.get(f"/api/found-items/{found_id}", headers=bob["headers"])
    assert check_found_final.json()["status"] == "RETURNED"
    print("[PASS] 11. Final statuses verified after confirmed handover (LostItem=RECOVERED, FoundItem=RETURNED)")

    # -------------------------------------------------------------
    # TEST SUITE 3: COMPETING CLAIMS HANDLING ON A FOUND ITEM
    # -------------------------------------------------------------
    # Bob reports a found blue water bottle (eligible for claiming)
    f2_res = client.post("/api/found-items", json={
        "title": f"Hydro Flask Blue {uid}",
        "category": "Personal Items",
        "description": "Blue 32oz Hydro Flask found in Dining Hall",
        "location": "Dining Hall",
        "found_date": "2026-10-18",
    }, headers=bob["headers"])
    assert f2_res.status_code == 201
    f2_id = f2_res.json()["id"]

    # Alice submits Claim 1 (direct claim)
    claim_alice_res = client.post(f"/api/found-items/{f2_id}/claim", json={
        "verification_details": "Has a scratch near the logo and black lid.",
    }, headers=alice["headers"])
    assert claim_alice_res.status_code == 201
    c_alice_id = claim_alice_res.json()["id"]

    # Charlie submits competing Claim 2 (direct claim) on the same found item -> Blocked by Rule 1.1
    claim_charlie_res = client.post(f"/api/found-items/{f2_id}/claim", json={
        "verification_details": "Lost my hydro flask yesterday with black strap.",
    }, headers=charlie["headers"])
    assert claim_charlie_res.status_code == 409
    print(f"[PASS] 12a. Rule 1.1 enforced: Second active claim blocked while Claim #{c_alice_id} is active (409 Conflict)")

    # Simulate legacy/exceptional competing claim directly in DB (Rule 1.2)
    db = SessionLocal()
    charlie_claim = Claim(
        found_item_id=f2_id,
        claimant_id=charlie["user"]["id"],
        verification_details="Lost my hydro flask yesterday with black strap.",
        status="PENDING",
    )
    db.add(charlie_claim)
    db.commit()
    db.refresh(charlie_claim)
    c_charlie_id = charlie_claim.id
    db.close()
    print(f"[PASS] 12b. Exceptional competing claims present on FoundItem #{f2_id} (Claim #{c_alice_id} and #{c_charlie_id})")

    # Finder Bob attempts to approve Alice's claim directly -> Blocked because competing claims require Reviewer intervention
    fail_finder_appr = client.put(f"/api/claims/{c_alice_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Scratch matches description perfectly.",
    }, headers=bob["headers"])
    assert fail_finder_appr.status_code == 400
    assert "Mandatory Reviewer intervention is required" in fail_finder_appr.json()["detail"]
    print("[PASS] 12c. Finder blocked from approving when competing claims exist (400 Bad Request)")

    # Authorized Staff Reviewer resolves competing claims by approving Alice's claim
    staff_reviewer = create_user_token(f"staff_comp_{uid}@example.com", "Staff Reviewer", role="reviewer")
    appr_alice = client.put(f"/api/claims/{c_alice_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Scratch matches description perfectly. Reviewer approved.",
    }, headers=staff_reviewer["headers"])
    assert appr_alice.status_code == 200
    assert appr_alice.json()["status"] == "APPROVED"

    # Verify Charlie's competing claim was automatically REJECTED
    c_charlie_check = client.get(f"/api/claims/{c_charlie_id}", headers=charlie["headers"])
    assert c_charlie_check.status_code == 200
    assert c_charlie_check.json()["status"] == "REJECTED"
    assert "Another ownership claim was approved" in (c_charlie_check.json()["reviewer_notes"] or "")
    print(f"[PASS] 13. Competing Claim #{c_charlie_id} automatically transitioned to REJECTED with clear rationale")

    # Verify Charlie received claim rejection notification
    notifs_c = client.get("/api/notifications", headers=charlie["headers"]).json()["notifications"]
    assert any(n["type"] == "CLAIM_REJECTED" for n in notifs_c)
    print("[PASS] 14. Competing claimant Charlie received CLAIM_REJECTED notification")

    # Bob tries to approve Charlie's already rejected claim -> 400 Bad Request
    fail_appr_charlie = client.put(f"/api/claims/{c_charlie_id}/review", json={
        "action": "APPROVE",
    }, headers=bob["headers"])
    assert fail_appr_charlie.status_code == 400
    print("[PASS] 15. Attempting to approve competing claim is rejected (400 Bad Request)")

    # Dave tries to submit a new claim on now-CLAIMED FoundItem f2 -> 400 Bad Request
    fail_new_claim = client.post(f"/api/found-items/{f2_id}/claim", json={
        "verification_details": "Is this still available to claim?",
    }, headers=dave["headers"])
    assert fail_new_claim.status_code == 400
    print("[PASS] 16. New claim submission blocked when item has been claimed (400 Bad Request)")

    # -------------------------------------------------------------
    # TEST SUITE 4: CANCELLED & REJECTED CLAIMS DO NOT BLOCK FUTURE CLAIMS
    # -------------------------------------------------------------
    # Bob reports found sunglasses F3
    f3_res = client.post("/api/found-items", json={
        "title": f"Ray-Ban Sunglasses {uid}",
        "category": "Accessories",
        "description": "Black classic wayfarer found at student center",
        "location": "Student Center",
        "found_date": "2026-10-18",
    }, headers=bob["headers"])
    f3_id = f3_res.json()["id"]

    # Charlie submits claim C3_1
    c3_1_res = client.post(f"/api/found-items/{f3_id}/claim", json={
        "verification_details": "Has gold hinges and small scratch on left lens.",
    }, headers=charlie["headers"])
    assert c3_1_res.status_code == 201
    c3_1_id = c3_1_res.json()["id"]

    # Charlie cancels claim C3_1
    cancel_res = client.post(f"/api/claims/{c3_1_id}/cancel", headers=charlie["headers"])
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Charlie can submit a new claim because the previous one was cancelled
    c3_2_res = client.post(f"/api/found-items/{f3_id}/claim", json={
        "verification_details": "Resubmitting with full model number RB2140.",
    }, headers=charlie["headers"])
    assert c3_2_res.status_code == 201
    c3_2_id = c3_2_res.json()["id"]
    print("[PASS] 17. Cancelled claim does not block eligible claimant from submitting new claim")

    # Finder Bob rejects Charlie's claim C3_2
    reject_res = client.put(f"/api/claims/{c3_2_id}/review", json={
        "action": "REJECT",
        "reviewer_notes": "Model number does not match item in possession.",
    }, headers=bob["headers"])
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # Item F3 is still AVAILABLE because claim was rejected
    f3_check = client.get(f"/api/found-items/{f3_id}", headers=bob["headers"])
    assert f3_check.json()["status"] in ("AVAILABLE", "ACTIVE")

    # Alice submits claim on F3 and is approved
    c3_alice = client.post(f"/api/found-items/{f3_id}/claim", json={
        "verification_details": "Tortoise frame with green lenses.",
    }, headers=alice["headers"])
    assert c3_alice.status_code == 201
    c3_alice_id = c3_alice.json()["id"]

    appr_alice3 = client.put(f"/api/claims/{c3_alice_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Frame and lens description correct.",
    }, headers=bob["headers"])
    assert appr_alice3.status_code == 200
    print("[PASS] 18. Rejected claim left item available and allowed subsequent claim approval")

    # -------------------------------------------------------------
    # TEST SUITE 5: DIRECT CLAIM COMPLETE RECOVERY LIFECYCLE
    # -------------------------------------------------------------
    # Bob reports a found Calculator F4
    f4_res = client.post("/api/found-items", json={
        "title": f"TI-84 Plus CE Calculator {uid}",
        "category": "Electronics",
        "description": "Mint green TI-84 Plus CE calculator",
        "location": "Math Building Room 101",
        "found_date": "2026-10-18",
    }, headers=bob["headers"])
    f4_id = f4_res.json()["id"]

    # Charlie submits direct claim (no match, no lost item)
    c4_res = client.post(f"/api/found-items/{f4_id}/claim", json={
        "verification_details": "Has my initials CD engraved on battery compartment back.",
    }, headers=charlie["headers"])
    assert c4_res.status_code == 201
    c4_id = c4_res.json()["id"]

    # Bob approves direct claim
    appr_c4 = client.put(f"/api/claims/{c4_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Initials CD verified.",
    }, headers=bob["headers"])
    assert appr_c4.status_code == 200

    # Verify recovery auto-created for DIRECT CLAIM
    rec4_res = client.get(f"/api/claims/{c4_id}/recovery", headers=charlie["headers"])
    assert rec4_res.status_code == 200
    rec4 = rec4_res.json()
    assert rec4["match_id"] is None, "Direct claim recovery must have match_id = None"
    assert rec4["lost_item"] is None, "Direct claim recovery must have lost_item = None"
    assert rec4["found_item"] is not None
    assert rec4["status"] == "RETURN_PENDING"
    rec4_id = rec4["id"]
    print(f"[PASS] 19. Direct claim Recovery #{rec4_id} created with match_id=None, lost_item=None, status=RETURN_PENDING")

    # Conversation created and coordination message sent for direct claim
    conv_res = client.post(f"/api/claims/{c4_id}/conversation", headers=charlie["headers"])
    assert conv_res.status_code == 200
    conv_id = conv_res.json()["id"]
    msg_res = client.post(f"/api/conversations/{conv_id}/messages", json={
        "content": "Thanks Bob! Let's meet tomorrow at 10am.",
    }, headers=charlie["headers"])
    assert msg_res.status_code == 201
    print(f"[PASS] 20. Direct claim conversation coordination verified (Conv ID: {conv_id})")

    # Finder Bob marks returned
    ret_c4 = client.post(f"/api/recoveries/{rec4_id}/returned", json={
        "return_location": "Math Building Front Desk",
        "return_notes": "Left with secretary.",
    }, headers=bob["headers"])
    assert ret_c4.status_code == 200
    assert ret_c4.json()["status"] == "RETURNED"

    # Claimant Charlie confirms recovery
    conf_c4 = client.post(f"/api/recoveries/{rec4_id}/confirm", headers=charlie["headers"])
    assert conf_c4.status_code == 200
    assert conf_c4.json()["status"] == "RECOVERED"
    print("[PASS] 21. Direct claim completed full recovery lifecycle (RETURN_PENDING -> RETURNED -> RECOVERED)")

    # Charlie views history and sees the recovered direct item
    hist_c = client.get("/api/history", headers=charlie["headers"])
    assert hist_c.status_code == 200
    hist_items = hist_c.json()["items"]
    assert any(h["recovery_id"] == rec4_id for h in hist_items)
    hist_entry = next(h for h in hist_items if h["recovery_id"] == rec4_id)
    assert hist_entry["status"] == "RECOVERED"
    assert hist_entry["user_role"] == "claimant"
    print("[PASS] 22. Direct claim recovery correctly presented in Claimant's User History")

    print("\n" + "=" * 65)
    print("   ALL 22 COMPETING CLAIMS & RECOVERY LIFECYCLE TESTS PASSED!   ")
    print("=" * 65)

if __name__ == "__main__":
    init_db()
    run_tests()
