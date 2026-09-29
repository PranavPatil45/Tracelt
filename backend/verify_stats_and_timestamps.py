"""
Verification test for Tracelt Live Dashboard Stats, Badge Counts, and Notification Timestamps.
Ensures zero mock data, correct database calculations, and proper timestamp handling.
"""
import sys
import os
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.claim import Claim
from app.models.notification import Notification
from app.core.security import create_access_token, get_password_hash

client = TestClient(app)

def test_stats_and_timestamps():
    db: Session = SessionLocal()
    try:
        print("\n--- 1. Testing Empty User Dashboard Stats ---")
        empty_email = f"empty_user_{int(datetime.now().timestamp())}@test.edu"
        empty_user = User(
            email=empty_email,
            full_name="Empty Test User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            campus="Test University",
            department="Physics",
        )
        db.add(empty_user)
        db.commit()
        db.refresh(empty_user)

        empty_token = create_access_token(subject=str(empty_user.id))
        headers = {"Authorization": f"Bearer {empty_token}"}

        res = client.get("/api/users/me/dashboard-stats", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        print(f"Empty user dashboard stats: {data}")
        assert data["lost_items"] == 0, f"Expected 0 lost_items, got {data['lost_items']}"
        assert data["found_items"] == 0, f"Expected 0 found_items, got {data['found_items']}"
        assert data["matches"] == 0, f"Expected 0 matches, got {data['matches']}"
        assert data["claims"] == 0, f"Expected 0 claims, got {data['claims']}"
        assert data["recovered"] == 0, f"Expected 0 recovered, got {data['recovered']}"
        assert data["unread_messages"] == 0, f"Expected 0 unread_messages, got {data['unread_messages']}"
        assert data["unread_notifications"] == 0, f"Expected 0 unread_notifications, got {data['unread_notifications']}"
        print("[PASS] Empty user has exact 0 counts for all stats.")

        print("\n--- 2. Testing User with Real Items, Claims, Notifications ---")
        active_email = f"active_user_{int(datetime.now().timestamp())}@test.edu"
        active_user = User(
            email=active_email,
            full_name="Active Test User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            campus="Science Campus",
            department="Chemistry",
        )
        db.add(active_user)
        db.commit()
        db.refresh(active_user)

        # Add 2 Lost Items
        item1 = LostItem(
            user_id=active_user.id,
            title="Chemistry Lab Notebook",
            category="Books",
            description="Spiral notebook with chemistry formulas.",
            location="Room 302",
            campus="Science Campus",
            lost_date="2026-09-20",
            status="ACTIVE",
        )
        item2 = LostItem(
            user_id=active_user.id,
            title="Scientific Calculator",
            category="Electronics",
            description="Silver casing scientific calculator.",
            location="Library 2nd Floor",
            campus="Science Campus",
            lost_date="2026-09-21",
            status="ACTIVE",
        )
        # Add 1 Found Item
        item3 = FoundItem(
            user_id=active_user.id,
            title="Blue Umbrella",
            category="Other",
            description="Found a blue umbrella near the entrance.",
            location="Main Hall",
            campus="Science Campus",
            found_date="2026-09-22",
            status="AVAILABLE",
        )
        db.add_all([item1, item2, item3])
        db.commit()

        # Add 1 Claim on another found item
        finder = User(
            email=f"finder_{int(datetime.now().timestamp())}@test.edu",
            full_name="Finder User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            campus="Science Campus",
        )
        db.add(finder)
        db.commit()
        db.refresh(finder)

        found_by_other = FoundItem(
            user_id=finder.id,
            title="Keys with Red Lanyard",
            category="Keys",
            description="Keys found on cafeteria table.",
            location="Cafeteria",
            campus="Science Campus",
            found_date="2026-09-23",
            status="AVAILABLE",
        )
        db.add(found_by_other)
        db.commit()
        db.refresh(found_by_other)

        from app.models.match import Match

        match1 = Match(
            lost_item_id=item1.id,
            found_item_id=found_by_other.id,
            total_score=85,
            status="POSSIBLE",
        )
        db.add(match1)
        db.commit()
        db.refresh(match1)

        claim1 = Claim(
            match_id=match1.id,
            claimant_id=active_user.id,
            status="PENDING",
            verification_details="Has a brass door key and a mail key.",
        )
        db.add(claim1)

        # Add 2 Notifications (1 unread, 1 read)
        notif1 = Notification(
            user_id=active_user.id,
            title="New Match Detected",
            message="Possible match for your Chemistry Lab Notebook.",
            type="MATCH_FOUND",
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        notif2 = Notification(
            user_id=active_user.id,
            title="Claim Received",
            message="Your claim has been submitted for review.",
            type="CLAIM_SUBMITTED",
            is_read=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add_all([notif1, notif2])
        db.commit()

        active_token = create_access_token(subject=str(active_user.id))
        active_headers = {"Authorization": f"Bearer {active_token}"}

        res = client.get("/api/users/me/dashboard-stats", headers=active_headers)
        assert res.status_code == 200
        stats = res.json()
        print(f"Active user dashboard stats: {stats}")
        assert stats["lost_items"] == 2, f"Expected 2 lost_items, got {stats['lost_items']}"
        assert stats["found_items"] == 1, f"Expected 1 found_items, got {stats['found_items']}"
        assert stats["claims"] == 1, f"Expected 1 claims, got {stats['claims']}"
        assert stats["unread_notifications"] == 1, f"Expected 1 unread_notifications, got {stats['unread_notifications']}"
        print("[PASS] User stats accurately reflect database items and claims.")

        print("\n--- 3. Testing Notifications Ordering & Unread Count ---")
        notif_res = client.get("/api/notifications", headers=active_headers)
        assert notif_res.status_code == 200
        notifs_data = notif_res.json()
        assert notifs_data["unread_count"] == 1, f"Expected unread_count=1, got {notifs_data['unread_count']}"
        assert len(notifs_data["notifications"]) == 2, f"Expected 2 notifications, got {len(notifs_data['notifications'])}"
        
        # Verify newest notification is first
        first_created = notifs_data["notifications"][0]["created_at"]
        second_created = notifs_data["notifications"][1]["created_at"]
        assert first_created >= second_created, "Notifications should be sorted in descending order"
        print(f"[PASS] Notifications ordered descending: {first_created} >= {second_created}")

        print("\n--- 4. Testing Campus Activity Feed Scoping ---")
        campus_res = client.get("/api/campus/activity?campus=Science%20Campus", headers=active_headers)
        assert campus_res.status_code == 200
        activity_items = campus_res.json()
        assert len(activity_items) > 0, "Expected campus activity items"
        print(f"[PASS] Campus activity feed returned {len(activity_items)} items for Science Campus.")

        print("\n==========================================")
        print("ALL STATS, BADGES, AND TIMESTAMP TESTS PASSED!")
        print("==========================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    test_stats_and_timestamps()
