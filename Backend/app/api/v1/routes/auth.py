"""
Google OAuth route.

Flow:
  1. Frontend receives a Google access_token via @react-oauth/google
  2. Frontend POSTs it to POST /api/v1/auth/google
  3. We call Google's userinfo endpoint to verify the token and get the user profile
  4. We upsert the user in our DB (create if new, fetch if existing)
  5. We return our own JWT pair (same shape as /login)

Why userinfo instead of id_token verification?
  @react-oauth/google's implicit flow returns an access_token, not an id_token.
  Calling the userinfo endpoint is the correct way to verify an access_token.
  It also gives us name, email, and picture in one call.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx
import secrets

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginResponse, UserResponse
from app.utils.jwt_utils import create_access_token, create_refresh_token

router = APIRouter()

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.post("/auth/google", response_model=LoginResponse)
async def google_auth(
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Verify a Google access_token, upsert the user, and return our JWT pair.

    Expected body: { "access_token": "<google_access_token>" }
    """
    google_access_token = payload.get("access_token")
    if not google_access_token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="access_token is required",
        )

    # ── 1. Verify token with Google and fetch profile ──────────────────────
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not reach Google servers: {exc}",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google token",
        )

    profile = resp.json()
    email   = profile.get("email")
    name    = profile.get("name") or profile.get("given_name") or "Google User"

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not return an email address",
        )

    # ── 2. Upsert user ────────────────────────────────────────────────────
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # New user — create with a random unusable password so the
        # existing password column constraint is satisfied.
        # They can set a password later via a "forgot password" flow.
        random_password = secrets.token_hex(32)
        user = User(
            name=name,
            email=email,
            password=random_password,   # not a valid bcrypt hash — intentional
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # ── 3. Issue our own JWT pair ─────────────────────────────────────────
    access_token  = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id, user.email)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.from_orm(user),
    )
