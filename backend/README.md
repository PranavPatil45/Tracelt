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

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/register` (or `/register`) | Create new user account | No |
| `POST` | `/api/login` (or `/login`) | Authenticate user & get JWT | No |
| `POST` | `/api/token` | OAuth2 form login for Swagger docs | No |
| `GET` | `/api/me` (or `/me`) | Get current user's profile | Yes (Bearer token) |
| `GET` | `/health` | Service health status | No |
