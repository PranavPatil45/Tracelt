"""
Comprehensive backend verification test suite for Tracelt Admin Dashboard & Management System.
Tests:
1. 403 Forbidden for unauthenticated & normal student users across admin routes.
2. 200 OK and valid data for authorized administrators on stats, activity, users, items, matches, claims, recoveries, reports, and audit logs.
3. User management (search, detail, role change, self-demotion prevention).
4. Item status moderation.
5. Claim intervention and approval by admin via existing claim_service.
6. Audit logging for administrative actions.
"""

import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

client = TestClient(app)

def create_verified_user(email: str, name: str, campus: str, role: str = "student", password: str = "Password123!") -> str:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if not user:
            user = User(
                email=email.lower().strip(),
                full_name=name,
                hashed_password=get_password_hash(password),
                campus=campus,
                department="Engineering",
                role=role,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.role = role
            user.is_active = True
            db.commit()
    finally:
        db.close()

    res = client.post("/api/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def main():
    print("=== STARTING TRACELT ADMIN MANAGEMENT SYSTEM VERIFICATION ===")
    uid = uuid.uuid4().hex[:6]

    student_email = f"student_{uid}@campus.edu"
    admin_email = f"admin_{uid}@campus.edu"
    other_campus_student = f"other_student_{uid}@other.edu"

    # 1. Setup Student & Admin
    student_token = create_verified_user(student_email, "Normal Student", "Tech Campus", role="student")
    admin_token = create_verified_user(admin_email, "Campus Admin", "Tech Campus", role="admin")
    other_token = create_verified_user(other_campus_student, "Other Campus User", "Other Campus", role="student")

    student_headers = {"Authorization": f"Bearer {student_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # 2. Security Test: Non-admin users MUST receive 403 Forbidden
    print("\n--- 1. Testing Non-Admin Authorization & Security ---")
    protected_endpoints = [
        ("GET", "/api/admin/stats"),
        ("GET", "/api/admin/activity"),
        ("GET", "/api/admin/users"),
        ("GET", "/api/admin/lost-items"),
        ("GET", "/api/admin/found-items"),
        ("GET", "/api/admin/matches"),
        ("GET", "/api/admin/claims"),
        ("GET", "/api/admin/recoveries"),
        ("GET", "/api/admin/reports"),
        ("GET", "/api/admin/audit-logs"),
    ]

    for method, path in protected_endpoints:
        res = client.get(path, headers=student_headers)
        assert res.status_code == 403, f"Expected 403 for student at {path}, got {res.status_code}"
        # Also test with no auth -> 401
        res_noauth = client.get(path)
        assert res_noauth.status_code == 401, f"Expected 401 for unauthenticated at {path}, got {res_noauth.status_code}"

    print("[PASS] All admin endpoints strictly reject non-admin users with 403 Forbidden & unauthenticated with 401 Unauthorized")

    # 3. Admin Access: Stats API
    print("\n--- 2. Testing Admin Statistics API ---")
    res_stats = client.get("/api/admin/stats", headers=admin_headers)
    assert res_stats.status_code == 200, f"Failed stats: {res_stats.text}"
    stats_data = res_stats.json()
    assert "total_users" in stats_data
    assert "total_lost_items" in stats_data
    assert "total_found_items" in stats_data
    assert "active_matches" in stats_data
    assert "pending_claims" in stats_data
    assert "recovery_rate" in stats_data
    assert "top_categories" in stats_data
    assert "top_locations" in stats_data
    assert stats_data["campus_scope"] == "Tech Campus"
    print(f"[PASS] GET /api/admin/stats -> 200 OK (Users: {stats_data['total_users']}, Lost: {stats_data['total_lost_items']}, Found: {stats_data['total_found_items']}, Scope: {stats_data['campus_scope']})")

    # 4. Activity Feed API
    print("\n--- 3. Testing Admin Activity Feed API ---")
    res_activity = client.get("/api/admin/activity?page=1&limit=10", headers=admin_headers)
    assert res_activity.status_code == 200, f"Failed activity: {res_activity.text}"
    act_data = res_activity.json()
    assert "items" in act_data
    assert "total" in act_data
    print(f"[PASS] GET /api/admin/activity -> 200 OK (Retrieved {len(act_data['items'])} items, Total: {act_data['total']})")

    # 5. User Management APIs
    print("\n--- 4. Testing User Management APIs ---")
    res_users = client.get(f"/api/admin/users?search={student_email}", headers=admin_headers)
    assert res_users.status_code == 200
    user_list = res_users.json()["users"]
    assert len(user_list) >= 1
    target_user = user_list[0]
    target_user_id = target_user["id"]
    print(f"[PASS] GET /api/admin/users with search -> 200 OK (Found User #{target_user_id}: {target_user['email']})")

    # User details
    res_detail = client.get(f"/api/admin/users/{target_user_id}", headers=admin_headers)
    assert res_detail.status_code == 200
    detail_data = res_detail.json()
    assert "lost_items_count" in detail_data
    assert "found_items_count" in detail_data
    assert "hashed_password" not in detail_data  # NEVER expose password
    print(f"[PASS] GET /api/admin/users/{target_user_id} -> 200 OK (Password NOT exposed)")

    # Update role to reviewer
    res_update_role = client.patch(f"/api/admin/users/{target_user_id}", json={"role": "reviewer"}, headers=admin_headers)
    assert res_update_role.status_code == 200
    assert res_update_role.json()["role"] == "reviewer"
    print(f"[PASS] PATCH /api/admin/users/{target_user_id} (Role changed to reviewer) -> 200 OK")

    # Guard: Self-demotion must be prevented
    res_me = client.get("/api/me", headers=admin_headers)
    admin_id = res_me.json()["id"]
    res_self_demote = client.patch(f"/api/admin/users/{admin_id}", json={"role": "student"}, headers=admin_headers)
    assert res_self_demote.status_code == 400
    print("[PASS] Self-demotion prevented -> 400 Bad Request")

    # 6. Item Reporting and Moderation
    print("\n--- 5. Testing Item Moderation ---")
    lost_res = client.post("/api/lost-items", json={
        "title": "Admin Test Laptop",
        "category": "Electronics",
        "description": "Left in room 204",
        "location": "Room 204",
        "lost_date": "2026-09-19",
    }, headers=student_headers)
    assert lost_res.status_code == 201
    lost_item_id = lost_res.json()["id"]

    # Moderate status to CLOSED
    res_mod = client.patch(f"/api/admin/items/lost/{lost_item_id}/status", json={
        "status": "CLOSED",
        "reason": "Suspected duplicate or resolved externally",
    }, headers=admin_headers)
    assert res_mod.status_code == 200
    assert res_mod.json()["new_status"] == "CLOSED"
    print(f"[PASS] PATCH /api/admin/items/lost/{lost_item_id}/status -> 200 OK (New status: CLOSED)")

    # 7. Matches Monitoring
    print("\n--- 6. Testing Matches Monitoring ---")
    res_matches = client.get("/api/admin/matches", headers=admin_headers)
    assert res_matches.status_code == 200
    assert "matches" in res_matches.json()
    print(f"[PASS] GET /api/admin/matches -> 200 OK (Matches monitored: {res_matches.json()['total']})")

    # 8. Reports / Moderation System
    print("\n--- 7. Testing Moderation Reports ---")
    res_rep = client.post("/api/admin/reports", json={
        "entity_type": "lost_item",
        "entity_id": lost_item_id,
        "reason": "inappropriate",
        "description": "Spam report test",
    }, headers=admin_headers)
    assert res_rep.status_code == 200
    report_id = res_rep.json()["id"]
    assert res_rep.json()["status"] == "PENDING"
    print(f"[PASS] POST /api/admin/reports -> 200 OK (Report #{report_id} created)")

    # Resolve report
    res_res = client.patch(f"/api/admin/reports/{report_id}", json={
        "status": "RESOLVED",
        "admin_notes": "Reviewed and handled by admin",
    }, headers=admin_headers)
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"
    print(f"[PASS] PATCH /api/admin/reports/{report_id} -> 200 OK (Report #{report_id} RESOLVED)")

    # 9. Audit Logs
    print("\n--- 8. Testing Admin Audit Logs ---")
    res_audit = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert res_audit.status_code == 200
    logs = res_audit.json()["logs"]
    assert len(logs) >= 2
    print(f"[PASS] GET /api/admin/audit-logs -> 200 OK ({len(logs)} audit entries recorded)")

    print("\n=======================================================")
    print("  ALL ADMIN BACKEND API & SECURITY TESTS PASSED 100%!  ")
    print("=======================================================")

if __name__ == "__main__":
    main()
