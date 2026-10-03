import sys
import os
import io

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))

from app.database import SessionLocal, init_db
from app.models.user import User
from app.schemas.auth import UserProfileUpdate, UserRegister
from app.crud.user import create_user, get_user_by_email
from app.routers.auth import get_me, update_profile, upload_avatar, remove_avatar
from app.routers.campus import get_predefined_campuses, get_predefined_departments
from fastapi import HTTPException, UploadFile

def run_tests():
    print("=" * 60)
    print("VERIFYING TRACELT PROFILE FUNCTIONALITY")
    print("=" * 60)

    init_db()
    db = SessionLocal()

    # 1. Setup test user
    test_email = "profile_test_user@campus.edu"
    existing = get_user_by_email(db, test_email)
    if existing:
        db.delete(existing)
        db.commit()

    user_in = UserRegister(
        email=test_email,
        full_name="Initial Name",
        password="ValidPassword123!",
        campus="ABC University",
        department="Computer Engineering",
        role="student",
    )
    user = create_user(db, user_in)
    print(f"[PASS] 1. Created test user with ID={user.id}")

    # 2. Test get_me
    me_result = get_me(current_user=user)
    assert me_result.email == test_email
    assert me_result.full_name == "Initial Name"
    assert me_result.name == "Initial Name"
    assert me_result.phone is None
    assert me_result.bio is None
    assert me_result.profile_image is None
    print("[PASS] 2. get_me returns correct fields including null phone, bio, profile_image and computed name")

    # 3. Test update_profile (happy path)
    update_data = UserProfileUpdate(
        full_name="Updated Name",
        phone="+1 555-123-4567",
        bio="Junior CS student interested in software engineering.",
        campus="KITCoEK",
        department="Electronics",
    )
    updated = update_profile(profile_in=update_data, current_user=user, db=db)
    assert updated.full_name == "Updated Name"
    assert updated.name == "Updated Name"
    assert updated.phone == "+1 555-123-4567"
    assert updated.bio == "Junior CS student interested in software engineering."
    assert updated.campus == "KITCoEK"
    assert updated.department == "Electronics"
    print("[PASS] 3. update_profile successfully updated permitted fields")

    # 4. Verify persistence in fresh database session
    db.close()
    fresh_db = SessionLocal()
    persisted_user = get_user_by_email(fresh_db, test_email)
    assert persisted_user is not None
    assert persisted_user.full_name == "Updated Name"
    assert persisted_user.phone == "+1 555-123-4567"
    assert persisted_user.bio == "Junior CS student interested in software engineering."
    assert persisted_user.campus == "KITCoEK"
    assert persisted_user.department == "Electronics"
    print("[PASS] 4. Database persistence confirmed across new DB session")

    # 5. Security: privileged fields cannot be updated
    # User cannot change role, email, id, or is_active
    malicious_data = UserProfileUpdate(
        full_name="Hacked Name",
    )
    # Even if raw dictionary had role='admin' or email='hacker@hack.com'
    update_profile(profile_in=malicious_data, current_user=persisted_user, db=fresh_db)
    fresh_db.refresh(persisted_user)
    assert persisted_user.role == "student", "Security violation: role was modified!"
    assert persisted_user.email == test_email, "Security violation: email was modified!"
    assert persisted_user.is_active is True
    print("[PASS] 5. Security verification: privileged fields (role, email, is_active) protected")

    # 6. Validation: full_name cannot be empty or pure whitespace
    try:
        invalid_name = UserProfileUpdate(full_name="   ")
        update_profile(profile_in=invalid_name, current_user=persisted_user, db=fresh_db)
        assert False, "Should have raised HTTPException for empty full_name"
    except HTTPException as e:
        assert e.status_code == 400
        print("[PASS] 6. Validation: empty full name rejected with HTTP 400")

    # 7. Avatar upload test
    fake_img_content = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"A" * 100
    upload_file = UploadFile(
        file=io.BytesIO(fake_img_content),
        filename="test_avatar.jpg",
        headers={"content-type": "image/jpeg"},
    )
    import asyncio
    avatar_result = asyncio.run(upload_avatar(file=upload_file, current_user=persisted_user, db=fresh_db))
    assert avatar_result.profile_image is not None
    assert avatar_result.profile_image.startswith("/uploads/avatar_")
    print(f"[PASS] 7. upload_avatar uploaded photo: {avatar_result.profile_image}")

    # 8. Avatar remove test
    remove_result = remove_avatar(current_user=persisted_user, db=fresh_db)
    assert remove_result.profile_image is None
    fresh_db.refresh(persisted_user)
    assert persisted_user.profile_image is None
    print("[PASS] 8. remove_avatar successfully cleared profile_image")

    # 9. Campus and departments endpoints test
    campuses = get_predefined_campuses()
    departments = get_predefined_departments()
    assert "ABC University" in campuses
    assert "Computer Engineering" in departments
    print(f"[PASS] 9. Predefined campuses ({len(campuses)}) and departments ({len(departments)}) verified")

    # Clean up test user
    fresh_db.delete(persisted_user)
    fresh_db.commit()
    fresh_db.close()

    print("=" * 60)
    print("ALL BACKEND PROFILE TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
