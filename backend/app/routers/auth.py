"""
Authentication routes: register, login, refresh, and logout.
"""
import os
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status

from app.rate_limit import limiter
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.auth_utils import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_refresh_token_expiry,
)
from app.database import get_db
from app.models import User

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
async def register(
    request: Request,
    user_in: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
) -> schemas.Token:
    """
    Register a new user and return an access token.
    
    Args:
        user_in: User registration data
        db: Database session
        
    Returns:
        Token response with access_token
        
    Raises:
        HTTPException: If email already exists (400)
    """
    user = await crud.create_user(db, user_in)
    access_token = create_access_token(user_id=user.id)
    return schemas.Token(access_token=access_token, token_type="bearer")


@router.post("/token", response_model=schemas.Token)
@limiter.limit("5/15minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = False,
    db: AsyncSession = Depends(get_db),
) -> schemas.Token:
    """
    Login endpoint (OAuth2 compatible) that returns a JWT token.
    
    Args:
        form_data: OAuth2 form data with username (email) and password
        db: Database session
        
    Returns:
        Token response with access_token
        
    Raises:
        HTTPException: If credentials are invalid (401)
    """
    user = await crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user_id=user.id)

    # Issue refresh token and set it as an HTTP-only cookie
    raw_refresh_token = create_refresh_token()
    expires_at = get_refresh_token_expiry(remember_me=remember_me)
    await crud.create_persistent_refresh_token(
        db=db,
        user_id=user.id,
        raw_token=raw_refresh_token,
        expires_at=expires_at,
    )

    secure_cookie = os.getenv("ENVIRONMENT", "development") != "development"
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        path="/",
        expires=int(expires_at.timestamp()),
    )

    return schemas.Token(access_token=access_token, token_type="bearer")


@router.get("/auth/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get current authenticated user information.
    Note: This is a helper endpoint, not in the original API spec but useful for testing.
    """
    return {"email": current_user.email}


@router.post("/auth/refresh", response_model=schemas.Token)
@limiter.limit("10/minute")
async def refresh_access_token(
    request: Request,
    response: Response,
    body: Optional[schemas.TokenRefreshRequest] = Body(None),
    db: AsyncSession = Depends(get_db),
) -> schemas.Token:
    """
    Exchange a valid refresh token for a new access token.
    
    The refresh token is primarily expected in an HTTP-only cookie, but an
    optional body field is also supported for flexibility.
    """
    cookie_token = request.cookies.get("refresh_token")
    body_token = body.refresh_token if body is not None else None
    raw_refresh_token = body_token or cookie_token

    if not raw_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    refresh_token = await crud.find_valid_refresh_token(db, raw_refresh_token)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    access_token = create_access_token(user_id=refresh_token.user_id)

    # Re-issue cookie with the same token and updated expiry to extend lifetime
    # according to the non-remember-me configuration.
    expires_at = get_refresh_token_expiry(remember_me=False)
    secure_cookie = os.getenv("ENVIRONMENT", "development") != "development"
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        path="/",
        expires=int(expires_at.timestamp()),
    )

    return schemas.Token(access_token=access_token, token_type="bearer")


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Logout the current user by revoking the refresh token and clearing the cookie.
    """
    raw_refresh_token = request.cookies.get("refresh_token")
    if raw_refresh_token:
        await crud.revoke_refresh_token_by_raw(db, raw_refresh_token)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key="refresh_token",
        path="/",
    )
    return response
