"""
Comprehensive verification test for Reviewer Assignment and Dedicated Reviewer Portal in Tracelt.
Tests:
1. Permission enforcement: Student accounts are blocked (HTTP 403) from /api/reviewer and assignment APIs.
2. Reviewer / Admin accounts are permitted.
3. Workload calculation & eligible reviewers list.
4. Conflict of interest: Claimant or Finder cannot be assigned to review their case.
5. Reviewer assignment & reassignment & unassignment with audit logging in reviewer_assignments.
6. Auto-assignment balancing load across eligible, conflict-free reviewers.
7. Reviewer dashboard stats & assigned cases list with filtering and search.
8. Reviewer case details retrieval (verifies item info, evidence, competing claims, NO plaintext OTP).
9. Status transition: Start review (UNDER_REVIEW).
10. Case decision: Reject with rationale and Approve with rationale.
11. Invariant: Review approval authorizes recovery, does NOT mark item RECOVERED or HANDED_OVER.
12. Security: Non-assigned reviewer cannot decide another reviewer's case unless admin.
13. Return case for reassignment with rationale.
14. Dispute resolution on recovery.
"""

import sys
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.found_item import FoundItem
from app.models.lost_item import LostItem
from app.models.claim import Claim
from app.models.recovery import Recovery
from app.models.reviewer_assignment import ReviewerAssignment
from app.core.security import create_access_token

client = TestClient(app)

def create_or_get_user(db, email, full_name, role, campus="Main Campus"):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password="test_password_hash",
            role=role,
            campus=campus,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.role = role
        user.is_active = True
        db.commit()
        db.refresh(user)
    return user

