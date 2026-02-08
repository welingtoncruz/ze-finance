"""
Pydantic schemas for request/response validation and serialization.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# Auth Schemas
class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(min_length=8)


class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


# Transaction Schemas
class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""
    amount: Decimal = Field(gt=0, description="Amount must be positive")
    type: str = Field(pattern="^(INCOME|EXPENSE)$")
    category: str
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        """Validate transaction type."""
        if v not in ("INCOME", "EXPENSE"):
            raise ValueError("type must be either INCOME or EXPENSE")
        return v


class TransactionUpdate(BaseModel):
    """Schema for updating a transaction (partial update, all fields optional)."""
    amount: Optional[Decimal] = Field(default=None, gt=0, description="Amount must be positive if provided")
    type: Optional[str] = Field(default=None, pattern="^(INCOME|EXPENSE)$")
    category: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate transaction type."""
        if v is not None and v not in ("INCOME", "EXPENSE"):
            raise ValueError("type must be either INCOME or EXPENSE")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """Validate category is non-empty if provided."""
        if v is not None and not v.strip():
            raise ValueError("category must be non-empty if provided")
        return v.strip() if v else None


class TransactionResponse(BaseModel):
    """Schema for transaction response."""
    id: UUID
    amount: Decimal
    type: str
    category: str
    description: Optional[str] = None
    occurred_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Dashboard Schemas
class CategoryMetric(BaseModel):
    """Schema for category aggregation metric."""
    name: str
    value: Decimal


class DashboardSummary(BaseModel):
    """Schema for dashboard summary response."""
    total_balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    by_category: list[CategoryMetric]
