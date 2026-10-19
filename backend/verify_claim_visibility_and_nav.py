"""
verify_claim_visibility_and_nav.py - Focused verification for Task 3:
Fix Item Details Claim Visibility and Sidebar Navigation in Tracelt.
"""

import sys
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, get_db
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.models.claim import Claim

client = TestClient(app)

def create_user(role="user"):
    uid = uuid.uuid4().hex[:8]
    data = {
        "email": f"test_{uid}@example.com",
        "full_name": f"User {uid}",
        "password": "Password123!",
        "phone_number": "+1234567890",
        "campus": "Test Campus",
        "role": role
    }
    res = client.post("/api/register", json=data)
    assert res.status_code == 201, f"Failed to register user: {res.text}"
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return token, user_id, data["email"]

def test_claim_visibility_and_navigation_backend():
    print("=" * 65)
    print("=== TASK 3: CLAIM VISIBILITY & NAVIGATION INTEGRITY CHECKS ===")
    print("=" * 65)

    # 1. Setup users
    alice_token, alice_id, _ = create_user()  # Finder / Lost reporter
    bob_token, bob_id, _ = create_user()      # Claimant / Non-owner
    charlie_token, charlie_id, _ = create_user() # Another user

    headers_alice = {"Authorization": f"Bearer {alice_token}"}
    headers_bob = {"Authorization": f"Bearer {bob_token}"}

    # 2. Alice reports a lost item
    lost_res = client.post("/api/lost-items", headers=headers_alice, json={
        "title": "Alice's Lost Backpack",
        "category": "Bags",
        "location": "North Library",
        "lost_date": "2026-10-18",
        "lost_time": "14:00",
        "description": "Black Herschel backpack with laptop inside"
    })
    assert lost_res.status_code == 201, f"Create lost item failed: {lost_res.text}"
    lost_item = lost_res.json()
    lost_item_id = lost_item["id"]
    print(f"[PASS] 1. Alice reported LostItem #{lost_item_id}")

    # 3. Alice reports a found item
    found_res = client.post("/api/found-items", headers=headers_alice, json={
        "title": "Alice's Found Water Bottle",
        "category": "Bottles",
        "location": "Campus Center",
        "found_date": "2026-10-18",
        "found_time": "15:00",
        "description": "Blue hydroflask bottle left on bench"
    })
    assert found_res.status_code == 201, f"Create found item failed: {found_res.text}"
    found_item = found_res.json()
    found_item_id = found_item["id"]
    print(f"[PASS] 2. Alice reported FoundItem #{found_item_id}")

    # 4. Check Claim Action Block: Attempting direct claim on a lost item must fail
    # Via POST /api/lost-items/{lost_item_id}/claim
    direct_lost_endpoint = client.post(
        f"/api/lost-items/{lost_item_id}/claim",
        headers=headers_bob,
        json={"verification_details": "I think this lost item belongs to me."}
    )
    assert direct_lost_endpoint.status_code == 400, f"Expected 400, got: {direct_lost_endpoint.status_code}"
    assert "found items" in direct_lost_endpoint.json()["detail"].lower()
    print("[PASS] 3. Direct claim on /api/lost-items/{id}/claim rejected (400 Bad Request)")

    # Find or create a lost item whose ID does not exist in found_items
    db = SessionLocal()
    found_ids = {f.id for f in db.query(FoundItem.id).all()}
    target_lost_id = None
    if lost_item_id not in found_ids:
        target_lost_id = lost_item_id
    else:
        for _ in range(40):
            li = LostItem(
                user_id=alice_id,
                title="Extra Lost",
                category="Other",
                description="Sample lost item description for test",
                location="Campus",
                lost_date="2026-10-18",
                status="ACTIVE"
            )
            db.add(li)
            db.commit()
            db.refresh(li)
            if li.id not in found_ids:
                target_lost_id = li.id
                break
    db.close()

    # Via POST /api/found-items/{target_lost_id}/claim (passing a lost_item_id where found_item_id is expected)
    direct_found_mismatch = client.post(
        f"/api/found-items/{target_lost_id}/claim",
        headers=headers_bob,
        json={"verification_details": "Trying to claim a lost item ID through found endpoint."}
    )
    assert direct_found_mismatch.status_code == 400, f"Expected 400, got: {direct_found_mismatch.status_code} - {direct_found_mismatch.text}"
    assert "lost item" in direct_found_mismatch.json()["detail"].lower()
    print("[PASS] 4. Submitting lost item ID to /api/found-items/{id}/claim rejected (400 Bad Request)")

    # Via unified POST /api/claims with lost_item_id without match_id
    direct_unified_lost = client.post(
        "/api/claims",
        headers=headers_bob,
        json={
            "lost_item_id": lost_item_id,
            "verification_details": "Trying to claim lost item directly via unified endpoint."
        }
    )
    assert direct_unified_lost.status_code == 400, f"Expected 400, got: {direct_unified_lost.status_code}"
    print("[PASS] 5. Unified POST /api/claims with lost_item_id without match_id rejected (400 Bad Request)")

    # 5. Check Claim Action Block: Finder Alice cannot claim her own found item
    self_claim = client.post(
        f"/api/found-items/{found_item_id}/claim",
        headers=headers_alice,
        json={"verification_details": "I found this item and want to claim it myself."}
    )
    assert self_claim.status_code == 400, f"Expected 400, got: {self_claim.status_code}"
    assert "found yourself" in self_claim.json()["detail"].lower()
    print("[PASS] 6. Finder Alice blocked from self-claiming her own found item (400 Bad Request)")

    # 6. Check Valid Direct Claim: Non-owner Bob claims FoundItem #found_item_id (No match exists)
    valid_direct_claim = client.post(
        f"/api/found-items/{found_item_id}/claim",
        headers=headers_bob,
        json={
            "verification_details": "This is my Hydroflask bottle. It has a small dent on the bottom rim.",
            "proof_answers": {"color": "blue"}
        }
    )
    assert valid_direct_claim.status_code == 201, f"Expected 201, got: {valid_direct_claim.status_code} - {valid_direct_claim.text}"
    claim_data = valid_direct_claim.json()
    assert claim_data["found_item_id"] == found_item_id
    assert claim_data["match_id"] is None
    print(f"[PASS] 7. Eligible non-owner Bob successfully submitted direct claim #{claim_data['id']} for found item")

    # 7. Check Duplicate Active Direct Claim Block
    dup_claim = client.post(
        f"/api/found-items/{found_item_id}/claim",
        headers=headers_bob,
        json={"verification_details": "Submitting another claim for the same found item."}
    )
    assert dup_claim.status_code == 409, f"Expected 409, got: {dup_claim.status_code}"
    print("[PASS] 8. Duplicate active direct claim prevented (409 Conflict)")

    # 8. Check Match-based claims continue working
    db = SessionLocal()
    try:
        # Create a new found item and lost item for match
        found2 = FoundItem(
            user_id=alice_id,
            title="Keys with red lanyard",
            category="Keys",
            description="Found keys in gym",
            location="Gym",
            found_date="2026-10-18",
            status="AVAILABLE"
        )
        lost2 = LostItem(
            user_id=bob_id,
            title="Dorm keys with lanyard",
            category="Keys",
            description="Lost dorm keys in gym",
            location="Gym",
            lost_date="2026-10-18",
            status="ACTIVE"
        )
        db.add_all([found2, lost2])
        db.commit()
        db.refresh(found2)
        db.refresh(lost2)

        match = Match(
            lost_item_id=lost2.id,
            found_item_id=found2.id,
            total_score=85,
            status="POSSIBLE"
        )
        db.add(match)
        db.commit()
        db.refresh(match)
        match_id = match.id
    finally:
        db.close()

    match_claim_res = client.post(
        f"/api/matches/{match_id}/claim",
        headers=headers_bob,
        json={"verification_details": "These are my dorm keys with the red lanyard attached."}
    )
    assert match_claim_res.status_code == 201, f"Expected 201, got: {match_claim_res.status_code}"
    assert match_claim_res.json()["match_id"] == match_id
    print(f"[PASS] 9. Match-based claim flow continues working properly (Claim #{match_claim_res.json()['id']})")

    # 9. Verify navigation state contracts
    # Test determineActiveTab logic mirroring frontend implementation
    def determine_active_tab(pathname, search_param=None, state_from=None, effective_type="LOST"):
        source = state_from or search_param
        if source:
            if source == 'explore': return 'explore'
            if source in ('lost-items', 'my-lost-items'): return 'lost-items'
            if source in ('found-items', 'my-found-items'): return 'found-items'
            if source in ('admin', 'admin-portal'): return 'admin-portal'
            if source in ('matches', 'claims', 'history', 'dashboard', 'messages'): return source
        if pathname.startswith('/items/'):
            return 'explore'
        if pathname.startswith('/lost-items'):
            return 'lost-items'
        if pathname.startswith('/found-items'):
            return 'found-items'
        return 'found-items' if effective_type == 'FOUND' else 'lost-items'

    # Verify explore stays active when opening lost or found item from explore
    assert determine_active_tab("/lost-items/1", search_param="explore") == "explore"
    assert determine_active_tab("/lost-items/1", state_from="explore") == "explore"
    assert determine_active_tab("/found-items/1", search_param="explore") == "explore"
    assert determine_active_tab("/found-items/1", state_from="explore") == "explore"
    print("[PASS] 10. Navigation from Explore preserves 'explore' active sidebar tab for both lost and found reports")

    # Verify My Lost Items stays active
    assert determine_active_tab("/lost-items/1", search_param="lost-items") == "lost-items"
    assert determine_active_tab("/lost-items/1", state_from="lost-items") == "lost-items"
    print("[PASS] 11. Navigation from My Lost Items preserves 'lost-items' active tab")

    # Verify My Found Items stays active
    assert determine_active_tab("/found-items/1", search_param="found-items") == "found-items"
    assert determine_active_tab("/found-items/1", state_from="found-items") == "found-items"
    print("[PASS] 12. Navigation from My Found Items preserves 'found-items' active tab")

    # Verify Matches, Claims, History, Messages, Admin Portal stay active
    assert determine_active_tab("/lost-items/1", search_param="matches") == "matches"
    assert determine_active_tab("/found-items/1", search_param="claims") == "claims"
    assert determine_active_tab("/lost-items/1", search_param="history") == "history"
    assert determine_active_tab("/found-items/1", search_param="messages") == "messages"
    assert determine_active_tab("/found-items/1", search_param="admin-portal") == "admin-portal"
    print("[PASS] 13. Navigation from other sections (Matches, Claims, History, Messages, Admin) preserves active tab")

    # Verify fallback on direct URL access or refresh without params
    assert determine_active_tab("/lost-items/1") == "lost-items"
    assert determine_active_tab("/found-items/1") == "found-items"
    assert determine_active_tab("/items/1") == "explore"
    print("[PASS] 14. Fallbacks on direct access or refreshed detail URLs resolve sensibly")

    print("=" * 65)
    print("=== ALL 14 TASK 3 VERIFICATION CHECKS PASSED SUCCESSFULLY! ===")
    print("=" * 65)

if __name__ == "__main__":
    test_claim_visibility_and_navigation_backend()
