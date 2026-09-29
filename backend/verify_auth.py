import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User

client = TestClient(app)

def run_verification():
    print("========================================")
    print("  TRACELT FASTAPI AUTH VERIFICATION")
    print("========================================")

    Base.metadata.create_all(bind=engine)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[PASS] GET /health -> 200 OK")

    # Clean up test user if exists
    db = SessionLocal()
    test_email = "alex.chen@campus.edu"
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    # 2. Registration
    reg_payload = {
        "full_name": "Alex Chen",
        "email": test_email,
        "password": "SuperSecurePassword123!",
        "campus": "North Campus - Tech Center",
        "department": "Computer Science & Engineering",
    }
    res = client.post("/api/register", json=reg_payload)
    assert res.status_code == 201, f"Registration failed ({res.status_code}): {res.text}"
    data = res.json()
    assert "access_token" in data, "No access_token returned"
    assert data["token_type"] == "bearer", f"Invalid token_type: {data.get('token_type')}"
    assert data["user"]["email"] == test_email, f"User email mismatch: {data['user']}"
    assert data["user"]["full_name"] == "Alex Chen"
    token = data["access_token"]
    print(f"[PASS] POST /api/register -> 201 Created (Token received: {token[:20]}...)")

    # 3. Duplicate Registration should return 409 Conflict
    res = client.post("/api/register", json=reg_payload)
    assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}: {res.text}"
    assert "already exists" in res.json().get("detail", "").lower()
    print("[PASS] POST /api/register (duplicate) -> 409 Conflict")

    # 4. Login with correct credentials
    login_payload = {
        "email": test_email,
        "password": "SuperSecurePassword123!",
        "remember": True,
    }
    res = client.post("/api/login", json=login_payload)
    assert res.status_code == 200, f"Login failed: {res.text}"
    login_data = res.json()
    assert "access_token" in login_data
    assert login_data["user"]["full_name"] == "Alex Chen"
    print("[PASS] POST /api/login (valid) -> 200 OK")

    # 5. Login with incorrect password
    bad_login = {
        "email": test_email,
        "password": "WrongPassword!",
        "remember": False,
    }
    res = client.post("/api/login", json=bad_login)
    assert res.status_code == 401, f"Expected 401 Unauthorized, got {res.status_code}"
    print("[PASS] POST /api/login (invalid password) -> 401 Unauthorized")

    # 6. Authenticated /me endpoint
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/me", headers=headers)
    assert res.status_code == 200, f"GET /me failed: {res.text}"
    me_data = res.json()
    assert me_data["email"] == test_email
    assert me_data["full_name"] == "Alex Chen"
    assert me_data["campus"] == "North Campus - Tech Center"
    print(f"[PASS] GET /api/me (authenticated) -> 200 OK (User: {me_data['full_name']})")

    # 7. Unauthenticated /me endpoint
    res = client.get("/api/me")
    assert res.status_code == 401, f"Expected 401 for unauthenticated /me, got {res.status_code}"
    print("[PASS] GET /api/me (unauthenticated) -> 401 Unauthorized")

    # 8. OAuth2 token endpoint for Swagger docs
    form_payload = {
        "username": test_email,
        "password": "SuperSecurePassword123!",
    }
    res = client.post("/api/token", data=form_payload)
    assert res.status_code == 200, f"POST /token failed: {res.text}"
    assert "access_token" in res.json()
    print("[PASS] POST /api/token (Swagger OAuth2 form) -> 200 OK")

    # 9. Also verify root-level routes (/login, /register, /me)
    res = client.get("/me", headers=headers)
    assert res.status_code == 200, f"GET /me (root alias) failed: {res.text}"
    print("[PASS] GET /me (root alias) -> 200 OK")

    print("\nALL 9 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_verification()
