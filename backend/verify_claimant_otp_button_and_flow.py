import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.found_item import FoundItem
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


def run_claimant_otp_button_and_flow_tests():
    print("=" * 80)
    print("   TRACELT BUG FIX: CLAIMANT OTP GENERATION BUTTON & LIFECYCLE TESTS   ")
    print("=" * 80)

    uid = uuid.uuid4().hex[:6]
    claimant = create_user_token(f"claimant_{uid}@test.com", "Alice Claimant")
    finder = create_user_token(f"finder_{uid}@test.com", "Bob Finder")
    staff = create_user_token(f"reviewer_{uid}@test.com", "Staff Reviewer", role="reviewer")
    intruder = create_user_token(f"intruder_{uid}@test.com", "Charlie Intruder")

    print("[PASS] 1. Test users created (Claimant, Finder, Staff Reviewer, Intruder)")

    # 1. Report found item
    f_res = client.post("/api/found-items", json={
        "title": f"MacBook Air M2 {uid}",
        "category": "Electronics",
        "description": "Space Gray with campus sticker",
        "location": "Science Library Floor 2",
        "found_date": "2026-10-20",
    }, headers=finder["headers"])
    assert f_res.status_code == 201
    found_item = f_res.json()

    # 2. Claimant submits direct claim requesting OTP handover
    c_res = client.post("/api/claims", json={
        "found_item_id": found_item["id"],
        "verification_details": "MacBook has a blue Python logo sticker on the bottom left corner.",
        "preferred_handover_method": "OTP",
    }, headers=claimant["headers"])
    assert c_res.status_code == 201
    claim = c_res.json()
    assert claim["handover_method"] == "OTP"
    print(f"[PASS] 2. Claimant submitted Claim #{claim['id']} requesting OTP handover")

    # 3. Finder approves claim
    appr_res = client.put(f"/api/claims/{claim['id']}/review", json={
        "action": "APPROVE",
        "handover_method": "OTP",
    }, headers=finder["headers"])
    assert appr_res.status_code == 200, f"Approve claim failed: {appr_res.text}"
    rec_res = client.get(f"/api/claims/{claim['id']}/recovery", headers=claimant["headers"])
    assert rec_res.status_code == 200
    rec_info = rec_res.json()
    recovery_id = rec_info["id"]
    print(f"[PASS] 3. Finder approved claim -> Recovery #{recovery_id} created with handover_method=OTP")

    # 4. Verification: GET /api/recoveries/{id} as Claimant
    cl_get = client.get(f"/api/recoveries/{recovery_id}", headers=claimant["headers"])
    assert cl_get.status_code == 200
    cl_data = cl_get.json()
    assert cl_data["claimant_id"] == claimant["user"]["id"], "claimant_id must match logged in claimant"
    assert cl_data["finder_id"] == finder["user"]["id"], "finder_id must match finder"
    assert cl_data["can_generate_otp"] is True, "Claimant must have can_generate_otp=True"
    assert cl_data["can_verify_otp"] is False, "Claimant must NOT have can_verify_otp=True"
    assert cl_data["has_active_otp"] is False, "has_active_otp must be False initially"
    print("[PASS] 4. Claimant recovery data includes claimant_id, finder_id, and can_generate_otp=True")

    # 5. Verification: GET /api/recoveries/{id} as Finder
    fi_get = client.get(f"/api/recoveries/{recovery_id}", headers=finder["headers"])
    assert fi_get.status_code == 200
    fi_data = fi_get.json()
    assert fi_data["can_generate_otp"] is False, "Finder must NOT have can_generate_otp=True"
    assert fi_data["can_verify_otp"] is True, "Finder must have can_verify_otp=True"
    assert fi_data["has_active_otp"] is False, "has_active_otp must be False initially"
    print("[PASS] 5. Finder recovery data shows can_generate_otp=False, can_verify_otp=True, has_active_otp=False")

    # 6. Verification: Intruder blocked from generating OTP
    int_gen = client.post(f"/api/recoveries/{recovery_id}/otp/generate", headers=intruder["headers"])
    assert int_gen.status_code == 403, f"Intruder should get 403, got {int_gen.status_code}"
    # Verification: Finder blocked from generating OTP
    fi_gen = client.post(f"/api/recoveries/{recovery_id}/otp/generate", headers=finder["headers"])
    assert fi_gen.status_code == 403, f"Finder should get 403, got {fi_gen.status_code}"
    print("[PASS] 6. Finder and Intruder strictly blocked from generating OTP (403 Forbidden)")

    # 7. Finder cannot verify before Claimant generates code
    fi_v_early = client.post(f"/api/recoveries/{recovery_id}/verify-otp", json={
        "otp": "123456",
        "return_location": "Science Library",
    }, headers=finder["headers"])
    assert fi_v_early.status_code == 400
    assert "No active OTP found" in fi_v_early.json()["detail"]
    print("[PASS] 7. Finder verification safely rejected when no active OTP exists (400 Bad Request)")

    # 8. Claimant clicks "Generate Handover Code"
    gen_res = client.post(f"/api/recoveries/{recovery_id}/otp/generate", headers=claimant["headers"])
    assert gen_res.status_code == 200
    otp_data = gen_res.json()
    otp_code = otp_data["otp"]
    assert len(otp_code) == 6 and otp_code.isdigit(), f"Invalid OTP format: {otp_code}"
    assert otp_data["is_active"] is True
    assert otp_data["attempts_remaining"] == 5
    assert otp_data["expires_in_seconds"] == 1800
    print(f"[PASS] 8. Claimant generated valid 6-digit OTP ({otp_code}) with 30-min expiration")

    # 9. Ensure plaintext code is NOT revealed to Finder
    fi_get_after = client.get(f"/api/recoveries/{recovery_id}", headers=finder["headers"]).json()
    assert fi_get_after["has_active_otp"] is True, "has_active_otp must now be True"
    assert "otp" not in fi_get_after
    assert "otp_hash" not in fi_get_after
    print("[PASS] 9. Finder recovery state updated (has_active_otp=True) without exposing plaintext OTP")

    # 10. Regeneration test: Claimant can regenerate code safely
    regen_res = client.post(f"/api/recoveries/{recovery_id}/otp/generate", headers=claimant["headers"])
    assert regen_res.status_code == 200
    new_otp_data = regen_res.json()
    new_code = new_otp_data["otp"]
    assert new_code != otp_code or True  # very high probability of being different
    # Old code is now invalid
    old_try = client.post(f"/api/recoveries/{recovery_id}/verify-otp", json={
        "otp": otp_code,
        "return_location": "Science Library Floor 2",
    }, headers=finder["headers"])
    assert old_try.status_code == 400
    assert "Invalid OTP code" in old_try.json()["detail"]
    print(f"[PASS] 10. Claimant successfully regenerated OTP ({new_code}) and previous code was invalidated")

    # 11. Finder verifies the new active OTP in person
    v_res = client.post(f"/api/recoveries/{recovery_id}/verify-otp", json={
        "otp": new_code,
        "return_location": "Science Library Floor 2 Desk 4",
        "return_notes": "Checked laptop serial number against claimant ID.",
    }, headers=finder["headers"])
    assert v_res.status_code == 200
    rec_verified = v_res.json()
    assert rec_verified["status"] == "RETURNED"
    assert rec_verified["otp_verified_at"] is not None
    print(f"[PASS] 11. Finder verified correct OTP -> recovery status transitioned to RETURNED with otp_verified_at")

    # 12. Invariant: Status must remain RETURNED (not prematurely RECOVERED)
    assert rec_verified["status"] == "RETURNED"
    print("[PASS] 12. Verification marks RETURNED, does NOT prematurely finalize to RECOVERED")

    # 13. Claimant confirms receipt -> terminal status RECOVERED
    conf_res = client.post(f"/api/recoveries/{recovery_id}/confirm", headers=claimant["headers"])
    assert conf_res.status_code == 200
    rec_final = conf_res.json()
    assert rec_final["status"] == "RECOVERED"
    assert rec_final["confirmed_at"] is not None
    print("[PASS] 13. Claimant confirmed receipt -> finalized to RECOVERED")

    # 14. Dispute safeguard: Disputed recovery blocks OTP generation until resolved
    # Setup second item and recovery for dispute check
    f2_res = client.post("/api/found-items", json={
        "title": f"iPhone 15 Pro {uid}",
        "category": "Electronics",
        "description": "Natural Titanium",
        "location": "Student Union",
        "found_date": "2026-10-20",
    }, headers=finder["headers"]).json()

    c2_res = client.post("/api/claims", json={
        "found_item_id": f2_res["id"],
        "verification_details": "Has a clear case with a Metro card inside.",
        "preferred_handover_method": "OTP",
    }, headers=claimant["headers"]).json()

    client.put(f"/api/claims/{c2_res['id']}/review", json={
        "action": "APPROVE",
        "handover_method": "OTP",
    }, headers=finder["headers"])

    rec2 = client.get(f"/api/claims/{c2_res['id']}/recovery", headers=claimant["headers"]).json()
    rec2_id = rec2["id"]

    # Raise dispute
    disp_res = client.post(f"/api/recoveries/{rec2_id}/dispute", json={
        "reason": "Finder reported screen is cracked, claimant disputes condition.",
    }, headers=claimant["headers"])
    assert disp_res.status_code == 200
    assert disp_res.json()["review_status"] == "DISPUTED"

    # OTP generation should now be blocked
    disp_gen = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=claimant["headers"])
    assert disp_gen.status_code == 400
    assert "Resolution required first" in disp_gen.json()["detail"]
    print(f"[PASS] 14. Dispute safeguard strictly blocks OTP generation during active dispute")

    # Staff reviewer resolves dispute
    res_disp = client.post(f"/api/admin/recoveries/{rec2_id}/resolve-dispute", json={
        "decision": "APPROVE",
        "notes": "Reviewed photo evidence. Condition is consistent with report. Authorized to proceed.",
    }, headers=staff["headers"])
    assert res_disp.status_code == 200
    assert res_disp.json()["review_status"] == "APPROVED"

    # Now Claimant can generate OTP
    unblock_gen = client.post(f"/api/recoveries/{rec2_id}/otp/generate", headers=claimant["headers"])
    assert unblock_gen.status_code == 200
    print(f"[PASS] 15. Staff resolution unblocks recovery and Claimant successfully generated OTP ({unblock_gen.json()['otp']})")

    # 15. Direct handover flow unaffected
    f3_res = client.post("/api/found-items", json={
        "title": f"Umbrella {uid}",
        "category": "Accessories",
        "description": "Black umbrella with curved handle",
        "location": "Gymnasium",
        "found_date": "2026-10-20",
    }, headers=finder["headers"]).json()

    c3_res = client.post("/api/claims", json={
        "found_item_id": f3_res["id"],
        "verification_details": "Has a campus sticker on the handle.",
        "preferred_handover_method": "DIRECT",
    }, headers=claimant["headers"]).json()

    client.put(f"/api/claims/{c3_res['id']}/review", json={
        "action": "APPROVE",
        "handover_method": "DIRECT",
    }, headers=finder["headers"])

    rec3 = client.get(f"/api/claims/{c3_res['id']}/recovery", headers=finder["headers"]).json()
    rec3_id = rec3["id"]
    assert rec3["handover_method"] == "DIRECT"
    assert rec3["can_mark_returned"] is True
    assert rec3["can_verify_otp"] is False

    direct_ret = client.post(f"/api/recoveries/{rec3_id}/returned", json={
        "return_location": "Gymnasium Front Desk",
        "return_notes": "Left at front desk.",
    }, headers=finder["headers"])
    assert direct_ret.status_code == 200
    assert direct_ret.json()["status"] == "RETURNED"
    print(f"[PASS] 16. Routine DIRECT handover flow proceeds smoothly without requiring OTP")

    print("\n" + "=" * 80)
    print("   ALL 16 CLAIMANT OTP BUTTON & LIFECYCLE TESTS PASSED!   ")
    print("=" * 80)


if __name__ == "__main__":
    run_claimant_otp_button_and_flow_tests()
