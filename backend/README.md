# Tracelt FastAPI Authentication Backend

FastAPI backend providing JWT-based user registration, login, and profile endpoints for the Tracelt lost & found portal.

## Tech Stack & Dependencies

- **Python** 3.12+
- `fastapi==0.110.0`
- `uvicorn==0.28.0`
- `sqlalchemy==2.0.28`
- `pydantic==2.6.4`
- `pydantic-settings==2.2.1`
- `pyjwt==2.8.0`
- `passlib[bcrypt]==1.7.4`
- `python-multipart==0.0.9`
- `bcrypt==4.0.1`

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── deps.py          # FastAPI dependencies (get_current_user)
│   │   └── security.py      # Password hashing & JWT encode/decode
│   ├── crud/
│   │   └── user.py          # Database operations
│   ├── models/
│   │   └── user.py          # SQLAlchemy User model
│   ├── routers/
│   │   └── auth.py          # /register, /login, /token, /me endpoints
│   ├── schemas/
│   │   └── auth.py          # Pydantic schemas (UserRegister, UserLogin, Token, etc.)
│   ├── config.py            # App settings via pydantic-settings
│   ├── database.py          # SQLAlchemy engine & sessionmaker
│   └── main.py              # FastAPI app initialization & CORS
├── .env                     # Local environment configuration
├── .env.example             # Example environment configuration
└── requirements.txt         # Pinned dependencies
```

## Running the Backend

From the workspace root or `backend` folder:

```bash
# Activate virtual environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Start the development server
uvicorn app.main:app --reload --port 8000 --app-dir backend
```

- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/register` (or `/register`) | Create new user account | No |
| `POST` | `/api/login` (or `/login`) | Authenticate user & get JWT | No |
| `POST` | `/api/token` | OAuth2 form login for Swagger docs | No |
| `POST` | `/api/auth/google` (or `/auth/google`) | Sign-in / sign-up with Google ID token credential | No |
| `POST` | `/api/auth/google/link-with-password` | Link existing password account with Google credential | No |
| `POST` | `/api/auth/google/link` | Link Google account to current authenticated user | Yes (Bearer token) |
| `POST` | `/api/auth/google/unlink` | Disconnect Google account from current user | Yes (Bearer token) |
| `GET` | `/api/me` (or `/me`) | Get current user's profile | Yes (Bearer token) |
| `GET` | `/health` | Service health status | No |

## Google Authentication Setup

### 1. Google Cloud Console Configuration
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select an existing project.
3. Configure the **OAuth Consent Screen**:
   - User Type: **External** (or Internal for institutional Google Workspace).
   - App Name: `Tracelt`
   - User support email and developer contact info.
   - Scopes: `openid`, `email`, `profile`.
4. Create an **OAuth 2.0 Client ID**:
   - Application Type: **Web application**
   - Name: `Tracelt Web Client`
   - **Authorized JavaScript origins**:
     - Local dev: `http://localhost:5173` and `http://127.0.0.1:5173`
     - Production: `https://yourdomain.com`
   - Authorized redirect URIs: Not required for Google Identity Services (GIS) ID-token popups.
5. Copy the generated **Client ID** (e.g. `123456789-abcdef.apps.googleusercontent.com`).

### 2. Environment Configuration
- In `backend/.env`:
  ```bash
  GOOGLE_CLIENT_ID="123456789-abcdef.apps.googleusercontent.com"
  ```
- In `frontend/.env`:
  ```bash
  VITE_GOOGLE_CLIENT_ID="123456789-abcdef.apps.googleusercontent.com"
  ```

### 3. Account Linking & Security Model
- **Case A (New User)**: Registers account with verified email, default role `student`, and prompts for campus in profile if not provided during signup.
- **Case B (Returning Google User)**: Automatically signs in and returns standard Tracelt JWT access token.
- **Case C (Existing Email/Password User)**: Prevents duplicate accounts or silent auto-linking. Returns HTTP 409 `ACCOUNT_LINKING_REQUIRED` and displays an explicit password-verification linking card in the UI or allows linking inside Settings.

### 4. Running Verification Tests
Execute automated authentication suites (with mocks; no live Google network requests):
```bash
# Verify baseline email/password authentication
python backend/verify_auth.py

# Verify Google Identity Services authentication & account linking
python backend/verify_google_auth.py
```
