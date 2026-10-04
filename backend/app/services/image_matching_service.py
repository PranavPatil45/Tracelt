import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from app.config import settings
from app.core.file_storage import UPLOADS_DIR, get_filename_from_url
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem

logger = logging.getLogger("tracelt.image_matching")

ALLOWED_VERDICTS = {"strong_match", "possible_match", "weak_match", "not_match", "uncertain"}


class VisualComparisonResult(BaseModel):
    visual_score: int = Field(
        ...,
        description="Visual similarity score from 0 to 100 based strictly on visual features (color, brand, make/model, damage, unique marks)."
    )
    verdict: str = Field(
        ...,
        description="Categorical judgment: 'strong_match', 'possible_match', 'weak_match', 'not_match', or 'uncertain'."
    )
    confidence: float = Field(
        ...,
        description="Confidence in the assessment from 0.0 to 1.0."
    )
    reasons: List[str] = Field(
        ...,
        description="List of concise, objective reasons explaining why the two items visually match or differ."
    )
    matched_features: Optional[List[str]] = Field(
        default=None,
        description="Specific features that visually align between the two items."
    )
    differentiating_features: Optional[List[str]] = Field(
        default=None,
        description="Specific features that differ between the two items."
    )


def resolve_image_file_path(image_url: Optional[str]) -> Optional[Path]:
    """
    Resolves an item image_url to an absolute local filesystem Path if it exists.
    Returns None if missing or unresolvable.
    """
    if not image_url or not isinstance(image_url, str):
        return None

    filename = get_filename_from_url(image_url)
    if not filename:
        return None

    candidate = (UPLOADS_DIR / filename).resolve()
    uploads_resolved = UPLOADS_DIR.resolve()

    try:
        if candidate.is_relative_to(uploads_resolved) and candidate.is_file():
            return candidate
    except AttributeError:
        if str(candidate).startswith(str(uploads_resolved)) and candidate.is_file():
            return candidate

    return None


def get_image_mime_type(file_path: Path) -> str:
    """Detects MIME type for image file, defaulting to image/jpeg."""
    suffix = file_path.suffix.lower()
    mapping = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    return mapping.get(suffix, "image/jpeg")


