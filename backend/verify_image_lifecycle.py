"""
End-to-end verification script for Image Upload, Storage, Loading, and Display in Tracelt.
Validates:
1. Upload generates exactly 1 physical file on disk.
2. Direct GET on /uploads/<filename> and /api/uploads/<filename> returns 200 OK with matching image bytes.
3. Fetching item details, search/explore, list endpoints 5+ times causes 0 new files to be created.
4. Deleting an item automatically cleans up its unreferenced image from disk.
5. Validation rejects non-images and empty files.
"""

import io
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.core.file_storage import UPLOADS_DIR

client = TestClient(app)

# Minimal 1x1 GIF / PNG byte signatures
TEST_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf"
    b"\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
)

TEST_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00"
    b"\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19"
    b"\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f"
    b"'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f"
    b"\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01"
    b"\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf"
    b"\x00\xff\xd9"
)

def count_uploads() -> int:
    return len([f for f in UPLOADS_DIR.iterdir() if f.is_file()])

def get_auth_token(email: str, name: str) -> str:
    signup_data = {
        "email": email,
        "password": "Password123!",
        "full_name": name,
        "campus": "ABC University",
        "department": "Engineering",
    }
    client.post("/api/register", json=signup_data)
    login_res = client.post("/api/login", json={"email": email, "password": "Password123!"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return login_res.json()["access_token"]

def main():
    print("=== STARTING TRACELT IMAGE LIFECYCLE & STORAGE VERIFICATION ===")
    
    # 0. Initial state check
    initial_count = count_uploads()
    print(f"[STEP 0] Initial upload files count: {initial_count}")

    # Authenticate
    token_a = get_auth_token("image_test_user_a@test.com", "Image Test User A")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Test invalid uploads rejected
    bad_file = {"file": ("malware.exe", io.BytesIO(b"malicious"), "application/octet-stream")}
    res_bad = client.post("/api/upload-image", files=bad_file, headers=headers_a)
    assert res_bad.status_code == 400, f"Expected 400 for exe, got {res_bad.status_code}"
    print("[PASS] 1a. Upload non-image (.exe) correctly rejected -> 400 Bad Request")

    empty_file = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    res_empty = client.post("/api/upload-image", files=empty_file, headers=headers_a)
    assert res_empty.status_code == 400, f"Expected 400 for empty file, got {res_empty.status_code}"
    print("[PASS] 1b. Upload empty image correctly rejected -> 400 Bad Request")

    assert count_uploads() == initial_count, "Rejected uploads must not create files on disk"

    # 2. Upload exactly ONE valid image
    good_file = {"file": ("blue_backpack.jpg", io.BytesIO(TEST_JPEG_BYTES), "image/jpeg")}
    res_upload = client.post("/api/upload-image", files=good_file, headers=headers_a)
    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_data = res_upload.json()
    image_url = upload_data["image_url"]
    filename = upload_data["filename"]
    print(f"[PASS] 2. POST /api/upload-image succeeded -> 200 OK (URL: {image_url})")

    # Verify exactly 1 file created
    assert count_uploads() == initial_count + 1, f"Expected {initial_count + 1} files, got {count_uploads()}"
    print(f"[PASS] Upload directory contains exactly {count_uploads()} file (1 file per upload)")

    # 3. Verify static file serving
    # Direct /uploads/<filename>
    res_static_1 = client.get(image_url)
    assert res_static_1.status_code == 200, f"Static fetch failed at {image_url}: {res_static_1.status_code}"
    assert res_static_1.content == TEST_JPEG_BYTES, "Fetched static file content does not match original bytes"
    assert "image/jpeg" in res_static_1.headers.get("content-type", "")
    print(f"[PASS] 3a. GET {image_url} -> 200 OK (Content-Type: image/jpeg, bytes match)")

    # Direct /api/uploads/<filename>
    api_static_url = f"/api{image_url}"
    res_static_2 = client.get(api_static_url)
    assert res_static_2.status_code == 200, f"Static fetch failed at {api_static_url}: {res_static_2.status_code}"
    assert res_static_2.content == TEST_JPEG_BYTES
    print(f"[PASS] 3b. GET {api_static_url} -> 200 OK (Content-Type: image/jpeg, bytes match)")

    # 4. Create Lost Item with this image
    lost_payload = {
        "title": "Navy Blue Backpack",
        "category": "Bags & Backpacks",
        "description": "Lost near science center with laptop compartment.",
        "location": "Science Center",
        "lost_date": "2026-09-18",
        "image_url": image_url,
    }
    res_create_lost = client.post("/api/lost-items", json=lost_payload, headers=headers_a)
    assert res_create_lost.status_code == 201, f"Failed creating lost item: {res_create_lost.text}"
    lost_item = res_create_lost.json()
    lost_item_id = lost_item["id"]
    assert lost_item["image_url"] == image_url
    print(f"[PASS] 4. Created LostItem #{lost_item_id} referencing {image_url}")

    # File count must still be exactly 1
    assert count_uploads() == initial_count + 1
    print(f"[PASS] File count after item creation remains: {count_uploads()}")

    # 5. Idempotency test: 5x refresh / navigation simulation
    print("\n--- Simulating multiple page navigations and reloads ---")
    for i in range(1, 6):
        # GET single item details
        res_det = client.get(f"/api/lost-items/{lost_item_id}")
        assert res_det.status_code == 200

        # GET explore list
        res_exp = client.get("/api/lost-items?limit=10")
        assert res_exp.status_code == 200

        # GET user items
        res_my = client.get("/api/users/me/lost-items", headers=headers_a)
        assert res_my.status_code == 200

        # GET history
        res_hist = client.get("/api/history", headers=headers_a)
        assert res_hist.status_code == 200

        # Static fetch
        res_img = client.get(image_url)
        assert res_img.status_code == 200

        # Verify NO new files created
        current_files = count_uploads()
        assert current_files == initial_count + 1, f"Navigation iteration {i} leaked files! Count: {current_files}"
        print(f"  Iteration {i}: 5 endpoints queried -> Uploads count remains {current_files}")

    print("[PASS] 5. Idempotency Verified: 5 iterations of fetches/reloads created 0 new files!")

    # 6. Test Found Item creation with a separate image
    png_file = {"file": ("silver_keys.png", io.BytesIO(TEST_PNG_BYTES), "image/png")}
    res_upload_found = client.post("/api/upload-image", files=png_file, headers=headers_a)
    assert res_upload_found.status_code == 200
    found_image_url = res_upload_found.json()["image_url"]
    assert count_uploads() == initial_count + 2
    print(f"\n[PASS] 6a. Uploaded second image for found item -> Total uploads count: {count_uploads()}")

    found_payload = {
        "title": "Silver Keychain",
        "category": "Keys",
        "description": "Found on bench outside dining hall.",
        "location": "Dining Hall",
        "found_date": "2026-09-18",
        "image_url": found_image_url,
    }
    res_create_found = client.post("/api/found-items", json=found_payload, headers=headers_a)
    assert res_create_found.status_code == 201
    found_item_id = res_create_found.json()["id"]
    print(f"[PASS] 6b. Created FoundItem #{found_item_id} referencing {found_image_url}")

    # 7. Test automatic cleanup upon item deletion
    # Delete Lost Item
    res_del_lost = client.delete(f"/api/lost-items/{lost_item_id}", headers=headers_a)
    assert res_del_lost.status_code == 200
    assert count_uploads() == initial_count + 1, f"Expected {initial_count + 1} files after deleting lost item, got {count_uploads()}"
    print(f"[PASS] 7a. Deleted LostItem #{lost_item_id} -> Associated image cleanly deleted from disk (remaining: {count_uploads()})")

    # Delete Found Item
    res_del_found = client.delete(f"/api/found-items/{found_item_id}", headers=headers_a)
    assert res_del_found.status_code == 200
    assert count_uploads() == initial_count, f"Expected {initial_count} files after deleting found item, got {count_uploads()}"
    print(f"[PASS] 7b. Deleted FoundItem #{found_item_id} -> Associated image cleanly deleted from disk (remaining: {count_uploads()})")

    print("\n=======================================================")
    print("  ALL IMAGE LIFECYCLE & STORAGE TESTS PASSED 100%!     ")
    print("=======================================================")

if __name__ == "__main__":
    main()
