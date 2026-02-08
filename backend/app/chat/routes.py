"""
Chat routes for Zefa Finance AI agent.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth_utils import get_current_user
from app.database import get_db
from app.models import User
from app.chat import crud as chat_crud
from app.chat.schemas import ChatMessageCreate, ChatMessageResponse, ChatMessage, ChatAssistantMeta
from app.ai import gateway
from app.ai.gateway import set_ephemeral_api_key, get_api_key, AI_MAX_CONTEXT_MESSAGES


class ApiKeyRequest(BaseModel):
    """Schema for API key request."""
    api_key: str

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_message(
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    """
    Create a chat message and get Zefa's response with UI metadata.
    
    Args:
        payload: Chat message creation payload
        current_user: Current authenticated user (from JWT)
        db: Database session
        
    Returns:
        Assistant's response message with UI metadata envelope
        
    Raises:
        HTTPException: If message creation fails
    """
    if not payload.text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message text is required",
        )
    
    user_id = current_user.id
    conversation_id = payload.conversation_id
    
    # Persist user message
    user_message = await chat_crud.create_chat_message(
        db=db,
        user_id=user_id,
        payload=payload,
        role="user",
        content=payload.text,
        conversation_id=conversation_id,
    )
    
    # Update conversation_id if it was None
    if conversation_id is None:
        conversation_id = user_message.conversation_id
    
    # Get recent messages for context
    recent_messages_list = await chat_crud.list_recent_messages(
        db=db,
        user_id=user_id,
        conversation_id=conversation_id,
        limit=AI_MAX_CONTEXT_MESSAGES,
    )
    
    # Convert to format expected by gateway, excluding the just-persisted user message
    # to avoid duplication (gateway will add it separately)
    recent_messages = []
    for msg in recent_messages_list:
        # Skip the user message we just persisted (it will be added by gateway)
        if msg.id == user_message.id:
            continue
        recent_messages.append({
            "role": msg.role,
            "content": msg.content,
        })
    
    # Get conversation summary if exists
    summary_obj = await chat_crud.get_conversation_summary(
        db=db,
        user_id=user_id,
        conversation_id=conversation_id,
    )
    conversation_summary = summary_obj.summary if summary_obj else None
    
    # Determine if we should include context pack (heuristic: finance-related intents)
    # Use the same keyword list as should_attach_tools() for consistency
    # For heuristic mode: include context pack more liberally to enable insights,
    # but tools will only be attached for explicit finance actions
    user_text_lower = payload.text.lower()
    finance_keywords = [
        # Query
        "saldo", "gasto", "gastei", "receita", "despesa", "extrato",
        "fim do mês", "sobrou", "quanto", "transação", "transacao",
        "balance", "transaction", "spending",
        # Create/Add
        "criar", "registrar", "adicionar", "create", "add", "register",
        # Edit/Update
        "alterar", "altera", "mudar", "muda", "editar", "edita", "atualizar", "atualiza",
        "update", "edit", "change", "modify", "modificar",
        # Delete/Remove
        "deletar", "deleta", "remover", "remove", "excluir", "exclui", "apagar", "apaga",
        "delete", "remove", "exclude",
        # Analysis
        "análise", "analise", "insight", "resumo", "total", "soma", "média",
        # General finance
        "dinheiro", "valor", "preço", "custo", "pagamento",
        "como estou", "como vai", "situação", "situacao", "status",
        "financeiro", "finanças", "financas", "grana", "reais",
        # List/Show
        "listar", "list", "mostrar", "show", "ver", "ver todas",
    ]
    include_context_pack = any(keyword in user_text_lower for keyword in finance_keywords)
    
    # Process through AI gateway
    try:
        assistant_response = await gateway.process_chat_message(
            db=db,
            user_id=user_id,
            conversation_id=conversation_id,
            user_message=payload.text,
            recent_messages=recent_messages,
            conversation_summary=conversation_summary,
            include_context_pack=include_context_pack,
        )
    except ValueError as e:
        # Handle missing API key or other validation errors
        error_msg = str(e)
        if "API key" in error_msg.lower():
            assistant_response = {
                "role": "assistant",
                "content": (
                    "Olá! Sou o Zefa, seu assistente financeiro. "
                    "Para que eu possa ajudá-lo, preciso de uma chave de API do provedor de IA. "
                    "Por favor, configure a variável de ambiente OPENAI_API_KEY, ANTHROPIC_API_KEY ou GEMINI_API_KEY "
                    "no arquivo .env do backend, ou forneça a chave temporariamente via chat. "
                    "A chave fornecida via chat será armazenada apenas em memória e expirará em 60 minutos."
                ),
                "tool_calls": [],
                "needs_api_key": True,
                "metadata": ChatAssistantMeta().model_dump(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"AI processing error: {error_msg}",
            )
    except Exception as e:
        # Log error details for debugging
        import traceback
        error_traceback = traceback.format_exc()
        print(f"[ERROR] Chat message processing failed: {type(e).__name__}: {e}")
        print(f"[ERROR] Traceback:\n{error_traceback}")
        
        # Return safe message to user but log the actual error
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Erro ao processar mensagem. Por favor, tente novamente.",
        )
    
    # Extract metadata from response
    metadata_dict = assistant_response.get("metadata", {})
    if not metadata_dict:
        metadata_dict = ChatAssistantMeta().model_dump()
    
    # Persist assistant message
    try:
        print(f"[DEBUG] Persisting assistant message")
        assistant_message = await chat_crud.create_chat_message(
            db=db,
            user_id=user_id,
            payload=ChatMessageCreate(
                conversation_id=conversation_id,
                text=assistant_response.get("content", ""),
                content_type="text",
            ),
            role="assistant",
            content=assistant_response.get("content", ""),
            conversation_id=conversation_id,
        )
        print(f"[DEBUG] Assistant message persisted: {assistant_message.id}")
        
        # Trigger summarization check if needed (async, non-blocking)
        try:
            await chat_crud.maybe_update_conversation_summary(
                db=db,
                user_id=user_id,
                conversation_id=conversation_id,
            )
        except Exception as e:
            # Log but don't fail the request if summarization fails
            print(f"[WARNING] Summarization check failed: {type(e).__name__}: {e}")
    except Exception as e:
        print(f"[ERROR] Failed to persist assistant message: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
        raise
    
    # Build response message
    message_response = ChatMessage(
        id=assistant_message.id,
        conversation_id=assistant_message.conversation_id,
        role=assistant_message.role,
        content=assistant_message.content,
        content_type=assistant_message.content_type,
        created_at=assistant_message.created_at,
    )
    
    # Build metadata (convert dict back to Pydantic model for validation)
    meta = ChatAssistantMeta(**metadata_dict)
    
    return ChatMessageResponse(
        message=message_response,
        meta=meta,
    )


@router.post("/api-key", status_code=status.HTTP_200_OK)
async def set_api_key(
    request: ApiKeyRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Set ephemeral API key for the current user (stored in memory only, expires in 60 minutes).
    
    Args:
        request: API key request with api_key field
        current_user: Current authenticated user
        
    Returns:
        Success message
    """
    set_ephemeral_api_key(current_user.id, request.api_key, ttl_minutes=60)
    return {
        "message": "API key configurada temporariamente. A chave será armazenada apenas em memória e expirará em 60 minutos.",
    }
