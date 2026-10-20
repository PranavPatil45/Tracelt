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
from app.models.notification import Notification

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


def run_otp_permissions_and_generation_tests():
    print("=" * 80)
    print("   TASK 3.1: OTP HANDOVER PERMISSIONS, SELECTION & GENERATION TESTS   ")
    print("=" * 80)

    uid = uuid.uuid4().hex[:6]
    alice = create_user_token(f"alice_p_{uid}@test.com", "Alice Claimant")
    bob = create_user_token(f"bob_p_{uid}@test.com", "Bob Finder")
    staff = create_user_token(f"staff_p_{uid}@test.com", "Staff Reviewer", role="reviewer")
    intruder = create_user_token(f"intruder_p_{uid}@test.com", "Intruder User")

    print("[PASS] 1. Test users created (Claimant Alice, Finder Bob, Staff Reviewer, Intruder)")

    # -------------------------------------------------------------------------
    # SUITE 1: CLAIMANT AND FINDER CAN REQUEST OTP VERIFICATION (Criteria 1 & 2)
    # -------------------------------------------------------------------------
    # Create routine found item
    f1_res = client.post("/api/found-items", json={
        "title": f"Silver Bicycle Key {uid}",
        "category": "Keys",
        "description": "Single key with green rubber ring",
        "location": "Bicycle Racks East",
        "found_date": "2026-10-20",
    }, headers=bob["headers"])
    assert f1_res.status_code == 201
    f1_id = f1_res.json()["id"]

    # 1.1 Claimant Alice submits claim specifying preferred_handover_method = "OTP"
    c1_res = client.post(f"/api/found-items/{f1_id}/claim", json={
        "verification_details": "Has Master Lock stamped and tiny notch on edge.",
        "preferred_handover_method": "OTP",
    }, headers=alice["headers"])
    assert c1_res.status_code == 201
    c1_id = c1_res.json()["id"]
    assert c1_res.json()["handover_method"] == "OTP"
    print(f"[PASS] 2. Criterion 1: Claimant Alice requested OTP at claim submission (#{c1_id})")

    # 1.2 Criterion 4 & 5: Finder attempts to approve with "DIRECT" -> Backend refuses to downgrade!
    appr_c1 = client.put(f"/api/claims/{c1_id}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Key ring verified.",
        "handover_method": "DIRECT",  # Attempted downgrade
    }, headers=bob["headers"])
    assert appr_c1.status_code == 200
    assert appr_c1.json()["handover_method"] == "OTP", "Backend must NOT downgrade claimant's OTP selection!"
    print("[PASS] 3. Criterion 4 & 5: Finder cannot silently downgrade claimant-requested OTP to DIRECT")

    rec1_res = client.get(f"/api/claims/{c1_id}/recovery", headers=alice["headers"])
    assert rec1_res.status_code == 200
    rec1 = rec1_res.json()
    rec1_id = rec1["id"]
    assert rec1["handover_method"] == "OTP"
    print(f"[PASS] 4. Recovery #{rec1_id} created with handover_method=OTP")

    # -------------------------------------------------------------------------
    # SUITE 2: UPGRADE DIRECT RECOVERY TO OTP ON SERVER (Criteria 1, 2, 3)
    # -------------------------------------------------------------------------
    # Create second routine item with DIRECT handover
    f2_res = client.post("/api/found-items", json={
        "title": f"Winter Scarf {uid}",
        "category": "Clothing",
        "description": "Wool plaid scarf",
        "location": "Student Lounge",
        "found_date": "2026-10-20",
    }, headers=bob["headers"])
    f2_id = f2_res.json()["id"]

    c2_res = client.post(f"/api/found-items/{f2_id}/claim", json={
        "verification_details": "Green and navy blue plaid with fringe.",
    }, headers=alice["headers"])
    c2_id = c2_res.json()["id"]

    # Finder approves with DIRECT
    client.put(f"/api/claims/{c2_id}/review", json={
        "action": "APPROVE",
        "handover_method": "DIRECT",
    }, headers=bob["headers"])

    rec2_res = client.get(f"/api/claims/{c2_id}/recovery", headers=alice["headers"])
    rec2_id = rec2_res.json()["id"]
    assert rec2_res.json()["handover_method"] == "DIRECT"
    assert rec2_res.json()["can_request_otp"] is True

    # 2.1 Criterion 3: Unauthorized intruder cannot change handover method -> 403 Forbidden
    fail_int_req = client.post(f"/api/recoveries/{rec2_id}/request-otp", headers=intruder["headers"])
    assert fail_int_req.status_code == 403
    print("[PASS] 5. Criterion 3: Unauthorized intruder blocked from requesting OTP (403 Forbidden)")

    # 2.2 Criterion 2: Finder Bob requests OTP verification for Recovery #rec2_id
    req_otp_res = client.post(f"/api/recoveries/{rec2_id}/request-otp", headers=bob["headers"])
    assert req_otp_res.status_code == 200
    rec2_updated = req_otp_res.json()
    assert rec2_updated["handover_method"] == "OTP"
    assert rec2_updated["can_request_otp"] is False, "Once OTP is active, can_request_otp must be False"
    print(f"[PASS] 6. Criterion 2: Finder Bob successfully upgraded Recovery #{rec2_id} to OTP handover")

    # Verify notification dispatched to Claimant Alice
    db = SessionLocal()
    notif_alice = db.query(Notification).filter(
        Notification.user_id == alice["user"]["id"],
        Notification.type == "OTP_REQUESTED",
        Notification.related_entity_id == rec2_id,
    ).first()
    assert notif_alice is not None
    assert "Finder" in notif_alice.message
    db.close()
    print("[PASS] 7. Notification successfully dispatched to Claimant regarding OTP request")

    # -------------------------------------------------------------------------
    # SUITE 3: OTP GENERATION, PLAINTEXT PRIVACY & FINDER VERIFY GUARDS (Criteria 6, 7, 8)
    # -------------------------------------------------------------------------
    # 3.1 Criterion 8: Finder Bob opens Verify modal when NO active OTP exists -> Blocked (400 Bad Request)
    fail_no_otp = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": "123456",
        "return_location": "Student Lounge Desk",
    }, headers=bob["headers"])
    assert fail_no_otp.status_code == 400
    assert "Claimant must generate a handover OTP first" in fail_no_otp.json()["detail"]
    print("[PASS] 8. Criterion 8: Finder cannot verify when no active OTP exists (400 Bad Request)")

    # 3.2 Criterion 7: Finder Bob CANNOT retrieve plaintext OTP or generate OTP on Claimant's behalf
    fail_finder_gen = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=bob["headers"])
    assert fail_finder_gen.status_code == 403
    print("[PASS] 9. Criterion 7: Finder strictly blocked from generating OTP (403 Forbidden)")

    # 3.3 Criterion 6: Claimant Alice generates OTP
    gen_res = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=alice["headers"])
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    otp_code_1 = gen_data["otp"]
    assert len(otp_code_1) == 6
    assert otp_code_1.isdigit()
    assert gen_data["is_active"] is True
    print(f"[PASS] 10. Criterion 6: Claimant Alice generated and received 6-digit OTP ({otp_code_1})")

    # 3.4 Criterion 7: Verify Finder GET /api/recoveries/{id} NEVER exposes plaintext OTP
    rec2_finder_view = client.get(f"/api/recoveries/{rec2_id}", headers=bob["headers"]).json()
    assert rec2_finder_view["has_active_otp"] is True
    assert "otp" not in rec2_finder_view
    assert "otp_hash" not in rec2_finder_view

    # Verify Finder notification for OTP_READY does NOT contain plaintext OTP
    db = SessionLocal()
    notif_ready = db.query(Notification).filter(
        Notification.user_id == bob["user"]["id"],
        Notification.type == "OTP_READY",
        Notification.related_entity_id == rec2_id,
    ).first()
    assert notif_ready is not None
    assert otp_code_1 not in notif_ready.message
    db.close()
    print("[PASS] 11. Criterion 7: Confirmed plaintext OTP is never exposed in Finder API response or notification")

    # -------------------------------------------------------------------------
    # SUITE 4: REGENERATION INVALIDATES PREVIOUS OTP (Criterion 11)
    # -------------------------------------------------------------------------
    gen_res2 = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=alice["headers"])
    assert gen_res2.status_code == 200
    otp_code_2 = gen_res2.json()["otp"]
    assert otp_code_2 != otp_code_1

    # Finder tries submitting old otp_code_1 -> Rejected
    old_otp_try = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": otp_code_1,
        "return_location": "Student Lounge",
    }, headers=bob["headers"])
    assert old_otp_try.status_code == 400
    assert "Invalid OTP code" in old_otp_try.json()["detail"]
    print("[PASS] 12. Criterion 11: Regeneration invalidated previous OTP (old code rejected)")

    # -------------------------------------------------------------------------
    # SUITE 5: INVALID, EXPIRED & ATTEMPT LIMITS ENFORCEMENT (Criteria 10 & 12)
    # -------------------------------------------------------------------------
    # Test remaining attempts decrement
    bad_attempt = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": "999999",
        "return_location": "Student Lounge",
    }, headers=bob["headers"])
    assert bad_attempt.status_code == 400
    assert "3 attempt(s) remaining" in bad_attempt.json()["detail"]

    # Test expired OTP
    db = SessionLocal()
    rec_db = db.query(Recovery).filter(Recovery.id == rec2_id).first()
    rec_db.otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()
    db.close()

    exp_res = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": otp_code_2,
        "return_location": "Student Lounge",
    }, headers=bob["headers"])
    assert exp_res.status_code == 400
    assert "OTP has expired" in exp_res.json()["detail"]
    print("[PASS] 13. Criterion 10: Expired OTP rejected with 400 Bad Request")

    # Verify notification dispatched to Claimant that code expired
    db = SessionLocal()
    notif_exp = db.query(Notification).filter(
        Notification.user_id == alice["user"]["id"],
        Notification.type == "OTP_EXPIRED",
        Notification.related_entity_id == rec2_id,
    ).first()
    assert notif_exp is not None
    db.close()
    print("[PASS] 14. Notification dispatched to Claimant when OTP expiration was triggered")

    # Test attempt limits (5 max)
    # Regenerate fresh OTP
    gen_res3 = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=alice["headers"])
    otp_code_3 = gen_res3.json()["otp"]

    for i in range(5):
        fail_i = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
            "otp": "000000",
            "return_location": "Student Lounge",
        }, headers=bob["headers"])
        assert fail_i.status_code == 400

    # 6th attempt with correct OTP blocked
    exh_res = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": otp_code_3,
        "return_location": "Student Lounge",
    }, headers=bob["headers"])
    assert exh_res.status_code == 400
    assert "Maximum OTP verification attempts exceeded" in exh_res.json()["detail"]
    print("[PASS] 15. Criterion 12: 5 failed attempts locks OTP until regenerated")

    # -------------------------------------------------------------------------
    # SUITE 6: VALID OTP VERIFICATION AND LIFECYCLE INVARIANTS (Criteria 9, 10, 13)
    # -------------------------------------------------------------------------
    # Claimant generates fresh valid OTP
    gen_res4 = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=alice["headers"])
    valid_otp = gen_res4.json()["otp"]

    # Finder verifies valid OTP
    ver_succ = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": valid_otp,
        "return_location": "Student Lounge Desk 2",
        "return_notes": "Scarf inspected and verified by owner.",
    }, headers=bob["headers"])
    assert ver_succ.status_code == 200
    assert ver_succ.json()["status"] == "RETURNED"
    assert ver_succ.json()["otp_verified_at"] is not None
    print("[PASS] 16. Criterion 9: Valid OTP verified -> status transitioned to RETURNED with otp_verified_at")

    # 6.1 Criterion 10: Reusing validated OTP is rejected (single use)
    reuse_try = client.post(f"/api/recoveries/{rec2_id}/verify-otp", json={
        "otp": valid_otp,
        "return_location": "Student Lounge Desk 2",
    }, headers=bob["headers"])
    assert reuse_try.status_code in (400, 409)
    print("[PASS] 17. Criterion 10: Reused OTP rejected (single-use enforced)")

    # 6.2 Criterion 13: OTP verification alone does NOT finalize recovery
    rec_check = client.get(f"/api/recoveries/{rec2_id}", headers=alice["headers"]).json()
    assert rec_check["status"] == "RETURNED"
    print("[PASS] 18. Criterion 13: OTP verification alone does NOT mark RECOVERED")

    # 6.3 Claimant confirms recovery -> Officially finalized
    conf_succ = client.post(f"/api/recoveries/{rec2_id}/confirm", headers=alice["headers"])
    assert conf_succ.status_code == 200
    assert conf_succ.json()["status"] == "RECOVERED"
    print("[PASS] 19. Criterion 13: Claimant confirmed receipt -> finalized to RECOVERED")

    # -------------------------------------------------------------------------
    # SUITE 7: MANDATORY REVIEWER APPROVAL STILL ENFORCED (Criterion 14)
    # -------------------------------------------------------------------------
    f_high = client.post("/api/found-items", json={
        "title": f"Trezor Hardware Crypto Wallet {uid}",
        "category": "High-Risk",
        "description": "Black hardware wallet model T",
        "location": "Computer Science Lab",
        "found_date": "2026-10-20",
    }, headers=bob["headers"]).json()

    c_high = client.post(f"/api/found-items/{f_high['id']}/claim", json={
        "verification_details": "Includes recovery card in black leather sleeve.",
    }, headers=alice["headers"]).json()
    assert c_high["is_mandatory_review"] is True
    assert c_high["is_mandatory_otp"] is True
    assert c_high["review_status"] == "PENDING"

    # Finder cannot approve directly
    fail_f_appr = client.put(f"/api/claims/{c_high['id']}/review", json={
        "action": "APPROVE",
    }, headers=bob["headers"])
    assert fail_f_appr.status_code == 400

    # Reviewer approves
    staff_appr = client.put(f"/api/claims/{c_high['id']}/review", json={
        "action": "APPROVE",
        "reviewer_notes": "Serial verified with manufacturer purchase order.",
        "handover_method": "OTP",
    }, headers=staff["headers"])
    assert staff_appr.status_code == 200

    rec_high = client.get(f"/api/claims/{c_high['id']}/recovery", headers=alice["headers"]).json()
    assert rec_high["is_mandatory_otp"] is True
    assert rec_high["handover_method"] == "OTP"
    print("[PASS] 20. Criterion 14: Mandatory Reviewer approval strictly required before handover")

    # -------------------------------------------------------------------------
    # SUITE 8: DIRECT HANDOVER REMAINS FUNCTIONAL (Criterion 15)
    # -------------------------------------------------------------------------
    f_dir = client.post("/api/found-items", json={
        "title": f"Water Bottle {uid}",
        "category": "Personal Items",
        "description": "Green hydroflask",
        "location": "Gym",
        "found_date": "2026-10-20",
    }, headers=bob["headers"]).json()

    c_dir = client.post(f"/api/found-items/{f_dir['id']}/claim", json={
        "verification_details": "Dent on bottom base with national parks stickers.",
    }, headers=alice["headers"]).json()

    client.put(f"/api/claims/{c_dir['id']}/review", json={
        "action": "APPROVE",
        "handover_method": "DIRECT",
    }, headers=bob["headers"])

    rec_dir = client.get(f"/api/claims/{c_dir['id']}/recovery", headers=alice["headers"]).json()
    assert rec_dir["handover_method"] == "DIRECT"

    # Direct return works smoothly
    ret_dir = client.post(f"/api/recoveries/{rec_dir['id']}/returned", json={
        "return_location": "Gym Lost and Found",
    }, headers=bob["headers"])
    assert ret_dir.status_code == 200
    assert ret_dir.json()["status"] == "RETURNED"

    conf_dir = client.post(f"/api/recoveries/{rec_dir['id']}/confirm", headers=alice["headers"])
    assert conf_dir.status_code == 200
    assert conf_dir.json()["status"] == "RECOVERED"
    print("[PASS] 21. Criterion 15: Direct handover flow completed successfully without OTP")

    # -------------------------------------------------------------------------
    # SUITE 9: DUPLICATE / OUT-OF-ORDER PROTECTION (Criterion 16)
    # -------------------------------------------------------------------------
    dup_conf_call = client.post(f"/api/recoveries/{rec_dir['id']}/confirm", headers=alice["headers"])
    assert dup_conf_call.status_code == 409
    dup_ret_call = client.post(f"/api/recoveries/{rec_dir['id']}/returned", json={
        "return_location": "Gym Lost and Found",
    }, headers=bob["headers"])
    assert dup_ret_call.status_code == 409
    print("[PASS] 22. Criterion 16: Duplicate confirmation and return calls safely rejected (409 Conflict)")

    print("\n" + "=" * 80)
    print("   ALL 22 TASK 3.1 OTP PERMISSIONS & GENERATION TESTS PASSED!   ")
    print("=" * 80)


if __name__ == "__main__":
    init_db()
    run_otp_permissions_and_generation_tests()
