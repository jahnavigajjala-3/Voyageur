from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set in environment variables")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


class TokenData(BaseModel):
    user_id: int
    email: str
    token_type: str  # "access" or "refresh"


def create_access_token(user_id: int, email: str) -> str:
    """Generate a short-lived access token (30 min)"""
    to_encode = {
        "user_id": user_id,
        "email": email,
        "token_type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: int, email: str) -> str:
    """Generate a long-lived refresh token (7 days)"""
    to_encode = {
        "user_id": user_id,
        "email": email,
        "token_type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": datetime.utcnow(),
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, expected_type: str = "access") -> Optional[TokenData]:
    """
    Verify a JWT token and return token data.
    Returns None if token is invalid/expired.
    expected_type: "access" or "refresh"
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        token_type: str = payload.get("token_type")

        if user_id is None or email is None or token_type is None:
            return None

        # Check token type matches expectation
        if token_type != expected_type:
            return None

        return TokenData(user_id=user_id, email=email, token_type=token_type)

    except JWTError:
        return None


def decode_token_without_validation(token: str) -> Optional[dict]:
    """
    Decode token WITHOUT verification (use only for debugging).
    NEVER use this in production auth logic.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        return payload
    except JWTError:
        return None
