"""
Context pack builder for injecting compact finance context into LLM messages.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

import os

from app.models import Transaction
from app.crud import get_dashboard_summary

# Default transaction limit for context pack
AI_CONTEXT_PACK_TX_LIMIT = int(os.getenv("AI_CONTEXT_PACK_TX_LIMIT", "6"))


async def build_finance_context_pack(
    db: AsyncSession,
    user_id: UUID,
    now: Optional[datetime] = None,
    tx_limit: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Build a compact finance context pack for the user.
    
    This provides recent financial snapshot without sending entire DB.
    Used to enable personalized responses and proactive insights.
    
    Args:
        db: Database session
        user_id: User ID
        now: Current datetime (defaults to utcnow)
        tx_limit: Maximum number of recent transactions to include (defaults to AI_CONTEXT_PACK_TX_LIMIT)
        
    Returns:
        Dictionary with finance context (balance, month-to-date, recent transactions)
    """
    if now is None:
        now = datetime.utcnow()
    
    if tx_limit is None:
        tx_limit = AI_CONTEXT_PACK_TX_LIMIT
    
    # Get balance summary
    summary = await get_dashboard_summary(db, user_id)
    
    # Get month start
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get month-to-date transactions
    month_query = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.occurred_at >= month_start,
    )
    month_result = await db.execute(month_query)
    month_transactions = list(month_result.scalars().all())
    
    # Calculate month-to-date totals
    month_income = sum(
        float(tx.amount) for tx in month_transactions if tx.type == "INCOME"
    )
    month_expense = sum(
        float(tx.amount) for tx in month_transactions if tx.type == "EXPENSE"
    )
    
    # Get top expense categories (month-to-date)
    expense_by_category: Dict[str, float] = {}
    for tx in month_transactions:
        if tx.type == "EXPENSE":
            category = tx.category
            expense_by_category[category] = expense_by_category.get(category, 0.0) + float(tx.amount)
    
    top_expense_categories = [
        {"category": cat, "amount": amt}
        for cat, amt in sorted(expense_by_category.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    # Get recent transactions (last N transactions, regardless of month)
    recent_query = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.occurred_at.desc())
        .limit(tx_limit)
    )
    recent_result = await db.execute(recent_query)
    recent_transactions = list(recent_result.scalars().all())
    
    return {
        "currency": "BRL",
        "as_of": now.isoformat() + "Z",
        "balance": {
            "amount": float(summary.total_balance),
        },
        "month_to_date": {
            "income_total": month_income,
            "expense_total": month_expense,
            "top_expense_categories": top_expense_categories,
        },
        "recent_transactions": [
            {
                "occurred_at": tx.occurred_at.isoformat() if tx.occurred_at else None,
                "type": tx.type,
                "amount": float(tx.amount),
                "category": tx.category,
                "description": tx.description,
            }
            for tx in recent_transactions
        ],
    }
