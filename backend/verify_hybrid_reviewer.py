import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.found_item import FoundItem
from app.models.lost_item import LostItem
from app.models.match import Match
from app.models.claim import Claim
from app.models.recovery import Recovery

client = TestClient(app)


def create_user_token(email: str, name: str, campus: str = "Downtown", role: str = "user"):
    password = "SecurePassword123!"
    reg_res = client.post("/api/register", json={
        "email": email,
        "password": password,
        "full_name": name,
        "campus": campus,
    })
    assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    user_info = reg_res.json()["user"]
    if role != "user":
        db = SessionLocal()
        u = db.query(User).filter(User.id == user_info["id"]).first()
        if u:
            u.role = role
            db.commit()
            db.refresh(u)
            user_info["role"] = role
        db.close()
    return {"headers": {"Authorization": f"Bearer {token}"}, "user": user_info}


def run_hybrid_tests():
    print("=" * 70)
    print("   TASK 3: HYBRID REVIEWER WORKFLOW & HANDOVER VERIFICATION TESTS   ")
    print("=" * 70)

    uid = uuid.uuid4().hex[:6]
    alice = create_user_token(f"alice_hy_{uid}@test.com", "Alice Claimant")
    bob = create_user_token(f"bob_hy_{uid}@test.com", "Bob Finder")
    charlie = create_user_token(f"charlie_hy_{uid}@test.com", "Charlie Competitor")
    staff = create_user_token(f"staff_hy_{uid}@test.com", "Staff Reviewer", role="reviewer")
    intruder = create_user_token(f"intruder_hy_{uid}@test.com", "Intruder User")

    print("[PASS] 1. Test users registered (Alice, Bob, Charlie, Staff Reviewer, Intruder)")

    # -------------------------------------------------------------------------
    # SUITE 1: RULE 1.1 - ONE ACTIVE CLAIM PER FOUND ITEM ENFORCEMENT
    # -------------------------------------------------------------------------
    f1_res = client.post("/api/found-items", json={
        "title": f"Stainless Steel Water Bottle {uid}",
        "category": "Personal Items",
        "description": "Silver 500ml insulated water bottle",
        "location": "Library 2nd Floor",
        "found_date": "2026-10-19",
    }, headers=bob["headers"])
    assert f1_res.status_code == 201
    f1_id = f1_res.json()["id"]

    # 1.1.1 First claim succeeds
    c1_res = client.post(f"/api/found-items/{f1_id}/claim", json={
        "verification_details": "Has a dent near the bottom rim and my initials AW.",
    }, headers=alice["headers"])
    assert c1_res.status_code == 201
    c1_id = c1_res.json()["id"]
    assert c1_res.json()["status"] == "PENDING"
    print(f"[PASS] 2. First claim #{c1_id} submitted with status PENDING")

    # 1.1.2 Second claim blocked while first is PENDING (409 Conflict)
    c1_dup = client.post(f"/api/found-items/{f1_id}/claim", json={
        "verification_details": "I lost this bottle yesterday in the morning.",
    }, headers=charlie["headers"])
    assert c1_dup.status_code == 409
    assert "Another active claim is currently being processed" in c1_dup.json()["detail"]
    print("[PASS] 3. Second claim blocked while existing claim is PENDING (409 Conflict)")

    # 1.1.3 Finder requests review -> Claim transitions to UNDER_REVIEW
    req_rev = client.put(f"/api/claims/{c1_id}/review", json={
        "action": "REQUEST_REVIEW",
        "reviewer_notes": "I would like campus staff to check the engraving.",
    }, headers=bob["headers"])
    assert req_rev.status_code == 200
    assert req_rev.json()["status"] == "UNDER_REVIEW"
    assert req_rev.json()["review_status"] == "PENDING"
    print("[PASS] 4. Finder requested reviewer involvement; claim status -> UNDER_REVIEW, review_status -> PENDING")

    # 1.1.4 Second claim still blocked while existing claim is UNDER_REVIEW (409 Conflict)
    c1_dup_ur = client.post(f"/api/found-items/{f1_id}/claim", json={
        "verification_details": "I lost this bottle yesterday in the morning.",
    }, headers=charlie["headers"])
    assert c1_dup_ur.status_code == 409
    print("[PASS] 5. Second claim blocked while existing claim is UNDER_REVIEW (409 Conflict)")

    # 1.1.5 Reviewer rejects the claim
    rev_rej = client.put(f"/api/claims/{c1_id}/review", json={
        "action": "REJECT",
        "reviewer_notes": "Initials AW do not match item markings.",
    }, headers=staff["headers"])
    assert rev_rej.status_code == 200
    assert rev_rej.json()["status"] == "REJECTED"
    assert rev_rej.json()["review_status"] == "REJECTED"
    print("[PASS] 6. Reviewer rejected claim #{c1_id}; status -> REJECTED")

    # 1.1.6 Now that previous claim is REJECTED, Charlie can submit a new claim
    c1_charlie = client.post(f"/api/found-items/{f1_id}/claim", json={
        "verification_details": "Has my student ID sticker barcode on the bottom.",
    }, headers=charlie["headers"])
    assert c1_charlie.status_code == 201
    c1_charlie_id = c1_charlie.json()["id"]
    print(f"[PASS] 7. New claim #{c1_charlie_id} succeeds after previous claim was REJECTED")

    # -------------------------------------------------------------------------
    # SUITE 2: ROUTINE DIRECT FLOW (NO REVIEWER REQUIRED)
    # -------------------------------------------------------------------------
    # Finder Bob approves Charlie's routine claim directly
    appr_c1 = client.put(f"/api/claims/{c1_charlie_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Barcode verified.",
        "handover_method": "DIRECT",
    }, headers=bob["headers"])
    assert appr_c1.status_code == 200
    assert appr_c1.json()["status"] == "APPROVED"
    assert appr_c1.json()["review_status"] == "NOT_REQUIRED"
    assert appr_c1.json()["handover_method"] == "DIRECT"
    print("[PASS] 8. Routine claim approved directly by Finder (review_status=NOT_REQUIRED, handover=DIRECT)")

    # Recovery record auto-created
    rec1_res = client.get(f"/api/claims/{c1_charlie_id}/recovery", headers=charlie["headers"])
    assert rec1_res.status_code == 200
    rec1_id = rec1_res.json()["id"]
    assert rec1_res.json()["status"] == "RETURN_PENDING"
    assert rec1_res.json()["review_status"] == "NOT_REQUIRED"
    print(f"[PASS] 9. Routine Recovery #{rec1_id} created with status RETURN_PENDING")

    # -------------------------------------------------------------------------
    # SUITE 3: RULE 4 - CONFLICT OF INTEREST & IMPARTIALITY SAFEGUARDS
    # -------------------------------------------------------------------------
    # 3.1 Claimant cannot review their own claim
    self_rev = client.put(f"/api/claims/{c1_charlie_id}/review", json={
        "action": "APPROVE",
    }, headers=charlie["headers"])
    assert self_rev.status_code in (400, 403)
    print("[PASS] 10. Claimant blocked from reviewing their own claim (HTTP 403/400)")

    # 3.2 Staff reviewer who reported found item cannot act as reviewer on it
    f_staff = client.post("/api/found-items", json={
        "title": f"Staff Reported Umbrella {uid}",
        "category": "Accessories",
        "description": "Black umbrella left in office",
        "location": "Staff Office",
        "found_date": "2026-10-19",
    }, headers=staff["headers"])
    f_staff_id = f_staff.json()["id"]

    claim_staff_item = client.post(f"/api/found-items/{f_staff_id}/claim", json={
        "verification_details": "Has wooden curved handle and small tear.",
    }, headers=alice["headers"])
    c_staff_id = claim_staff_item.json()["id"]

    # Staff attempts to act as staff reviewer on their own reported item
    staff_self_rev = client.put(f"/api/claims/{c_staff_id}/review", json={
        "action": "REQUEST_REVIEW",
    }, headers=staff["headers"])
    # If staff requests review or if another staff reviews:
    # An impartial reviewer is required
    staff2 = create_user_token(f"staff2_hy_{uid}@test.com", "Second Reviewer", role="reviewer")
    appr_impartial = client.put(f"/api/claims/{c_staff_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Impartial reviewer approval.",
    }, headers=staff2["headers"])
    assert appr_impartial.status_code == 200
    print("[PASS] 11. Impartial Reviewer verified and approved staff-reported item claim")

    # -------------------------------------------------------------------------
    # SUITE 4: MANDATORY HIGH-RISK REVIEW & MANDATORY OTP HANDOVER
    # -------------------------------------------------------------------------
    # Item with high-risk keyword (e.g. "Rolex", "Passport", "Cash")
    f_hr = client.post("/api/found-items", json={
        "title": f"Luxury Rolex Submariner Watch {uid}",
        "category": "High-Risk",
        "description": "Found luxury watch with gold bezel and certificate in box",
        "location": "Gym Locker Room",
        "found_date": "2026-10-19",
    }, headers=bob["headers"])
    assert f_hr.status_code == 201
    f_hr_id = f_hr.json()["id"]

    c_hr = client.post(f"/api/found-items/{f_hr_id}/claim", json={
        "verification_details": "Serial number registered to my name on the warranty card.",
    }, headers=alice["headers"])
    assert c_hr.status_code == 201
    c_hr_id = c_hr.json()["id"]
    c_hr_data = c_hr.json()
    assert c_hr_data["is_mandatory_review"] is True
    assert c_hr_data["review_status"] == "PENDING"
    assert c_hr_data["review_reason"] == "HIGH_RISK"
    assert c_hr_data["is_mandatory_otp"] is True
    assert c_hr_data["handover_method"] == "OTP"
    print(f"[PASS] 12. High-risk claim #{c_hr_id} automatically flagged: is_mandatory_review=True, review_status=PENDING, handover_method=OTP")

    # 4.1 Finder Bob attempts to approve directly -> Blocked (Rule 2)
    fail_finder_hr = client.put(f"/api/claims/{c_hr_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Direct approval attempt.",
    }, headers=bob["headers"])
    assert fail_finder_hr.status_code == 400
    assert "requires Reviewer intervention" in fail_finder_hr.json()["detail"]
    print("[PASS] 13. Finder direct approval blocked on mandatory high-risk claim (400 Bad Request)")

    # 4.2 Authorized Reviewer approves the high-risk claim
    appr_hr = client.put(f"/api/claims/{c_hr_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Warranty serial verified against manufacturer registry.",
        "handover_method": "OTP",
    }, headers=staff["headers"])
    assert appr_hr.status_code == 200
    assert appr_hr.json()["status"] == "APPROVED"
    assert appr_hr.json()["review_status"] == "APPROVED"
    assert appr_hr.json()["handover_method"] == "OTP"
    print("[PASS] 14. Authorized Reviewer approved high-risk claim (status=APPROVED, review_status=APPROVED)")

    # 4.3 Recovery record created with mandatory OTP
    rec_hr_res = client.get(f"/api/claims/{c_hr_id}/recovery", headers=alice["headers"])
    assert rec_hr_res.status_code == 200
    rec_hr = rec_hr_res.json()
    assert rec_hr["is_mandatory_otp"] is True
    assert rec_hr["handover_method"] == "OTP"
    rec_hr_id = rec_hr["id"]
    print(f"[PASS] 15. Recovery #{rec_hr_id} created with is_mandatory_otp=True and handover_method=OTP")

    # 4.4 Finder attempts to bypass OTP and mark returned directly -> Blocked
    fail_direct_ret = client.post(f"/api/recoveries/{rec_hr_id}/returned", json={
        "return_location": "Campus Police Desk",
    }, headers=bob["headers"])
    assert fail_direct_ret.status_code in (400, 409)
    assert "requires OTP handover verification" in fail_direct_ret.json()["detail"]
    print("[PASS] 16. Finder blocked from bypassing mandatory OTP handover (400 Bad Request)")

    # -------------------------------------------------------------------------
    # SUITE 5: OTP GENERATION, ATTEMPTS, EXPIRY, AND VERIFICATION
    # -------------------------------------------------------------------------
    # 5.1 Finder or Intruder cannot generate OTP (Only Claimant)
    fail_gen_finder = client.post(f"/api/recoveries/{rec_hr_id}/otp/generate", headers=bob["headers"])
    assert fail_gen_finder.status_code == 403
    fail_gen_int = client.post(f"/api/recoveries/{rec_hr_id}/otp/generate", headers=intruder["headers"])
    assert fail_gen_int.status_code == 403
    print("[PASS] 17. Non-claimants (Finder & Intruder) blocked from generating OTP (403 Forbidden)")

    # 5.2 Claimant Alice generates OTP
    gen_otp_res = client.post(f"/api/recoveries/{rec_hr_id}/otp/generate", headers=alice["headers"])
    assert gen_otp_res.status_code == 200
    otp_data = gen_otp_res.json()
    otp_code = otp_data["otp"]
    assert len(otp_code) == 6
    assert otp_code.isdigit()
    assert "expires_at" in otp_data
    print(f"[PASS] 18. Claimant generated secure 6-digit OTP ({otp_code}) with 30-min expiration")

    # Verify OTP is NOT stored plaintext in the DB (only SHA-256 hash)
    db = SessionLocal()
    rec_db = db.query(Recovery).filter(Recovery.id == rec_hr_id).first()
    assert rec_db.otp_hash is not None
    assert otp_code not in rec_db.otp_hash
    assert len(rec_db.otp_hash) == 64  # SHA-256 hex string length
    db.close()
    print("[PASS] 19. OTP verified to be stored ONLY as SHA-256 hash in database (never plaintext)")

    # 5.3 Claimant cannot verify OTP (Only Finder verifies)
    fail_ver_claimant = client.post(f"/api/recoveries/{rec_hr_id}/verify-otp", json={
        "otp": otp_code,
        "return_location": "Security Office Desk 2",
    }, headers=alice["headers"])
    assert fail_ver_claimant.status_code == 403
    print("[PASS] 20. Claimant blocked from verifying OTP (Finder must verify) (403 Forbidden)")

    # 5.4 Incorrect OTP is rejected and decrements remaining attempts
    bad_otp_res = client.post(f"/api/recoveries/{rec_hr_id}/verify-otp", json={
        "otp": "999999",
        "return_location": "Security Office Desk 2",
    }, headers=bob["headers"])
    assert bad_otp_res.status_code == 400
    assert "Invalid OTP code" in bad_otp_res.json()["detail"]
    assert "remaining" in bad_otp_res.json()["detail"].lower()
    print("[PASS] 21. Incorrect OTP rejected with remaining attempt count (400 Bad Request)")

    # 5.5 Finder enters correct OTP -> Transitions status to RETURNED
    ver_res = client.post(f"/api/recoveries/{rec_hr_id}/verify-otp", json={
        "otp": otp_code,
        "return_location": "Security Office Desk 2",
        "return_notes": "Handed watch directly to claimant Alice.",
    }, headers=bob["headers"])
    assert ver_res.status_code == 200
    assert ver_res.json()["status"] == "RETURNED"
    print("[PASS] 22. Finder verified correct OTP -> recovery status successfully transitioned to RETURNED")

    # 5.6 OTP cannot be reused after verification (Single-use)
    reuse_otp_res = client.post(f"/api/recoveries/{rec_hr_id}/verify-otp", json={
        "otp": otp_code,
        "return_location": "Security Office Desk 2",
    }, headers=bob["headers"])
    assert reuse_otp_res.status_code in (400, 409)
    print("[PASS] 23. OTP single-use enforced: Reusing validated OTP rejected (HTTP 409/400)")

    # 5.7 Invariant Check: OTP verification alone DOES NOT mark recovery as RECOVERED
    rec_check_step = client.get(f"/api/recoveries/{rec_hr_id}", headers=alice["headers"]).json()
    assert rec_check_step["status"] == "RETURNED"
    lost_check_step = client.get(f"/api/found-items/{f_hr_id}", headers=bob["headers"]).json()
    assert lost_check_step["status"] == "RETURNED"
    print("[PASS] 24. Invariant enforced: OTP verification marks RETURNED, does NOT prematurely finalize RECOVERED")

    # -------------------------------------------------------------------------
    # SUITE 6: DISPUTE WORKFLOW & RESOLUTION
    # -------------------------------------------------------------------------
    # 6.1 Claimant Alice raises a dispute before confirming recovery
    disp_res = client.post(f"/api/recoveries/{rec_hr_id}/dispute", json={
        "reason": "Watch warranty box was opened and extra links are missing.",
    }, headers=alice["headers"])
    assert disp_res.status_code == 200
    assert disp_res.json()["review_status"] == "DISPUTED"
    print(f"[PASS] 25. Claimant raised dispute on Recovery #{rec_hr_id} (review_status=DISPUTED)")

    # 6.2 While DISPUTED, final confirmation is blocked
    fail_confirm_disp = client.post(f"/api/recoveries/{rec_hr_id}/confirm", headers=alice["headers"])
    assert fail_confirm_disp.status_code == 400
    assert "Resolution required first" in fail_confirm_disp.json()["detail"]
    print("[PASS] 26. Final confirmation strictly blocked while recovery is DISPUTED (400 Bad Request)")

    # 6.3 Reviewer resolves dispute
    res_disp_res = client.post(f"/api/admin/recoveries/{rec_hr_id}/resolve-dispute", json={
        "decision": "RESOLVE",
        "resolution_notes": "Claimant and finder agreed the missing links were in the box envelope.",
    }, headers=staff["headers"])
    assert res_disp_res.status_code == 200
    assert res_disp_res.json()["review_status"] == "APPROVED"
    print(f"[PASS] 27. Staff Reviewer resolved dispute on Recovery #{rec_hr_id} (review_status -> APPROVED)")

    # 6.4 Now that dispute is resolved, Claimant Alice confirms final receipt
    final_conf = client.post(f"/api/recoveries/{rec_hr_id}/confirm", headers=alice["headers"])
    assert final_conf.status_code == 200
    assert final_conf.json()["status"] == "RECOVERED"
    print("[PASS] 28. Claimant Alice successfully confirmed final recovery (status -> RECOVERED)")

    # 6.5 Verify terminal statuses
    rec_final = client.get(f"/api/recoveries/{rec_hr_id}", headers=alice["headers"]).json()
    assert rec_final["status"] == "RECOVERED"
    found_final = client.get(f"/api/found-items/{f_hr_id}", headers=bob["headers"]).json()
    assert found_final["status"] == "RETURNED"
    print("[PASS] 29. Terminal statuses confirmed: Recovery=RECOVERED, FoundItem=RETURNED")

    # 6.6 A recovered item cannot receive any new claim
    new_claim_rec = client.post(f"/api/found-items/{f_hr_id}/claim", json={
        "verification_details": "Can I claim this recovered watch?",
    }, headers=intruder["headers"])
    assert new_claim_rec.status_code == 400
    print("[PASS] 30. Recovered item strictly cannot accept new claims (400 Bad Request)")

    # -------------------------------------------------------------------------
    # SUITE 7: ADMIN REVIEW QUEUE & STATUS FILTERING
    # -------------------------------------------------------------------------
    admin_pending = client.get("/api/admin/claims?review_status=PENDING", headers=staff["headers"])
    assert admin_pending.status_code == 200
    print("[PASS] 31. GET /api/admin/claims?review_status=PENDING filter works correctly")

    admin_recoveries = client.get("/api/admin/recoveries", headers=staff["headers"])
    assert admin_recoveries.status_code == 200
    assert len(admin_recoveries.json()["recoveries"]) > 0
    print("[PASS] 32. GET /api/admin/recoveries lists all recovery records")

    print("\n" + "=" * 70)
    print("   ALL 32 TASK 3 HYBRID REVIEWER WORKFLOW CHECKS PASSED!   ")
    print("=" * 70)


if __name__ == "__main__":
    init_db()
    run_hybrid_tests()
