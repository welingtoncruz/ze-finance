"""
CRUD operations and business logic for User, Transaction, and Dashboard.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
import os

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken, Transaction, User
from app.schemas import (
    CategoryMetric,
    DashboardSummary,
    TransactionCreate,
    TransactionUpdate,
    UserCreate,
    UserProfileUpdate,
)
from app.auth_utils import get_password_hash, hash_refresh_token, verify_password


def get_default_monthly_budget() -> Decimal:
    """
    Get the default monthly budget for new users.

    Reads from DEFAULT_MONTHLY_BUDGET env var, falling back to 5000.
    """
    raw_value = os.getenv("DEFAULT_MONTHLY_BUDGET", "5000")
    try:
        return Decimal(raw_value)
    except Exception:
        # Fallback to a safe default if env value is invalid
        return Decimal("5000")


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
        full_name=user_in.full_name.strip() if user_in.full_name else None,
        monthly_budget=get_default_monthly_budget(),
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


# Refresh token CRUD
async def create_persistent_refresh_token(
    db: AsyncSession,
    user_id: UUID,
    raw_token: str,
    expires_at: datetime,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> RefreshToken:
    """
    Persist a hashed refresh token for a user.
    
    Args:
        db: Database session
        user_id: ID of the user
        raw_token: Plain text refresh token
        expires_at: Expiration datetime for the refresh token
        user_agent: Optional user agent string for auditing
        ip_address: Optional IP address for auditing
        
    Returns:
        The created RefreshToken object
    """
    del user_agent  # Reserved for future auditing improvements
    del ip_address  # Reserved for future auditing improvements

    token = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=expires_at,
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)
    return token


async def find_valid_refresh_token(
    db: AsyncSession,
    raw_token: str,
) -> Optional[RefreshToken]:
    """
    Find a valid (non-expired, non-revoked) refresh token by its raw value.
    
    Args:
        db: Database session
        raw_token: Plain text refresh token
        
    Returns:
        RefreshToken object if found and valid, None otherwise
    """
    now = datetime.utcnow()
    token_hash = hash_refresh_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(
            (RefreshToken.token_hash == token_hash)
            & (RefreshToken.expires_at > now)
            & (RefreshToken.revoked_at.is_(None))
        )
    )
    return result.scalar_one_or_none()


async def revoke_refresh_token(
    db: AsyncSession,
    refresh_token: RefreshToken,
) -> None:
    """
    Revoke a single refresh token.
    
    Args:
        db: Database session
        refresh_token: The RefreshToken instance to revoke
    """
    refresh_token.revoked_at = datetime.utcnow()
    await db.commit()


async def revoke_refresh_token_by_raw(
    db: AsyncSession,
    raw_token: str,
) -> None:
    """
    Revoke a refresh token by its raw value.
    
    Args:
        db: Database session
        raw_token: Plain text refresh token
    """
    token_hash = hash_refresh_token(raw_token)
    now = datetime.utcnow()
    result = await db.execute(
        select(RefreshToken).where(
            (RefreshToken.token_hash == token_hash)
            & (RefreshToken.revoked_at.is_(None))
        )
    )
    token = result.scalar_one_or_none()
    if token:
        token.revoked_at = now
        await db.commit()


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


async def get_user_transaction(
    db: AsyncSession,
    transaction_id: UUID,
    user_id: UUID,
) -> Optional[Transaction]:
    """
    Get a transaction by ID if it belongs to the user.
    
    Args:
        db: Database session
        transaction_id: ID of the transaction
        user_id: ID of the user (for ownership verification)
        
    Returns:
        Transaction object if found and owned by user, None otherwise
    """
    result = await db.execute(
        select(Transaction).where(
            (Transaction.id == transaction_id) & (Transaction.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def update_user_transaction(
    db: AsyncSession,
    transaction_id: UUID,
    user_id: UUID,
    tx_update: TransactionUpdate,
) -> Optional[Transaction]:
    """
    Update a transaction if it belongs to the user.
    
    Args:
        db: Database session
        transaction_id: ID of the transaction to update
        user_id: ID of the user (for ownership verification)
        tx_update: Transaction update schema (partial fields)
        
    Returns:
        Updated Transaction object if found and updated, None if not found
        
    Raises:
        HTTPException: If validation fails (amount <= 0, etc.)
    """
    # Fetch the transaction
    transaction = await get_user_transaction(db, transaction_id, user_id)
    if not transaction:
        return None
    
    # Check if at least one field is provided
    update_data = tx_update.model_dump(exclude_unset=True)
    if not update_data:
        # No-op: return current transaction
        return transaction
    
    # Validate amount if provided
    if "amount" in update_data and update_data["amount"] is not None:
        if update_data["amount"] <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be positive",
            )
    
    # Update fields
    for field, value in update_data.items():
        if value is not None:
            setattr(transaction, field, value)
    
    await db.commit()
    await db.refresh(transaction)
    return transaction


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


async def get_user_profile(
    db: AsyncSession,
    user_id: UUID,
) -> User:
    """
    Get the authenticated user's profile.

    Args:
        db: Database session
        user_id: ID of the authenticated user

    Returns:
        User entity for profile mapping

    Raises:
        HTTPException: If user is not found
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def update_user_profile(
    db: AsyncSession,
    user_id: UUID,
    profile_in: UserProfileUpdate,
) -> User:
    """
    Update the authenticated user's profile fields.

    Args:
        db: Database session
        user_id: ID of the authenticated user
        profile_in: Profile update payload

    Returns:
        Updated User entity

    Raises:
        HTTPException: If user is not found
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = profile_in.model_dump(exclude_unset=True)

    if "full_name" in update_data:
        user.full_name = update_data["full_name"]

    if "monthly_budget" in update_data and update_data["monthly_budget"] is not None:
        if update_data["monthly_budget"] <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Monthly budget must be positive",
            )
        user.monthly_budget = update_data["monthly_budget"]

    await db.commit()
    await db.refresh(user)
    return user
