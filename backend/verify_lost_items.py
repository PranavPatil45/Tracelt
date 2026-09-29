import io
import os
import sys
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app

client = TestClient(app)

def run_tests():
    print("========================================")
    print("  TRACELT LOST ITEMS API VERIFICATION   ")
    print("========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] GET /api/health -> 200 OK")

    # 2. Register/Login User A
    user_a_email = "alex.lost@campus.edu"
    client.post("/api/register", json={
        "full_name": "Alex Reporter",
        "email": user_a_email,
        "password": "Password123!",
        "campus": "ABC University",
        "department": "Engineering"
    })
    res_a = client.post("/api/login", json={
        "email": user_a_email,
        "password": "Password123!"
    })
    assert res_a.status_code == 200, f"User A login failed: {res_a.text}"
    token_a = res_a.json()["access_token"]
    user_a_id = res_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("[PASS] User A authenticated (Bearer token obtained)")

    # 3. Register/Login User B
    user_b_email = "sarah.intruder@campus.edu"
    client.post("/api/register", json={
        "full_name": "Sarah Student",
        "email": user_b_email,
        "password": "Password123!",
        "campus": "ABC University",
        "department": "Science"
    })
    res_b = client.post("/api/login", json={
        "email": user_b_email,
        "password": "Password123!"
    })
    assert res_b.status_code == 200, f"User B login failed: {res_b.text}"
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print("[PASS] User B authenticated (Bearer token obtained)")

    # 4. Upload image as User A
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    file_payload = {"file": ("test_wallet.png", io.BytesIO(fake_png), "image/png")}
    res_upload = client.post("/api/upload-image", files=file_payload, headers=headers_a)
    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    assert "image_url" in upload_data
    uploaded_image_url = upload_data["image_url"]
    print(f"[PASS] POST /api/upload-image -> 200 OK (URL: {uploaded_image_url})")

    # 5. Test invalid image upload (bad extension / mime)
    bad_file = {"file": ("test.exe", io.BytesIO(b"binary"), "application/octet-stream")}
    res_bad = client.post("/api/upload-image", files=bad_file, headers=headers_a)
    assert res_bad.status_code == 400
    print("[PASS] POST /api/upload-image (invalid type rejected) -> 400 Bad Request")

    # 6. Test Report Lost Item validation (future date error)
    bad_item_payload = {
        "title": "Future Item",
        "category": "Electronics",
        "description": "Lost in the future",
        "location": "Library",
        "lost_date": "2099-01-01"
    }
    res_val = client.post("/api/lost-items", json=bad_item_payload, headers=headers_a)
    assert res_val.status_code == 422, f"Expected 422 for future date, got {res_val.status_code}"
    print("[PASS] POST /api/lost-items (future date rejected) -> 422 Unprocessable Entity")

    # 7. User A creates valid lost item
    valid_item_payload = {
        "title": "Black Leather Wallet",
        "category": "Wallet",
        "description": "Black leather bifold wallet with student card and red stripe.",
        "location": "Library 2nd Floor",
        "lost_date": "2026-09-17",
        "lost_time": "14:30",
        "image_url": uploaded_image_url
    }
    res_create = client.post("/api/lost-items", json=valid_item_payload, headers=headers_a)
    assert res_create.status_code == 201, f"Create lost item failed: {res_create.text}"
    created_item = res_create.json()
    item_id = created_item["id"]
    assert created_item["title"] == "Black Leather Wallet"
    assert created_item["user_id"] == user_a_id
    assert created_item["status"] == "ACTIVE"
    assert created_item["campus"] == "ABC University"
    print(f"[PASS] POST /api/lost-items -> 201 Created (ID: {item_id}, Owner: User A)")

    # 8. User A fetches their lost items
    res_my = client.get("/api/users/me/lost-items", headers=headers_a)
    assert res_my.status_code == 200
    my_items = res_my.json()
    assert any(i["id"] == item_id for i in my_items)
    print(f"[PASS] GET /api/users/me/lost-items -> 200 OK ({len(my_items)} items for User A)")

    # 9. Public / Filtered list
    res_list = client.get("/api/lost-items?category=Wallet")
    assert res_list.status_code == 200
    assert any(i["id"] == item_id for i in res_list.json())
    print("[PASS] GET /api/lost-items?category=Wallet -> 200 OK")

    # 10. Single item lookup
    res_single = client.get(f"/api/lost-items/{item_id}")
    assert res_single.status_code == 200
    assert res_single.json()["title"] == "Black Leather Wallet"
    print(f"[PASS] GET /api/lost-items/{item_id} -> 200 OK")

    # 11. Authorization: User B cannot edit User A's item
    res_hack_edit = client.put(
        f"/api/lost-items/{item_id}",
        json={"title": "Hacked Wallet Title"},
        headers=headers_b
    )
    assert res_hack_edit.status_code == 403, f"Expected 403, got {res_hack_edit.status_code}"
    print("[PASS] User B PUT /api/lost-items/{id} (unauthorized edit) -> 403 Forbidden")

    # 12. Authorization: User B cannot delete User A's item
    res_hack_del = client.delete(f"/api/lost-items/{item_id}", headers=headers_b)
    assert res_hack_del.status_code == 403, f"Expected 403, got {res_hack_del.status_code}"
    print("[PASS] User B DELETE /api/lost-items/{id} (unauthorized delete) -> 403 Forbidden")

    # 13. User A edits their own item
    res_edit = client.put(
        f"/api/lost-items/{item_id}",
        json={"description": "Updated description: Wallet has college ID inside."},
        headers=headers_a
    )
    assert res_edit.status_code == 200
    assert "Updated description" in res_edit.json()["description"]
    print("[PASS] User A PUT /api/lost-items/{id} (authorized edit) -> 200 OK")

    # 14. User A deletes their own item
    res_del = client.delete(f"/api/lost-items/{item_id}", headers=headers_a)
    assert res_del.status_code == 200
    print("[PASS] User A DELETE /api/lost-items/{id} (authorized delete) -> 200 OK")

    # 15. Verify item no longer exists
    res_verify_del = client.get(f"/api/lost-items/{item_id}")
    assert res_verify_del.status_code == 404
    print(f"[PASS] GET /api/lost-items/{item_id} after deletion -> 404 Not Found")

    print("\nALL 15 BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
