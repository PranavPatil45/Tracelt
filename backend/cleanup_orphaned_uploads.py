"""
Safe cleanup script for orphaned files in backend/uploads.
Identifies all files currently on disk, cross-references with LostItem and FoundItem
tables in the SQLite database, reports active vs orphaned files, and safely removes
only unreferenced files.
"""

from pathlib import Path
from app.database import SessionLocal
from app.models.lost_item import LostItem
from app.models.found_item import FoundItem
from app.core.file_storage import UPLOADS_DIR, get_filename_from_url

def main():
    print(f"Scanning uploads directory: {UPLOADS_DIR.resolve()}")
    if not UPLOADS_DIR.exists():
        print("Uploads directory does not exist.")
        return

    db = SessionLocal()
    try:
        lost_items = db.query(LostItem).all()
        found_items = db.query(FoundItem).all()

        referenced_filenames = set()
        for item in lost_items:
            fname = get_filename_from_url(item.image_url)
            if fname:
                referenced_filenames.add(fname)
                print(f"[REFERENCED - LostItem #{item.id}] '{item.title}': {fname}")

        for item in found_items:
            fname = get_filename_from_url(item.image_url)
            if fname:
                referenced_filenames.add(fname)
                print(f"[REFERENCED - FoundItem #{item.id}] '{item.title}': {fname}")

        disk_files = [f for f in UPLOADS_DIR.iterdir() if f.is_file()]
        print(f"\nTotal files on disk: {len(disk_files)}")
        print(f"Total files referenced by DB: {len(referenced_filenames)}")

        orphaned = []
        kept = []

        for f in disk_files:
            if f.name in referenced_filenames:
                kept.append(f)
            else:
                orphaned.append(f)

        print(f"\nFiles referenced in DB (KEPT): {len(kept)}")
        for f in kept:
            print(f"  - {f.name} ({f.stat().st_size} bytes)")

        print(f"\nOrphaned files (TO BE REMOVED): {len(orphaned)}")
        for f in orphaned:
            print(f"  - {f.name} ({f.stat().st_size} bytes)")

        # Safely remove orphaned files
        deleted_count = 0
        for f in orphaned:
            try:
                f.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"Failed to delete {f.name}: {e}")

        print(f"\nCleaned up {deleted_count} orphaned files successfully.")
        remaining = [f for f in UPLOADS_DIR.iterdir() if f.is_file()]
        print(f"Remaining files on disk: {len(remaining)}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
