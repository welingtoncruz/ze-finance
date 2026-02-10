"""
Pydantic schemas for chat API and tool contracts.
"""
from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# Chat Schemas
class ChatMessageCreate(BaseModel):
    """Schema for creating a new chat message."""
    conversation_id: Optional[UUID] = None
    text: Optional[str] = Field(default=None, max_length=10000)
    content_type: Literal["text"] = "text"


class ChatMessage(BaseModel):
    """Schema for a single chat message (used within the response envelope)."""
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    content_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionCreatedData(BaseModel):
    """Data payload for transaction creation UI event."""
    transaction: dict  # Transaction data from tool result


class ChatUiEvent(BaseModel):
    """UI event metadata for frontend rendering."""
    type: Literal["success_card", "warning_card", "info_card"]
    variant: Literal["neon"] = "neon"
    accent: Literal["electric_lime", "deep_indigo"] = "electric_lime"
    title: str
    subtitle: Optional[str] = None
    data: Optional[dict] = None  # Flexible payload (e.g., TransactionCreatedData)


class ChatAssistantMeta(BaseModel):
    """Metadata about assistant response (UI events, insights, actions)."""
    ui_events: list[ChatUiEvent] = []
    did_create_transaction: bool = False
    created_transaction_id: Optional[UUID] = None
    did_update_transaction: bool = False
    updated_transaction_id: Optional[UUID] = None
    did_delete_transaction: bool = False
    deleted_transaction_id: Optional[UUID] = None
    insight_tags: list[str] = []  # e.g., ["overspending_food", "good_savings_streak"]


class ChatMessageResponse(BaseModel):
    """Response envelope with message and UI metadata."""
    message: ChatMessage
    meta: ChatAssistantMeta


# Tool Input Schemas (strict JSON)
class GetBalanceInput(BaseModel):
    """Input schema for get_balance tool (empty object)."""
    pass


class ListTransactionsInput(BaseModel):
    """Input schema for list_transactions tool."""
    limit: int = Field(default=50, ge=1, le=200)
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None


class CreateTransactionInput(BaseModel):
    """Input schema for create_transaction tool."""
    amount: float = Field(gt=0)
    type: Literal["INCOME", "EXPENSE"]
    category: str
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None


class AnalyzeSpendingInput(BaseModel):
    """Input schema for analyze_spending tool."""
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    group_by: Literal["category", "day", "month"] = "category"
    top_n: Optional[int] = Field(default=None, ge=1, le=50)


class UpdateTransactionInput(BaseModel):
    """Input schema for update_transaction tool."""
    transaction_id: UUID
    amount: Optional[float] = Field(default=None, gt=0)
    type: Optional[Literal["INCOME", "EXPENSE"]] = None
    category: Optional[str] = None
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None


class DeleteTransactionInput(BaseModel):
    """Input schema for delete_transaction tool."""
    transaction_id: UUID