def compare_item_images(
    lost_item: LostItem,
    found_item: FoundItem,
) -> Optional[Dict[str, Any]]:
    """
    Performs visual comparison between a LostItem and FoundItem using Gemini Vision.

    Returns a dict if successful:
    {
        "visual_score": int,       # 0 - 100
        "visual_verdict": str,     # strong_match | possible_match | weak_match | not_match | uncertain
        "visual_confidence": float,# 0.0 - 1.0
        "visual_reasons": list,    # explanation reasons and feature observations
    }
    Or None if images are missing, API key is not configured, or analysis fails.
    """
    # 1. Check if Gemini API key is configured
    api_key = (settings.GEMINI_API_KEY or "").strip()
    if not api_key:
        logger.warning("[VISUAL] GEMINI_API_KEY is not configured in backend/.env. Skipping visual comparison.")
        return None

    # 2. Resolve both image paths
    lost_path = resolve_image_file_path(lost_item.image_url)
    found_path = resolve_image_file_path(found_item.image_url)

    if not lost_path or not found_path:
        logger.info(
            f"[VISUAL] Comparison skipped for Lost #{lost_item.id} <-> Found #{found_item.id}: "
            f"Missing image file on disk (lost: {bool(lost_path)}, found: {bool(found_path)})"
        )
        return None

    try:
        from google import genai
        from google.genai import types

        lost_mime = get_image_mime_type(lost_path)
        found_mime = get_image_mime_type(found_path)

        with open(lost_path, "rb") as f:
            lost_bytes = f.read()
        with open(found_path, "rb") as f:
            found_bytes = f.read()

        if not lost_bytes or not found_bytes:
            return None

        part_lost = types.Part.from_bytes(data=lost_bytes, mime_type=lost_mime)
        part_found = types.Part.from_bytes(data=found_bytes, mime_type=found_mime)

        prompt_text = (
            "You are an expert visual forensic analyst for a university campus Lost & Found system.\n"
            "Compare the two provided images: Image 1 is the 'Lost Item' and Image 2 is the 'Found Item'.\n\n"
            f"Context Information:\n"
            f"- Lost Item Title: {lost_item.title}\n"
            f"- Lost Item Category: {lost_item.category}\n"
            f"- Lost Item Description: {lost_item.description or 'None provided'}\n\n"
            f"- Found Item Title: {found_item.title}\n"
            f"- Found Item Category: {found_item.category}\n"
            f"- Found Item Description: {found_item.description or 'None provided'}\n\n"
            "Analysis Task:\n"
            "1. Examine the visual evidence in Image 1 and Image 2 carefully.\n"
            "2. Compare physical characteristics: item type, silhouette, color palette, brand logos, model details, stickers, scratches, wear and tear, or unique identifiers.\n"
            "3. Assess if Image 2 could reasonably be the same item as Image 1, accounting for different angles, lighting, background, or distance.\n"
            "4. Provide:\n"
            "   - visual_score: integer from 0 to 100 indicating visual similarity (0 = completely different object, 100 = identical object).\n"
            "   - verdict: exactly one of ['strong_match', 'possible_match', 'weak_match', 'not_match', 'uncertain'].\n"
            "   - confidence: float from 0.0 to 1.0 expressing how confident you are given image quality and clarity.\n"
            "   - reasons: list of concise bullet points detailing observed similarities and differences.\n"
            "   - matched_features: list of specific visual attributes that match.\n"
            "   - differentiating_features: list of specific visual attributes that conflict.\n"
        )

        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=VisualComparisonResult,
            temperature=0.2,
        )

        candidate_models = [settings.GEMINI_MODEL]
        for fallback in ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest"]:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        response = None
        last_error = None
        for model_candidate in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model_candidate,
                    contents=[
                        "Image 1 (Reported Lost Item):",
                        part_lost,
                        "Image 2 (Reported Found Item):",
                        part_found,
                        prompt_text,
                    ],
                    config=config,
                )
                if response and response.text:
                    break
            except Exception as err:
                last_error = err
                logger.warning(
                    f"[VISUAL] Gemini model '{model_candidate}' failed for Lost #{lost_item.id} <-> Found #{found_item.id}: {err}"
                )

        if not response or not response.text:
            if last_error:
                raise last_error
            logger.warning("[VISUAL] Empty response from Gemini visual comparison.")
            return None

        import json
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        data = json.loads(raw_text)
        result = VisualComparisonResult.model_validate(data)

        # Normalize score and verdict
        v_score = max(0, min(100, int(result.visual_score)))
        v_conf = max(0.0, min(1.0, float(result.confidence)))

        raw_verdict = (result.verdict or "").strip().lower().replace(" ", "_")
        if raw_verdict not in ALLOWED_VERDICTS:
            if v_score >= 75:
                raw_verdict = "strong_match"
            elif v_score >= 50:
                raw_verdict = "possible_match"
            elif v_score >= 25:
                raw_verdict = "weak_match"
            else:
                raw_verdict = "not_match"

        # Format reasons cleanly
        formatted_reasons = list(result.reasons or [])
        if result.matched_features:
            for feat in result.matched_features:
                if feat and feat not in formatted_reasons:
                    formatted_reasons.append(f"Visual match: {feat}")
        if result.differentiating_features:
            for diff in result.differentiating_features:
                if diff and diff not in formatted_reasons:
                    formatted_reasons.append(f"Visual difference: {diff}")

        logger.info(
            f"[VISUAL] Gemini visual analysis for Lost #{lost_item.id} <-> Found #{found_item.id}: "
            f"score={v_score}, verdict={raw_verdict}, confidence={v_conf}"
        )

        return {
            "visual_score": v_score,
            "visual_verdict": raw_verdict,
            "visual_confidence": v_conf,
            "visual_reasons": formatted_reasons,
        }

    except Exception as e:
        logger.exception(
            f"[VISUAL] Gemini visual comparison failed for Lost #{lost_item.id} <-> Found #{found_item.id}: {e}"
        )
        return None
