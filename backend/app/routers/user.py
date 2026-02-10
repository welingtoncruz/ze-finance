"""
User profile routes: read and update authenticated user configuration.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.auth_utils import get_current_user
from app.database import get_db
from app.models import User


router = APIRouter(tags=["user"])


@router.get(
    "/user/profile",
    response_model=schemas.UserProfileResponse,
    status_code=status.HTTP_200_OK,
)
async def get_user_profile_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> schemas.UserProfileResponse:
    """
    Get the authenticated user's profile.
    """
    user = await crud.get_user_profile(db, current_user.id)

    monthly_budget = (
        user.monthly_budget
        if user.monthly_budget is not None
        else crud.get_default_monthly_budget()
    )

    return schemas.UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        monthly_budget=monthly_budget,
    )


@router.patch(
    "/user/profile",
    response_model=schemas.UserProfileResponse,
    status_code=status.HTTP_200_OK,
)
async def update_user_profile_endpoint(
    profile_in: schemas.UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> schemas.UserProfileResponse:
    """
    Update the authenticated user's profile configuration.
    """
    user = await crud.update_user_profile(
        db=db,
        user_id=current_user.id,
        profile_in=profile_in,
    )

    monthly_budget = (
        user.monthly_budget
        if user.monthly_budget is not None
        else crud.get_default_monthly_budget()
    )

    return schemas.UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        monthly_budget=monthly_budget,
    )

