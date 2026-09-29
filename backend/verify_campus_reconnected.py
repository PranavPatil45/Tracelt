import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("VERIFYING CAMPUS ACTIVITY & USERS/ME/RECONNECTED")
    print("=" * 60)

    uid = uuid.uuid4().hex[:6]
    email_a = f"alice_act_{uid}@test.edu"
    email_b = f"bob_act_{uid}@test.edu"
    pwd = "Password123!"

    # 1. Register Alice and Bob
    reg_a = client.post("/api/register", json={
        "email": email_a,
        "full_name": f"Alice Campus {uid}",
        "password": pwd,
        "role": "student",
        "campus": "Tech Campus"
    })
    assert reg_a.status_code == 201, f"Failed Alice registration: {reg_a.text}"
    token_a = reg_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    reg_b = client.post("/api/register", json={
        "email": email_b,
        "full_name": f"Bob Campus {uid}",
        "password": pwd,
        "role": "staff",
        "campus": "Tech Campus"
    })
    assert reg_b.status_code == 201, f"Failed Bob registration: {reg_b.text}"
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    print("[PASS] 1. Users registered successfully")

    # 2. Test /api/users/me/reconnected returns empty array for new user (no 404!)
    rec_res_empty = client.get("/api/users/me/reconnected", headers=headers_a)
    assert rec_res_empty.status_code == 200, f"Expected 200 from /api/users/me/reconnected, got {rec_res_empty.status_code}: {rec_res_empty.text}"
    assert isinstance(rec_res_empty.json(), list), "Expected list response"
    assert len(rec_res_empty.json()) == 0, "Expected empty list for user with no recoveries"
    print("[PASS] 2. GET /api/users/me/reconnected returns empty list for new user")

    # 3. Test unauthenticated request returns 401
    unauth_rec = client.get("/api/users/me/reconnected")
    assert unauth_rec.status_code == 401, "Expected 401 Unauthorized without token"
    print("[PASS] 3. GET /api/users/me/reconnected enforces authentication (401)")

    # 4. Report Lost Item by Alice and Found Item by Bob
    lost_res = client.post("/api/lost-items", json={
        "title": f"Blue Water Bottle {uid}",
        "category": "Bottles",
        "campus": "Tech Campus",
        "location": "Student Center Gym",
        "lost_date": "2026-09-18",
        "lost_time": "10:00",
        "description": "Insulated stainless steel blue water bottle."
    }, headers=headers_a)
    assert lost_res.status_code == 201
    lost_id = lost_res.json()["id"]

    found_res = client.post("/api/found-items", json={
        "title": f"Blue Water Bottle {uid}",
        "category": "Bottles",
        "campus": "Tech Campus",
        "location": "Student Center Gym",
        "found_date": "2026-09-18",
        "found_time": "10:30",
        "description": "Blue insulated bottle found on bench.",
        "storage_location": "Gym Front Desk"
    }, headers=headers_b)
    assert found_res.status_code == 201
    found_id = found_res.json()["id"]
    print("[PASS] 4. Lost and found items reported successfully")

    # 5. Test /api/campus/activity
    # a. Without campus parameter (uses user campus)
    act_res = client.get("/api/campus/activity", headers=headers_a)
    assert act_res.status_code == 200, f"Failed /api/campus/activity: {act_res.text}"
    activities = act_res.json()
    assert isinstance(activities, list)
    assert len(activities) >= 2, "Expected at least 2 activities"
    first_act = activities[0]
    assert "id" in first_act
    assert "icon" in first_act
    assert "title" in first_act
    assert "type" in first_act
    assert "location" in first_act
    assert "timeAgo" in first_act
    print(f"[PASS] 5. GET /api/campus/activity returns valid activity list (Count: {len(activities)})")

    # b. With explicit campus param matching user's campus
    act_campus_res = client.get("/api/campus/activity?campus=Tech%20Campus", headers=headers_a)
    assert act_campus_res.status_code == 200
    assert len(act_campus_res.json()) >= 2
    print("[PASS] 6. GET /api/campus/activity?campus=Tech%20Campus returns filtered items")

    # c. With non-existent campus param (e.g. ABC University) - must handle gracefully without 404!
    act_abc_res = client.get("/api/campus/activity?campus=ABC%20University", headers=headers_a)
    assert act_abc_res.status_code == 200, f"Expected 200 with fallback, got {act_abc_res.status_code}: {act_abc_res.text}"
    assert isinstance(act_abc_res.json(), list)
    print("[PASS] 7. GET /api/campus/activity?campus=ABC%20University handled gracefully (200 OK)")

    # d. Unauthenticated /api/campus/activity returns 401
    unauth_act = client.get("/api/campus/activity")
    assert unauth_act.status_code == 401
    print("[PASS] 8. GET /api/campus/activity enforces authentication (401)")

    # 6. Complete recovery flow to test populated /api/users/me/reconnected
    # a. Find match
    matches_res = client.get("/api/matches", headers=headers_a)
    assert matches_res.status_code == 200
    matches = matches_res.json()["matches"]
    match = next(m for m in matches if m["lost_item_id"] == lost_id or (m.get("lost_item") and m["lost_item"]["id"] == lost_id))
    match_id = match["id"]

    # b. Submit claim
    claim_res = client.post(f"/api/matches/{match_id}/claim", json={
        "verification_details": "The bottle has a small scratch on the cap and a gym sticker."
    }, headers=headers_a)
    assert claim_res.status_code == 201
    claim_id = claim_res.json()["id"]

    # c. Bob approves claim
    approve_res = client.put(f"/api/claims/{claim_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Sticker verified."
    }, headers=headers_b)
    assert approve_res.status_code == 200

    # d. Lookup recovery record
    rec_res = client.get(f"/api/claims/{claim_id}/recovery", headers=headers_a)
    assert rec_res.status_code == 200
    recovery_id = rec_res.json()["id"]

    # e. Bob marks returned
    ret_res = client.post(f"/api/recoveries/{recovery_id}/returned", json={
        "return_location": "Gym Reception",
        "return_notes": "Returned to Alice."
    }, headers=headers_b)
    assert ret_res.status_code == 200

    # f. Alice confirms recovery
    conf_res = client.post(f"/api/recoveries/{recovery_id}/confirm", headers=headers_a)
    assert conf_res.status_code == 200

    print("[PASS] 9. Recovery lifecycle completed (Status: RECOVERED)")

    # 7. Test /api/users/me/reconnected now returns the reconnected item for Alice and Bob
    alice_rec = client.get("/api/users/me/reconnected", headers=headers_a)
    assert alice_rec.status_code == 200
    alice_items = alice_rec.json()
    assert len(alice_items) >= 1
    item = alice_items[0]
    assert item["status"] in ("Recovered", "Returned")
    assert item["lostLocation"] is not None
    assert item["matchedLocation"] is not None
    assert item["founder"] is not None
    assert item["date"] is not None
    print(f"[PASS] 10. GET /api/users/me/reconnected returns Alice's recovered item: {item['title']}")

    bob_rec = client.get("/api/users/me/reconnected", headers=headers_b)
    assert bob_rec.status_code == 200
    bob_items = bob_rec.json()
    assert len(bob_items) >= 1
    print(f"[PASS] 11. GET /api/users/me/reconnected returns Bob's returned item: {bob_items[0]['title']}")

    print("=" * 60)
    print("ALL 11 CAMPUS ACTIVITY & RECONNECTED TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
