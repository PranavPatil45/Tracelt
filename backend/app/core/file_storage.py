import logging
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Base directory for uploads: backend/uploads
UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def get_filename_from_url(image_url: Optional[str]) -> Optional[str]:
    """Extract the plain filename from a URL path, stripping query parameters and directories."""
    if not image_url or not isinstance(image_url, str):
        return None
    cleaned = image_url.strip().split("?")[0].split("#")[0]
    filename = Path(cleaned).name
    if not filename or filename in (".", "..") or "/" in filename or "\\" in filename:
        return None
    return filename


def delete_uploaded_file_if_unreferenced(
    db: Session,
    image_url: Optional[str],
    exclude_lost_item_id: Optional[int] = None,
    exclude_found_item_id: Optional[int] = None,
) -> bool:
    """
    Safely deletes a physical image file from the uploads directory if it is
    no longer referenced by any LostItem or FoundItem in the database.
    """
    filename = get_filename_from_url(image_url)
    if not filename:
        return False

    target_path = (UPLOADS_DIR / filename).resolve()
    uploads_resolved = UPLOADS_DIR.resolve()

    # Prevent directory traversal
    try:
        if not target_path.is_relative_to(uploads_resolved):
            return False
    except AttributeError:
        if not str(target_path).startswith(str(uploads_resolved)):
            return False

    if not target_path.exists() or not target_path.is_file():
        return False

    # Check if any other LostItem references this file
    from app.models.lost_item import LostItem
    from app.models.found_item import FoundItem

    lost_query = db.query(LostItem).filter(LostItem.image_url.contains(filename))
    if exclude_lost_item_id is not None:
        lost_query = lost_query.filter(LostItem.id != exclude_lost_item_id)
    if lost_query.first():
        logger.info(f"File {filename} is still referenced by another lost item. Keeping on disk.")
        return False

    # Check if any other FoundItem references this file
    found_query = db.query(FoundItem).filter(FoundItem.image_url.contains(filename))
    if exclude_found_item_id is not None:
        found_query = found_query.filter(FoundItem.id != exclude_found_item_id)
    if found_query.first():
        logger.info(f"File {filename} is still referenced by another found item. Keeping on disk.")
        return False

    try:
        target_path.unlink()
        logger.info(f"Successfully deleted unreferenced image file: {target_path}")
        return True
    except Exception as e:
        logger.warning(f"Failed to delete unreferenced image file {target_path}: {e}")
        return False
