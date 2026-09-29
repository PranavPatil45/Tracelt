import sys
import uuid
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("RUNNING TRACELT RECOVERY & HISTORY SYSTEM VERIFICATION")
    print("=" * 60)

    uid = uuid.uuid4().hex[:6]
    email_a = f"alice_rec_{uid}@test.edu"
    email_b = f"bob_rec_{uid}@test.edu"
    email_c = f"charlie_rec_{uid}@test.edu"
    pwd = "Password123!"

    # 1. Register Users
    reg_a = client.post("/api/register", json={
        "email": email_a,
        "full_name": f"Alice Recoverer {uid}",
        "password": pwd,
        "role": "student",
        "campus": "Tech Campus"
    })
    assert reg_a.status_code == 201, f"Failed Alice registration: {reg_a.text}"
    token_a = reg_a.json()["access_token"]
    user_a = reg_a.json()["user"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    reg_b = client.post("/api/register", json={
        "email": email_b,
        "full_name": f"Bob Finder {uid}",
        "password": pwd,
        "role": "staff",
        "campus": "Tech Campus"
    })
    assert reg_b.status_code == 201, f"Failed Bob registration: {reg_b.text}"
    token_b = reg_b.json()["access_token"]
    user_b = reg_b.json()["user"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    reg_c = client.post("/api/register", json={
        "email": email_c,
        "full_name": f"Charlie Intruder {uid}",
        "password": pwd,
        "role": "student",
        "campus": "Tech Campus"
    })
    assert reg_c.status_code == 201, f"Failed Charlie registration: {reg_c.text}"
    token_c = reg_c.json()["access_token"]
    headers_c = {"Authorization": f"Bearer {token_c}"}

    print("[PASS] 1. Users registered successfully (Alice, Bob, Charlie)")

    # 2. Report Lost Item by Alice
    lost_res = client.post("/api/lost-items", json={
        "title": f"Brown Leather Backpack {uid}",
        "category": "Bags",
        "campus": "Tech Campus",
        "location": "Main Library 2nd Floor",
        "lost_date": "2026-09-15",
        "lost_time": "14:00",
        "description": "Brown leather backpack with laptop sleeve and water bottle pocket."
    }, headers=headers_a)
    assert lost_res.status_code == 201, f"Failed reporting lost item: {lost_res.text}"
    lost_item = lost_res.json()
    lost_id = lost_item["id"]

    # 3. Report Found Item by Bob
    found_res = client.post("/api/found-items", json={
        "title": f"Brown Backpack {uid}",
        "category": "Bags",
        "campus": "Tech Campus",
        "location": "Main Library Study Room",
        "found_date": "2026-09-15",
        "found_time": "15:30",
        "description": "Found brown leather backpack near table 4.",
        "storage_location": "Library Help Desk"
    }, headers=headers_b)
    assert found_res.status_code == 201, f"Failed reporting found item: {found_res.text}"
    found_item = found_res.json()
    found_id = found_item["id"]

    print("[PASS] 2. Lost item and Found item reported successfully")

    # 4. Fetch the Match record (generated automatically when found item is reported)
    match_res = client.get("/api/matches", headers=headers_a)
    assert match_res.status_code == 200, f"Failed getting matches: {match_res.text}"
    matches = match_res.json()["matches"]
    assert len(matches) > 0, "Expected at least 1 match"
    match = next((m for m in matches if m["lost_item_id"] == lost_id or (m.get("lost_item") and m["lost_item"]["id"] == lost_id)), matches[0])
    match_id = match["id"]
    print(f"[PASS] 3. Match generated (Match ID: {match_id}, Score: {match['score']}%)")

    # 5. Alice Submits Claim
    claim_res = client.post(f"/api/matches/{match_id}/claim", json={
        "verification_details": "The bag has a silver keychain attached to the front zipper and a red notebook inside."
    }, headers=headers_a)
    assert claim_res.status_code == 201, f"Failed claim creation: {claim_res.text}"
    claim = claim_res.json()
    claim_id = claim["id"]
    print(f"[PASS] 4. Alice submitted claim (Claim ID: {claim_id})")

    # 6. Bob Approves Claim -> Triggers Auto Recovery Creation
    approve_res = client.put(f"/api/claims/{claim_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Keychain and red notebook confirmed! Ready for return."
    }, headers=headers_b)
    assert approve_res.status_code == 200, f"Failed claim approval: {approve_res.text}"
    print("[PASS] 5. Bob approved claim")

    # 6b. Initiate conversation between Alice and Bob
    conv_init = client.post(f"/api/claims/{claim_id}/conversation", headers=headers_a)
    assert conv_init.status_code == 200
    conv_id = conv_init.json()["id"]
    # Send coordination message
    msg_res = client.post(f"/api/conversations/{conv_id}/messages", json={
        "content": "Hi Bob! Where can we meet to hand over the backpack?"
    }, headers=headers_a)
    assert msg_res.status_code == 201
    print(f"[PASS] 5b. Conversation started (Conv ID: {conv_id}) and message sent")

    # 7. Verify Recovery Auto-Created with status RETURN_PENDING
    rec_lookup = client.get(f"/api/claims/{claim_id}/recovery", headers=headers_a)
    assert rec_lookup.status_code == 200, f"Recovery lookup by claim failed: {rec_lookup.text}"
    rec_data = rec_lookup.json()
    recovery_id = rec_data["id"]
    assert rec_data["status"] == "RETURN_PENDING"
    assert rec_data["claimant"]["id"] == user_a["id"]
    assert rec_data["finder"]["id"] == user_b["id"]
    assert rec_data["can_mark_returned"] is False  # Alice cannot mark returned
    assert rec_data["can_confirm_recovery"] is False  # Cannot confirm until returned
    print(f"[PASS] 6. Recovery record created automatically (Recovery ID: {recovery_id}, Status: RETURN_PENDING)")

    # 8. Check Finder Permissions on GET /recoveries/{id}
    rec_finder = client.get(f"/api/recoveries/{recovery_id}", headers=headers_b)
    assert rec_finder.status_code == 200
    assert rec_finder.json()["can_mark_returned"] is True
    assert rec_finder.json()["can_confirm_recovery"] is False
    print("[PASS] 7. Finder permissions correctly evaluated (can_mark_returned = True)")

    # 9. Intruder Charlie blocked from viewing recovery
    rec_charlie = client.get(f"/api/recoveries/{recovery_id}", headers=headers_c)
    assert rec_charlie.status_code == 403, "Charlie should be blocked with 403"
    print("[PASS] 8. Intruder Charlie blocked with 403 Forbidden")

    # 10. Validation & Unauthorized Action Checks
    # a. Alice tries to confirm receipt before it is marked returned -> 400 Bad Request
    fail_confirm = client.post(f"/api/recoveries/{recovery_id}/confirm", headers=headers_a)
    assert fail_confirm.status_code in (400, 409), f"Premature confirm should return 400/409: {fail_confirm.text}"

    # b. Alice tries to mark returned -> 403 Forbidden (she is claimant)
    fail_mark_a = client.post(f"/api/recoveries/{recovery_id}/returned", json={
        "return_location": "Main Hall"
    }, headers=headers_a)
    assert fail_mark_a.status_code == 403, "Claimant cannot mark returned"

    # c. Charlie tries to mark returned -> 403 Forbidden
    fail_mark_c = client.post(f"/api/recoveries/{recovery_id}/returned", json={
        "return_location": "Main Hall"
    }, headers=headers_c)
    assert fail_mark_c.status_code == 403, "Intruder cannot mark returned"
    print("[PASS] 9. Role permissions & premature confirmation validations enforced")

    # 11. Bob (Finder) Marks Item Returned
    return_res = client.post(f"/api/recoveries/{recovery_id}/returned", json={
        "return_location": "Library Security Desk, 1st Floor",
        "return_notes": "Handed package to student security lead Dave."
    }, headers=headers_b)
    assert return_res.status_code == 200, f"Failed marking returned: {return_res.text}"
    returned_data = return_res.json()
    assert returned_data["status"] == "RETURNED"
    assert returned_data["return_location"] == "Library Security Desk, 1st Floor"
    assert returned_data["returned_at"] is not None
    print("[PASS] 10. Finder Bob marked item RETURNED with location & notes")

    # 12. Verify ITEM_RETURNED notification received by Alice
    notif_res = client.get("/api/notifications", headers=headers_a)
    assert notif_res.status_code == 200
    notifs_a = notif_res.json()["notifications"]
    assert any(n["type"] == "ITEM_RETURNED" for n in notifs_a), "Alice must receive ITEM_RETURNED notification"
    print("[PASS] 11. Alice received ITEM_RETURNED notification")

    # 13. Duplicate return call returns 409 Conflict
    dup_return = client.post(f"/api/recoveries/{recovery_id}/returned", json={
        "return_location": "Another Location"
    }, headers=headers_b)
    assert dup_return.status_code == 409, "Duplicate mark returned must return 409 Conflict"
    print("[PASS] 12. Duplicate mark returned blocked (409 Conflict)")

    # 14. Bob tries to confirm receipt -> 403 Forbidden
    fail_confirm_b = client.post(f"/api/recoveries/{recovery_id}/confirm", headers=headers_b)
    assert fail_confirm_b.status_code == 403, "Finder cannot confirm recovery"

    # 15. Alice Confirms Receipt (Status becomes RECOVERED)
    confirm_res = client.post(f"/api/recoveries/{recovery_id}/confirm", headers=headers_a)
    assert confirm_res.status_code == 200, f"Failed confirm recovery: {confirm_res.text}"
    confirmed_data = confirm_res.json()
    assert confirmed_data["status"] == "RECOVERED"
    assert confirmed_data["confirmed_at"] is not None
    print("[PASS] 13. Claimant Alice confirmed receipt -> Status: RECOVERED")

    # 16. Verify Source Item Statuses
    check_lost = client.get(f"/api/lost-items/{lost_id}", headers=headers_a)
    assert check_lost.status_code == 200
    assert check_lost.json()["status"] == "RECOVERED", "LostItem must be RECOVERED"

    check_found = client.get(f"/api/found-items/{found_id}", headers=headers_b)
    assert check_found.status_code == 200
    assert check_found.json()["status"] == "RETURNED", "FoundItem must be RETURNED"
    print("[PASS] 14. Item statuses updated in database (LostItem=RECOVERED, FoundItem=RETURNED)")

    # 17. Duplicate confirmation returns 409 Conflict
    dup_confirm = client.post(f"/api/recoveries/{recovery_id}/confirm", headers=headers_a)
    assert dup_confirm.status_code == 409, "Duplicate confirmation must return 409 Conflict"
    print("[PASS] 15. Duplicate confirmation blocked (409 Conflict)")

    # 18. Verify ITEM_RECOVERED notification received by Bob
    notif_b_res = client.get("/api/notifications", headers=headers_b)
    assert notif_b_res.status_code == 200
    notifs_b = notif_b_res.json()["notifications"]
    assert any(n["type"] == "ITEM_RECOVERED" for n in notifs_b), "Bob must receive ITEM_RECOVERED notification"
    print("[PASS] 16. Bob received ITEM_RECOVERED notification")

    # 19. Verify Conversation closure & message blocking
    conv_id = confirmed_data.get("conversation_id")
    if conv_id:
        conv_res = client.get(f"/api/conversations/{conv_id}", headers=headers_a)
        assert conv_res.status_code == 200
        assert conv_res.json()["is_closed"] is True, "Conversation should be closed after recovery"
        # Try sending message in closed conversation
        send_fail = client.post(f"/api/conversations/{conv_id}/messages", json={
            "content": "Are you still there?"
        }, headers=headers_a)
        assert send_fail.status_code == 400, "Sending message to closed conversation must return 400"
        print("[PASS] 17. Messaging locked into read-only mode after recovery")

    # 20. Verify User History Endpoint
    hist_a = client.get("/api/history", headers=headers_a)
    assert hist_a.status_code == 200
    items_a = hist_a.json()["items"]
    assert any(h["recovery_id"] == recovery_id for h in items_a)
    my_item_a = next(h for h in items_a if h["recovery_id"] == recovery_id)
    assert my_item_a["user_role"] == "claimant"
    assert my_item_a["status"] == "RECOVERED"
    print(f"[PASS] 18. Alice history contains recovery record (Total: {hist_a.json()['total']})")

    hist_b = client.get("/api/history", headers=headers_b)
    assert hist_b.status_code == 200
    items_b = hist_b.json()["items"]
    assert any(h["recovery_id"] == recovery_id for h in items_b)
    my_item_b = next(h for h in items_b if h["recovery_id"] == recovery_id)
    assert my_item_b["user_role"] == "finder"
    print(f"[PASS] 19. Bob history contains recovery record (Total: {hist_b.json()['total']})")

    hist_c = client.get("/api/history", headers=headers_c)
    assert hist_c.status_code == 200
    assert hist_c.json()["total"] == 0, "Charlie should have 0 history records"
    print("[PASS] 20. Charlie history is empty (Strict user scoping)")

    # 21. Verify History Stats Endpoint
    stats_a = client.get("/api/history/stats", headers=headers_a)
    assert stats_a.status_code == 200
    sa = stats_a.json()
    assert sa["recovered_count"] >= 1
    print(f"[PASS] 21. Alice stats verified: {sa}")

    stats_b = client.get("/api/history/stats", headers=headers_b)
    assert stats_b.status_code == 200
    sb = stats_b.json()
    assert sb["returned_count"] >= 1
    print(f"[PASS] 22. Bob stats verified: {sb}")

    print("=" * 60)
    print("ALL 22 RECOVERY & HISTORY VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
