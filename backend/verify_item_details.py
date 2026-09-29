import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app

client = TestClient(app)


def run_tests():
    print("==========================================")
    print("  TRACELT ITEM DETAILS API VERIFICATION   ")
    print("==========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] 1. GET /api/health -> 200 OK")

    # 2. Register/Login User A (Owner)
    email_a = "detail.owner@campus.edu"
    client.post(
        "/api/register",
        json={
            "full_name": "Detail Owner",
            "email": email_a,
            "password": "Password123!",
            "campus": "ABC University",
            "department": "Mechanical Engineering",
        },
    )
    res_a = client.post("/api/login", json={"email": email_a, "password": "Password123!"})
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    user_a_id = res_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"[PASS] 2. User A (Owner ID: {user_a_id}) authenticated")

    # 3. Register/Login User B (Non-Owner)
    email_b = "detail.viewer@campus.edu"
    client.post(
        "/api/register",
        json={
            "full_name": "Detail Viewer",
            "email": email_b,
            "password": "Password123!",
            "campus": "ABC University",
            "department": "Civil Engineering",
        },
    )
    res_b = client.post("/api/login", json={"email": email_b, "password": "Password123!"})
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print("[PASS] 3. User B (Viewer) authenticated")

    # 4. User A creates LostItem
    res_lost = client.post(
        "/api/lost-items",
        json={
            "title": "Bose Noise Cancelling Headphones",
            "category": "Electronics",
            "description": "Black Bose 700 headphones left inside Study Room B with USB-C cable.",
            "location": "Library Study Room B",
            "lost_date": "2026-09-17",
            "lost_time": "15:45",
        },
        headers=headers_a,
    )
    assert res_lost.status_code == 201
    lost_item = res_lost.json()
    lost_id = lost_item["id"]
    print(f"[PASS] 4. User A created LostItem #{lost_id}")

    # 5. User A creates FoundItem
    res_found = client.post(
        "/api/found-items",
        json={
            "title": "Blue Spiral Notebook & Pen",
            "category": "Books",
            "description": "Found on cafeteria bench with organic chemistry notes inside.",
            "location": "Canteen",
            "found_date": "2026-09-16",
            "found_time": "13:00",
        },
        headers=headers_a,
    )
    assert res_found.status_code == 201
    found_item = res_found.json()
    found_id = found_item["id"]
    print(f"[PASS] 5. User A created FoundItem #{found_id}")

    # 6. Fetch single lost item via /api/lost-items/{id}
    res_get_lost = client.get(f"/api/lost-items/{lost_id}")
    assert res_get_lost.status_code == 200
    data_lost = res_get_lost.json()
    assert data_lost["id"] == lost_id
    assert data_lost["user_id"] == user_a_id
    assert data_lost["title"] == "Bose Noise Cancelling Headphones"
    assert "hashed_password" not in data_lost
    assert "email" not in data_lost
    print(f"[PASS] 6. GET /api/lost-items/{lost_id} returned complete data with privacy preserved")

    # 7. Fetch unified lost item via /api/items/lost/{id}
    res_get_unified_lost = client.get(f"/api/items/lost/{lost_id}", headers=headers_b)
    assert res_get_unified_lost.status_code == 200
    unified_lost = res_get_unified_lost.json()
    assert unified_lost["id"] == lost_id
    assert unified_lost["type"] == "LOST"
    assert unified_lost["date"] == "2026-09-17"
    assert unified_lost["time"] == "15:45"
    print(f"[PASS] 7. GET /api/items/lost/{lost_id} returned normalized ExploreItem")

    # 8. Fetch single found item via /api/found-items/{id}
    res_get_found = client.get(f"/api/found-items/{found_id}")
    assert res_get_found.status_code == 200
    data_found = res_get_found.json()
    assert data_found["id"] == found_id
    assert data_found["user_id"] == user_a_id
    assert data_found["status"] == "AVAILABLE"
    assert "hashed_password" not in data_found
    print(f"[PASS] 8. GET /api/found-items/{found_id} returned complete data")

    # 9. Fetch unified found item via /api/items/found/{id}
    res_get_unified_found = client.get(f"/api/items/found/{found_id}", headers=headers_b)
    assert res_get_unified_found.status_code == 200
    unified_found = res_get_unified_found.json()
    assert unified_found["id"] == found_id
    assert unified_found["type"] == "FOUND"
    assert unified_found["status"] == "AVAILABLE"
    print(f"[PASS] 9. GET /api/items/found/{found_id} returned normalized ExploreItem")

    # 10. Non-existent items return 404
    res_404_lost = client.get("/api/lost-items/999999")
    assert res_404_lost.status_code == 404
    res_404_found = client.get("/api/items/found/999999", headers=headers_a)
    assert res_404_found.status_code == 404
    print("[PASS] 10. Non-existent item IDs accurately return 404 Not Found")

    # 11. Invalid type parameter returns 400
    res_400 = client.get("/api/items/unknown_type/1", headers=headers_a)
    assert res_400.status_code == 400
    print("[PASS] 11. Invalid item type parameter accurately returns 400 Bad Request")

    # 12. Non-owner User B cannot edit User A's report -> 403 Forbidden
    res_unauth_edit = client.put(
        f"/api/lost-items/{lost_id}",
        json={"title": "Hacked Title"},
        headers=headers_b,
    )
    assert res_unauth_edit.status_code == 403
    print(f"[PASS] 12. Non-owner User B blocked from editing LostItem #{lost_id} (403 Forbidden)")

    # 13. Non-owner User B cannot delete User A's report -> 403 Forbidden
    res_unauth_del = client.delete(f"/api/found-items/{found_id}", headers=headers_b)
    assert res_unauth_del.status_code == 403
    print(f"[PASS] 13. Non-owner User B blocked from deleting FoundItem #{found_id} (403 Forbidden)")

    # 14. Owner User A can edit their report -> 200 OK
    res_auth_edit = client.put(
        f"/api/lost-items/{lost_id}",
        json={"description": "Updated: Black Bose 700 with case and audio cable."},
        headers=headers_a,
    )
    assert res_auth_edit.status_code == 200
    assert "audio cable" in res_auth_edit.json()["description"]
    print(f"[PASS] 14. Owner User A successfully edited report #{lost_id}")

    # 15. Owner User A can delete their report -> 200 OK
    res_auth_del = client.delete(f"/api/lost-items/{lost_id}", headers=headers_a)
    assert res_auth_del.status_code == 200
    res_verify_del = client.get(f"/api/lost-items/{lost_id}")
    assert res_verify_del.status_code == 404
    print(f"[PASS] 15. Owner User A successfully deleted report #{lost_id}")

    print("==========================================")
    print("  ALL 15 ITEM DETAILS CHECKS PASSED!      ")
    print("==========================================")


if __name__ == "__main__":
    run_tests()
