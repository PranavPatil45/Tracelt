import os
import sys
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app

client = TestClient(app)


def run_tests():
    print("=========================================")
    print("    TRACELT EXPLORE API VERIFICATION     ")
    print("=========================================")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] 1. GET /api/health -> 200 OK")

    # 2. Register/Login User A (ABC University)
    email_a = "alex.explore@abc.edu"
    client.post(
        "/api/register",
        json={
            "full_name": "Alex Explore",
            "email": email_a,
            "password": "Password123!",
            "campus": "ABC University",
            "department": "Computer Science",
        },
    )
    res_login_a = client.post("/api/login", json={"email": email_a, "password": "Password123!"})
    assert res_login_a.status_code == 200
    token_a = res_login_a.json()["access_token"]
    user_a_id = res_login_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("[PASS] 2. User A (ABC University) authenticated")

    # 3. Register/Login User B (XYZ Institute - Different Campus)
    email_b = "sarah.explore@xyz.edu"
    client.post(
        "/api/register",
        json={
            "full_name": "Sarah Remote",
            "email": email_b,
            "password": "Password123!",
            "campus": "XYZ Institute",
            "department": "Architecture",
        },
    )
    res_login_b = client.post("/api/login", json={"email": email_b, "password": "Password123!"})
    assert res_login_b.status_code == 200
    token_b = res_login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print("[PASS] 3. User B (XYZ Institute) authenticated")

    # 4. Create items for ABC University
    res_lost = client.post(
        "/api/lost-items",
        json={
            "title": "Silver Dell XPS Laptop",
            "category": "Electronics",
            "description": "Dell XPS 13 with stickers on lid, left on desk 4.",
            "location": "Library 2nd Floor",
            "lost_date": "2026-09-17",
            "lost_time": "14:00",
        },
        headers=headers_a,
    )
    assert res_lost.status_code == 201
    lost_id = res_lost.json()["id"]

    res_found = client.post(
        "/api/found-items",
        json={
            "title": "Black Leather Bifold Wallet",
            "category": "Wallet",
            "description": "Found near cafeteria counter with transit pass inside.",
            "location": "Canteen",
            "found_date": "2026-09-16",
            "found_time": "12:30",
        },
        headers=headers_a,
    )
    assert res_found.status_code == 201
    found_id = res_found.json()["id"]
    print(f"[PASS] 4. Created LostItem #{lost_id} and FoundItem #{found_id} at ABC University")

    # 5. Create item for XYZ Institute
    res_remote = client.post(
        "/api/lost-items",
        json={
            "title": "Blue JanSport Backpack",
            "category": "Bag",
            "description": "Navy blue backpack containing textbooks.",
            "location": "Hostel Block A",
            "lost_date": "2026-09-15",
        },
        headers=headers_b,
    )
    assert res_remote.status_code == 201
    remote_id = res_remote.json()["id"]
    print(f"[PASS] 5. Created LostItem #{remote_id} at XYZ Institute")

    # 6. Unauthenticated check on /api/explore -> 401
    res_unauth = client.get("/api/explore")
    assert res_unauth.status_code == 401
    print("[PASS] 6. GET /api/explore (unauthenticated) -> 401 Unauthorized")

    # 7. Campus Isolation: User A should only see ABC University items
    res_explore_a = client.get("/api/explore", headers=headers_a)
    assert res_explore_a.status_code == 200
    data_a = res_explore_a.json()
    items_a = data_a["items"]
    assert any(i["id"] == lost_id and i["type"] == "LOST" for i in items_a)
    assert any(i["id"] == found_id and i["type"] == "FOUND" for i in items_a)
    assert not any(i["id"] == remote_id and i["type"] == "LOST" for i in items_a), "XYZ Institute item must NOT appear in ABC University feed!"
    print("[PASS] 7. Campus scoping strictly verified (User A only sees ABC University)")

    # 8. Unified types in response
    types = {i["type"] for i in items_a}
    assert "LOST" in types and "FOUND" in types, "Default feed must contain both LOST and FOUND items"
    print("[PASS] 8. Unified feed contains both 'LOST' and 'FOUND' items")

    # 9. Type filter: type=lost
    res_lost_only = client.get("/api/explore?type=lost", headers=headers_a)
    assert res_lost_only.status_code == 200
    items_lost = res_lost_only.json()["items"]
    assert all(i["type"] == "LOST" for i in items_lost)
    assert any(i["id"] == lost_id and i["type"] == "LOST" for i in items_lost)
    assert not any(i["type"] == "FOUND" for i in items_lost)
    print("[PASS] 9. Filter type=lost returns only lost items")

    # 10. Type filter: type=found
    res_found_only = client.get("/api/explore?type=found", headers=headers_a)
    assert res_found_only.status_code == 200
    items_found = res_found_only.json()["items"]
    assert all(i["type"] == "FOUND" for i in items_found)
    assert any(i["id"] == found_id and i["type"] == "FOUND" for i in items_found)
    assert not any(i["type"] == "LOST" for i in items_found)
    print("[PASS] 10. Filter type=found returns only found items")

    # 11. Search by title
    res_search_dell = client.get("/api/explore?search=Dell", headers=headers_a)
    assert res_search_dell.status_code == 200
    search_items = res_search_dell.json()["items"]
    assert any(i["id"] == lost_id and i["type"] == "LOST" for i in search_items)
    assert not any(i["id"] == found_id and i["type"] == "FOUND" for i in search_items)
    print("[PASS] 11. Search by keyword ('Dell') accurately matched item")

    # 12. Search by description or location
    res_search_cafe = client.get("/api/explore?search=cafeteria", headers=headers_a)
    assert res_search_cafe.status_code == 200
    assert any(i["id"] == found_id and i["type"] == "FOUND" for i in res_search_cafe.json()["items"])
    print("[PASS] 12. Search by description ('cafeteria') matched item")

    # 13. Category filter
    res_cat = client.get("/api/explore?category=Electronics", headers=headers_a)
    assert res_cat.status_code == 200
    for it in res_cat.json()["items"]:
        assert it["category"] == "Electronics"
    print("[PASS] 13. Filter category=Electronics accurately filtered results")

    # 14. Location filter
    res_loc = client.get("/api/explore?location=Library", headers=headers_a)
    assert res_loc.status_code == 200
    for it in res_loc.json()["items"]:
        assert "Library" in it["location"]
    print("[PASS] 14. Filter location=Library accurately filtered results")

    # 15. Date preset: 30days
    res_date = client.get("/api/explore?date_preset=30days", headers=headers_a)
    assert res_date.status_code == 200
    assert res_date.json()["total"] >= 2
    print("[PASS] 15. Filter date_preset=30days returned matching records")

    # 16. Pagination: limit=1
    res_p1 = client.get("/api/explore?limit=1&page=1", headers=headers_a)
    assert res_p1.status_code == 200
    data_p1 = res_p1.json()
    assert len(data_p1["items"]) == 1
    assert data_p1["page"] == 1
    assert data_p1["pages"] >= 2
    item_p1_key = (data_p1["items"][0]["id"], data_p1["items"][0]["type"])

    res_p2 = client.get("/api/explore?limit=1&page=2", headers=headers_a)
    assert res_p2.status_code == 200
    data_p2 = res_p2.json()
    assert len(data_p2["items"]) == 1
    assert data_p2["page"] == 2
    item_p2_key = (data_p2["items"][0]["id"], data_p2["items"][0]["type"])
    assert item_p1_key != item_p2_key, "Page 1 and Page 2 must not return duplicate items"
    print("[PASS] 16. Pagination (page=1, limit=1 -> page=2, limit=1) verified without duplicates")

    # 17. Sorting check: newest vs oldest
    res_sort_new = client.get("/api/explore?sort=newest", headers=headers_a)
    res_sort_old = client.get("/api/explore?sort=oldest", headers=headers_a)
    assert res_sort_new.status_code == 200 and res_sort_old.status_code == 200
    if len(res_sort_new.json()["items"]) >= 2:
        newest_key = (res_sort_new.json()["items"][0]["id"], res_sort_new.json()["items"][0]["type"])
        oldest_key = (res_sort_old.json()["items"][0]["id"], res_sort_old.json()["items"][0]["type"])
        assert newest_key != oldest_key or len(res_sort_new.json()["items"]) == 1
    print("[PASS] 17. Sorting (newest vs oldest) works properly")

    # 18. Exclude closed items by default
    res_closed_item = client.post(
        "/api/found-items",
        json={
            "title": "Closed Report Item",
            "category": "Keys",
            "description": "Already returned to owner.",
            "location": "Main Building",
            "found_date": "2026-09-10",
        },
        headers=headers_a,
    )
    closed_id = res_closed_item.json()["id"]
    # Mark as CLOSED
    client.put(f"/api/found-items/{closed_id}", json={"status": "CLOSED"}, headers=headers_a)

    # Verify default explore does NOT show CLOSED item
    res_after_close = client.get("/api/explore", headers=headers_a)
    assert not any(i["id"] == closed_id and i["type"] == "FOUND" for i in res_after_close.json()["items"])
    print("[PASS] 18. Non-active/CLOSED items excluded from discovery feed by default")

    print("=========================================")
    print("    ALL 18 EXPLORE CHECKS PASSED!        ")
    print("=========================================")


if __name__ == "__main__":
    run_tests()
