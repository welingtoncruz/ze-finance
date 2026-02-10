"""
CRUD operations for chat messages and conversation summaries.
Note: conversation_id from client is a logical grouping key only. All queries
filter by user_id from JWT—conversation isolation is enforced; no cross-user access.
"""
import os
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChatMessage, ChatConversationSummary
from app.chat.schemas import ChatMessageCreate

# Summarization prompt
SUMMARIZATION_PROMPT = """Você é um assistente que resume conversas de forma concisa e factual.

Resuma a conversa abaixo, mantendo:
- Valores monetários mencionados
- Categorias de transações
- Datas importantes
- Perguntas não resolvidas ou pendências
- Contexto financeiro relevante

Seja objetivo e mantenha apenas informações essenciais. O resumo será usado para dar contexto em conversas futuras."""


async def create_chat_message(
    db: AsyncSession,
    user_id: UUID,
    payload: ChatMessageCreate,
    role: str,
    content: str,
    conversation_id: Optional[UUID] = None,
    tool_name: Optional[str] = None,
    tool_call_id: Optional[str] = None,
) -> ChatMessage:
    """
    Create a new chat message.
    
    Args:
        db: Database session
        user_id: User ID (from JWT)
        payload: Chat message creation payload
        role: Message role (system, user, assistant, tool)
        content: Message content
        conversation_id: Optional conversation ID (will be generated if not provided)
        tool_name: Optional tool name (for tool messages)
        tool_call_id: Optional tool call ID (for tool messages)
        
    Returns:
        Created ChatMessage object
    """
    # Generate conversation_id if not provided
    if conversation_id is None:
        conversation_id = uuid4()
    
    # Ensure conversation_id belongs to user (or create new one)
    # For MVP, we trust the conversation_id from payload, but in production
    # you might want to verify ownership
    
    db_message = ChatMessage(
        user_id=user_id,
        conversation_id=conversation_id,
        role=role,
        content=content,
        content_type=payload.content_type,
        tool_name=tool_name,
        tool_call_id=tool_call_id,
    )
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    return db_message


async def list_recent_messages(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID,
    limit: int = 50,
) -> List[ChatMessage]:
    """
    List recent messages for a conversation, ordered by created_at ascending.
    
    Gets the N most recent messages and returns them in chronological order
    (oldest → newest) for LLM context building.
    
    Args:
        db: Database session
        user_id: User ID (strictly scoped)
        conversation_id: Conversation ID
        limit: Maximum number of messages to return
        
    Returns:
        List of ChatMessage objects ordered by created_at ascending
    """
    # Query newest N messages (descending order)
    result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.conversation_id == conversation_id,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    # Reverse to get chronological order (oldest → newest) for LLM context
    messages.reverse()
    return messages


async def get_conversation_summary(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID,
) -> Optional[ChatConversationSummary]:
    """
    Get conversation summary if it exists.
    
    Args:
        db: Database session
        user_id: User ID
        conversation_id: Conversation ID
        
    Returns:
        ChatConversationSummary if exists, None otherwise
    """
    result = await db.execute(
        select(ChatConversationSummary).where(
            ChatConversationSummary.user_id == user_id,
            ChatConversationSummary.conversation_id == conversation_id,
        )
    )
    return result.scalar_one_or_none()


async def update_conversation_summary(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID,
    summary: str,
) -> ChatConversationSummary:
    """
    Create or update conversation summary.
    
    Args:
        db: Database session
        user_id: User ID
        conversation_id: Conversation ID
        summary: Summary text
        
    Returns:
        ChatConversationSummary object
    """
    existing = await get_conversation_summary(db, user_id, conversation_id)
    
    if existing:
        existing.summary = summary
        # updated_at is handled by onupdate in the model
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        db_summary = ChatConversationSummary(
            conversation_id=conversation_id,
            user_id=user_id,
            summary=summary,
        )
        db.add(db_summary)
        await db.commit()
        await db.refresh(db_summary)
        return db_summary


async def maybe_update_conversation_summary(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID,
    max_messages: Optional[int] = None,
) -> None:
    """
    Summarize conversation if message count exceeds threshold.
    
    When total message count grows beyond max_messages, generates/updates a compact
    summary and relies less on raw history to reduce token usage.
    
    Args:
        db: Database session
        user_id: User ID
        conversation_id: Conversation ID
        max_messages: Maximum number of messages before summarization (defaults to AI_MAX_CONTEXT_MESSAGES)
    """
    # Import here to avoid circular dependency
    from app.ai.gateway import AI_MAX_CONTEXT_MESSAGES, call_llm, get_api_key, AI_SUMMARY_TOKEN_BUDGET
    
    if max_messages is None:
        max_messages = AI_MAX_CONTEXT_MESSAGES
    
    # Count total messages for this conversation
    count_result = await db.execute(
        select(func.count(ChatMessage.id))
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.conversation_id == conversation_id,
        )
    )
    total_count = count_result.scalar() or 0
    
    # If count <= max_messages, no summarization needed
    if total_count <= max_messages:
        return
    
    # Fetch older messages to summarize (everything except the last max_messages)
    # Exclude system messages and large tool_result payloads
    older_messages_result = await db.execute(
        select(ChatMessage)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.conversation_id == conversation_id,
            ChatMessage.role != "system",
            ChatMessage.content_type != "tool_result",  # Exclude large tool results
        )
        .order_by(ChatMessage.created_at.asc())
        .limit(total_count - max_messages)
    )
    older_messages = list(older_messages_result.scalars().all())
    
    if not older_messages:
        return
    
    # Build messages for summarization
    messages_to_summarize = []
    for msg in older_messages:
        # Truncate very long messages
        content = msg.content
        if len(content) > 500:
            content = content[:500] + "..."
        messages_to_summarize.append({
            "role": msg.role,
            "content": content,
        })
    
    # Build summarization prompt
    conversation_text = "\n".join([
        f"{msg['role']}: {msg['content']}"
        for msg in messages_to_summarize
    ])
    
    summarization_messages = [
        {
            "role": "system",
            "content": SUMMARIZATION_PROMPT,
        },
        {
            "role": "user",
            "content": f"Resuma esta conversa:\n\n{conversation_text}",
        },
    ]
    
    # Get API key (required for LLM call)
    api_key = get_api_key(user_id)
    if not api_key:
        # Cannot summarize without API key, skip
        print(f"[WARNING] Cannot summarize conversation {conversation_id}: no API key")
        return
    
    try:
        # Call LLM for summarization with output cap
        summary_response = await call_llm(summarization_messages, tools=None, api_key=api_key)
        summary_text = summary_response.get("content", "").strip()
        
        # Truncate summary if it exceeds budget (rough estimate: 1 token ≈ 4 chars)
        max_summary_chars = AI_SUMMARY_TOKEN_BUDGET * 4
        if len(summary_text) > max_summary_chars:
            summary_text = summary_text[:max_summary_chars] + "..."
        
        if summary_text:
            # Update conversation summary
            await update_conversation_summary(db, user_id, conversation_id, summary_text)
            print(f"[DEBUG] Updated conversation summary for {conversation_id}")
    except Exception as e:
        # Log error but don't fail the request
        print(f"[ERROR] Failed to summarize conversation {conversation_id}: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
