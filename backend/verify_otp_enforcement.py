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


def run_otp_enforcement_tests():
    print("=" * 75)
    print("   TRACELT OTP HANDOVER STRICT ENFORCEMENT & REGRESSION SUITE   ")
    print("=" * 75)

    uid = uuid.uuid4().hex[:6]
    claimant = create_user_token(f"claimant_otp_{uid}@test.com", "Alice Claimant")
    finder = create_user_token(f"finder_otp_{uid}@test.com", "Bob Finder")
    staff = create_user_token(f"staff_otp_{uid}@test.com", "Staff Reviewer", role="reviewer")
    intruder = create_user_token(f"intruder_otp_{uid}@test.com", "Intruder User")

    print("[PASS] 1. Test actors created (Claimant Alice, Finder Bob, Staff Reviewer, Intruder)")

    # -------------------------------------------------------------------------
    # TEST CASE 1 & 2: User-selected OTP Recovery cannot be bypassed
    # -------------------------------------------------------------------------
    # Create found item
    f_res = client.post("/api/found-items", json={
        "title": f"Blue Wireless Headphones {uid}",
        "category": "Electronics",
        "description": "Sony WH-1000XM4 in blue protective case",
        "location": "Engineering Lab 3",
        "found_date": "2026-10-20",
    }, headers=finder["headers"])
    assert f_res.status_code == 201
    f_id = f_res.json()["id"]

    # Submit direct claim
    c_res = client.post(f"/api/found-items/{f_id}/claim", json={
        "verification_details": "Left inside blue case with white charging cable.",
    }, headers=claimant["headers"])
    assert c_res.status_code == 201
    c_id = c_res.json()["id"]

    # Finder approves claim selecting OTP handover method (is_mandatory_otp=False, user choice!)
    # (Notice: This is the exact scenario of Recovery #97!)
    appr_res = client.put(f"/api/claims/{c_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Serial matched registration.",
        "handover_method": "OTP",
    }, headers=finder["headers"])
    assert appr_res.status_code == 200
    assert appr_res.json()["handover_method"] == "OTP"

    rec_res = client.get(f"/api/claims/{c_id}/recovery", headers=claimant["headers"])
    assert rec_res.status_code == 200
    rec = rec_res.json()
    rec_id = rec["id"]
    assert rec["handover_method"] == "OTP"
    assert rec["status"] == "RETURN_PENDING"
    assert rec["can_mark_returned"] is False, "Finder direct mark returned must be hidden for OTP recoveries!"
    assert rec["can_generate_otp"] is True, "Claimant can_generate_otp must be True when status is RETURN_PENDING!"

    rec_finder = client.get(f"/api/claims/{c_id}/recovery", headers=finder["headers"]).json()
    assert rec_finder["can_verify_otp"] is True, "Finder can_verify_otp must be True when status is RETURN_PENDING!"
    assert rec_finder["can_mark_returned"] is False, "Finder can_mark_returned must be False for OTP!"
    print(f"[PASS] 2. User-selected OTP Recovery #{rec_id} verified: can_mark_returned=False, can_verify_otp=True (Finder), can_generate_otp=True (Claimant)")

    # CRITERION 1: Finder attempts direct mark returned on OTP recovery -> Blocked with HTTP 409
    fail_ret = client.post(f"/api/recoveries/{rec_id}/returned", json={
        "return_location": "Lab 3 Desk",
    }, headers=finder["headers"])
    assert fail_ret.status_code == 409, f"Expected 409 Conflict, got {fail_ret.status_code}"
    assert "requires OTP handover verification" in fail_ret.json()["detail"]
    print("[PASS] 3. Criterion 1: Finder blocked from direct return on OTP recovery (HTTP 409 Conflict)")

    # CRITERION 2: Claimant attempts confirm recovery before OTP verification -> Blocked with HTTP 409
    fail_conf = client.post(f"/api/recoveries/{rec_id}/confirm", headers=claimant["headers"])
    assert fail_conf.status_code == 409, f"Expected 409 Conflict, got {fail_conf.status_code}"
    assert "Handover OTP has not been verified" in fail_conf.json()["detail"]
    print("[PASS] 4. Criterion 2: Claimant blocked from finalizing unverified OTP recovery (HTTP 409 Conflict)")

    # -------------------------------------------------------------------------
    # CRITERION 3: Generated but unverified OTP does not count as verification
    # -------------------------------------------------------------------------
    gen_res = client.post(f"/api/recoveries/{rec_id}/otp/generate", headers=claimant["headers"])
    assert gen_res.status_code == 200
    otp_data = gen_res.json()
    otp_code = otp_data["otp"]
    assert len(otp_code) == 6

    # Verify that generating OTP sets has_active_otp in recovery response
    rec_after_gen = client.get(f"/api/recoveries/{rec_id}", headers=claimant["headers"]).json()
    assert rec_after_gen["has_active_otp"] is True
    assert rec_after_gen["status"] == "RETURN_PENDING"

    # Claimant tries to confirm while OTP is generated but NOT verified by finder
    fail_conf_gen = client.post(f"/api/recoveries/{rec_id}/confirm", headers=claimant["headers"])
    assert fail_conf_gen.status_code == 409
    assert "Handover OTP has not been verified" in fail_conf_gen.json()["detail"]
    print("[PASS] 5. Criterion 3: Generated but unverified OTP cannot be confirmed (HTTP 409 Conflict)")

    # -------------------------------------------------------------------------
    # CRITERION 4: Invalid and expired OTP enforcement & attempt limits
    # -------------------------------------------------------------------------
    # Invalid OTP attempt
    bad_otp_res = client.post(f"/api/recoveries/{rec_id}/verify-otp", json={
        "otp": "000000",
        "return_location": "Lab 3 Desk",
    }, headers=finder["headers"])
    assert bad_otp_res.status_code == 400
    assert "Invalid OTP code" in bad_otp_res.json()["detail"]
    assert "4 attempt(s) remaining" in bad_otp_res.json()["detail"]

    # Test expired OTP
    db = SessionLocal()
    rec_db = db.query(Recovery).filter(Recovery.id == rec_id).first()
    rec_db.otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()
    db.close()

    exp_res = client.post(f"/api/recoveries/{rec_id}/verify-otp", json={
        "otp": otp_code,
        "return_location": "Lab 3 Desk",
    }, headers=finder["headers"])
    assert exp_res.status_code == 400
    assert "OTP has expired" in exp_res.json()["detail"]
    print("[PASS] 6. Criterion 4: Invalid and expired OTPs strictly rejected (HTTP 400)")

    # Test attempt exhaustion
    # Regenerate OTP
    gen_res2 = client.post(f"/api/recoveries/{rec_id}/otp/generate", headers=claimant["headers"])
    assert gen_res2.status_code == 200
    otp_code2 = gen_res2.json()["otp"]

    for i in range(5):
        fail_att = client.post(f"/api/recoveries/{rec_id}/verify-otp", json={
            "otp": "111111",
            "return_location": "Lab 3 Desk",
        }, headers=finder["headers"])
        assert fail_att.status_code == 400

    # 6th attempt with correct OTP blocked due to attempt exhaustion
    exh_res = client.post(f"/api/recoveries/{rec_id}/verify-otp", json={
        "otp": otp_code2,
        "return_location": "Lab 3 Desk",
    }, headers=finder["headers"])
    assert exh_res.status_code == 400
    assert "Maximum OTP verification attempts exceeded" in exh_res.json()["detail"]
    print("[PASS] 7. Criterion 4: OTP attempt limits (5 max) strictly enforced (HTTP 400)")

    # -------------------------------------------------------------------------
    # CRITERION 5: Verified OTP transitions recovery to RETURNED
    # -------------------------------------------------------------------------
    # Claimant regenerates fresh OTP
    gen_fresh = client.post(f"/api/recoveries/{rec_id}/otp/generate", headers=claimant["headers"])
    assert gen_fresh.status_code == 200
    fresh_otp = gen_fresh.json()["otp"]

    # Finder verifies valid OTP
    ver_success = client.post(f"/api/recoveries/{rec_id}/verify-otp", json={
        "otp": fresh_otp,
        "return_location": "Student Union Ground Floor",
        "return_notes": "Claimant verified headphones powered on and connected.",
    }, headers=finder["headers"])
    assert ver_success.status_code == 200
    assert ver_success.json()["status"] == "RETURNED"
    assert ver_success.json()["otp_verified_at"] is not None
    print("[PASS] 8. Criterion 5: Valid OTP verified -> recovery transitioned to RETURNED with otp_verified_at timestamp")

    # -------------------------------------------------------------------------
    # CRITERION 6: OTP verification alone DOES NOT finalize recovery (remains RETURNED)
    # -------------------------------------------------------------------------
    rec_after_ver = client.get(f"/api/recoveries/{rec_id}", headers=claimant["headers"]).json()
    assert rec_after_ver["status"] == "RETURNED", "Recovery must NOT be RECOVERED yet!"
    found_after_ver = client.get(f"/api/found-items/{f_id}", headers=finder["headers"]).json()
    assert found_after_ver["status"] == "RETURNED", "FoundItem must NOT be RECOVERED yet!"
    print("[PASS] 9. Criterion 6: OTP verification marks RETURNED, does NOT prematurely finalize RECOVERED")

    # -------------------------------------------------------------------------
    # CRITERION 7: Claimant confirmation is still required (transitions to RECOVERED)
    # -------------------------------------------------------------------------
    conf_success = client.post(f"/api/recoveries/{rec_id}/confirm", headers=claimant["headers"])
    assert conf_success.status_code == 200
    assert conf_success.json()["status"] == "RECOVERED"
    assert conf_success.json()["confirmed_at"] is not None

    rec_terminal = client.get(f"/api/recoveries/{rec_id}", headers=claimant["headers"]).json()
    assert rec_terminal["status"] == "RECOVERED"
    print("[PASS] 10. Criterion 7: Claimant confirmed receipt -> recovery officially transitioned to RECOVERED")

    # -------------------------------------------------------------------------
    # CRITERION 8: Reviewer approval still enforced if required
    # -------------------------------------------------------------------------
    f_high_res = client.post("/api/found-items", json={
        "title": f"Gold Rolex Watch {uid}",
        "category": "Jewelry",
        "description": "18k gold oyster perpetual watch",
        "location": "Gym Lockers",
        "found_date": "2026-10-20",
    }, headers=finder["headers"])
    assert f_high_res.status_code == 201
    f_high_id = f_high_res.json()["id"]

    c_high_res = client.post(f"/api/found-items/{f_high_id}/claim", json={
        "verification_details": "Gold watch with serial engraved inside clasp.",
    }, headers=claimant["headers"])
    assert c_high_res.status_code == 201
    c_high_id = c_high_res.json()["id"]

    # Claim is automatically flagged high-risk
    c_high_data = c_high_res.json()
    assert c_high_data["is_mandatory_review"] is True
    assert c_high_data["review_status"] == "PENDING"
    assert c_high_data["handover_method"] == "OTP"

    # Finder direct approval blocked
    fail_finder_appr = client.put(f"/api/claims/{c_high_id}/review", json={
        "action": "APPROVE",
    }, headers=finder["headers"])
    assert fail_finder_appr.status_code == 400
    assert "requires Reviewer intervention" in fail_finder_appr.json()["detail"]

    # Staff reviewer approves
    staff_appr = client.put(f"/api/claims/{c_high_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Serial verified against police purchase registry.",
        "handover_method": "OTP",
    }, headers=staff["headers"])
    assert staff_appr.status_code == 200

    rec_high_res = client.get(f"/api/claims/{c_high_id}/recovery", headers=claimant["headers"])
    assert rec_high_res.status_code == 200
    rec_high_id = rec_high_res.json()["id"]
    print(f"[PASS] 11. Criterion 8: Mandatory reviewer approval strictly enforced for Recovery #{rec_high_id}")

    # -------------------------------------------------------------------------
    # CRITERION 9: Unresolved dispute blocks finalization
    # -------------------------------------------------------------------------
    # Claimant generates OTP and Finder verifies OTP
    gen_high_otp = client.post(f"/api/recoveries/{rec_high_id}/otp/generate", headers=claimant["headers"])
    assert gen_high_otp.status_code == 200
    high_otp = gen_high_otp.json()["otp"]

    ver_high = client.post(f"/api/recoveries/{rec_high_id}/verify-otp", json={
        "otp": high_otp,
        "return_location": "Campus Police Desk",
    }, headers=finder["headers"])
    assert ver_high.status_code == 200
    assert ver_high.json()["status"] == "RETURNED"

    # Claimant raises dispute before confirming
    disp_res = client.post(f"/api/recoveries/{rec_high_id}/dispute", json={
        "reason": "Watch crown seems loose and back cover shows scratches.",
    }, headers=claimant["headers"])
    assert disp_res.status_code == 200
    assert disp_res.json()["review_status"] == "DISPUTED"

    # Confirmation strictly blocked during DISPUTED state
    fail_disp_conf = client.post(f"/api/recoveries/{rec_high_id}/confirm", headers=claimant["headers"])
    assert fail_disp_conf.status_code == 400
    assert "Resolution required first" in fail_disp_conf.json()["detail"]

    # Staff resolves dispute
    res_disp = client.post(f"/api/admin/recoveries/{rec_high_id}/resolve-dispute", json={
        "decision": "RESOLVE",
        "resolution_notes": "Claimant accepted jeweler inspection condition.",
    }, headers=staff["headers"])
    assert res_disp.status_code == 200
    assert res_disp.json()["review_status"] == "APPROVED"

    # Confirmation now succeeds
    conf_disp_succ = client.post(f"/api/recoveries/{rec_high_id}/confirm", headers=claimant["headers"])
    assert conf_disp_succ.status_code == 200
    assert conf_disp_succ.json()["status"] == "RECOVERED"
    print("[PASS] 12. Criterion 9: Unresolved dispute blocks finalization until resolved by staff")

    # -------------------------------------------------------------------------
    # CRITERION 10: Direct handover continues to work without OTP
    # -------------------------------------------------------------------------
    f_dir_res = client.post("/api/found-items", json={
        "title": f"Umbrella {uid}",
        "category": "Accessories",
        "description": "Black compact folding umbrella",
        "location": "Cafeteria Entry",
        "found_date": "2026-10-20",
    }, headers=finder["headers"])
    assert f_dir_res.status_code == 201
    f_dir_id = f_dir_res.json()["id"]

    c_dir_res = client.post(f"/api/found-items/{f_dir_id}/claim", json={
        "verification_details": "Wooden curved handle with small scuff.",
    }, headers=claimant["headers"])
    assert c_dir_res.status_code == 201
    c_dir_id = c_dir_res.json()["id"]

    # Finder approves with DIRECT handover method
    client.put(f"/api/claims/{c_dir_id}/review", json={
        "action": "APPROVE",
        "handover_method": "DIRECT",
    }, headers=finder["headers"])

    rec_dir_res = client.get(f"/api/claims/{c_dir_id}/recovery", headers=claimant["headers"])
    rec_dir_id = rec_dir_res.json()["id"]
    assert rec_dir_res.json()["handover_method"] == "DIRECT"
    rec_dir_finder = client.get(f"/api/claims/{c_dir_id}/recovery", headers=finder["headers"]).json()
    assert rec_dir_finder["can_mark_returned"] is True

    # Finder marks returned directly
    dir_ret = client.post(f"/api/recoveries/{rec_dir_id}/returned", json={
        "return_location": "Cafeteria Lost and Found Desk",
        "return_notes": "Left behind counter.",
    }, headers=finder["headers"])
    assert dir_ret.status_code == 200
    assert dir_ret.json()["status"] == "RETURNED"

    # Claimant confirms directly
    dir_conf = client.post(f"/api/recoveries/{rec_dir_id}/confirm", headers=claimant["headers"])
    assert dir_conf.status_code == 200
    assert dir_conf.json()["status"] == "RECOVERED"
    print("[PASS] 13. Criterion 10: Routine DIRECT handover functions smoothly without OTP requirement")

    # -------------------------------------------------------------------------
    # CRITERION 11: Duplicate or out-of-order requests cannot bypass verification
    # -------------------------------------------------------------------------
    dup_conf = client.post(f"/api/recoveries/{rec_dir_id}/confirm", headers=claimant["headers"])
    assert dup_conf.status_code == 409
    assert "already been confirmed" in dup_conf.json()["detail"]

    dup_ret = client.post(f"/api/recoveries/{rec_dir_id}/returned", json={
        "return_location": "Cafeteria Desk",
    }, headers=finder["headers"])
    assert dup_ret.status_code == 409
    print("[PASS] 14. Criterion 11: Duplicate/out-of-order requests safely rejected (HTTP 409 Conflict)")

    # -------------------------------------------------------------------------
    # CRITERION 12: Both direct claims and match-based claims remain functional
    # -------------------------------------------------------------------------
    # Match-based claim flow with OTP
    l_match_res = client.post("/api/lost-items", json={
        "title": f"Scientific Calculator {uid}",
        "category": "Electronics",
        "description": "TI-84 Plus CE Silver Edition with sticker on back",
        "location": "Math Building Hall",
        "lost_date": "2026-10-20",
    }, headers=claimant["headers"])
    assert l_match_res.status_code == 201
    l_match_id = l_match_res.json()["id"]

    f_match_res = client.post("/api/found-items", json={
        "title": f"Graphing Calculator {uid}",
        "category": "Electronics",
        "description": "Silver Texas Instruments calculator",
        "location": "Math Building Hall Room 102",
        "found_date": "2026-10-20",
    }, headers=finder["headers"])
    assert f_match_res.status_code == 201
    f_match_id = f_match_res.json()["id"]

    # Lookup or create automated match
    db = SessionLocal()
    match_rec = db.query(Match).filter(Match.lost_item_id == l_match_id, Match.found_item_id == f_match_id).first()
    if not match_rec:
        match_rec = Match(
            lost_item_id=l_match_id,
            found_item_id=f_match_id,
            total_score=94,
            category_score=25,
            location_score=25,
            date_score=20,
            time_score=10,
            description_score=14,
            status="POSSIBLE",
        )
        db.add(match_rec)
        db.commit()
        db.refresh(match_rec)
    m_id = match_rec.id
    db.close()

    # Claimant claims via match
    c_match_res = client.post(f"/api/matches/{m_id}/claim", json={
        "verification_details": "Name sticker inside battery cover.",
    }, headers=claimant["headers"])
    assert c_match_res.status_code == 201
    c_match_id = c_match_res.json()["id"]

    # Finder approves with OTP
    client.put(f"/api/claims/{c_match_id}/review", json={
        "action": "APPROVE",
        "handover_method": "OTP",
    }, headers=finder["headers"])

    rec_m_res = client.get(f"/api/claims/{c_match_id}/recovery", headers=claimant["headers"])
    assert rec_m_res.status_code == 200
    rec_m_id = rec_m_res.json()["id"]
    assert rec_m_res.json()["match_id"] == m_id
    assert rec_m_res.json()["handover_method"] == "OTP"

    # Enforce OTP flow on match-based recovery
    fail_m_ret = client.post(f"/api/recoveries/{rec_m_id}/returned", json={
        "return_location": "Math Desk",
    }, headers=finder["headers"])
    assert fail_m_ret.status_code == 409

    gen_m_otp = client.post(f"/api/recoveries/{rec_m_id}/otp/generate", headers=claimant["headers"])
    assert gen_m_otp.status_code == 200
    m_otp = gen_m_otp.json()["otp"]

    ver_m = client.post(f"/api/recoveries/{rec_m_id}/verify-otp", json={
        "otp": m_otp,
        "return_location": "Math Building Office",
    }, headers=finder["headers"])
    assert ver_m.status_code == 200
    assert ver_m.json()["status"] == "RETURNED"

    conf_m = client.post(f"/api/recoveries/{rec_m_id}/confirm", headers=claimant["headers"])
    assert conf_m.status_code == 200
    assert conf_m.json()["status"] == "RECOVERED"

    # Terminal state check on lost item & found item
    lost_check = client.get(f"/api/lost-items/{l_match_id}", headers=claimant["headers"]).json()
    assert lost_check["status"] == "RECOVERED"
    found_check = client.get(f"/api/found-items/{f_match_id}", headers=finder["headers"]).json()
    assert found_check["status"] == "RETURNED"

    print("[PASS] 15. Criterion 12: Match-based claim with OTP handover completed lifecycle successfully")

    print("\n" + "=" * 75)
    print("   ALL 15 OTP ENFORCEMENT & REGRESSION TESTS PASSED!   ")
    print("=" * 75)


if __name__ == "__main__":
    init_db()
    run_otp_enforcement_tests()
