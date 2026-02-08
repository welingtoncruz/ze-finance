"""
AI tool definitions and implementations for Zefa Finance agent.
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Transaction
from app.crud import (
    create_user_transaction,
    delete_user_transaction,
    get_dashboard_summary,
    get_user_transaction,
    list_user_transactions,
    update_user_transaction,
)
from app.schemas import TransactionCreate, TransactionUpdate
from app.chat.schemas import (
    GetBalanceInput,
    ListTransactionsInput,
    CreateTransactionInput,
    AnalyzeSpendingInput,
    UpdateTransactionInput,
    DeleteTransactionInput,
)


# Tool Registry
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_balance",
            "description": "Get the user's current financial balance (total income minus total expenses)",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_transactions",
            "description": "List user's transactions with optional date range and limit filters",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of transactions to return (1-200)",
                        "minimum": 1,
                        "maximum": 200,
                    },
                    "from_date": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Start date for filtering transactions (ISO 8601)",
                    },
                    "to_date": {
                        "type": "string",
                        "format": "date-time",
                        "description": "End date for filtering transactions (ISO 8601)",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_transaction",
            "description": "Create a new income or expense transaction",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "Transaction amount (must be positive)",
                        "minimum": 0.01,
                    },
                    "type": {
                        "type": "string",
                        "enum": ["INCOME", "EXPENSE"],
                        "description": "Transaction type",
                    },
                    "category": {
                        "type": "string",
                        "description": "Transaction category (e.g., 'Food', 'Transport', 'Salary')",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional transaction description",
                    },
                    "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "When the transaction occurred (ISO 8601). Defaults to now if not provided",
                    },
                },
                "required": ["amount", "type", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_spending",
            "description": "Analyze spending patterns grouped by category, day, or month",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_date": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Start date for analysis (ISO 8601)",
                    },
                    "to_date": {
                        "type": "string",
                        "format": "date-time",
                        "description": "End date for analysis (ISO 8601)",
                    },
                    "group_by": {
                        "type": "string",
                        "enum": ["category", "day", "month"],
                        "description": "How to group the analysis",
                        "default": "category",
                    },
                    "top_n": {
                        "type": "integer",
                        "description": "Return only top N results (1-50)",
                        "minimum": 1,
                        "maximum": 50,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_transaction",
            "description": "Update an existing transaction by id (amount, type, category, description, occurred_at). IMPORTANT: You MUST first use list_transactions to find the transaction ID if the user doesn't provide it explicitly. Match transactions by category, amount, description, or date mentioned by the user. Then use the transaction_id from the search results to update it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transaction_id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "ID of the transaction to update. You must get this ID from list_transactions first if the user doesn't provide it explicitly.",
                    },
                    "amount": {
                        "type": "number",
                        "description": "New transaction amount (must be positive)",
                        "minimum": 0.01,
                    },
                    "type": {
                        "type": "string",
                        "enum": ["INCOME", "EXPENSE"],
                        "description": "Transaction type",
                    },
                    "category": {
                        "type": "string",
                        "description": "Transaction category (e.g., 'Food', 'Transport', 'Salary')",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional transaction description",
                    },
                    "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "When the transaction occurred (ISO 8601)",
                    },
                },
                "required": ["transaction_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_transaction",
            "description": "Delete a transaction by id. IMPORTANT: You MUST first use list_transactions to find the transaction ID if the user doesn't provide it explicitly. Match transactions by category, amount, description, or date mentioned by the user. Then use the transaction_id from the search results to delete it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transaction_id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "ID of the transaction to delete. You must get this ID from list_transactions first if the user doesn't provide it explicitly.",
                    },
                },
                "required": ["transaction_id"],
            },
        },
    },
]


async def tool_get_balance(
    db: AsyncSession,
    user_id: UUID,
) -> Dict[str, Any]:
    """
    Get user's current balance.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        
    Returns:
        Dictionary with balance information
    """
    summary = await get_dashboard_summary(db, user_id)
    return {
        "total_balance": float(summary.total_balance),
        "total_income": float(summary.total_income),
        "total_expense": float(summary.total_expense),
        "currency": "BRL",
    }


async def tool_list_transactions(
    db: AsyncSession,
    user_id: UUID,
    filters: ListTransactionsInput,
) -> Dict[str, Any]:
    """
    List user's transactions with optional filters.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        filters: Filter parameters
        
    Returns:
        Dictionary with list of transactions
    """
    # Build query with filters
    query = select(Transaction).where(Transaction.user_id == user_id)
    
    if filters.from_date:
        query = query.where(Transaction.occurred_at >= filters.from_date)
    if filters.to_date:
        query = query.where(Transaction.occurred_at <= filters.to_date)
    
    query = query.order_by(Transaction.occurred_at.desc()).limit(filters.limit)
    
    result = await db.execute(query)
    transactions = list(result.scalars().all())
    
    return {
        "transactions": [
            {
                "id": str(tx.id),
                "amount": float(tx.amount),
                "type": tx.type,
                "category": tx.category,
                "description": tx.description,
                "occurred_at": tx.occurred_at.isoformat() if tx.occurred_at else None,
            }
            for tx in transactions
        ],
        "count": len(transactions),
    }


async def tool_create_transaction(
    db: AsyncSession,
    user_id: UUID,
    tx_input: CreateTransactionInput,
) -> Dict[str, Any]:
    """
    Create a new transaction for the user.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        tx_input: Transaction creation input
        
    Returns:
        Dictionary with created transaction information
    """
    # Convert to TransactionCreate schema
    tx_create = TransactionCreate(
        amount=Decimal(str(tx_input.amount)),
        type=tx_input.type,
        category=tx_input.category,
        description=tx_input.description,
        occurred_at=tx_input.occurred_at,
    )
    
    transaction = await create_user_transaction(db, tx_create, user_id)
    
    return {
        "id": str(transaction.id),
        "amount": float(transaction.amount),
        "type": transaction.type,
        "category": transaction.category,
        "description": transaction.description,
        "occurred_at": transaction.occurred_at.isoformat() if transaction.occurred_at else None,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
    }


async def tool_analyze_spending(
    db: AsyncSession,
    user_id: UUID,
    analysis_input: AnalyzeSpendingInput,
) -> Dict[str, Any]:
    """
    Analyze spending patterns grouped by category, day, or month.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        analysis_input: Analysis parameters
        
    Returns:
        Dictionary with analysis results
    """
    # Build base query
    query = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.type == "EXPENSE",  # Only analyze expenses
    )
    
    if analysis_input.from_date:
        query = query.where(Transaction.occurred_at >= analysis_input.from_date)
    if analysis_input.to_date:
        query = query.where(Transaction.occurred_at <= analysis_input.to_date)
    
    result = await db.execute(query)
    transactions = list(result.scalars().all())
    
    # Group by specified dimension
    grouped: Dict[str, Decimal] = {}
    
    for tx in transactions:
        amount = Decimal(str(tx.amount))
        
        if analysis_input.group_by == "category":
            key = tx.category
        elif analysis_input.group_by == "day":
            key = tx.occurred_at.date().isoformat() if tx.occurred_at else "unknown"
        elif analysis_input.group_by == "month":
            if tx.occurred_at:
                key = tx.occurred_at.strftime("%Y-%m")
            else:
                key = "unknown"
        else:
            key = "unknown"
        
        grouped[key] = grouped.get(key, Decimal("0.00")) + amount
    
    # Convert to list and sort
    results = [
        {"group": k, "total": float(v)}
        for k, v in sorted(grouped.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Apply top_n if specified
    if analysis_input.top_n:
        results = results[: analysis_input.top_n]
    
    return {
        "group_by": analysis_input.group_by,
        "results": results,
        "total": float(sum(grouped.values())),
    }


async def tool_update_transaction(
    db: AsyncSession,
    user_id: UUID,
    tx_input: UpdateTransactionInput,
) -> Dict[str, Any]:
    """
    Update an existing transaction for the user.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        tx_input: Transaction update input
        
    Returns:
        Dictionary with updated transaction information
        
    Raises:
        ValueError: If transaction not found or validation fails
    """
    # Check if at least one field is provided for update
    update_fields = [
        tx_input.amount is not None,
        tx_input.type is not None,
        tx_input.category is not None,
        tx_input.description is not None,
        tx_input.occurred_at is not None,
    ]
    if not any(update_fields):
        raise ValueError("At least one field must be provided for update (amount, type, category, description, or occurred_at)")
    
    # Convert to TransactionUpdate schema
    update_data = {}
    if tx_input.amount is not None:
        update_data["amount"] = Decimal(str(tx_input.amount))
    if tx_input.type is not None:
        update_data["type"] = tx_input.type
    if tx_input.category is not None:
        update_data["category"] = tx_input.category
    if tx_input.description is not None:
        update_data["description"] = tx_input.description
    if tx_input.occurred_at is not None:
        update_data["occurred_at"] = tx_input.occurred_at
    
    tx_update = TransactionUpdate(**update_data)
    
    transaction = await update_user_transaction(db, tx_input.transaction_id, user_id, tx_update)
    
    if not transaction:
        raise ValueError(f"Transaction {tx_input.transaction_id} not found or not owned by user")
    
    return {
        "id": str(transaction.id),
        "amount": float(transaction.amount),
        "type": transaction.type,
        "category": transaction.category,
        "description": transaction.description,
        "occurred_at": transaction.occurred_at.isoformat() if transaction.occurred_at else None,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
    }


async def tool_delete_transaction(
    db: AsyncSession,
    user_id: UUID,
    tx_input: DeleteTransactionInput,
) -> Dict[str, Any]:
    """
    Delete a transaction for the user.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        tx_input: Transaction deletion input
        
    Returns:
        Dictionary with deletion confirmation
        
    Raises:
        ValueError: If transaction not found
    """
    # Get transaction before deletion to return info
    transaction = await get_user_transaction(db, tx_input.transaction_id, user_id)
    
    if not transaction:
        raise ValueError(f"Transaction {tx_input.transaction_id} not found or not owned by user")
    
    deleted = await delete_user_transaction(db, tx_input.transaction_id, user_id)
    
    if not deleted:
        raise ValueError(f"Transaction {tx_input.transaction_id} could not be deleted")
    
    return {
        "deleted": True,
        "id": str(tx_input.transaction_id),
        "amount": float(transaction.amount),
        "category": transaction.category,
    }


# Tool execution dispatcher
async def execute_tool(
    db: AsyncSession,
    user_id: UUID,
    tool_name: str,
    tool_args: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Execute a tool by name with provided arguments.
    
    Args:
        db: Database session
        user_id: User ID (injected from JWT, never from LLM)
        tool_name: Name of the tool to execute
        tool_args: Tool arguments (will be validated against schema)
        
    Returns:
        Tool execution result
        
    Raises:
        ValueError: If tool name is unknown or arguments are invalid
    """
    from pydantic import ValidationError
    
    try:
        if tool_name == "get_balance":
            return await tool_get_balance(db, user_id)
        
        elif tool_name == "list_transactions":
            filters = ListTransactionsInput(**tool_args)
            return await tool_list_transactions(db, user_id, filters)
        
        elif tool_name == "create_transaction":
            tx_input = CreateTransactionInput(**tool_args)
            return await tool_create_transaction(db, user_id, tx_input)
        
        elif tool_name == "analyze_spending":
            analysis_input = AnalyzeSpendingInput(**tool_args)
            return await tool_analyze_spending(db, user_id, analysis_input)
        
        elif tool_name == "update_transaction":
            tx_input = UpdateTransactionInput(**tool_args)
            return await tool_update_transaction(db, user_id, tx_input)
        
        elif tool_name == "delete_transaction":
            tx_input = DeleteTransactionInput(**tool_args)
            return await tool_delete_transaction(db, user_id, tx_input)
        
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
    except ValidationError as e:
        # Convert Pydantic validation errors to more user-friendly messages
        error_details = []
        for error in e.errors():
            field = ".".join(str(loc) for loc in error["loc"])
            msg = error["msg"]
            error_details.append(f"{field}: {msg}")
        raise ValueError(f"Invalid arguments for {tool_name}: {'; '.join(error_details)}")
