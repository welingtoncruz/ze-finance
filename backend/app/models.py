"""
SQLAlchemy database models for Zefa Finance MVP.
"""
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """
    User model representing a registered user in the system.
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    transactions = relationship(
        "Transaction",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"


class Transaction(Base):
    """
    Transaction model representing a financial movement (income or expense).
    """
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount = Column(Numeric(10, 2), nullable=False)  # Decimal precision for financial accuracy
    type = Column(Enum("INCOME", "EXPENSE", name="transaction_type"), nullable=False)
    category = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="transactions")

    # Index for optimized dashboard queries
    __table_args__ = (
        Index("idx_transactions_user_occurred", "user_id", "occurred_at"),
    )

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, user_id={self.user_id}, type={self.type}, amount={self.amount})>"
