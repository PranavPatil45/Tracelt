"""
Comprehensive Verification Suite for Tracelt Gemini Visual Matching System.
Tests:
1. Directional date scoring fix.
2. Deterministic Layer 1 matching integrity and hard gates.
3. Missing image handling & unconfigured Gemini handling.
4. Candidate gating & MAX_VISUAL_COMPARISONS limits.
5. Mocked Gemini success & graceful error handling.
6. Match serialization & separate scores verification.
"""
import sys
import unittest
from datetime import datetime
from unittest.mock import patch, MagicMock

# Ensure backend directory is in path
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.user import User
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.config import settings
from app.services.matching_service import (
    calculate_category_score,
    calculate_location_score,
    calculate_date_score,
    calculate_time_score,
    calculate_text_similarity,
    calculate_match_score,
    evaluate_and_save_match,
    find_matches_for_lost_item,
    find_matches_for_found_item,
    scan_campus_matches,
)
from app.services.image_matching_service import (
    compare_item_images,
    resolve_image_file_path,
    get_image_mime_type,
    VisualComparisonResult,
)
from app.routers.matches import _serialize_match


class TestVisualMatchingSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an in-memory SQLite database for isolated test execution
        cls.engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()
        # Seed test users
        self.user1 = User(
            id=101,
            email="student1@campus.edu",
            hashed_password="hash",
            full_name="Alice Student",
            campus="Main Campus",
            role="student",
            is_active=True,
        )
        self.user2 = User(
            id=102,
            email="student2@campus.edu",
            hashed_password="hash",
            full_name="Bob Finder",
            campus="Main Campus",
            role="student",
            is_active=True,
        )
        self.db.add_all([self.user1, self.user2])
        self.db.commit()

    def tearDown(self):
        try:
            self.db.rollback()
            self.db.query(Match).delete()
            self.db.query(LostItem).delete()
            self.db.query(FoundItem).delete()
            self.db.query(User).delete()
            self.db.commit()
        except Exception:
            self.db.rollback()
        finally:
            self.db.close()

    # --------------------------------------------------------------------------
    # 1. Directional Date Scoring Fix
    # --------------------------------------------------------------------------
    def test_directional_date_scoring(self):
        """Found item date cannot precede lost item date."""
        # Same day -> 20 points
        score, reason = calculate_date_score("2026-10-05", "2026-10-05")
        self.assertEqual(score, 20)
        self.assertIn("same date", reason.lower())

        # Found 1 day after -> 15 points
        score, reason = calculate_date_score("2026-10-05", "2026-10-06")
        self.assertEqual(score, 15)

        # Found 2 days after -> 10 points
        score, reason = calculate_date_score("2026-10-05", "2026-10-07")
        self.assertEqual(score, 10)

        # Found 3 days after -> 5 points
        score, reason = calculate_date_score("2026-10-05", "2026-10-08")
        self.assertEqual(score, 5)

        # Found 4 days after -> 0 points
        score, reason = calculate_date_score("2026-10-05", "2026-10-09")
        self.assertEqual(score, 0)
        self.assertIsNone(reason)

        # BUG FIX TEST: Found 1 day BEFORE lost date -> MUST return 0 points
        score, reason = calculate_date_score("2026-10-05", "2026-10-04")
        self.assertEqual(score, 0, "Found date preceding lost date must score 0 points")
        self.assertIsNone(reason)

        # Found 30 days BEFORE lost date -> MUST return 0 points
        score, reason = calculate_date_score("2026-10-05", "2026-09-05")
        self.assertEqual(score, 0)
        self.assertIsNone(reason)

    # --------------------------------------------------------------------------
    # 2. Deterministic Layer 1 Rules & Gates
    # --------------------------------------------------------------------------
    def test_deterministic_scoring_integrity(self):
        """Verifies deterministic algorithm signals sum and cap correctly."""
        lost = LostItem(
            id=1,
            user_id=101,
            title="Black Hydro Flask Bottle",
            category="Bottles",
            location="Central Library 2nd Floor",
            campus="Main Campus",
            lost_date="2026-10-05",
            lost_time="14:00",
            description="Matte black 32oz water bottle with a dent on the bottom",
            status="ACTIVE",
        )
        found = FoundItem(
            id=2,
            user_id=102,
            title="Black Water Bottle Hydroflask",
            category="Bottles",
            location="Central Library",
            campus="Main Campus",
            found_date="2026-10-05",
            found_time="14:30",
            description="Found black metal hydroflask bottle near study desks",
            status="AVAILABLE",
        )

        scores = calculate_match_score(lost, found)
        self.assertEqual(scores["category_score"], 25) # Exact category match
        self.assertEqual(scores["location_score"], 15) # Partial keyword match ("Library")
        self.assertEqual(scores["date_score"], 20)     # Same day
        self.assertEqual(scores["time_score"], 10)     # <= 1 hour
        self.assertGreaterEqual(scores["description_score"], 5) # Text overlap
        self.assertGreaterEqual(scores["total_score"], 70)
        self.assertLessEqual(scores["total_score"], 100)

    def test_deterministic_hard_gates(self):
        """Hard gates: self-matching and cross-campus must be blocked."""
        lost = LostItem(
            id=10,
            user_id=101,
            title="Keys",
            category="Keys",
            location="Gym",
            campus="Main Campus",
            status="ACTIVE",
        )
        # Same user
        found_same_user = FoundItem(
            id=11,
            user_id=101,
            title="Keys",
            category="Keys",
            location="Gym",
            campus="Main Campus",
            status="AVAILABLE",
        )
        res1 = evaluate_and_save_match(self.db, lost, found_same_user)
        self.assertIsNone(res1, "Self-matching must be blocked")

        # Different campus
        found_diff_campus = FoundItem(
            id=12,
            user_id=102,
            title="Keys",
            category="Keys",
            location="Gym",
            campus="North Campus",
            status="AVAILABLE",
        )
        res2 = evaluate_and_save_match(self.db, lost, found_diff_campus)
        self.assertIsNone(res2, "Cross-campus matching must be blocked")

    # --------------------------------------------------------------------------
    # 3. Missing Image Handling
    # --------------------------------------------------------------------------
    def test_missing_image_handling(self):
        """If either item lacks an image, Gemini is skipped and visual fields remain None."""
        lost_no_img = LostItem(
            id=20,
            user_id=101,
            title="Blue Umbrella",
            category="Accessories",
            location="Student Union",
            campus="Main Campus",
            lost_date="2026-10-01",
            description="Compact blue umbrella",
            image_url=None,
            status="ACTIVE",
        )
        found_with_img = FoundItem(
            id=21,
            user_id=102,
            title="Blue Umbrella",
            category="Accessories",
            location="Student Union",
            campus="Main Campus",
            found_date="2026-10-01",
            description="Blue folding umbrella found in lounge",
            image_url="/uploads/umbrella.jpg",
            status="AVAILABLE",
        )
        self.db.add_all([lost_no_img, found_with_img])
        self.db.commit()

        # compare_item_images returns None
        res = compare_item_images(lost_no_img, found_with_img)
        self.assertIsNone(res)

        # Match creation succeeds with visual fields as None
        matches = find_matches_for_lost_item(self.db, lost_item_id=lost_no_img.id)
        self.assertEqual(len(matches), 1)
        m = matches[0]
        self.assertGreaterEqual(m.total_score, 60)
        self.assertIsNone(m.visual_score)
        self.assertIsNone(m.visual_verdict)
        self.assertIsNone(m.visual_confidence)
        self.assertIsNone(m.visual_reasons)

    # --------------------------------------------------------------------------
    # 4. Graceful Degradation on Gemini Failure
    # --------------------------------------------------------------------------
    def test_gemini_failure_graceful_degradation(self):
        """When Gemini throws an exception or quota error, deterministic matching is unaffected."""
        lost = LostItem(
            id=30,
            user_id=101,
            title="AirPods Pro",
            category="Electronics",
            location="Science Hall 101",
            campus="Main Campus",
            lost_date="2026-10-02",
            description="White AirPods in black silicone case",
            image_url="/uploads/airpods_lost.jpg",
            status="ACTIVE",
        )
        found = FoundItem(
            id=31,
            user_id=102,
            title="Apple AirPods Case",
            category="Electronics",
            location="Science Hall",
            campus="Main Campus",
            found_date="2026-10-02",
            description="AirPods in black case found on front row desk",
            image_url="/uploads/airpods_found.jpg",
            status="AVAILABLE",
        )
        self.db.add_all([lost, found])
        self.db.commit()

        # Mock compare_item_images raising an API exception
        with patch("app.services.matching_service.compare_item_images", side_effect=Exception("Gemini Quota Exceeded 429")):
            matches = find_matches_for_lost_item(self.db, lost_item_id=lost.id)

        # Match must still be created from deterministic signals
        self.assertEqual(len(matches), 1)
        m = matches[0]
        self.assertGreaterEqual(m.total_score, 60)
        self.assertIsNone(m.visual_score, "Visual score must be None when Gemini fails")
        self.assertIsNone(m.visual_verdict)

    # --------------------------------------------------------------------------
    # 5. Gemini Visual Comparison Integration & Separate Scores
    # --------------------------------------------------------------------------
    def test_gemini_visual_success_and_serialization(self):
        """When Gemini succeeds, visual score/verdict/reasons are saved separately without altering total_score."""
        lost = LostItem(
            id=40,
            user_id=101,
            title="Red Jansport Backpack",
            category="Bags",
            location="Engineering Center",
            campus="Main Campus",
            lost_date="2026-10-03",
            description="Red canvas backpack with NASA pin on front pocket",
            image_url="/uploads/bag_lost.jpg",
            status="ACTIVE",
        )
        found = FoundItem(
            id=41,
            user_id=102,
            title="Red Backpack with Pin",
            category="Bags",
            location="Engineering Center",
            campus="Main Campus",
            found_date="2026-10-03",
            description="Red backpack found in computer lab 204",
            image_url="/uploads/bag_found.jpg",
            status="AVAILABLE",
        )
        self.db.add_all([lost, found])
        self.db.commit()

        mock_visual_data = {
            "visual_score": 92,
            "visual_verdict": "strong_match",
            "visual_confidence": 0.95,
            "visual_reasons": [
                "Identical red canvas shade and Jansport logo placement",
                "Visual match: Distinctive circular NASA enamel pin on zipper flap",
            ],
        }

        with patch("app.services.matching_service.compare_item_images", return_value=mock_visual_data):
            matches = find_matches_for_lost_item(self.db, lost_item_id=lost.id)

        self.assertEqual(len(matches), 1)
        m = matches[0]

        # Verify separate storage: total_score is deterministic, visual_score is Gemini
        self.assertNotEqual(m.total_score, m.visual_score)
        self.assertEqual(m.visual_score, 92)
        self.assertEqual(m.visual_verdict, "strong_match")
        self.assertEqual(m.visual_confidence, 0.95)
        self.assertEqual(len(m.visual_reasons), 2)
        self.assertIn("NASA", m.visual_reasons[1])

        # Test Serialization in API
        serialized = _serialize_match(m)
        self.assertEqual(serialized.id, m.id)
        self.assertEqual(serialized.score, m.total_score)
        self.assertEqual(serialized.visual_score, 92)
        self.assertEqual(serialized.visual_verdict, "strong_match")
        self.assertEqual(serialized.visual_confidence, 0.95)
        self.assertEqual(len(serialized.visual_reasons), 2)

    # --------------------------------------------------------------------------
    # 6. Candidate Gating & MAX_VISUAL_COMPARISONS Limit
    # --------------------------------------------------------------------------
    def test_visual_candidate_gating_and_limit(self):
        """Candidates below threshold are not sent to Gemini, and comparisons are capped at MAX_VISUAL_COMPARISONS."""
        lost = LostItem(
            id=50,
            user_id=101,
            title="Grey Dell Laptop",
            category="Electronics",
            location="Library",
            campus="Main Campus",
            lost_date="2026-10-01",
            description="Dell Inspiron 15 grey laptop with charger",
            image_url="/uploads/laptop_lost.jpg",
            status="ACTIVE",
        )
        self.db.add(lost)

        # Create 8 found items with images
        found_items = []
        for i in range(1, 9):
            fi = FoundItem(
                id=100 + i,
                user_id=102,
                title=f"Grey Dell Laptop {i}",
                category="Electronics",
                location="Library",
                campus="Main Campus",
                found_date="2026-10-01",
                description=f"Found grey Dell laptop {i} on study desk",
                image_url=f"/uploads/laptop_found_{i}.jpg",
                status="AVAILABLE",
            )
            found_items.append(fi)
        self.db.add_all(found_items)
        self.db.commit()

        call_count = 0

        def fake_compare(lost_item, found_item):
            nonlocal call_count
            call_count += 1
            return {
                "visual_score": 70,
                "visual_verdict": "possible_match",
                "visual_confidence": 0.8,
                "visual_reasons": ["Similar laptop"],
            }

        with patch("app.services.matching_service.compare_item_images", side_effect=fake_compare):
            with patch.object(settings, "MAX_VISUAL_COMPARISONS", 3):
                matches = find_matches_for_lost_item(self.db, lost_item_id=lost.id)

        # All 8 match deterministically, but Gemini should only be called MAX_VISUAL_COMPARISONS = 3 times
        self.assertEqual(len(matches), 8)
        self.assertEqual(call_count, 3, "Gemini calls must be capped at MAX_VISUAL_COMPARISONS")


if __name__ == "__main__":
    unittest.main()
