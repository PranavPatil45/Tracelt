import logging
from typing import Dict, Any, Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger("tracelt.google_auth")


def verify_google_credential(credential: str, client_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Cryptographically verifies a Google ID token credential using Google's official auth library.
    
    Validates:
    - Token signature against Google's public JWK certificates
    - Token audience (aud) matches the trusted GOOGLE_CLIENT_ID
    - Token issuer (iss) is 'accounts.google.com' or 'https://accounts.google.com'
    - Token expiration (exp) is valid
    - Email claim exists and is verified (email_verified == True)
    - Google subject identifier (sub) is present and non-empty

    Returns dictionary containing verified payload claims.
    Never trusts unverified payload claims from the frontend.
    """
    if not credential or not isinstance(credential, str) or not credential.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google authentication credential.",
        )

    expected_client_id = client_id or settings.GOOGLE_CLIENT_ID
    if not expected_client_id:
        logger.error("Google authentication failed: GOOGLE_CLIENT_ID is not configured on the backend server.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Authentication is not configured on the server. Please set GOOGLE_CLIENT_ID in the environment.",
        )

    try:
        request = google_requests.Request()
        # verify_oauth2_token validates signature, expiration, issuer, and audience
        idinfo = id_token.verify_oauth2_token(
            id_token=credential.strip(),
            request=request,
            audience=expected_client_id,
            clock_skew_in_seconds=10,
        )
    except ValueError as e:
        logger.warning(f"Google ID token verification failed (ValueError): {e}")
        error_msg = str(e)
        if "Token expired" in error_msg:
            detail = "Google credential has expired. Please sign in again."
        elif "Wrong recipient" in error_msg or "audience" in error_msg.lower():
            detail = "Google credential audience mismatch. Check configured Google Client ID."
        else:
            detail = "Invalid Google credential or signature."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        )
    except Exception as e:
        logger.error(f"Google verification network/service error: {e}", exc_info=False)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify credential with Google Identity Services. Please check your network and try again.",
        )

    # 1. Require subject identifier
    sub = idinfo.get("sub")
    if not sub or not str(sub).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token does not contain a valid subject identifier (sub).",
        )

    # 2. Require verified email
    email = idinfo.get("email")
    if not email or not str(email).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account does not have an associated email address.",
        )

    email_verified = idinfo.get("email_verified")
    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your Google email address is unverified. Please verify your email with Google first.",
        )

    return {
        "sub": str(sub).strip(),
        "email": str(email).strip().lower(),
        "name": (idinfo.get("name") or idinfo.get("given_name") or email.split("@")[0]).strip(),
        "picture": idinfo.get("picture"),
        "email_verified": True,
    }
