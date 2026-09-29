import sys
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

client = TestClient(app)

def run_tests():
    print("==========================================")
    print("   TRACELT NOTIFICATIONS SYSTEM TESTS     ")
    print("==========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] 1. API Health Check -> 200 OK")

    # 2. Register test users
    suffix = uuid.uuid4().hex[:6]
    test_campus = f"Campus_{suffix}"
    # User Alice (Lost Item Owner / Claimant)
    alice_email = f"alice_notif_{suffix}@campus.edu"
    res = client.post(
        "/api/register",
        json={
            "email": alice_email,
            "password": "Password123!",
            "full_name": "Alice Claimant",
            "campus": test_campus,
            "department": "Computer Science",
        },
    )
    assert res.status_code == 201, f"Alice registration failed: {res.text}"
    alice_token = res.json()["access_token"]
    alice_id = res.json()["user"]["id"]
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    # User Bob (Finder)
    bob_email = f"bob_notif_{suffix}@campus.edu"
    res = client.post(
        "/api/register",
        json={
            "email": bob_email,
            "password": "Password123!",
            "full_name": "Bob Finder",
            "campus": test_campus,
            "department": "Mechanical Engineering",
        },
    )
    assert res.status_code == 201, f"Bob registration failed: {res.text}"
    bob_token = res.json()["access_token"]
    bob_id = res.json()["user"]["id"]
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # User Charlie (Intruder)
    charlie_email = f"charlie_notif_{suffix}@campus.edu"
    res = client.post(
        "/api/register",
        json={
            "email": charlie_email,
            "password": "Password123!",
            "full_name": "Charlie Intruder",
            "campus": "Other Campus",
        },
    )
    assert res.status_code == 201
    charlie_token = res.json()["access_token"]
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}
    print("[PASS] 2. Test users registered (Alice, Bob, Charlie)")

    # 3. Initially, users have 0 notifications
    res = client.get("/api/notifications/unread-count", headers=alice_headers)
    assert res.status_code == 200
    assert res.json()["count"] == 0
    print("[PASS] 3. Initial unread count is 0")

    # 4. Alice reports Lost Item: "Black Leather Wallet"
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    res = client.post(
        "/api/lost-items",
        headers=alice_headers,
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Main Library Floor 2",
            "lost_date": today_str,
            "lost_time": "14:00",
            "description": "Black leather wallet with ID and cards inside.",
        },
    )
    assert res.status_code == 201, f"Lost item failed: {res.text}"
    lost_item = res.json()

    # 5. Bob reports matching Found Item: "Black Leather Wallet"
    res = client.post(
        "/api/found-items",
        headers=bob_headers,
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "location": "Main Library Floor 2",
            "found_date": today_str,
            "found_time": "14:30",
            "description": "Found black leather wallet with cards on table.",
        },
    )
    assert res.status_code == 201, f"Found item failed: {res.text}"
    found_item = res.json()

    # 6. Check that Alice received MATCH_FOUND notification
    res = client.get("/api/notifications", headers=alice_headers)
    assert res.status_code == 200, f"Get notifications failed: {res.text}"
    data = res.json()
    assert data["total"] >= 1, f"Expected at least 1 notification, got {data['total']}"
    match_notif = next((n for n in data["notifications"] if n["type"] == "MATCH_FOUND"), None)
    assert match_notif is not None, "Alice did not receive MATCH_FOUND notification"
    assert "Black Leather Wallet" in match_notif["message"]
    assert match_notif["is_read"] is False
    assert match_notif["related_entity_type"] == "match"
    print(f"[PASS] 4. MATCH_FOUND notification created for Lost Item owner (Alice) -> {match_notif['title']}")

    # Check that Bob (finder) did NOT receive MATCH_FOUND (only lost item owner is notified of possible matches to claim)
    res = client.get("/api/notifications", headers=bob_headers)
    assert res.status_code == 200
    bob_notifs = res.json()
    assert bob_notifs["total"] == 0, f"Bob should have 0 notifications, got {bob_notifs['total']}"
    print("[PASS] 5. Finder Bob not spammed with duplicate/unneeded match alert")

    # 7. Deduplication test: Re-trigger matching scan
    res = client.post("/api/matches/scan", headers=alice_headers)
    assert res.status_code == 200
    res = client.get("/api/notifications", headers=alice_headers)
    alice_matches_notifs = [n for n in res.json()["notifications"] if n["type"] == "MATCH_FOUND"]
    assert len(alice_matches_notifs) == 1, f"Duplicate notification created! Expected 1, found {len(alice_matches_notifs)}"
    print("[PASS] 6. Deduplication verified: Re-scan did not create duplicate MATCH_FOUND notification")

    # 8. Unread count check for Alice
    res = client.get("/api/notifications/unread-count", headers=alice_headers)
    assert res.status_code == 200
    assert res.json()["count"] >= 1
    print(f"[PASS] 7. GET /api/notifications/unread-count returns {res.json()['count']}")

    # 9. Mark single notification as read
    notif_id = match_notif["id"]
    res = client.patch(f"/api/notifications/{notif_id}/read", headers=alice_headers)
    assert res.status_code == 200
    updated_notif = res.json()
    assert updated_notif["is_read"] is True
    assert updated_notif["read_at"] is not None
    print("[PASS] 8. PATCH /api/notifications/{id}/read correctly updated is_read and read_at")

    # 10. Intruder Charlie attempts to mark Alice's notification as read -> 403 Forbidden
    res = client.patch(f"/api/notifications/{notif_id}/read", headers=charlie_headers)
    assert res.status_code == 403, f"Expected 403 for unauthorized patch, got {res.status_code}"
    print("[PASS] 9. Intruder Charlie blocked from modifying Alice's notification (403 Forbidden)")

    # 11. Alice submits an ownership claim
    match_id = match_notif["related_entity_id"]
    res = client.post(
        f"/api/matches/{match_id}/claim",
        headers=alice_headers,
        json={
            "verification_details": "My student ID #4492 is in the inner right slot and lock screen has a dog.",
            "additional_message": "Can meet at the library foyer.",
        },
    )
    assert res.status_code == 201, f"Claim submission failed: {res.text}"
    claim = res.json()

    # 12. Finder Bob should receive CLAIM_SUBMITTED notification
    res = client.get("/api/notifications", headers=bob_headers)
    assert res.status_code == 200
    bob_data = res.json()
    assert bob_data["total"] == 1
    claim_sub_notif = bob_data["notifications"][0]
    assert claim_sub_notif["type"] == "CLAIM_SUBMITTED"
    assert claim_sub_notif["related_entity_type"] == "claim"
    assert claim_sub_notif["related_entity_id"] == claim["id"]
    print(f"[PASS] 10. CLAIM_SUBMITTED notification created for Finder Bob -> {claim_sub_notif['title']}")

    # 13. Bob reviews and APPROVES claim
    res = client.put(
        f"/api/claims/{claim['id']}/review",
        headers=bob_headers,
        json={
            "action": "APPROVE",
            "reviewer_notes": "All identification verified accurately.",
        },
    )
    assert res.status_code == 200, f"Review failed: {res.text}"

    # 14. Alice should receive CLAIM_APPROVED notification
    res = client.get("/api/notifications", headers=alice_headers)
    assert res.status_code == 200
    alice_claims_approved = [n for n in res.json()["notifications"] if n["type"] == "CLAIM_APPROVED"]
    assert len(alice_claims_approved) == 1, "Alice did not receive CLAIM_APPROVED notification"
    assert "approved" in alice_claims_approved[0]["message"].lower()
    print(f"[PASS] 11. CLAIM_APPROVED notification created for Claimant Alice -> {alice_claims_approved[0]['title']}")

    # 15. Test CLAIM_CANCELLED: create another pair and cancel claim
    # Alice reports second lost item
    res = client.post(
        "/api/lost-items",
        headers=alice_headers,
        json={
            "title": "Blue Umbrella",
            "category": "Other",
            "location": "Cafeteria",
            "lost_date": today_str,
            "description": "Blue folding umbrella with wooden handle.",
        },
    )
    lost2 = res.json()
    # Bob reports matching found item
    res = client.post(
        "/api/found-items",
        headers=bob_headers,
        json={
            "title": "Blue Umbrella",
            "category": "Other",
            "location": "Cafeteria",
            "found_date": today_str,
            "description": "Blue folding umbrella found on chair.",
        },
    )
    found2 = res.json()

    # Find the match
    res = client.get(f"/api/lost-items/{lost2['id']}/matches", headers=alice_headers)
    assert res.status_code == 200
    matches2 = res.json()
    assert len(matches2) >= 1
    match2_id = matches2[0]["id"]

    # Alice submits claim on match2
    res = client.post(
        f"/api/matches/{match2_id}/claim",
        headers=alice_headers,
        json={"verification_details": "It has my name tag under the strap."},
    )
    assert res.status_code == 201
    claim2 = res.json()

    # Alice cancels claim2
    res = client.post(f"/api/claims/{claim2['id']}/cancel", headers=alice_headers)
    assert res.status_code == 200

    # Bob should receive CLAIM_CANCELLED notification
    res = client.get("/api/notifications?filter=claims", headers=bob_headers)
    assert res.status_code == 200
    bob_cancelled = [n for n in res.json()["notifications"] if n["type"] == "CLAIM_CANCELLED"]
    assert len(bob_cancelled) == 1, "Finder Bob did not receive CLAIM_CANCELLED notification"
    print(f"[PASS] 12. CLAIM_CANCELLED notification created for Finder Bob -> {bob_cancelled[0]['title']}")

    # 16. Test CLAIM_REJECTED: create third pair and reject claim
    res = client.post(
        "/api/lost-items",
        headers=alice_headers,
        json={
            "title": "Water Bottle",
            "category": "Other",
            "location": "Gym",
            "lost_date": today_str,
            "description": "Red hydro flask bottle.",
        },
    )
    lost3 = res.json()
    res = client.post(
        "/api/found-items",
        headers=bob_headers,
        json={
            "title": "Water Bottle",
            "category": "Other",
            "location": "Gym",
            "found_date": today_str,
            "description": "Red bottle found near lockers.",
        },
    )
    found3 = res.json()
    res = client.get(f"/api/lost-items/{lost3['id']}/matches", headers=alice_headers)
    match3_id = res.json()[0]["id"]

    res = client.post(
        f"/api/matches/{match3_id}/claim",
        headers=alice_headers,
        json={"verification_details": "Sticker of a cat on the back."},
    )
    claim3 = res.json()

    # Bob REJECTS claim3
    res = client.put(
        f"/api/claims/{claim3['id']}/review",
        headers=bob_headers,
        json={
            "action": "REJECT",
            "reviewer_notes": "The bottle has a dog sticker, not a cat.",
        },
    )
    assert res.status_code == 200

    # Alice should receive CLAIM_REJECTED notification with notes
    res = client.get("/api/notifications?filter=claims", headers=alice_headers)
    assert res.status_code == 200
    alice_rejected = [n for n in res.json()["notifications"] if n["type"] == "CLAIM_REJECTED"]
    assert len(alice_rejected) == 1, "Alice did not receive CLAIM_REJECTED notification"
    assert "dog sticker" in alice_rejected[0]["message"]
    print(f"[PASS] 13. CLAIM_REJECTED notification created with reviewer notes -> {alice_rejected[0]['message']}")

    # 17. Test ITEM_RECOVERED notification: Manual status update
    res = client.post(
        "/api/lost-items",
        headers=alice_headers,
        json={
            "title": "Notebook",
            "category": "Books",
            "location": "Hall A",
            "lost_date": today_str,
            "description": "Blue ruled notebook.",
        },
    )
    notebook = res.json()
    # Update to RECOVERED
    res = client.put(
        f"/api/lost-items/{notebook['id']}",
        headers=alice_headers,
        json={
            "title": "Notebook",
            "category": "Books",
            "location": "Hall A",
            "description": "Blue ruled notebook.",
            "status": "RECOVERED",
        },
    )
    assert res.status_code == 200
    # Check Alice received ITEM_RECOVERED
    res = client.get("/api/notifications?filter=recoveries", headers=alice_headers)
    assert res.status_code == 200
    recovered_notifs = res.json()["notifications"]
    assert len(recovered_notifs) >= 1
    assert recovered_notifs[0]["type"] == "ITEM_RECOVERED"
    print(f"[PASS] 14. ITEM_RECOVERED notification created on manual recovery -> {recovered_notifs[0]['title']}")

    # 18. Test Mark All as Read
    res = client.patch("/api/notifications/read-all", headers=alice_headers)
    assert res.status_code == 200
    updated_count = res.json()["updated"]
    assert updated_count > 0, f"Expected updated > 0, got {updated_count}"

    # Verify unread count is now 0
    res = client.get("/api/notifications/unread-count", headers=alice_headers)
    assert res.status_code == 200
    assert res.json()["count"] == 0, f"Expected unread 0 after read-all, got {res.json()['count']}"
    print(f"[PASS] 15. PATCH /api/notifications/read-all marked {updated_count} notifications as read (Unread count -> 0)")

    # 19. User Isolation: Charlie cannot see Alice or Bob's notifications
    res = client.get("/api/notifications", headers=charlie_headers)
    assert res.status_code == 200
    assert res.json()["total"] == 0
    print("[PASS] 16. User Isolation verified: Charlie sees 0 notifications")

    # 20. Pagination testing
    res = client.get("/api/notifications?page=1&limit=2", headers=alice_headers)
    assert res.status_code == 200
    paged = res.json()
    assert len(paged["notifications"]) == 2
    assert paged["page"] == 1
    assert paged["limit"] == 2
    print(f"[PASS] 17. Pagination works accurately (page=1, limit=2 returned 2 of {paged['total']} notifications)")

    print("==========================================")
    print("   ALL 17 NOTIFICATION CHECKS PASSED!     ")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
