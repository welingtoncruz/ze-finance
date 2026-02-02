"""
Transaction routes: create, list, and delete transactions.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.auth_utils import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[schemas.TransactionResponse])
async def list_transactions(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[schemas.TransactionResponse]:
    """
    List transactions for the authenticated user.
    
    Args:
        limit: Maximum number of transactions to return (default: 50)
        current_user: Authenticated user (from JWT)
        db: Database session
        
    Returns:
        List of transaction responses
    """
    transactions = await crud.list_user_transactions(db, current_user.id, limit)
    return transactions


@router.post("", response_model=schemas.TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_in: schemas.TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> schemas.TransactionResponse:
    """
    Create a new transaction for the authenticated user.
    
    Args:
        tx_in: Transaction creation data
        current_user: Authenticated user (from JWT)
        db: Database session
        
    Returns:
        Created transaction response
    """
    transaction = await crud.create_user_transaction(db, tx_in, current_user.id)
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a transaction if it belongs to the authenticated user.
    
    Args:
        transaction_id: UUID of the transaction to delete
        current_user: Authenticated user (from JWT)
        db: Database session
        
    Raises:
        HTTPException: If transaction not found (404)
    """
    deleted = await crud.delete_user_transaction(db, transaction_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
