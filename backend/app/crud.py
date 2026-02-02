"""
CRUD operations and business logic for User, Transaction, and Dashboard.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction, User
from app.schemas import (
    CategoryMetric,
    DashboardSummary,
    TransactionCreate,
    UserCreate,
)
from app.auth_utils import get_password_hash, verify_password


# Auth CRUD
async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    """
    Create a new user with email uniqueness check and password hashing.
    
    Args:
        db: Database session
        user_in: User creation schema
        
    Returns:
        The created User object
        
    Raises:
        HTTPException: If email already exists
    """
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create new user
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> Optional[User]:
    """
    Authenticate a user by email and password.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
        
    Returns:
        User object if authentication succeeds, None otherwise
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    # Update last_login_at
    user.last_login_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    
    return user


# Transaction CRUD
async def create_user_transaction(
    db: AsyncSession,
    tx_in: TransactionCreate,
    user_id: UUID,
) -> Transaction:
    """
    Create a new transaction for a user.
    
    Args:
        db: Database session
        tx_in: Transaction creation schema
        user_id: ID of the user creating the transaction
        
    Returns:
        The created Transaction object
        
    Raises:
        HTTPException: If amount is not positive
    """
    # Validate amount is positive (should be enforced by schema, but double-check)
    if tx_in.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be positive",
        )
    
    # Use occurred_at if provided, otherwise use current time
    occurred_at = tx_in.occurred_at if tx_in.occurred_at else datetime.utcnow()
    
    db_transaction = Transaction(
        user_id=user_id,
        amount=tx_in.amount,
        type=tx_in.type,
        category=tx_in.category,
        description=tx_in.description,
        occurred_at=occurred_at,
    )
    db.add(db_transaction)
    await db.commit()
    await db.refresh(db_transaction)
    return db_transaction


async def list_user_transactions(
    db: AsyncSession,
    user_id: UUID,
    limit: int = 50,
) -> list[Transaction]:
    """
    List transactions for a user, ordered by occurred_at descending.
    
    Args:
        db: Database session
        user_id: ID of the user
        limit: Maximum number of transactions to return
        
    Returns:
        List of Transaction objects
    """
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.occurred_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def delete_user_transaction(
    db: AsyncSession,
    transaction_id: UUID,
    user_id: UUID,
) -> bool:
    """
    Delete a transaction if it belongs to the user.
    
    Args:
        db: Database session
        transaction_id: ID of the transaction to delete
        user_id: ID of the user (for ownership verification)
        
    Returns:
        True if transaction was deleted, False if not found
        
    Raises:
        HTTPException: If transaction doesn't belong to user (404)
    """
    # Use delete statement with WHERE clause for atomic operation
    result = await db.execute(
        delete(Transaction).where(
            (Transaction.id == transaction_id) & (Transaction.user_id == user_id)
        )
    )
    await db.commit()
    
    # Return True if a row was deleted, False otherwise
    return result.rowcount > 0


# Dashboard CRUD
async def get_dashboard_summary(
    db: AsyncSession,
    user_id: UUID,
) -> DashboardSummary:
    """
    Get dashboard summary with totals and category breakdown.
    
    Args:
        db: Database session
        user_id: ID of the user
        
    Returns:
        DashboardSummary with totals and category metrics
    """
    # Get all transactions for the user
    result = await db.execute(
        select(Transaction).where(Transaction.user_id == user_id)
    )
    transactions = list(result.scalars().all())
    
    # Calculate totals
    total_income = Decimal("0.00")
    total_expense = Decimal("0.00")
    category_totals: dict[str, Decimal] = {}
    
    for tx in transactions:
        amount = Decimal(str(tx.amount))
        if tx.type == "INCOME":
            total_income += amount
        else:  # EXPENSE
            total_expense += amount
        
        # Aggregate by category (for expenses only, as per common dashboard pattern)
        if tx.type == "EXPENSE":
            category_totals[tx.category] = category_totals.get(tx.category, Decimal("0.00")) + amount
    
    total_balance = total_income - total_expense
    
    # Build category metrics list
    by_category = [
        CategoryMetric(name=category, value=value)
        for category, value in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    ]
    
    return DashboardSummary(
        total_balance=total_balance,
        total_income=total_income,
        total_expense=total_expense,
        by_category=by_category,
    )
