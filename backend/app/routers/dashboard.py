"""
Dashboard routes: get financial summary.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.auth_utils import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=schemas.DashboardSummary)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> schemas.DashboardSummary:
    """
    Get dashboard summary with totals and category breakdown for the authenticated user.
    
    Args:
        current_user: Authenticated user (from JWT)
        db: Database session
        
    Returns:
        Dashboard summary with balance, totals, and category metrics
    """
    summary = await crud.get_dashboard_summary(db, current_user.id)
    return summary
