import sys
import os
from unittest.mock import patch

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal, init_db
from app.models.user import User
from app.config import settings
from app.core.security import get_password_hash

client = TestClient(app)


def run_google_auth_verification():
    print("==================================================")
    print("  TRACELT FASTAPI GOOGLE AUTHENTICATION TESTS")
    print("==================================================")

    init_db()

    test_google_sub = "google_test_sub_99887766"
    test_google_email = "google.student@campus.edu"
    test_google_name = "Maya Lin"

    # Clean up test users
    db = SessionLocal()
    for email in [test_google_email, "existing.pwd@campus.edu", "linking.user@campus.edu"]:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            db.delete(existing)
    existing_sub = db.query(User).filter(User.google_sub == test_google_sub).first()
    if existing_sub:
        db.delete(existing_sub)
    db.commit()
    db.close()

    # ---------------------------------------------------------
    # TEST 1: Missing Google configuration on server
    # ---------------------------------------------------------
    original_client_id = settings.GOOGLE_CLIENT_ID
    settings.GOOGLE_CLIENT_ID = None

    res = client.post("/api/auth/google", json={"credential": "some-dummy-token"})
    assert res.status_code == 500, f"Expected 500 when GOOGLE_CLIENT_ID missing, got {res.status_code}"
    assert "GOOGLE_CLIENT_ID in the environment" in res.json().get("detail", "")
    print("[PASS] 1. Missing GOOGLE_CLIENT_ID returns HTTP 500 configuration error")

    # Restore a test client id
    settings.GOOGLE_CLIENT_ID = "test-tracelt-client-id.apps.googleusercontent.com"

    # ---------------------------------------------------------
    # TEST 2: Invalid / Expired Token / Audience Mismatch
    # ---------------------------------------------------------
    # Token expired simulation
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.side_effect = ValueError("Token expired")
        res = client.post("/api/auth/google", json={"credential": "expired-token"})
        assert res.status_code == 401, f"Expected 401 for expired token, got {res.status_code}"
        assert "expired" in res.json().get("detail", "").lower()
        print("[PASS] 2. Expired Google token returns HTTP 401 Unauthorized")

    # Audience mismatch simulation
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.side_effect = ValueError("Wrong recipient, expected test-tracelt-client-id")
        res = client.post("/api/auth/google", json={"credential": "wrong-aud-token"})
        assert res.status_code == 401, f"Expected 401 for audience mismatch, got {res.status_code}"
        assert "audience mismatch" in res.json().get("detail", "").lower()
        print("[PASS] 3. Token audience mismatch returns HTTP 401 Unauthorized")

    # Unverified email claim simulation
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = {
            "sub": "some_sub",
            "email": "unverified@campus.edu",
            "email_verified": False,
            "name": "Unverified User",
        }
        res = client.post("/api/auth/google", json={"credential": "unverified-email-token"})
        assert res.status_code == 400, f"Expected 400 for unverified email, got {res.status_code}"
        assert "unverified" in res.json().get("detail", "").lower()
        print("[PASS] 4. Unverified Google email returns HTTP 400 Bad Request")

    # ---------------------------------------------------------
    # TEST 5: First-time Google user registration (Case A)
    # ---------------------------------------------------------
    mock_claims_maya = {
        "sub": test_google_sub,
        "email": test_google_email,
        "email_verified": True,
        "name": test_google_name,
        "picture": "https://lh3.googleusercontent.com/avatar_maya.jpg",
    }

    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = mock_claims_maya

        res = client.post(
            "/api/auth/google",
            json={
                "credential": "valid-token-maya",
                "campus": "KITCoEK",
                "department": "Computer Engineering",
            },
        )
        assert res.status_code == 200, f"Registration failed ({res.status_code}): {res.text}"
        data = res.json()
        assert "access_token" in data, "No access_token returned"
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == test_google_email
        assert data["user"]["full_name"] == test_google_name
        assert data["user"]["role"] == "student", f"Expected default role 'student', got: {data['user']['role']}"
        assert data["user"]["campus"] == "KITCoEK"
        assert data["user"]["department"] == "Computer Engineering"
        assert data["user"]["google_sub"] == test_google_sub
        assert data["user"]["is_google_linked"] is True
        token_maya = data["access_token"]
        print("[PASS] 5. Case A: First-time Google user registration succeeds with role 'student' and JWT token")

    # ---------------------------------------------------------
    # TEST 6: Returning Google user login (Case B)
    # ---------------------------------------------------------
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = mock_claims_maya

        res = client.post("/api/auth/google", json={"credential": "valid-token-maya"})
        assert res.status_code == 200, f"Returning login failed: {res.text}"
        data = res.json()
        assert data["user"]["email"] == test_google_email
        assert data["user"]["google_sub"] == test_google_sub
        print("[PASS] 6. Case B: Returning Google user authenticates without creating duplicate account")

    # ---------------------------------------------------------
    # TEST 7: Access protected route with issued JWT token
    # ---------------------------------------------------------
    headers = {"Authorization": f"Bearer {token_maya}"}
    res = client.get("/api/me", headers=headers)
    assert res.status_code == 200, f"Protected route failed: {res.text}"
    user_me = res.json()
    assert user_me["email"] == test_google_email
    assert user_me["is_google_linked"] is True
    print("[PASS] 7. Protected route (/api/me) accessible with Tracelt-issued JWT token")

    # ---------------------------------------------------------
    # TEST 8: Google-only user cannot log in via password endpoint
    # ---------------------------------------------------------
    res = client.post(
        "/api/login",
        json={"email": test_google_email, "password": "AnyRandomPassword123!"},
    )
    assert res.status_code == 401, f"Expected 401 for password login on Google-only account, got {res.status_code}"
    assert "Google Sign-In" in res.json().get("detail", "")
    print("[PASS] 8. Google-only account securely rejects arbitrary password attempts")

    # ---------------------------------------------------------
    # TEST 9: Existing email/password user account-linking requirement (Case C)
    # ---------------------------------------------------------
    # Create an existing email/password user
    reg_existing = {
        "full_name": "Jordan Lee",
        "email": "existing.pwd@campus.edu",
        "password": "Password123!",
        "campus": "ABC University",
        "department": "Mechanical Engineering",
    }
    res = client.post("/api/register", json=reg_existing)
    assert res.status_code == 201

    # Try Google Sign-In with matching email but unlinked sub
    mock_claims_existing_email = {
        "sub": "new_unlinked_sub_112233",
        "email": "existing.pwd@campus.edu",
        "email_verified": True,
        "name": "Jordan Lee",
    }
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = mock_claims_existing_email

        res = client.post("/api/auth/google", json={"credential": "token-for-existing-email"})
        assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}: {res.text}"
        detail = res.json().get("detail", {})
        code = detail.get("code") if isinstance(detail, dict) else ""
        assert code == "ACCOUNT_LINKING_REQUIRED", f"Expected code ACCOUNT_LINKING_REQUIRED, got: {detail}"
        print("[PASS] 9. Case C: Existing email/password user triggers 409 Conflict (ACCOUNT_LINKING_REQUIRED)")

    # ---------------------------------------------------------
    # TEST 10: Account linking via password verification (/auth/google/link-with-password)
    # ---------------------------------------------------------
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = mock_claims_existing_email

        # 10a. Bad password fails
        bad_link = {
            "email": "existing.pwd@campus.edu",
            "password": "WrongPassword!",
            "credential": "token-for-existing-email",
        }
        res = client.post("/api/auth/google/link-with-password", json=bad_link)
        assert res.status_code == 401
        print("[PASS] 10a. Account linking rejects incorrect password")

        # 10b. Correct password links successfully
        good_link = {
            "email": "existing.pwd@campus.edu",
            "password": "Password123!",
            "credential": "token-for-existing-email",
        }
        res = client.post("/api/auth/google/link-with-password", json=good_link)
        assert res.status_code == 200, f"Account linking failed: {res.text}"
        linked_data = res.json()
        assert linked_data["user"]["is_google_linked"] is True
        assert linked_data["user"]["google_sub"] == "new_unlinked_sub_112233"
        print("[PASS] 10b. Account linking with password verification succeeds and links Google identity")

        # 10c. Subsequent Google Sign-In now signs in immediately (Case B)
        res = client.post("/api/auth/google", json={"credential": "token-for-existing-email"})
        assert res.status_code == 200
        assert res.json()["user"]["email"] == "existing.pwd@campus.edu"
        print("[PASS] 10c. Linked user can now sign in seamlessly with Google")

    # ---------------------------------------------------------
    # TEST 11: Authenticated user linking & unlinking in Settings
    # ---------------------------------------------------------
    # Login as Jordan Lee with password to get fresh token
    login_res = client.post(
        "/api/login",
        json={"email": "existing.pwd@campus.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    jordan_token = login_res.json()["access_token"]
    jordan_headers = {"Authorization": f"Bearer {jordan_token}"}

    # Unlink Google account (allowed because user has password)
    res = client.post("/api/auth/google/unlink", headers=jordan_headers)
    assert res.status_code == 200, f"Unlink failed: {res.text}"
    assert res.json()["google_sub"] is None
    print("[PASS] 11a. Authenticated user can unlink Google account (password preserved)")

    # User without password cannot unlink Google account
    maya_headers = {"Authorization": f"Bearer {token_maya}"}
    res = client.post("/api/auth/google/unlink", headers=maya_headers)
    assert res.status_code == 400, f"Expected 400 for unlinking account without password, got {res.status_code}"
    print("[PASS] 11b. User without password cannot unlink Google account (prevents lockout)")

    # Relink Google account using authenticated endpoint /auth/google/link
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = {
            "sub": "relinked_sub_445566",
            "email": "existing.pwd@campus.edu",
            "email_verified": True,
            "name": "Jordan Lee",
        }
        res = client.post("/api/auth/google/link", headers=jordan_headers, json={"credential": "relink-token"})
        assert res.status_code == 200, f"Authenticated linking failed: {res.text}"
        assert res.json()["google_sub"] == "relinked_sub_445566"
        print("[PASS] 11c. Authenticated user can link Google account in profile settings")

    # ---------------------------------------------------------
    # TEST 12: Root route alias check (/auth/google)
    # ---------------------------------------------------------
    with patch("app.services.google_auth_service.id_token.verify_oauth2_token") as mock_verify:
        mock_verify.return_value = mock_claims_maya
        res = client.post("/auth/google", json={"credential": "valid-token-maya"})
        assert res.status_code == 200, f"Root alias failed: {res.text}"
        print("[PASS] 12. Root alias POST /auth/google is operational")

    # Restore original client ID
    settings.GOOGLE_CLIENT_ID = original_client_id

    print("\n==================================================")
    print("  ALL 12 GOOGLE AUTHENTICATION TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    run_google_auth_verification()
