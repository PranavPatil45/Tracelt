import sys
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.found_item import FoundItem
from app.models.claim import Claim

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

client = TestClient(app)


def run_tests():
    print("==========================================")
    print("   TRACELT MESSAGING / CONTACT TESTS      ")
    print("==========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health failed: {res.text}"
    print("[PASS] 1. API Health Check -> 200 OK")

    # Unique test run identifier
    suffix = uuid.uuid4().hex[:8]
    campus = f"TestCampus_{suffix}"

    # 2. Register User A (Alice - Claimant), User B (Bob - Finder), User C (Charlie - Intruder)
    def register_user(name, email, password):
        r = client.post(
            "/api/register",
            json={
                "email": email,
                "password": password,
                "full_name": name,
                "campus": campus,
                "department": "Engineering",
            },
        )
        assert r.status_code == 201, f"Failed to register {name}: {r.text}"
        data = r.json()
        return data["access_token"], data["user"]

    alice_token, alice_user = register_user("Alice Claimant", f"alice_{suffix}@campus.edu", "Password123!")
    bob_token, bob_user = register_user("Bob Finder", f"bob_{suffix}@campus.edu", "Password123!")
    charlie_token, charlie_user = register_user("Charlie Intruder", f"charlie_{suffix}@campus.edu", "Password123!")
    print("[PASS] 2. Registered Alice (Claimant), Bob (Finder), Charlie (Intruder)")

    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # 3. Setup: Alice loses Black Leather Wallet, Bob finds Black Leather Wallet
    r_lost = client.post(
        "/api/lost-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "description": "Lost near Central Library second floor",
            "location": "Central Library",
            "campus": campus,
            "lost_date": "2026-09-18",
            "lost_time": "10:00",
        },
        headers=alice_headers,
    )
    assert r_lost.status_code == 201, f"Failed to create lost item: {r_lost.text}"
    lost_item = r_lost.json()

    r_found = client.post(
        "/api/found-items",
        json={
            "title": "Black Leather Wallet",
            "category": "Wallet",
            "description": "Found on 2nd floor desk near Central Library",
            "location": "Central Library",
            "campus": campus,
            "found_date": "2026-09-18",
            "found_time": "10:30",
        },
        headers=bob_headers,
    )
    assert r_found.status_code == 201, f"Failed to create found item: {r_found.text}"
    found_item = r_found.json()

    # Get the generated match
    r_matches = client.get("/api/matches", headers=alice_headers)
    assert r_matches.status_code == 200, f"Failed to list matches: {r_matches.text}"
    matches_data = r_matches.json()
    assert len(matches_data["matches"]) > 0, "No matches found"
    match_id = matches_data["matches"][0]["id"]
    print(f"[PASS] 3. Correlated Match #{match_id} (Score: {matches_data['matches'][0]['score']}%)")

    # 4. Alice submits claim for the match
    r_claim = client.post(
        f"/api/matches/{match_id}/claim",
        json={
            "verification_details": "My student ID and a faded metro card are inside the inner flap.",
            "additional_message": "Can we coordinate collection?",
        },
        headers=alice_headers,
    )
    assert r_claim.status_code == 201, f"Claim submission failed: {r_claim.text}"
    claim = r_claim.json()
    claim_id = claim["id"]
    print(f"[PASS] 4. Alice submitted Claim #{claim_id} (Status: {claim['status']})")

    # TEST 1 — Create Conversation
    # Alice initiates contact with Bob via POST /api/claims/{claim_id}/conversation
    r_conv1 = client.post(f"/api/claims/{claim_id}/conversation", headers=alice_headers)
    assert r_conv1.status_code == 200, f"Create conversation failed: {r_conv1.text}"
    conv1 = r_conv1.json()
    conv_id = conv1["id"]
    assert conv1["claim_id"] == claim_id
    assert conv1["other_participant"]["full_name"] == "Bob Finder"
    assert conv1["other_participant"]["role"] == "Finder"

    # Bob accesses the same conversation via POST /api/claims/{claim_id}/conversation
    r_conv2 = client.post(f"/api/claims/{claim_id}/conversation", headers=bob_headers)
    assert r_conv2.status_code == 200
    conv2 = r_conv2.json()
    assert conv2["id"] == conv_id, "Did not return existing conversation"
    assert conv2["other_participant"]["full_name"] == "Alice Claimant"
    assert conv2["other_participant"]["role"] == "Claimant"
    print(f"[PASS] Test 1: Conversation #{conv_id} created idempotently without duplicates")

    # TEST 2 — Send Message
    # User A (Alice) sends: "Hi, I think this wallet is mine."
    r_msg1 = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "Hi, I think this wallet is mine."},
        headers=alice_headers,
    )
    assert r_msg1.status_code == 201, f"Failed to send message: {r_msg1.text}"
    msg1 = r_msg1.json()
    assert msg1["sender_id"] == alice_user["id"]
    assert msg1["content"] == "Hi, I think this wallet is mine."
    assert msg1["is_current_user"] is True
    print(f"[PASS] Test 2: Alice sent message -> stored with sender_id = Alice (#{alice_user['id']})")

    # TEST 3 — Finder Reply
    # User B (Bob) sends: "Hello! Can you confirm where you lost it?"
    r_msg2 = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "Hello! Can you confirm where you lost it?"},
        headers=bob_headers,
    )
    assert r_msg2.status_code == 201, f"Failed to send reply: {r_msg2.text}"
    msg2 = r_msg2.json()
    assert msg2["sender_id"] == bob_user["id"]

    # Verify both see both messages
    r_alice_history = client.get(f"/api/conversations/{conv_id}/messages", headers=alice_headers)
    assert r_alice_history.status_code == 200
    alice_msgs = r_alice_history.json()["items"]
    assert len(alice_msgs) == 2
    assert alice_msgs[0]["content"] == "Hi, I think this wallet is mine."
    assert alice_msgs[1]["content"] == "Hello! Can you confirm where you lost it?"

    r_bob_history = client.get(f"/api/conversations/{conv_id}/messages", headers=bob_headers)
    assert r_bob_history.status_code == 200
    bob_msgs = r_bob_history.json()["items"]
    assert len(bob_msgs) == 2
    print("[PASS] Test 3: Bob replied -> Both participants observe complete message thread")

    # TEST 4 — Unauthorized User Access
    # Charlie attempts GET /api/conversations/{conv_id}
    r_unauth_get = client.get(f"/api/conversations/{conv_id}", headers=charlie_headers)
    assert r_unauth_get.status_code == 403, f"Expected 403, got {r_unauth_get.status_code}"
    print("[PASS] Test 4: Intruder Charlie blocked from viewing conversation (403 Forbidden)")

    # TEST 5 — Unauthorized Send
    # Charlie attempts POST /api/conversations/{conv_id}/messages
    r_unauth_send = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "I am snooping into your chat."},
        headers=charlie_headers,
    )
    assert r_unauth_send.status_code == 403, f"Expected 403, got {r_unauth_send.status_code}"
    print("[PASS] Test 5: Intruder Charlie blocked from sending message (403 Forbidden)")

    # TEST 6 — Empty Message Validation
    r_empty = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "       "},
        headers=alice_headers,
    )
    assert r_empty.status_code in (400, 422), f"Expected 400/422, got {r_empty.status_code}"
    print(f"[PASS] Test 6: Whitespace-only message rejected with {r_empty.status_code}")

    # TEST 7 — Message Length Validation
    long_text = "A" * 2001
    r_too_long = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": long_text},
        headers=alice_headers,
    )
    assert r_too_long.status_code in (400, 422), f"Expected 400/422, got {r_too_long.status_code}"
    print(f"[PASS] Test 7: Message > 2000 characters rejected with {r_too_long.status_code}")

    # TEST 8 — Unread Count & Mark Read
    # Alice sends 2 more messages so Bob has 3 incoming unread messages total
    client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "I lost it around 10 AM on 2nd floor."},
        headers=alice_headers,
    )
    client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "Can I collect it today?"},
        headers=alice_headers,
    )

    r_bob_unread = client.get("/api/messages/unread-count", headers=bob_headers)
    assert r_bob_unread.status_code == 200
    assert r_bob_unread.json()["count"] == 3, f"Expected 3 unread, got {r_bob_unread.json()['count']}"
    print(f"[PASS] Test 8a: Bob has {r_bob_unread.json()['count']} unread messages")

    # Bob marks conversation as read
    r_read = client.patch(f"/api/conversations/{conv_id}/read", headers=bob_headers)
    assert r_read.status_code == 200
    assert r_read.json()["marked_count"] == 3

    r_bob_unread_after = client.get("/api/messages/unread-count", headers=bob_headers)
    assert r_bob_unread_after.json()["count"] == 0, f"Expected 0, got {r_bob_unread_after.json()['count']}"
    print("[PASS] Test 8b: Marked as read -> Bob unread count reset to 0")

    # TEST 9 — Notifications Integration
    # Alice sends a new message to Bob
    r_msg_notify = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "Thank you for confirming!"},
        headers=alice_headers,
    )
    assert r_msg_notify.status_code == 201

    # Bob checks notifications
    r_bob_notifs = client.get("/api/notifications", headers=bob_headers)
    assert r_bob_notifs.status_code == 200
    bob_notifs = r_bob_notifs.json()["notifications"]
    msg_notifs = [n for n in bob_notifs if n["type"] == "MESSAGE_RECEIVED"]
    assert len(msg_notifs) > 0, "No MESSAGE_RECEIVED notification found for Bob"
    assert "Alice Claimant" in msg_notifs[0]["message"]
    assert msg_notifs[0]["metadata"]["conversation_id"] == conv_id

    # Alice checks notifications (ensure sender Alice was NOT notified for her own message)
    r_alice_notifs = client.get("/api/notifications", headers=alice_headers)
    assert r_alice_notifs.status_code == 200
    alice_self_notifs = [
        n for n in r_alice_notifs.json()["notifications"]
        if n["type"] == "MESSAGE_RECEIVED" and n["metadata"].get("sender_name") == "Alice Claimant"
    ]
    assert len(alice_self_notifs) == 0, "Sender Alice received self-notification!"
    print("[PASS] Test 9: MESSAGE_RECEIVED notification created for Bob; Alice not spammed")

    # TEST 10 — Recovered Item Rules
    # Mark found item as RECOVERED in database
    db = SessionLocal()
    try:
        db_found = db.query(FoundItem).filter(FoundItem.id == found_item["id"]).first()
        db_found.status = "RECOVERED"
        db.commit()
    finally:
        db.close()

    # Conversation remains readable
    r_rec_conv = client.get(f"/api/conversations/{conv_id}", headers=alice_headers)
    assert r_rec_conv.status_code == 200
    assert r_rec_conv.json()["is_closed"] is True
    assert "recovered" in r_rec_conv.json()["close_reason"].lower()

    # Sending new message must fail with 400
    r_rec_send = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={"content": "Are you still there?"},
        headers=alice_headers,
    )
    assert r_rec_send.status_code == 400, f"Expected 400 for recovered item, got {r_rec_send.status_code}"
    print(f"[PASS] Test 10: Recovered Item -> Conversation is read-only; new message rejected with 400")

    # TEST 11 — Rejected Claim Rules
    # Reset found item status to AVAILABLE and create a second test claim that gets REJECTED
    db = SessionLocal()
    try:
        db_found = db.query(FoundItem).filter(FoundItem.id == found_item["id"]).first()
        db_found.status = "AVAILABLE"
        db.commit()
    finally:
        db.close()

    # Setup a second pair with a claim that gets rejected
    r_lost2 = client.post(
        "/api/lost-items",
        json={
            "title": "AirPods Pro Case",
            "category": "Electronics",
            "location": "Gym",
            "campus": campus,
            "lost_date": "2026-09-18",
            "description": "White AirPods Pro charging case lost in locker room",
        },
        headers=alice_headers,
    )
    r_found2 = client.post(
        "/api/found-items",
        json={
            "title": "AirPods Pro Case",
            "category": "Electronics",
            "location": "Gym",
            "campus": campus,
            "found_date": "2026-09-18",
            "description": "Found white AirPods Pro case near lockers",
        },
        headers=bob_headers,
    )
    r_matches2 = client.get("/api/matches", headers=alice_headers)
    match2_id = [m["id"] for m in r_matches2.json()["matches"] if m["lost_item"]["title"] == "AirPods Pro Case"][0]

    r_claim2 = client.post(
        f"/api/matches/{match2_id}/claim",
        json={"verification_details": "There is a Pikachu sticker on the bottom."},
        headers=alice_headers,
    )
    claim2_id = r_claim2.json()["id"]

    # Open conversation
    r_conv_rej = client.post(f"/api/claims/{claim2_id}/conversation", headers=alice_headers)
    conv_rej_id = r_conv_rej.json()["id"]

    # Send an initial message
    client.post(
        f"/api/conversations/{conv_rej_id}/messages",
        json={"content": "Does it have the sticker?"},
        headers=alice_headers,
    )

    # Bob rejects the claim
    r_reject = client.put(
        f"/api/claims/{claim2_id}/review",
        json={"action": "REJECT", "reviewer_notes": "No sticker on this case."},
        headers=bob_headers,
    )
    assert r_reject.status_code == 200

    # Conversation remains readable
    r_conv_detail = client.get(f"/api/conversations/{conv_rej_id}", headers=alice_headers)
    assert r_conv_detail.status_code == 200
    assert r_conv_detail.json()["is_closed"] is True
    assert "rejected" in r_conv_detail.json()["close_reason"].lower()
    assert len(r_conv_detail.json()["messages"]) == 1

    # Sending new message must be blocked with 400
    r_rej_send = client.post(
        f"/api/conversations/{conv_rej_id}/messages",
        json={"content": "Wait, let me double check!"},
        headers=alice_headers,
    )
    assert r_rej_send.status_code == 400, f"Expected 400 for rejected claim, got {r_rej_send.status_code}"
    print("[PASS] Test 11: Rejected Claim -> Conversation history readable; new messages blocked with 400")

    # TEST 12 — User Isolation
    # Charlie calls GET /api/conversations
    r_charlie_convs = client.get("/api/conversations", headers=charlie_headers)
    assert r_charlie_convs.status_code == 200
    assert len(r_charlie_convs.json()["conversations"]) == 0, "Charlie saw unrelated conversations!"

    # Alice should see her conversations, Bob should see his
    r_alice_convs = client.get("/api/conversations", headers=alice_headers)
    assert r_alice_convs.status_code == 200
    assert len(r_alice_convs.json()["conversations"]) == 2
    print("[PASS] Test 12: User Isolation verified -> Charlie sees 0 conversations")

    print("==========================================")
    print("   ALL 12 MESSAGING CHECKS PASSED!        ")
    print("==========================================")


if __name__ == "__main__":
    run_tests()