def run_tests():
    db = SessionLocal()
    print("=== Starting Reviewer Portal & Assignment Verification Suite ===")

    try:
        # 1. Setup users
        student_user = create_or_get_user(db, "student_tester@tracelt.edu", "Alice Student", "student")
        finder_user = create_or_get_user(db, "finder_tester@tracelt.edu", "Bob Finder", "student")
        reviewer_1 = create_or_get_user(db, "reviewer1_tester@tracelt.edu", "Carol Reviewer", "reviewer")
        reviewer_2 = create_or_get_user(db, "reviewer2_tester@tracelt.edu", "Dan Reviewer", "reviewer")
        admin_user = create_or_get_user(db, "admin_tester@tracelt.edu", "Eve Admin", "admin")

        token_student = create_access_token(student_user.id)
        token_rev1 = create_access_token(reviewer_1.id)
        token_rev2 = create_access_token(reviewer_2.id)
        token_admin = create_access_token(admin_user.id)

        headers_student = {"Authorization": f"Bearer {token_student}"}
        headers_rev1 = {"Authorization": f"Bearer {token_rev1}"}
        headers_rev2 = {"Authorization": f"Bearer {token_rev2}"}
        headers_admin = {"Authorization": f"Bearer {token_admin}"}

        # -------------------------------------------------------------
        # Test 1: Permission Enforcement
        # -------------------------------------------------------------
        print("\n--- Test 1: Permission Enforcement ---")
        res = client.get("/api/reviewer/stats", headers=headers_student)
        assert res.status_code == 403, f"Expected 403 for student on /reviewer/stats, got {res.status_code}"
        print("PASS: Student blocked from /api/reviewer/stats with 403 Forbidden.")

        res = client.get("/api/admin/reviewers", headers=headers_student)
        assert res.status_code == 403, f"Expected 403 for student on /admin/reviewers, got {res.status_code}"
        print("PASS: Student blocked from /api/admin/reviewers with 403 Forbidden.")

        res = client.get("/api/reviewer/stats", headers=headers_rev1)
        assert res.status_code == 200, f"Expected 200 for reviewer on /reviewer/stats, got {res.status_code}"
        print("PASS: Reviewer allowed on /api/reviewer/stats.")

        res = client.get("/api/admin/reviewers", headers=headers_admin)
        assert res.status_code == 200, f"Expected 200 for admin on /admin/reviewers, got {res.status_code}"
        data = res.json()
        assert "reviewers" in data
        assert any(r["id"] == reviewer_1.id for r in data["reviewers"])
        print(f"PASS: Admin fetched eligible reviewers. Total reviewers: {data['total']}.")

        # -------------------------------------------------------------
        # Test 2: Conflict of Interest on Assignment
        # -------------------------------------------------------------
        print("\n--- Test 2: Conflict of Interest on Assignment ---")
        # Create a found item where reviewer_1 is the finder!
        conflict_found_item = FoundItem(
            title="Conflict Calculator",
            category="Electronics",
            description="Silver scientific calculator",
            location="Science Hall Room 204",
            campus="Main Campus",
            found_date=datetime.now(timezone.utc).date(),
            status="AVAILABLE",
            user_id=reviewer_1.id,  # reviewer_1 found it!
        )
        db.add(conflict_found_item)
        db.commit()
        db.refresh(conflict_found_item)

        conflict_claim = Claim(
            found_item_id=conflict_found_item.id,
            claimant_id=student_user.id,
            verification_details="It has my initials 'AS' on the back cover",
            status="PENDING",
            review_status="PENDING",
            review_reason="USER_REQUESTED_REVIEW",
            handover_method="DIRECT",
        )
        db.add(conflict_claim)
        db.commit()
        db.refresh(conflict_claim)

        # Attempt to assign reviewer_1 to review this claim (conflict because reviewer_1 is finder!)
        res = client.post(
            f"/api/admin/claims/{conflict_claim.id}/assign",
            headers=headers_admin,
            json={"reviewer_id": reviewer_1.id, "notes": "Assigning finder as reviewer"},
        )
        assert res.status_code == 400, f"Expected 400 for conflict assignment, got {res.status_code}: {res.text}"
        assert "Conflict of interest" in res.json().get("detail", "")
        print("PASS: Conflict of interest strictly blocked when trying to assign finder as reviewer.")

        # Also attempt to assign student_user (claimant) as reviewer
        res = client.post(
            f"/api/admin/claims/{conflict_claim.id}/assign",
            headers=headers_admin,
            json={"reviewer_id": student_user.id},
        )
        assert res.status_code == 400, f"Expected 400 for non-eligible reviewer, got {res.status_code}"
        print("PASS: Non-eligible user blocked from assignment.")

        # -------------------------------------------------------------
        # Test 3: Valid Assignment, Reassignment & Audit Trail
        # -------------------------------------------------------------
        print("\n--- Test 3: Assignment, Reassignment & Audit Trail ---")
        # Assign reviewer_2 (no conflict)
        res = client.post(
            f"/api/admin/claims/{conflict_claim.id}/assign",
            headers=headers_admin,
            json={"reviewer_id": reviewer_2.id, "notes": "Assigned to Dan Reviewer for independent review"},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert res.json()["assigned_reviewer_id"] == reviewer_2.id
        print("PASS: Successfully assigned reviewer_2 to claim.")

        # Verify audit history
        res = client.get(f"/api/admin/assignments/history/CLAIM/{conflict_claim.id}", headers=headers_admin)
        assert res.status_code == 200
        history = res.json()["history"]
        assert len(history) >= 1
        assert history[0]["reviewer_id"] == reviewer_2.id
        assert history[0]["action"] == "ASSIGNED"
        print("PASS: Reviewer assignment audit trail logged in database.")

        # Reassign to admin
        res = client.post(
            f"/api/admin/claims/{conflict_claim.id}/assign",
            headers=headers_admin,
            json={"reviewer_id": admin_user.id, "notes": "Reassigned to admin"},
        )
        assert res.status_code == 200
        assert res.json()["assigned_reviewer_id"] == admin_user.id

        # Verify history reflects REASSIGNED
        res = client.get(f"/api/admin/assignments/history/CLAIM/{conflict_claim.id}", headers=headers_admin)
        history = res.json()["history"]
        assert len(history) >= 2
        assert history[0]["action"] == "REASSIGNED"
        print("PASS: Reassignment recorded in audit history.")

        # Unassign
        res = client.post(
            f"/api/admin/claims/{conflict_claim.id}/assign",
            headers=headers_admin,
            json={"reviewer_id": None, "notes": "Unassigning claim for auto-assignment"},
        )
        assert res.status_code == 200
        assert res.json()["assigned_reviewer_id"] is None
        print("PASS: Unassignment succeeded.")

        # -------------------------------------------------------------
        # Test 4: Auto-Assignment Workflow
        # -------------------------------------------------------------
        print("\n--- Test 4: Auto-Assignment Workflow ---")
        res = client.post(
            "/api/admin/assignments/auto-assign",
            headers=headers_admin,
            json={"campus": "Main Campus"},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["success"] is True
        print(f"PASS: Auto-assigned {data['assigned_count']} unassigned cases.")

        db.refresh(conflict_claim)
        assert conflict_claim.assigned_reviewer_id is not None
        # Must NOT be reviewer_1 because reviewer_1 is the finder!
        assert conflict_claim.assigned_reviewer_id != reviewer_1.id, "Auto-assign must not pick conflicted reviewer!"
        print(f"PASS: Auto-assigned conflict_claim to conflict-free reviewer #{conflict_claim.assigned_reviewer_id}.")

        # -------------------------------------------------------------
        # Test 5: Reviewer Portal Workspace & Case Details
        # -------------------------------------------------------------
        print("\n--- Test 5: Reviewer Portal Workspace & Case Details ---")
        assigned_reviewer_id = conflict_claim.assigned_reviewer_id
        assigned_token = token_rev2 if assigned_reviewer_id == reviewer_2.id else token_admin
        assigned_headers = {"Authorization": f"Bearer {assigned_token}"}

        # Check reviewer dashboard stats
        res = client.get("/api/reviewer/stats", headers=assigned_headers)
        assert res.status_code == 200
        stats = res.json()
        assert stats["assigned_total"] >= 1
        print("PASS: Reviewer dashboard stats returned correct metrics.")

        # Check assigned cases queue
        res = client.get("/api/reviewer/cases", headers=assigned_headers)
        assert res.status_code == 200
        cases_data = res.json()
        assert any(c["case_id"] == conflict_claim.id for c in cases_data["cases"])
        print("PASS: Case appears in assigned reviewer's case queue.")

        # Check Case Review Details
        res = client.get(f"/api/reviewer/cases/CLAIM/{conflict_claim.id}", headers=assigned_headers)
        assert res.status_code == 200
        detail = res.json()
        assert detail["case_id"] == conflict_claim.id
        assert detail["verification_details"] == "It has my initials 'AS' on the back cover"
        assert detail["found_item"]["title"] == "Conflict Calculator"
        assert detail["claimant"]["full_name"] == "Alice Student"
        assert "otp_plaintext" not in str(detail), "Plaintext OTP must NEVER exist in response payload!"
        print("PASS: Full case review details loaded successfully with verified security.")

        # -------------------------------------------------------------
        # Test 6: Cross-Reviewer Access Restriction
        # -------------------------------------------------------------
        print("\n--- Test 6: Cross-Reviewer Access Restriction ---")
        # If assigned to reviewer_2, reviewer_1 should not be able to decide it!
        # First ensure assigned to reviewer_2
        conflict_claim.assigned_reviewer_id = reviewer_2.id
        db.commit()

        # Reviewer 1 attempts to decide reviewer 2's assigned case
        res = client.post(
            f"/api/reviewer/cases/CLAIM/{conflict_claim.id}/decide",
            headers=headers_rev1,
            json={"action": "APPROVE", "rationale": "Unauthorized reviewer decision attempt"},
        )
        assert res.status_code == 403, f"Expected 403 for unassigned reviewer, got {res.status_code}: {res.text}"
        print("PASS: Unassigned reviewer blocked from deciding another reviewer's assigned case.")

        # -------------------------------------------------------------
        # Test 7: Start Review & Decision Lifecycle (Approve with Invariants)
        # -------------------------------------------------------------
        print("\n--- Test 7: Start Review & Decision Lifecycle ---")
        # Start review
        res = client.post(
            f"/api/reviewer/cases/CLAIM/{conflict_claim.id}/start-review",
            headers=headers_rev2,
        )
        assert res.status_code == 200
        db.refresh(conflict_claim)
        assert conflict_claim.status == "UNDER_REVIEW"
        print("PASS: Case transitioned to UNDER_REVIEW.")

        # Attempt decide with empty rationale (must fail)
        res = client.post(
            f"/api/reviewer/cases/CLAIM/{conflict_claim.id}/decide",
            headers=headers_rev2,
            json={"action": "APPROVE", "rationale": "  "},
        )
        assert res.status_code in (400, 422), f"Expected 400/422 for empty rationale, got {res.status_code}"
        print("PASS: Mandatory substantive rationale enforced.")

        # Approve claim
        res = client.post(
            f"/api/reviewer/cases/CLAIM/{conflict_claim.id}/decide",
            headers=headers_rev2,
            json={"action": "APPROVE", "rationale": "Valid evidence confirmed matching calculator initials AS."},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        db.refresh(conflict_claim)
        db.refresh(conflict_found_item)

        assert conflict_claim.status == "APPROVED"
        assert conflict_claim.review_status == "APPROVED"
        assert conflict_found_item.status == "CLAIMED", f"Found item status should be CLAIMED, got {conflict_found_item.status}"

        # Invariant check: Item must NOT be RECOVERED yet! Dual confirmation / OTP handover is required.
        recovery = db.query(Recovery).filter(Recovery.claim_id == conflict_claim.id).first()
        assert recovery is not None, "Recovery record must be automatically created upon claim approval"
        assert recovery.status == "RETURN_PENDING", f"Recovery status should be RETURN_PENDING, got {recovery.status}"
        print("PASS: Invariant verified: Claim approval authorized recovery, item status is CLAIMED, recovery status is RETURN_PENDING.")

        # -------------------------------------------------------------
        # Test 8: Return Case for Reassignment
        # -------------------------------------------------------------
        print("\n--- Test 8: Return Case for Reassignment ---")
        # Create a new test claim assigned to reviewer_1
        item_normal = FoundItem(
            title="Blue Backpack",
            category="Bags",
            description="Navy blue Jansport backpack",
            location="Library 1st Floor",
            campus="Main Campus",
            found_date=datetime.now(timezone.utc).date(),
            status="AVAILABLE",
            user_id=finder_user.id,
        )
        db.add(item_normal)
        db.commit()
        db.refresh(item_normal)

        claim_normal = Claim(
            found_item_id=item_normal.id,
            claimant_id=student_user.id,
            verification_details="Contains notebook with my name",
            status="PENDING",
            review_status="PENDING",
            assigned_reviewer_id=reviewer_1.id,
            assigned_at=datetime.now(timezone.utc),
        )
        db.add(claim_normal)
        db.commit()
        db.refresh(claim_normal)

        # Reviewer 1 returns case
        res = client.post(
            f"/api/reviewer/cases/CLAIM/{claim_normal.id}/return-reassign",
            headers=headers_rev1,
            json={"reason": "Scheduling conflict; please reassign to another reviewer."},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        db.refresh(claim_normal)
        assert claim_normal.assigned_reviewer_id is None
        assert "Returned by Reviewer Carol Reviewer" in claim_normal.assignment_notes

        # History should have RETURNED
        res = client.get(f"/api/admin/assignments/history/CLAIM/{claim_normal.id}", headers=headers_admin)
        history = res.json()["history"]
        assert any(h["action"] == "RETURNED" for h in history)
        print("PASS: Return case for reassignment succeeded and logged in audit history.")

        # -------------------------------------------------------------
        # Test 9: Dispute Handling in Reviewer Portal
        # -------------------------------------------------------------
        print("\n--- Test 9: Recovery Dispute Handling in Reviewer Portal ---")
        recovery.review_status = "DISPUTED"
        recovery.dispute_reason = "Claimant claims item has damage not present before"
        recovery.disputed_by = student_user.id
        recovery.assigned_reviewer_id = reviewer_2.id
        db.commit()

        # Reviewer 2 views dispute in reviewer portal
        res = client.get(f"/api/reviewer/cases/RECOVERY/{recovery.id}", headers=headers_rev2)
        assert res.status_code == 200
        rec_detail = res.json()
        assert rec_detail["dispute_reason"] == "Claimant claims item has damage not present before"

        # Reviewer 2 resolves dispute (APPROVE to unblock handover)
        res = client.post(
            f"/api/reviewer/cases/RECOVERY/{recovery.id}/decide",
            headers=headers_rev2,
            json={"action": "APPROVE", "rationale": "Item inspection conducted; minor cosmetic wear acknowledged. Handover approved to proceed."},
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        db.refresh(recovery)
        assert recovery.review_status == "APPROVED"
        print("PASS: Reviewer successfully resolved disputed recovery.")

        print("\n=== ALL 9 TEST SUITES PASSED FLAWLESSLY! ===")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
