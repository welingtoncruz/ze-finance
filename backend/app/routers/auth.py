"""
Authentication routes: register and login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.auth_utils import create_access_token, get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token, status_code=status.HTTP_201_CREATED)
async def register(
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
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
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
    return schemas.Token(access_token=access_token, token_type="bearer")


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get current authenticated user information.
    Note: This is a helper endpoint, not in the original API spec but useful for testing.
    """
    return {"email": current_user.email}
