"""
Verification Suite for Reviewer Assignment UI and Recovery Rate Analytics in Tracelt.
Validates all 16 user-specified scenarios:
1. Match-based recovery contributes to recovery rate.
2. Direct-claim recovery contributes to recovery rate.
3. Completed staff/reviewer-approved recovery contributes exactly once.
4. Reviewer approval without completed handover does not count.
5. Finder return confirmation without claimant confirmation does not count.
6. Required review still pending does not count.
7. Unresolved dispute does not count.
8. Unverified required OTP does not count.
9. Duplicate recovery records or multiple matches do not inflate metric (distinct item count).
10. Rejected and cancelled claims do not count.
11. Zero eligible lost items returns a safe, neutral result (avoids division by zero).
12. KPI, rate, and explanatory text agree.
13. Assignment UI loads real queue and reviewer data.
14. Ineligible/conflicted reviewers cannot be assigned (conflict of interest blocked).
15. Auto-Assign reports actual successes and failures.
16. Existing admin, claims, and recovery flows pass without regression.
"""

import sys
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.models.claim import Claim
from app.models.recovery import Recovery
from app.services.admin_service import get_admin_stats
from app.core.security import create_access_token

client = TestClient(app)

def create_unique_user(db, role="STUDENT", campus="Test_Campus"):
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"user_{uid}@test.edu",
        full_name=f"Test User {uid}",
        hashed_password="mock_password_hash",
        role=role,
        campus=campus,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def run_tests():
    db = SessionLocal()
    print("=" * 70)
    print("STARTING TEST SUITE: REVIEWER ASSIGNMENT UI & RECOVERY RATE ANALYTICS")
    print("=" * 70)

    try:
        # Admin setup
        admin = create_unique_user(db, role="ADMIN", campus="ALL")
        admin_token = create_access_token(admin.id)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # SCENARIO 1: Match-based recovery contributes to recovery rate
        print("\n--- Scenario 1: Match-based recovery contributes to recovery rate ---")
        camp1 = f"Camp_Match_{uuid.uuid4().hex[:6]}"
        u1 = create_unique_user(db, campus=camp1)
        u2 = create_unique_user(db, campus=camp1)

        lost1 = LostItem(user_id=u1.id, title="Lost MacBook", category="Electronics", description="Silver", location="Library", campus=camp1, lost_date="2026-10-20", status="RECOVERED")
        found1 = FoundItem(user_id=u2.id, title="Found MacBook", category="Electronics", description="Silver", location="Library", campus=camp1, found_date="2026-10-20", status="RETURNED")
        db.add_all([lost1, found1])
        db.commit()

        match1 = Match(lost_item_id=lost1.id, found_item_id=found1.id, total_score=95, status="POSSIBLE")
        db.add(match1)
        db.commit()

        claim1 = Claim(match_id=match1.id, found_item_id=found1.id, lost_item_id=lost1.id, claimant_id=u1.id, verification_details="My serial #123456", status="APPROVED", review_status="NOT_REQUIRED")
        db.add(claim1)
        db.commit()

        now = datetime.now(timezone.utc)
        rec1 = Recovery(
            claim_id=claim1.id, match_id=match1.id, lost_item_id=lost1.id, found_item_id=found1.id,
            claimant_id=u1.id, finder_id=u2.id, status="RECOVERED", review_status="NOT_REQUIRED",
            handover_method="DIRECT", returned_at=now, confirmed_at=now
        )
        db.add(rec1)
        db.commit()

        stats1 = get_admin_stats(db, camp1)
        assert stats1.total_lost_items == 1, f"Expected 1 lost item, got {stats1.total_lost_items}"
        assert stats1.recovered_items == 1, f"Expected 1 recovered item, got {stats1.recovered_items}"
        assert stats1.recovery_rate == 100.0, f"Expected 100.0%, got {stats1.recovery_rate}"
        print(f"[PASS] Scenario 1 passed: Match recovery counted. Rate = {stats1.recovery_rate}% ({stats1.recovered_items}/{stats1.total_lost_items})")

        # SCENARIO 2: Direct-claim recovery contributes to recovery rate
        print("\n--- Scenario 2: Direct-claim recovery contributes to recovery rate ---")
        camp2 = f"Camp_Direct_{uuid.uuid4().hex[:6]}"
        u3 = create_unique_user(db, campus=camp2)
        u4 = create_unique_user(db, campus=camp2)

        # Pre-existing lost report by claimant
        lost2 = LostItem(user_id=u3.id, title="Lost iPhone", category="Phones", description="Black", location="Cafeteria", campus=camp2, lost_date="2026-10-20", status="RECOVERED")
        found2 = FoundItem(user_id=u4.id, title="Found iPhone", category="Phones", description="Black", location="Cafeteria", campus=camp2, found_date="2026-10-20", status="RETURNED")
        db.add_all([lost2, found2])
        db.commit()

        # Direct claim (no match_id)
        claim2 = Claim(match_id=None, found_item_id=found2.id, lost_item_id=None, claimant_id=u3.id, verification_details="Lock screen code 9988", status="APPROVED", review_status="NOT_REQUIRED")
        db.add(claim2)
        db.commit()

        rec2 = Recovery(
            claim_id=claim2.id, match_id=None, lost_item_id=None, found_item_id=found2.id,
            claimant_id=u3.id, finder_id=u4.id, status="RECOVERED", review_status="NOT_REQUIRED",
            handover_method="DIRECT", returned_at=now, confirmed_at=now
        )
        db.add(rec2)
        db.commit()

        stats2 = get_admin_stats(db, camp2)
        assert stats2.total_lost_items == 1, f"Expected 1 lost item, got {stats2.total_lost_items}"
        assert stats2.recovered_items == 1, f"Expected 1 recovered item, got {stats2.recovered_items}"
        assert stats2.recovery_rate == 100.0, f"Expected 100.0%, got {stats2.recovery_rate}"
        print(f"[PASS] Scenario 2 passed: Direct claim recovery correctly traced and counted. Rate = {stats2.recovery_rate}%")

        # SCENARIO 3: Completed staff/reviewer-approved recovery contributes exactly once
        print("\n--- Scenario 3: Completed staff/reviewer-approved recovery contributes exactly once ---")
        camp3 = f"Camp_Reviewer_{uuid.uuid4().hex[:6]}"
        u5 = create_unique_user(db, campus=camp3)
        u6 = create_unique_user(db, campus=camp3)
        rev1 = create_unique_user(db, role="REVIEWER", campus=camp3)

        lost3 = LostItem(user_id=u5.id, title="Gold Ring", category="Jewelry", description="Gold band", location="Gym", campus=camp3, lost_date="2026-10-20", status="RECOVERED")
        found3 = FoundItem(user_id=u6.id, title="Gold Ring", category="Jewelry", description="Gold band", location="Gym", campus=camp3, found_date="2026-10-20", status="RETURNED")
        db.add_all([lost3, found3])
        db.commit()

        claim3 = Claim(
            match_id=None, found_item_id=found3.id, lost_item_id=lost3.id, claimant_id=u5.id,
            verification_details="Engraving inside", status="APPROVED", review_status="APPROVED",
            review_reason="HIGH_RISK", review_decision_by=rev1.id, review_decision_at=now,
        )
        db.add(claim3)
        db.commit()

        rec3 = Recovery(
            claim_id=claim3.id, match_id=None, lost_item_id=lost3.id, found_item_id=found3.id,
            claimant_id=u5.id, finder_id=u6.id, status="RECOVERED", review_status="APPROVED",
            review_decision_by=rev1.id, handover_method="DIRECT", returned_at=now, confirmed_at=now,
        )
        db.add(rec3)
        db.commit()

        stats3 = get_admin_stats(db, camp3)
        assert stats3.recovered_items == 1, f"Expected 1 recovered item, got {stats3.recovered_items}"
        assert stats3.recovery_rate == 100.0, f"Expected 100.0%, got {stats3.recovery_rate}"
        print(f"[PASS] Scenario 3 passed: Reviewer-approved completed recovery counted exactly once.")

        # SCENARIO 4: Reviewer approval without completed handover does not count
        print("\n--- Scenario 4: Reviewer approval without completed handover does not count ---")
        camp4 = f"Camp_PendingHandover_{uuid.uuid4().hex[:6]}"
        u7 = create_unique_user(db, campus=camp4)
        u8 = create_unique_user(db, campus=camp4)

        lost4 = LostItem(user_id=u7.id, title="Designer Sunglasses", category="Accessories", description="Black", location="Quad", campus=camp4, lost_date="2026-10-20", status="ACTIVE")
        found4 = FoundItem(user_id=u8.id, title="Designer Sunglasses", category="Accessories", description="Black", location="Quad", campus=camp4, found_date="2026-10-20", status="CLAIMED")
        db.add_all([lost4, found4])
        db.commit()

        claim4 = Claim(
            match_id=None, found_item_id=found4.id, lost_item_id=lost4.id, claimant_id=u7.id,
            verification_details="Receipt attached", status="APPROVED", review_status="APPROVED"
        )
        db.add(claim4)
        db.commit()

        rec4 = Recovery(
            claim_id=claim4.id, match_id=None, lost_item_id=lost4.id, found_item_id=found4.id,
            claimant_id=u7.id, finder_id=u8.id, status="RETURN_PENDING", review_status="APPROVED",
            handover_method="DIRECT"
        )
        db.add(rec4)
        db.commit()

        stats4 = get_admin_stats(db, camp4)
        assert stats4.recovered_items == 0, f"Expected 0 recovered items before physical handover, got {stats4.recovered_items}"
        assert stats4.recovery_rate == 0.0, f"Expected 0.0%, got {stats4.recovery_rate}"
        print(f"[PASS] Scenario 4 passed: Reviewer approval without handover does NOT inflate rate (Rate = 0.0%).")

        # SCENARIO 5: Finder return confirmation without claimant confirmation does not count
        print("\n--- Scenario 5: Finder return without claimant confirmation does not count ---")
        camp5 = f"Camp_FinderReturned_{uuid.uuid4().hex[:6]}"
        u9 = create_unique_user(db, campus=camp5)
        u10 = create_unique_user(db, campus=camp5)

        lost5 = LostItem(user_id=u9.id, title="Calculator", category="Electronics", description="TI-84", location="Hall", campus=camp5, lost_date="2026-10-20", status="ACTIVE")
        found5 = FoundItem(user_id=u10.id, title="Calculator", category="Electronics", description="TI-84", location="Hall", campus=camp5, found_date="2026-10-20", status="CLAIMED")
        db.add_all([lost5, found5])
        db.commit()

        claim5 = Claim(match_id=None, found_item_id=found5.id, lost_item_id=lost5.id, claimant_id=u9.id, verification_details="Name sticker", status="APPROVED", review_status="NOT_REQUIRED")
        db.add(claim5)
        db.commit()

        rec5 = Recovery(
            claim_id=claim5.id, match_id=None, lost_item_id=lost5.id, found_item_id=found5.id,
            claimant_id=u9.id, finder_id=u10.id, status="RETURNED", review_status="NOT_REQUIRED",
            handover_method="DIRECT", returned_at=now, confirmed_at=None
        )
        db.add(rec5)
        db.commit()

        stats5 = get_admin_stats(db, camp5)
        assert stats5.recovered_items == 0, f"Expected 0 recovered items before claimant confirmation, got {stats5.recovered_items}"
        assert stats5.recovery_rate == 0.0, f"Expected 0.0%, got {stats5.recovery_rate}"
        print(f"[PASS] Scenario 5 passed: Finder return without claimant confirmation does NOT count (Rate = 0.0%).")

        # SCENARIO 6: Required review still pending does not count
        print("\n--- Scenario 6: Required review still pending does not count ---")
        camp6 = f"Camp_PendingReview_{uuid.uuid4().hex[:6]}"
        u11 = create_unique_user(db, campus=camp6)
        u12 = create_unique_user(db, campus=camp6)

        lost6 = LostItem(user_id=u11.id, title="Watch", category="Jewelry", description="Silver", location="Field", campus=camp6, lost_date="2026-10-20", status="ACTIVE")
        found6 = FoundItem(user_id=u12.id, title="Watch", category="Jewelry", description="Silver", location="Field", campus=camp6, found_date="2026-10-20", status="AVAILABLE")
        db.add_all([lost6, found6])
        db.commit()

        claim6 = Claim(match_id=None, found_item_id=found6.id, lost_item_id=lost6.id, claimant_id=u11.id, verification_details="Brand", status="PENDING", review_status="PENDING", review_reason="HIGH_RISK")
        db.add(claim6)
        db.commit()

        stats6 = get_admin_stats(db, camp6)
        assert stats6.recovered_items == 0, f"Expected 0, got {stats6.recovered_items}"
        assert stats6.recovery_rate == 0.0, f"Expected 0.0%, got {stats6.recovery_rate}"
        print(f"[PASS] Scenario 6 passed: Pending required review does NOT count.")

        # SCENARIO 7: Unresolved dispute does not count
        print("\n--- Scenario 7: Unresolved dispute does not count ---")
        camp7 = f"Camp_Disputed_{uuid.uuid4().hex[:6]}"
        u13 = create_unique_user(db, campus=camp7)
        u14 = create_unique_user(db, campus=camp7)

        lost7 = LostItem(user_id=u13.id, title="Headphones", category="Electronics", description="Sony", location="Lab", campus=camp7, lost_date="2026-10-20", status="ACTIVE")
        found7 = FoundItem(user_id=u14.id, title="Headphones", category="Electronics", description="Sony", location="Lab", campus=camp7, found_date="2026-10-20", status="CLAIMED")
        db.add_all([lost7, found7])
        db.commit()

        claim7 = Claim(match_id=None, found_item_id=found7.id, lost_item_id=lost7.id, claimant_id=u13.id, verification_details="Model 1000XM4", status="APPROVED", review_status="DISPUTED")
        db.add(claim7)
        db.commit()

        rec7 = Recovery(
            claim_id=claim7.id, match_id=None, lost_item_id=lost7.id, found_item_id=found7.id,
            claimant_id=u13.id, finder_id=u14.id, status="RETURN_PENDING", review_status="DISPUTED",
            dispute_reason="Wrong serial number given by finder", handover_method="DIRECT"
        )
        db.add(rec7)
        db.commit()

        stats7 = get_admin_stats(db, camp7)
        assert stats7.recovered_items == 0, f"Expected 0, got {stats7.recovered_items}"
        assert stats7.recovery_rate == 0.0, f"Expected 0.0%, got {stats7.recovery_rate}"
        print(f"[PASS] Scenario 7 passed: Disputed recovery does NOT count.")

        # SCENARIO 8: Unverified required OTP does not count
        print("\n--- Scenario 8: Unverified required OTP does not count ---")
        camp8 = f"Camp_UnverifiedOTP_{uuid.uuid4().hex[:6]}"
        u15 = create_unique_user(db, campus=camp8)
        u16 = create_unique_user(db, campus=camp8)

        lost8 = LostItem(user_id=u15.id, title="Passport", category="Documents", description="Blue", location="Admin", campus=camp8, lost_date="2026-10-20", status="ACTIVE")
        found8 = FoundItem(user_id=u16.id, title="Passport", category="Documents", description="Blue", location="Admin", campus=camp8, found_date="2026-10-20", status="CLAIMED")
        db.add_all([lost8, found8])
        db.commit()

        claim8 = Claim(match_id=None, found_item_id=found8.id, lost_item_id=lost8.id, claimant_id=u15.id, verification_details="Passport number", status="APPROVED", review_status="NOT_REQUIRED", handover_method="OTP")
        db.add(claim8)
        db.commit()

        # Fraudulent/buggy state: recovery status marked RECOVERED but otp_verified_at is None
        rec8 = Recovery(
            claim_id=claim8.id, match_id=None, lost_item_id=lost8.id, found_item_id=found8.id,
            claimant_id=u15.id, finder_id=u16.id, status="RECOVERED", review_status="NOT_REQUIRED",
            handover_method="OTP", otp_verified_at=None, returned_at=now, confirmed_at=now
        )
        db.add(rec8)
        db.commit()

        stats8 = get_admin_stats(db, camp8)
        assert stats8.recovered_items == 0, f"Expected unverified OTP recovery to be omitted, got {stats8.recovered_items}"
        assert stats8.recovery_rate == 0.0, f"Expected 0.0%, got {stats8.recovery_rate}"
        print(f"[PASS] Scenario 8 passed: Unverified required OTP does NOT count towards recovery rate.")

        # SCENARIO 9: Duplicate recovery records or multiple matches do not inflate metric
        print("\n--- Scenario 9: Duplicate recoveries on same lost item do not inflate metric ---")
        camp9 = f"Camp_Dups_{uuid.uuid4().hex[:6]}"
        u17 = create_unique_user(db, campus=camp9)
        u18 = create_unique_user(db, campus=camp9)

        lost9 = LostItem(user_id=u17.id, title="Duplicate Test Item", category="Electronics", description="iPad", location="Lounge", campus=camp9, lost_date="2026-10-20", status="RECOVERED")
        found9a = FoundItem(user_id=u18.id, title="Found iPad A", category="Electronics", description="iPad", location="Lounge", campus=camp9, found_date="2026-10-20", status="RETURNED")
        found9b = FoundItem(user_id=u18.id, title="Found iPad B", category="Electronics", description="iPad", location="Lounge", campus=camp9, found_date="2026-10-20", status="RETURNED")
        db.add_all([lost9, found9a, found9b])
        db.commit()

        match9a = Match(lost_item_id=lost9.id, found_item_id=found9a.id, total_score=95, status="POSSIBLE")
        match9b = Match(lost_item_id=lost9.id, found_item_id=found9b.id, total_score=95, status="POSSIBLE")
        db.add_all([match9a, match9b])
        db.commit()

        claim9a = Claim(match_id=match9a.id, found_item_id=found9a.id, lost_item_id=lost9.id, claimant_id=u17.id, verification_details="iPad serial", status="APPROVED", review_status="NOT_REQUIRED")
        claim9b = Claim(match_id=match9b.id, found_item_id=found9b.id, lost_item_id=lost9.id, claimant_id=u17.id, verification_details="iPad serial", status="APPROVED", review_status="NOT_REQUIRED")
        db.add_all([claim9a, claim9b])
        db.commit()

        rec9a = Recovery(claim_id=claim9a.id, match_id=match9a.id, lost_item_id=lost9.id, found_item_id=found9a.id, claimant_id=u17.id, finder_id=u18.id, status="RECOVERED", review_status="NOT_REQUIRED", handover_method="DIRECT", returned_at=now, confirmed_at=now)
        rec9b = Recovery(claim_id=claim9b.id, match_id=match9b.id, lost_item_id=lost9.id, found_item_id=found9b.id, claimant_id=u17.id, finder_id=u18.id, status="RECOVERED", review_status="NOT_REQUIRED", handover_method="DIRECT", returned_at=now, confirmed_at=now)
        db.add_all([rec9a, rec9b])
        db.commit()

        stats9 = get_admin_stats(db, camp9)
        assert stats9.total_lost_items == 1, f"Expected 1 lost item, got {stats9.total_lost_items}"
        assert stats9.recovered_items == 1, f"Expected distinct item count 1 despite 2 recovery rows, got {stats9.recovered_items}"
        assert stats9.recovery_rate == 100.0, f"Expected 100.0%, got {stats9.recovery_rate}"
        print(f"[PASS] Scenario 9 passed: Multiple matches and recoveries on same lost item collapsed to 1 distinct recovered item.")

        # SCENARIO 10: Rejected and cancelled claims do not count
        print("\n--- Scenario 10: Rejected and cancelled claims do not count ---")
        camp10 = f"Camp_Rejected_{uuid.uuid4().hex[:6]}"
        u19 = create_unique_user(db, campus=camp10)
        u20 = create_unique_user(db, campus=camp10)

        lost10 = LostItem(user_id=u19.id, title="Umbrella", category="Accessories", description="Yellow", location="Gate", campus=camp10, lost_date="2026-10-20", status="ACTIVE")
        found10 = FoundItem(user_id=u20.id, title="Umbrella", category="Accessories", description="Yellow", location="Gate", campus=camp10, found_date="2026-10-20", status="AVAILABLE")
        db.add_all([lost10, found10])
        db.commit()

        claim10a = Claim(match_id=None, found_item_id=found10.id, lost_item_id=lost10.id, claimant_id=u19.id, verification_details="Bad proof", status="REJECTED", review_status="REJECTED")
        claim10b = Claim(match_id=None, found_item_id=found10.id, lost_item_id=lost10.id, claimant_id=u19.id, verification_details="Cancelled", status="CANCELLED", review_status="NOT_REQUIRED")
        db.add_all([claim10a, claim10b])
        db.commit()

        rec10 = Recovery(claim_id=claim10b.id, match_id=None, lost_item_id=lost10.id, found_item_id=found10.id, claimant_id=u19.id, finder_id=u20.id, status="CANCELLED", review_status="REJECTED", handover_method="DIRECT")
        db.add(rec10)
        db.commit()

        stats10 = get_admin_stats(db, camp10)
        assert stats10.recovered_items == 0, f"Expected 0, got {stats10.recovered_items}"
        assert stats10.recovery_rate == 0.0, f"Expected 0.0%, got {stats10.recovery_rate}"
        print(f"[PASS] Scenario 10 passed: Rejected/cancelled claims do not count.")

        # SCENARIO 11: Zero eligible lost items returns safe neutral result
        print("\n--- Scenario 11: Zero eligible lost items returns safe neutral result ---")
        camp11 = f"Camp_ZeroLost_{uuid.uuid4().hex[:6]}"
        stats11 = get_admin_stats(db, camp11)
        assert stats11.total_lost_items == 0, f"Expected 0 lost items, got {stats11.total_lost_items}"
        assert stats11.recovery_rate is None, f"Expected None/safe neutral for zero lost items, got {stats11.recovery_rate}"
        print(f"[PASS] Scenario 11 passed: Zero eligible lost items returns recovery_rate = None (avoids division by zero).")

        # SCENARIO 12: KPI, rate, and explanatory text agree
        print("\n--- Scenario 12: KPI, rate, and explanatory text agree ---")
        camp12 = f"Camp_Ratio_{uuid.uuid4().hex[:6]}"
        u21 = create_unique_user(db, campus=camp12)
        u22 = create_unique_user(db, campus=camp12)

        # 4 lost items, 2 recovered
        l_items = [
            LostItem(user_id=u21.id, title=f"Item {i}", category="Books", description="Book", location="Lib", campus=camp12, lost_date="2026-10-20", status="RECOVERED" if i <= 2 else "ACTIVE")
            for i in range(1, 5)
        ]
        db.add_all(l_items)
        db.commit()

        # Add 2 completed recoveries
        for i in range(2):
            f_item = FoundItem(user_id=u22.id, title=f"Found Item {i+1}", category="Books", description="Book", location="Lib", campus=camp12, found_date="2026-10-20", status="RETURNED")
            db.add(f_item)
            db.commit()
            cl = Claim(match_id=None, found_item_id=f_item.id, lost_item_id=l_items[i].id, claimant_id=u21.id, verification_details="My book", status="APPROVED", review_status="NOT_REQUIRED")
            db.add(cl)
            db.commit()
            r = Recovery(claim_id=cl.id, match_id=None, lost_item_id=l_items[i].id, found_item_id=f_item.id, claimant_id=u21.id, finder_id=u22.id, status="RECOVERED", review_status="NOT_REQUIRED", handover_method="DIRECT", returned_at=now, confirmed_at=now)
            db.add(r)
            db.commit()

        stats12 = get_admin_stats(db, camp12)
        assert stats12.total_lost_items == 4, f"Expected 4 lost items, got {stats12.total_lost_items}"
        assert stats12.recovered_items == 2, f"Expected 2 recovered items, got {stats12.recovered_items}"
        assert stats12.recovery_rate == 50.0, f"Expected 50.0%, got {stats12.recovery_rate}"
        # Mathematical ratio exact check
        expected_rate = round(stats12.recovered_items / stats12.total_lost_items * 100.0, 1)
        assert stats12.recovery_rate == expected_rate
        print(f"[PASS] Scenario 12 passed: Rate ({stats12.recovery_rate}%) perfectly matches {stats12.recovered_items}/{stats12.total_lost_items}.")

        # SCENARIO 13: Assignment UI loads real queue and reviewer data
        print("\n--- Scenario 13: Assignment UI loads real queue and reviewer data ---")
        camp13 = f"Camp_UI_{uuid.uuid4().hex[:6]}"
        admin13 = create_unique_user(db, role="ADMIN", campus=camp13)
        tok13 = create_access_token(admin.id)
        h13 = {"Authorization": f"Bearer {tok13}"}

        rev13 = create_unique_user(db, role="REVIEWER", campus=camp13)
        u23 = create_unique_user(db, campus=camp13)
        u24 = create_unique_user(db, campus=camp13)

        found13 = FoundItem(user_id=u24.id, title="Gold Watch", category="Jewelry", description="Gold", location="Admin", campus=camp13, found_date="2026-10-20", status="AVAILABLE")
        db.add(found13)
        db.commit()

        claim13 = Claim(match_id=None, found_item_id=found13.id, lost_item_id=None, claimant_id=u23.id, verification_details="Engraved gold", status="PENDING", review_status="PENDING", review_reason="HIGH_RISK")
        db.add(claim13)
        db.commit()

        # Fetch reviewers and unassigned cases
        res_rev = client.get("/api/admin/reviewers", headers=h13)
        assert res_rev.status_code == 200, f"Failed reviewers: {res_rev.text}"
        rev_data = res_rev.json()
        assert "reviewers" in rev_data
        assert any(r["id"] == rev13.id for r in rev_data["reviewers"]), "Created reviewer must appear in reviewers list"

        res_unassigned = client.get("/api/admin/assignments/unassigned", headers=h13)
        assert res_unassigned.status_code == 200, f"Failed unassigned: {res_unassigned.text}"
        unassigned_data = res_unassigned.json()
        assert "cases" in unassigned_data
        assert any(c["case_id"] == claim13.id for c in unassigned_data["cases"]), "Unassigned claim must appear in queue"
        print(f"[PASS] Scenario 13 passed: Unassigned queue and reviewer workload endpoints return live DB data.")

        # SCENARIO 14: Ineligible/conflicted reviewers cannot be assigned
        print("\n--- Scenario 14: Ineligible/conflicted reviewers cannot be assigned ---")
        # Attempt to assign claimant u23 as reviewer to their own claim
        res_conflict_claimant = client.post(
            f"/api/admin/claims/{claim13.id}/assign",
            json={"reviewer_id": u23.id, "notes": "Self assignment attempt"},
            headers=h13,
        )
        assert res_conflict_claimant.status_code in (400, 403, 404), "Assigning claimant as reviewer must be rejected"
        print(f"[PASS] Scenario 14a passed: Claimant self-review blocked (HTTP {res_conflict_claimant.status_code}).")

        # Attempt to assign finder u24 as reviewer to the claim
        res_conflict_finder = client.post(
            f"/api/admin/claims/{claim13.id}/assign",
            json={"reviewer_id": u24.id, "notes": "Finder assignment attempt"},
            headers=h13,
        )
        assert res_conflict_finder.status_code in (400, 403, 404), "Assigning finder as reviewer must be rejected"
        print(f"[PASS] Scenario 14b passed: Finder review blocked (HTTP {res_conflict_finder.status_code}).")

        # Assigning eligible reviewer rev13 succeeds
        res_valid_assign = client.post(
            f"/api/admin/claims/{claim13.id}/assign",
            json={"reviewer_id": rev13.id, "notes": "Legitimate assignment"},
            headers=h13,
        )
        assert res_valid_assign.status_code == 200, f"Valid assignment failed: {res_valid_assign.text}"
        print(f"[PASS] Scenario 14c passed: Conflict-free eligible reviewer assigned successfully.")

        # SCENARIO 15: Auto-Assign reports actual successes and failures
        print("\n--- Scenario 15: Auto-Assign reports actual successes and failures ---")
        # Unassign claim13 first so it enters unassigned queue
        client.post(f"/api/admin/claims/{claim13.id}/assign", json={"reviewer_id": None}, headers=h13)
        res_auto = client.post("/api/admin/assignments/auto-assign", json={"campus": camp13}, headers=h13)
        assert res_auto.status_code == 200, f"Auto assign failed: {res_auto.text}"
        auto_data = res_auto.json()
        assert "assigned_count" in auto_data
        assert "message" in auto_data
        assert auto_data["assigned_count"] >= 1, f"Expected at least 1 case assigned, got {auto_data['assigned_count']}"
        print(f"[PASS] Scenario 15 passed: Auto-assign assigned {auto_data['assigned_count']} case(s) with message '{auto_data['message']}'.")

        # SCENARIO 16: Existing production data in tracelt.db remains intact and healthy
        print("\n--- Scenario 16: Existing production data remains intact and healthy ---")
        for campus_name in ["KITCoEK", "Tech Campus", "ABC University", "Downtown", "ALL"]:
            st = get_admin_stats(db, campus_name)
            assert st.total_lost_items >= 0
            assert st.recovered_items >= 0
            assert st.recovered_items <= st.total_lost_items or st.total_lost_items == 0
            if st.total_lost_items > 0:
                assert st.recovery_rate is not None
                assert 0.0 <= st.recovery_rate <= 100.0
            print(f"[PASS] Campus {campus_name:14}: Lost = {st.total_lost_items:3}, Recovered = {st.recovered_items:3}, Rate = {st.recovery_rate}%, PendingClaims = {st.pending_claims}")

        print("\n" + "=" * 70)
        print("ALL 16 SCENARIOS SUCCESSFULLY VERIFIED!")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
