"""
End-to-end Diagnostic Script for Tracelt Gemini Visual Matching Pipeline.
Tests each of the 14 pipeline steps requested in the diagnostic checklist.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import json
from app.config import settings
from app.database import SessionLocal
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.models.match import Match
from app.services.matching_service import calculate_match_score, evaluate_and_save_match
from app.services.image_matching_service import resolve_image_file_path, compare_item_images
from app.routers.matches import _serialize_match


def run_pipeline_diagnosis():
    print("=" * 80)
    print("TRACELT GEMINI VISUAL MATCHING PIPELINE DIAGNOSIS")
    print("=" * 80)

    results = []

    # Checkpoint 1: Config
    has_key = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
    masked_key = f"{settings.GEMINI_API_KEY[:6]}...{settings.GEMINI_API_KEY[-4:]}" if has_key else "NONE"
    print(f"[CONFIG] GEMINI_API_KEY: {masked_key}")
    print(f"[CONFIG] GEMINI_MODEL: {settings.GEMINI_MODEL}")
    print(f"[CONFIG] VISUAL_CANDIDATE_THRESHOLD: {settings.VISUAL_CANDIDATE_THRESHOLD}")
    print(f"[CONFIG] MAX_VISUAL_COMPARISONS: {settings.MAX_VISUAL_COMPARISONS}")

    db = SessionLocal()
    try:
        lost = db.query(LostItem).filter(LostItem.id == 2).first()
        found = db.query(FoundItem).filter(FoundItem.id == 4).first()

        # Step 1: Match created (items exist)
        step1_ok = lost is not None and found is not None
        results.append(("1. Items exist in DB", step1_ok, f"Lost #{lost.id if lost else '?'}, Found #{found.id if found else '?'}"))

        # Step 2: Deterministic score calculated
        scores = calculate_match_score(lost, found) if step1_ok else {}
        total_score = scores.get("total_score", 0)
        step2_ok = total_score > 0
        results.append(("2. Deterministic score calculated", step2_ok, f"Score: {total_score}%"))

        # Step 3: Candidate selected for visual analysis?
        threshold = settings.VISUAL_CANDIDATE_THRESHOLD
        step3_ok = total_score >= threshold and (lost.user_id != found.user_id) and (lost.campus == found.campus)
        results.append(("3. Candidate selected for visual analysis", step3_ok, f"{total_score} >= {threshold} (Campus match: {lost.campus == found.campus})"))

        # Step 4: Lost image found?
        lost_img_url = lost.image_url if lost else None
        step4_ok = bool(lost_img_url)
        results.append(("4. Lost image URL present", step4_ok, f"{lost_img_url}"))

        # Step 5: Found image found?
        found_img_url = found.image_url if found else None
        step5_ok = bool(found_img_url)
        results.append(("5. Found image URL present", step5_ok, f"{found_img_url}"))

        # Step 6: Images successfully loaded from disk?
        lost_file = resolve_image_file_path(lost_img_url)
        found_file = resolve_image_file_path(found_img_url)
        step6_ok = (lost_file is not None and lost_file.is_file()) and (found_file is not None and found_file.is_file())
        results.append(("6. Image files loaded from disk", step6_ok, f"Lost: {lost_file.name if lost_file else 'None'}, Found: {found_file.name if found_file else 'None'}"))

        # Step 7: Gemini service called?
        step7_ok = has_key
        results.append(("7. Gemini service preconditions met", step7_ok, f"Key configured: {has_key}"))

        # Step 8: Gemini API request sent & Step 9: Gemini response received
        print("\n--- Sending request to Gemini Vision API ---")
        visual_data = compare_item_images(lost, found)
        step8_9_ok = visual_data is not None
        results.append(("8-9. Gemini request sent & response received", step8_9_ok, f"Received payload: {bool(visual_data)}"))

        # Step 10: Response parsed?
        step10_ok = step8_9_ok and "visual_score" in visual_data and "visual_verdict" in visual_data
        results.append(("10. Response parsed as structured JSON", step10_ok, f"Verdict: {visual_data.get('visual_verdict') if visual_data else 'None'}"))

        # Step 11: visual_score generated?
        v_score = visual_data.get("visual_score") if visual_data else None
        step11_ok = v_score is not None
        results.append(("11. visual_score generated", step11_ok, f"visual_score: {v_score}%"))

        # Step 12: Visual data saved to database?
        match_record = evaluate_and_save_match(
            db=db,
            lost_item=lost,
            found_item=found,
            threshold=50,
            visual_data=visual_data,
        )
        # Re-fetch from DB to guarantee it persisted
        db_match = db.query(Match).filter(Match.id == match_record.id).first()
        step12_ok = db_match is not None and db_match.visual_score == v_score
        results.append(("12. Visual data saved to SQLite database", step12_ok, f"Match #{db_match.id}: visual_score={db_match.visual_score}, verdict={db_match.visual_verdict}"))

        # Step 13: API returns visual data?
        serialized = _serialize_match(db_match)
        step13_ok = serialized.visual_score == v_score and serialized.visual_verdict is not None
        results.append(("13. API serializer includes visual fields", step13_ok, f"Schema visual_score={serialized.visual_score}, verdict={serialized.visual_verdict}"))

        # Step 14: Frontend receives visual data (schema contract check)
        serialized_dict = serialized.model_dump() if hasattr(serialized, "model_dump") else serialized.dict()
        frontend_contract = (
            "visual_score" in serialized_dict
            and "visual_verdict" in serialized_dict
            and "visual_confidence" in serialized_dict
            and "visual_reasons" in serialized_dict
            and serialized_dict.get("visual_score") is not None
        )
        verdict_str = (serialized_dict.get("visual_verdict") or "").replace("_", " ").upper()
        results.append(("14. Frontend receives non-null visual fields", frontend_contract, f"Badge: VISUAL: {serialized_dict.get('visual_score')}% ({verdict_str})"))

        print("\n" + "=" * 80)
        print("PIPELINE STEP RESULTS")
        print("=" * 80)
        for name, ok, details in results:
            status_tag = "[PASS]" if ok else "[FAIL]"
            print(f"{status_tag} {name:<42} | {details}")

        print("=" * 80)
        if all(r[1] for r in results):
            print("ALL 14 PIPELINE CHECKS PASSED SUCCESSFULLY!")
        else:
            print("SOME CHECKS FAILED. See details above.")
        print("=" * 80)

        if visual_data:
            print("\n[VISUAL ANALYSIS DETAILS]")
            print(f"Visual Similarity Score: {visual_data['visual_score']}%")
            print(f"Visual Verdict:          {visual_data['visual_verdict']}")
            print(f"Confidence:              {visual_data['visual_confidence']}")
            print("Visual Reasons / Observations:")
            for r in visual_data.get("visual_reasons", []):
                print(f"  - {r}")

    finally:
        db.close()


if __name__ == "__main__":
    run_pipeline_diagnosis()
