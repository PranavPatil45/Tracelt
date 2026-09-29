import io
import os
import sys
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app

client = TestClient(app)


def run_tests():
    print("=========================================")
    print("  TRACELT FOUND ITEMS API VERIFICATION   ")
    print("=========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] 1. GET /api/health -> 200 OK")

    # 2. Register / Login User A (Finder)
    user_a_email = "finder.alex@campus.edu"
    client.post(
        "/api/register",
        json={
            "full_name": "Alex Finder",
            "email": user_a_email,
            "password": "Password123!",
            "campus": "ABC University",
            "department": "Computer Science",
        },
    )
    res_a = client.post(
        "/api/login",
        json={
            "email": user_a_email,
            "password": "Password123!",
        },
    )
    assert res_a.status_code == 200, f"User A login failed: {res_a.text}"
    token_a = res_a.json()["access_token"]
    user_a_id = res_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("[PASS] 2. User A authenticated (Finder token obtained)")

    # 3. Register / Login User B (Different User)
    user_b_email = "charlie.other@campus.edu"
    client.post(
        "/api/register",
        json={
            "full_name": "Charlie Student",
            "email": user_b_email,
            "password": "Password123!",
            "campus": "ABC University",
            "department": "Physics",
        },
    )
    res_b = client.post(
        "/api/login",
        json={
            "email": user_b_email,
            "password": "Password123!",
        },
    )
    assert res_b.status_code == 200, f"User B login failed: {res_b.text}"
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print("[PASS] 3. User B authenticated (Other token obtained)")

    # 4. Upload image as User A
    fake_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    file_payload = {"file": ("found_keys.png", io.BytesIO(fake_png), "image/png")}
    res_upload = client.post("/api/upload-image", files=file_payload, headers=headers_a)
    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    assert "image_url" in upload_data
    uploaded_image_url = upload_data["image_url"]
    print(f"[PASS] 4. POST /api/upload-image -> 200 OK ({uploaded_image_url})")

    # 5. Validation rejection: future date
    bad_payload_future = {
        "title": "Set of Brass Keys",
        "category": "Keys",
        "description": "Found near the library stairs with a blue lanyard.",
        "location": "Library",
        "found_date": "2099-12-31",
    }
    res_future = client.post("/api/found-items", json=bad_payload_future, headers=headers_a)
    assert res_future.status_code == 422, f"Expected 422 for future date, got {res_future.status_code}"
    print("[PASS] 5. POST /api/found-items (future date rejected) -> 422 Unprocessable Entity")

    # 6. Validation rejection: short description
    bad_payload_desc = {
        "title": "Set of Brass Keys",
        "category": "Keys",
        "description": "Key",
        "location": "Library",
        "found_date": "2026-09-17",
    }
    res_short = client.post("/api/found-items", json=bad_payload_desc, headers=headers_a)
    assert res_short.status_code == 422, f"Expected 422 for short description, got {res_short.status_code}"
    print("[PASS] 6. POST /api/found-items (short description rejected) -> 422 Unprocessable Entity")

    # 7. Unauthenticated attempt rejected
    valid_payload = {
        "title": "Brass Keychain with Blue Lanyard",
        "category": "Keys",
        "description": "Set of 3 brass keys attached to a blue university lanyard, found under chair.",
        "location": "Library 1st Floor",
        "found_date": "2026-09-17",
        "found_time": "11:15",
        "image_url": uploaded_image_url,
    }
    res_no_auth = client.post("/api/found-items", json=valid_payload)
    assert res_no_auth.status_code == 401
    print("[PASS] 7. POST /api/found-items (unauthenticated rejected) -> 401 Unauthorized")

    # 8. User A creates valid found item
    res_create = client.post("/api/found-items", json=valid_payload, headers=headers_a)
    assert res_create.status_code == 201, f"Create found item failed: {res_create.text}"
    created_item = res_create.json()
    assert created_item["title"] == valid_payload["title"]
    assert created_item["user_id"] == user_a_id, "user_id must strictly match authenticated user"
    assert created_item["campus"] == "ABC University", "campus must match user's campus"
    assert created_item["status"] == "AVAILABLE", "initial status must be AVAILABLE"
    assert created_item["image_url"] == uploaded_image_url
    item_id = created_item["id"]
    print(f"[PASS] 8. POST /api/found-items -> 201 Created (ID: {item_id}, status: {created_item['status']})")

    # 9. Get single found item by ID
    res_get = client.get(f"/api/found-items/{item_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == item_id
    assert res_get.json()["status"] == "AVAILABLE"
    print(f"[PASS] 9. GET /api/found-items/{item_id} -> 200 OK")

    # 10. List public found items with search & filter
    res_list = client.get("/api/found-items?category=Keys")
    assert res_list.status_code == 200
    items_list = res_list.json()
    assert any(it["id"] == item_id for it in items_list)

    res_search = client.get("/api/found-items?search=lanyard")
    assert res_search.status_code == 200
    assert any(it["id"] == item_id for it in res_search.json())
    print("[PASS] 10. GET /api/found-items (with filter & search) -> 200 OK")

    # 11. User A retrieves their own found items
    res_my_a = client.get("/api/users/me/found-items", headers=headers_a)
    assert res_my_a.status_code == 200
    my_items_a = res_my_a.json()
    assert any(it["id"] == item_id for it in my_items_a)
    print(f"[PASS] 11. GET /api/users/me/found-items (User A has item {item_id}) -> 200 OK")

    # 12. User B retrieves their own found items (should NOT include User A's item)
    res_my_b = client.get("/api/users/me/found-items", headers=headers_b)
    assert res_my_b.status_code == 200
    my_items_b = res_my_b.json()
    assert not any(it["id"] == item_id for it in my_items_b)
    print(f"[PASS] 12. GET /api/users/me/found-items (User B isolated from User A) -> 200 OK")

    # 13. Authorization: User B cannot modify User A's item -> 403 Forbidden
    res_bad_update = client.put(
        f"/api/found-items/{item_id}",
        json={"title": "Hacked Title"},
        headers=headers_b,
    )
    assert res_bad_update.status_code == 403, f"Expected 403, got {res_bad_update.status_code}"
    print("[PASS] 13. PUT /api/found-items/{id} (Non-owner User B denied) -> 403 Forbidden")

    # 14. Authorization: User B cannot delete User A's item -> 403 Forbidden
    res_bad_delete = client.delete(f"/api/found-items/{item_id}", headers=headers_b)
    assert res_bad_delete.status_code == 403, f"Expected 403, got {res_bad_delete.status_code}"
    print("[PASS] 14. DELETE /api/found-items/{id} (Non-owner User B denied) -> 403 Forbidden")

    # 15. Owner update: User A updates status to CLAIMED
    update_payload = {
        "status": "CLAIMED",
        "description": "Returned to owner after verification.",
    }
    res_update = client.put(f"/api/found-items/{item_id}", json=update_payload, headers=headers_a)
    assert res_update.status_code == 200
    assert res_update.json()["status"] == "CLAIMED"
    assert res_update.json()["description"] == update_payload["description"]
    print("[PASS] 15. PUT /api/found-items/{id} (Owner User A updated to CLAIMED) -> 200 OK")

    # 16. Owner delete: User A deletes their own item
    res_delete = client.delete(f"/api/found-items/{item_id}", headers=headers_a)
    assert res_delete.status_code == 200
    print("[PASS] 16. DELETE /api/found-items/{id} (Owner User A deleted) -> 200 OK")

    # 17. Verify item is deleted -> 404
    res_verify_del = client.get(f"/api/found-items/{item_id}")
    assert res_verify_del.status_code == 404
    print("[PASS] 17. GET /api/found-items/{id} after deletion -> 404 Not Found")

    print("=========================================")
    print("  ALL 17 FOUND ITEM API CHECKS PASSED!   ")
    print("=========================================")


if __name__ == "__main__":
    run_tests()
