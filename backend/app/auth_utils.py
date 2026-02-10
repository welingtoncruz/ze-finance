"""
Authentication utilities: JWT token creation, refresh token helpers, and password hashing.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User

# Password hashing context
# Configure bcrypt backend explicitly to avoid compatibility issues
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__ident="2b",  # Use bcrypt 2b identifier
)

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# JWT configuration from environment
_SECRET_KEY_DEFAULT = "dev-secret-key-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", _SECRET_KEY_DEFAULT)
ALGORITHM = os.getenv("ALGORITHM", "HS256")


def _validate_secret_key() -> None:
    """Fail fast if SECRET_KEY is default in production (JWT forgery risk)."""
    env = os.getenv("ENVIRONMENT", "development")
    if env == "production" and SECRET_KEY == _SECRET_KEY_DEFAULT:
        raise RuntimeError(
            "SECRET_KEY must be set to a secure value in production. "
            "Do not use the default dev-secret-key-change-in-production."
        )


ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Refresh token configuration from environment
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER_ME = int(
    os.getenv("REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER_ME", "30")
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    
    Args:
        plain_password: The plain text password to verify
        hashed_password: The hashed password to compare against
        
    Returns:
        True if passwords match, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: The plain text password to hash
        
    Returns:
        The hashed password string
    """
    return pwd_context.hash(password)


def create_access_token(user_id: UUID, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token for a user.
    
    Args:
        user_id: The UUID of the user
        expires_delta: Optional custom expiration time. If not provided, uses ACCESS_TOKEN_EXPIRE_MINUTES
        
    Returns:
        The encoded JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "nonce": secrets.token_urlsafe(8),
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token() -> str:
    """
    Create a new opaque refresh token string.
    
    Returns:
        A URL-safe random token string
    """
    return secrets.token_urlsafe(64)


def hash_refresh_token(raw_token: str) -> str:
    """
    Hash a refresh token using a deterministic one-way hash.
    
    Args:
        raw_token: The plain text refresh token
        
    Returns:
        Hex-encoded SHA-256 hash of the token
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def get_refresh_token_expiry(remember_me: bool) -> datetime:
    """
    Compute the expiration datetime for a refresh token.
    
    Args:
        remember_me: Whether the user selected the 'remember me' option
        
    Returns:
        Datetime when the refresh token should expire
    """
    days = REFRESH_TOKEN_EXPIRE_DAYS_REMEMBER_ME if remember_me else REFRESH_TOKEN_EXPIRE_DAYS
    return datetime.now(timezone.utc) + timedelta(days=days)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency to get the current authenticated user from JWT token.
    
    Args:
        token: The JWT token from the Authorization header
        db: Database session dependency
        
    Returns:
        The authenticated User object
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
    
    # Fetch user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    return user
