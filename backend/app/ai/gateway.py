"""
AI Gateway: Provider-agnostic orchestration for Zefa chatbot agent.
"""
import os
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt import SYSTEM_PROMPT
from app.ai.tools import TOOLS, execute_tool
from app.ai.context import build_finance_context_pack
from app.chat.schemas import ChatAssistantMeta, ChatUiEvent


# Confirmation messages variations
CONFIRMATION_TITLES = [
    "Tá na mão.",
    "Fechado.",
    "Pronto.",
    "Registrado.",
    "Anotado.",
    "Feito.",
    "Concluído.",
    "Salvo.",
]

CONFIRMATION_SUBTITLES_EXPENSE = [
    "Despesa registrada pra você não perder o controle.",
    "Gasto anotado com sucesso.",
    "Despesa salva no seu histórico.",
    "Registrei essa despesa pra você.",
]

CONFIRMATION_SUBTITLES_INCOME = [
    "Receita registrada pra você acompanhar.",
    "Entrada anotada com sucesso.",
    "Receita salva no seu histórico.",
    "Registrei essa receita pra você.",
]


def get_random_confirmation_title() -> str:
    """Get a random confirmation title."""
    return random.choice(CONFIRMATION_TITLES)


def get_random_confirmation_subtitle(is_income: bool) -> str:
    """Get a random confirmation subtitle based on transaction type."""
    if is_income:
        return random.choice(CONFIRMATION_SUBTITLES_INCOME)
    return random.choice(CONFIRMATION_SUBTITLES_EXPENSE)


def should_attach_tools(user_message: str, include_context_pack: bool) -> bool:
    """
    Determine if tools should be attached based on AI_TOOLS_MODE.
    
    Args:
        user_message: User's message text
        include_context_pack: Whether finance context pack is being included
        
    Returns:
        True if tools should be attached, False otherwise
    """
    if AI_TOOLS_MODE == "always":
        return True
    elif AI_TOOLS_MODE == "never":
        return False
    elif AI_TOOLS_MODE == "heuristic":
        # In heuristic mode, attach tools only for explicit finance actions
        # (creating transactions, querying specific data) to reduce token usage.
        # Context pack is included more liberally to enable insights without tools.
        user_text_lower = user_message.lower()
        
        # Tools are needed for actions that require data modification or specific queries
        action_keywords = [
            # Create/Add
            "criar", "registrar", "adicionar", "create", "add", "register",
            # Edit/Update
            "alterar", "altera", "mudar", "muda", "editar", "edita", "atualizar", "atualiza",
            "update", "edit", "change", "modify", "modificar",
            # Delete/Remove
            "deletar", "deleta", "remover", "remove", "excluir", "exclui", "apagar", "apaga",
            "delete", "remove", "exclude",
            # Query
            "saldo", "gasto", "gastei", "receita", "despesa", "extrato",
            "quanto", "balance", "transaction", "spending",
            "transação", "transacao",  # Explicit transaction mentions
            "listar", "list", "mostrar", "show", "ver", "ver todas",
        ]
        
        # If context pack is included, it means it's finance-related, so attach tools
        if include_context_pack:
            # But only if it's an action that needs tools (not just conversational)
            if any(keyword in user_text_lower for keyword in action_keywords):
                return True
        
        # Also check for action keywords even if context pack wasn't included
        return any(keyword in user_text_lower for keyword in action_keywords)
    else:
        # Unknown mode, default to heuristic behavior
        return include_context_pack


def should_force_tools_from_context(recent_messages: List[Dict[str, str]]) -> bool:
    """
    Heuristic to force tools when the last assistant message asked for missing
    transaction details (e.g. category/description/date/type).
    """
    if not recent_messages:
        return False

    last_assistant = next(
        (msg for msg in reversed(recent_messages) if msg.get("role") == "assistant"),
        None,
    )
    if not last_assistant:
        return False

    content = (last_assistant.get("content") or "").lower()
    clarification_markers = [
        "categoria", "descrição", "descricao", "qual foi", "com o quê", "com o que",
        "foi despesa", "foi receita", "entrada ou saída", "entrada ou saida",
        "quando foi", "qual data", "data dessa", "pode confirmar",
    ]
    return any(marker in content for marker in clarification_markers)


def compact_tool_result(result: Any) -> str:
    """
    Compact tool result for injection into LLM prompt.
    
    Reduces token usage by:
    - Removing pretty-printing (no indent)
    - Truncating arrays to top N items
    - Truncating long strings
    - Enforcing AI_TOOL_RESULTS_MAX_CHARS limit
    
    Args:
        result: Tool result (dict, list, or primitive)
        
    Returns:
        Compact string representation
    """
    import json
    
    if isinstance(result, dict):
        # Truncate arrays in dict values
        compacted = {}
        for key, value in result.items():
            if isinstance(value, list) and len(value) > 10:
                # Keep only first 10 items
                compacted[key] = value[:10] + [f"... ({len(value) - 10} more items)"]
            elif isinstance(value, str) and len(value) > 500:
                # Truncate long strings
                compacted[key] = value[:500] + "..."
            else:
                compacted[key] = value
        result_str = json.dumps(compacted, ensure_ascii=False, separators=(',', ':'))
    elif isinstance(result, list):
        # Truncate long lists
        if len(result) > 10:
            compacted = result[:10] + [f"... ({len(result) - 10} more items)"]
        else:
            compacted = result
        result_str = json.dumps(compacted, ensure_ascii=False, separators=(',', ':'))
    else:
        result_str = str(result)
        if len(result_str) > 500:
            result_str = result_str[:500] + "..."
    
    # Enforce max chars limit
    if len(result_str) > AI_TOOL_RESULTS_MAX_CHARS:
        result_str = result_str[:AI_TOOL_RESULTS_MAX_CHARS] + "... (truncated)"
    
    return result_str


# Provider configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai")
AI_MODEL_CHAT = os.getenv("AI_MODEL_CHAT", "gpt-4o-mini")
AI_MAX_CONTEXT_MESSAGES = int(os.getenv("AI_MAX_CONTEXT_MESSAGES", "20"))
AI_SUMMARY_TOKEN_BUDGET = int(os.getenv("AI_SUMMARY_TOKEN_BUDGET", "500"))
AI_MAX_OUTPUT_TOKENS = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "1500"))
AI_TOOLS_MODE = os.getenv("AI_TOOLS_MODE", "heuristic")  # always, heuristic, never
AI_TOOL_RESULTS_MAX_CHARS = int(os.getenv("AI_TOOL_RESULTS_MAX_CHARS", "4000"))
AI_CONTEXT_PACK_TX_LIMIT = int(os.getenv("AI_CONTEXT_PACK_TX_LIMIT", "6"))

# Ephemeral API keys storage (in-memory only, scoped by user_id)
_ephemeral_api_keys: Dict[UUID, Dict[str, Any]] = {}


def get_api_key(user_id: UUID) -> Optional[str]:
    """
    Get API key for a user (from env or ephemeral storage).
    
    Args:
        user_id: User ID
        
    Returns:
        API key if available, None otherwise
    """
    # First check environment variable (strip to avoid \r\n from GCP Secret Manager)
    if AI_PROVIDER == "openai":
        env_key = (os.getenv("OPENAI_API_KEY") or "").strip()
        if env_key:
            return env_key
    elif AI_PROVIDER == "anthropic":
        env_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        if env_key:
            return env_key
    elif AI_PROVIDER == "gemini":
        env_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        if env_key:
            return env_key
    
    # Check ephemeral storage
    if user_id in _ephemeral_api_keys:
        key_data = _ephemeral_api_keys[user_id]
        # Check if expired
        if datetime.utcnow() < key_data["expires_at"]:
            return (key_data["key"] or "").strip()
        else:
            # Remove expired key
            del _ephemeral_api_keys[user_id]
    
    return None


def set_ephemeral_api_key(user_id: UUID, api_key: str, ttl_minutes: int = 60) -> None:
    """
    Store an ephemeral API key in memory (not persisted).
    
    Args:
        user_id: User ID
        api_key: API key to store
        ttl_minutes: Time to live in minutes (default 60)
    """
    _ephemeral_api_keys[user_id] = {
        "key": (api_key or "").strip(),
        "expires_at": datetime.utcnow() + timedelta(minutes=ttl_minutes),
    }


async def call_llm(
    messages: List[Dict[str, str]],
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Call LLM provider (OpenAI, Anthropic, or Gemini) with messages and optional tools.
    
    Args:
        messages: List of message dicts with 'role' and 'content'
        tools: Optional list of tool definitions
        api_key: API key (if None, will try to get from env)
        
    Returns:
        LLM response dict
        
    Raises:
        ValueError: If provider is not supported or API key is missing
        Exception: If API call fails
    """
    if AI_PROVIDER == "openai":
        return await _call_openai(messages, tools, api_key)
    elif AI_PROVIDER == "anthropic":
        return await _call_anthropic(messages, tools, api_key)
    elif AI_PROVIDER == "gemini":
        return await _call_gemini(messages, tools, api_key)
    else:
        raise ValueError(f"Unsupported AI provider: {AI_PROVIDER}")


async def _call_openai(
    messages: List[Dict[str, str]],
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Call OpenAI API.
    
    Args:
        messages: List of message dicts
        tools: Optional tool definitions
        api_key: API key
        
    Returns:
        OpenAI response dict
    """
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ImportError("openai package is required. Install with: pip install openai")
    
    if not api_key:
        api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    else:
        api_key = (api_key or "").strip()
    
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
    client = AsyncOpenAI(api_key=api_key)
    
    # Prepare request
    request_params: Dict[str, Any] = {
        "model": AI_MODEL_CHAT,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": AI_MAX_OUTPUT_TOKENS,
    }
    
    if tools:
        request_params["tools"] = tools
        request_params["tool_choice"] = "auto"
    
    try:
        response = await client.chat.completions.create(**request_params)
    except Exception as e:
        print(f"[ERROR] OpenAI API call failed: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
        raise

    # Extract response
    choice = response.choices[0]
    result: Dict[str, Any] = {
        "role": "assistant",
        "content": choice.message.content or "",
        "tool_calls": [],
    }
    
    if choice.message.tool_calls:
        for tool_call in choice.message.tool_calls:
            result["tool_calls"].append({
                "id": tool_call.id,
                "name": tool_call.function.name,
                "arguments": tool_call.function.arguments,
            })
    
    return result


async def _call_anthropic(
    messages: List[Dict[str, str]],
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Call Anthropic API.
    
    Args:
        messages: List of message dicts
        tools: Optional tool definitions
        api_key: API key
        
    Returns:
        Anthropic response dict
    """
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        raise ImportError("anthropic package is required. Install with: pip install anthropic")
    
    if not api_key:
        api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    else:
        api_key = (api_key or "").strip()
    
    if not api_key:
        raise ValueError("Anthropic API key is required")
    
    client = AsyncAnthropic(api_key=api_key)
    
    # Convert messages format (Anthropic uses different format)
    anthropic_messages = []
    for msg in messages:
        if msg["role"] == "system":
            continue  # Anthropic handles system separately
        anthropic_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })
    
    # Prepare request
    request_params: Dict[str, Any] = {
        "model": AI_MODEL_CHAT,
        "messages": anthropic_messages,
        "system": SYSTEM_PROMPT,
        "max_tokens": AI_MAX_OUTPUT_TOKENS,
    }
    
    if tools:
        # Convert tools to Anthropic format
        anthropic_tools = []
        for tool in tools:
            anthropic_tools.append(tool["function"])
        request_params["tools"] = anthropic_tools
    
    response = await client.messages.create(**request_params)
    
    # Extract response
    result: Dict[str, Any] = {
        "role": "assistant",
        "content": "",
        "tool_calls": [],
    }
    
    # Extract text content and tool calls
    for content_block in response.content:
        if content_block.type == "text":
            result["content"] += content_block.text
        elif content_block.type == "tool_use":
            # Anthropic provides input as dict, convert to JSON string for consistency
            import json
            result["tool_calls"].append({
                "id": content_block.id,
                "name": content_block.name,
                "arguments": json.dumps(content_block.input) if isinstance(content_block.input, dict) else str(content_block.input),
            })
    
    return result


async def _call_gemini(
    messages: List[Dict[str, str]],
    tools: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Call Google Gemini API using google-genai library.
    
    Args:
        messages: List of message dicts
        tools: Optional tool definitions
        api_key: API key
        
    Returns:
        Gemini response dict
    """
    try:
        from google import genai
        from google.genai import types
        import asyncio
    except ImportError:
        raise ImportError("google-genai package is required. Install with: pip install google-genai")
    
    if not api_key:
        api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    else:
        api_key = (api_key or "").strip()
    
    if not api_key:
        raise ValueError("Gemini API key is required")
    
    # Create client (strip avoids InvalidHeader from \r\n in GCP Secret Manager value)
    client = genai.Client(api_key=api_key)
    
    # Convert messages format - build conversation history and current message
    system_instruction = SYSTEM_PROMPT
    conversation_history = []
    current_message = ""
    
    # Separate system messages from conversation messages
    user_assistant_messages = []
    for msg in messages:
        if msg["role"] == "system":
            # Combine all system messages into instruction
            if system_instruction:
                system_instruction += "\n\n" + msg["content"]
            else:
                system_instruction = msg["content"]
        else:
            # Collect user and assistant messages
            user_assistant_messages.append(msg)
    
    # Build conversation history (all except the last user message)
    # The last user message is the current message
    for i, msg in enumerate(user_assistant_messages):
        if msg["role"] == "user":
            if i == len(user_assistant_messages) - 1:
                # Last message is the current one
                current_message = msg["content"]
            else:
                # Add to history - use Part objects for text content
                conversation_history.append(types.Content(role="user", parts=[types.Part(text=msg["content"])]))
        elif msg["role"] == "assistant":
            # Add assistant response to history - use Part objects for text content
            # Handle both text content and tool calls
            parts = []
            if msg.get("content"):
                parts.append(types.Part(text=msg["content"]))
            # Note: Gemini doesn't use "tool" role - function results are passed differently
            # We'll handle tool results separately in the message flow
            if parts:
                conversation_history.append(types.Content(role="model", parts=parts))
        elif msg["role"] == "tool":
            # For Gemini, tool results should be passed as user messages with function response format
            # Convert tool result to a user message describing the result
            tool_result_text = f"Resultado da função {msg.get('name', 'unknown')}: {msg.get('content', '')}"
            conversation_history.append(types.Content(role="user", parts=[types.Part(text=tool_result_text)]))
    
    # Ensure we have a current message (fallback to empty string if somehow missing)
    if not current_message:
        # If no user message found, use empty string (shouldn't happen in normal flow)
        current_message = ""
    
    # Convert tools to Gemini format
    gemini_tools = None
    if tools:
        function_declarations = _convert_tools_to_gemini_format(tools)
        gemini_tools = [types.Tool(function_declarations=function_declarations)]
    
    # Prepare config
    config = types.GenerateContentConfig(
        system_instruction=system_instruction if system_instruction else None,
        tools=gemini_tools if gemini_tools else None,
        max_output_tokens=AI_MAX_OUTPUT_TOKENS,
    )
    
    # Helper function to convert Gemini API errors to user-friendly messages
    def _handle_gemini_error(error: Exception) -> Dict[str, Any]:
        """Convert Gemini API errors to user-friendly error responses."""
        try:
            from google.genai import errors as genai_errors
        except ImportError:
            pass
        
        error_type = type(error).__name__
        error_message = str(error)
        
        # Check for specific Gemini error types
        if "ServerError" in error_type or "503" in error_message or "UNAVAILABLE" in error_message:
            return {
                "role": "assistant",
                "content": (
                    "Desculpe, o serviço de IA está temporariamente sobrecarregado. "
                    "Por favor, tente novamente em alguns instantes. "
                    "Se o problema persistir, você pode tentar usar outro provedor de IA (OpenAI ou Anthropic) "
                    "configurando a variável AI_PROVIDER no arquivo .env."
                ),
                "tool_calls": [],
                "error": "service_unavailable",
            }
        elif "429" in error_message or "RATE_LIMIT" in error_message or "quota" in error_message.lower():
            return {
                "role": "assistant",
                "content": (
                    "Desculpe, você atingiu o limite de requisições da API do Gemini. "
                    "Por favor, aguarde alguns minutos antes de tentar novamente, ou considere usar outro provedor de IA."
                ),
                "tool_calls": [],
                "error": "rate_limit_exceeded",
            }
        elif "401" in error_message or "403" in error_message or "INVALID_API_KEY" in error_message:
            return {
                "role": "assistant",
                "content": (
                    "Erro de autenticação com a API do Gemini. "
                    "Por favor, verifique se a chave GEMINI_API_KEY está correta no arquivo .env."
                ),
                "tool_calls": [],
                "error": "authentication_error",
            }
        elif "400" in error_message or "INVALID_ARGUMENT" in error_message:
            return {
                "role": "assistant",
                "content": (
                    "Erro na requisição para a API do Gemini. "
                    "Por favor, tente reformular sua mensagem ou entre em contato com o suporte."
                ),
                "tool_calls": [],
                "error": "invalid_request",
            }
        else:
            # Generic error
            return {
                "role": "assistant",
                "content": (
                    "Desculpe, ocorreu um erro ao processar sua mensagem. "
                    "Por favor, tente novamente. Se o problema persistir, verifique a configuração da API."
                ),
                "tool_calls": [],
                "error": "unknown_error",
            }
    
    # Run synchronous API call in thread pool to avoid blocking
    def _call_gemini_sync() -> Any:
        try:
            # Build contents - use Content objects for history + current message
            # The API accepts either a string or a list of Content objects
            if conversation_history:
                # If we have history, build full conversation: history + current user message
                all_contents = conversation_history + [types.Content(role="user", parts=[types.Part(text=current_message)])]
                contents = all_contents
            else:
                # No history, just send current message as string
                contents = current_message if current_message else ""
            
            response = client.models.generate_content(
                model=AI_MODEL_CHAT,
                contents=contents,
                config=config,
            )
            return response
        except Exception as e:
            print(f"[ERROR] Gemini API call failed: {type(e).__name__}: {e}")
            import traceback
            print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
            raise
    
    try:
        response = await asyncio.to_thread(_call_gemini_sync)
    except Exception as e:
        print(f"[ERROR] Gemini API call failed: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
        # Return user-friendly error instead of raising
        return _handle_gemini_error(e)
    
    # Extract response
    result: Dict[str, Any] = {
        "role": "assistant",
        "content": "",
        "tool_calls": [],
    }
    
    # Extract function calls and text content from parts first
    has_function_calls = False
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'content') and candidate.content:
            # Check if content has parts and it's not None
            if hasattr(candidate.content, 'parts') and candidate.content.parts is not None:
                import json
                for part in candidate.content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        has_function_calls = True
                        func_call = part.function_call
                        # Convert args to dict if it's not already
                        if hasattr(func_call.args, 'items'):
                            args_dict = dict(func_call.args)
                        elif isinstance(func_call.args, dict):
                            args_dict = func_call.args
                        else:
                            args_dict = {}
                        result["tool_calls"].append({
                            "id": f"gemini_{hash(str(func_call))}",
                            "name": func_call.name,
                            "arguments": json.dumps(args_dict) if args_dict else "{}",
                        })
                    elif hasattr(part, 'text') and part.text:
                        result["content"] += part.text
            elif hasattr(candidate.content, 'text') and candidate.content.text:
                # Sometimes content.text is available directly
                result["content"] = str(candidate.content.text)
                print(f"[DEBUG] Extracted text from candidate.content.text: {len(result['content'])} chars")
    
    # Extract text content - Only try response.text if no function calls were found
    # response.text raises ValueError when response contains function_call parts
    if not has_function_calls:
        try:
            # Check if response has text attribute before accessing
            if hasattr(response, 'text'):
                text_content = response.text
                # response.text can return None, empty string, or actual text
                if text_content is not None:
                    result["content"] = str(text_content)
                    if result["content"]:
                        print(f"[DEBUG] Extracted text from response.text: {len(result['content'])} chars")
                    else:
                        print(f"[DEBUG] response.text returned empty string")
                else:
                    # response.text is None - try to extract from parts as fallback
                    print(f"[DEBUG] response.text is None, trying to extract from parts")
        except ValueError as e:
            # ValueError occurs when response contains function_call parts
            # This is expected and we've already extracted from parts above
            print(f"[DEBUG] response.text not available (function calls present): {e}")
        except Exception as e:
            print(f"[WARNING] Error accessing response.text: {e}")
    
    # If still no content, try to extract from parts (fallback)
    if not result["content"] and hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'content') and candidate.content:
            # Try parts first
            if hasattr(candidate.content, 'parts') and candidate.content.parts is not None:
                for part in candidate.content.parts:
                    if hasattr(part, 'text') and part.text:
                        result["content"] += part.text
                        print(f"[DEBUG] Extracted text from parts: {len(part.text)} chars")
            # Try direct text attribute on content
            elif hasattr(candidate.content, 'text') and candidate.content.text:
                result["content"] = str(candidate.content.text)
                print(f"[DEBUG] Extracted text from candidate.content.text (fallback): {len(result['content'])} chars")
        # Try candidate.text directly
        if not result["content"] and hasattr(candidate, 'text') and candidate.text:
            result["content"] = str(candidate.text)
            print(f"[DEBUG] Extracted text from candidate.text: {len(result['content'])} chars")
        # Try response.text as last resort (may raise ValueError if function calls present)
        if not result["content"] and not has_function_calls:
            try:
                if hasattr(response, 'text') and response.text:
                    result["content"] = str(response.text)
                    print(f"[DEBUG] Extracted text from response.text (last resort): {len(result['content'])} chars")
            except (ValueError, AttributeError) as e:
                print(f"[DEBUG] Could not extract from response.text: {e}")
    
    # Log if still no content (for debugging)
    # Note: It's normal to have no text content when function calls are present (first LLM call)
    if not result["content"]:
        if has_function_calls:
            # This is expected - Gemini returns only function calls in first response
            print(f"[DEBUG] No text content (function calls present - this is normal)")
        else:
            # No function calls and no content - this might be an issue
            print(f"[WARNING] No text content found in response (no function calls)")
            # Avoid accessing response.text if function calls are present (raises ValueError)
            try:
                text_info = f"response.text type: {type(response.text)}, value: {repr(response.text)}"
                print(f"[WARNING] {text_info}")
            except ValueError:
                print(f"[WARNING] response.text not available")
            
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content'):
                    print(f"[WARNING] candidate.content.parts: {getattr(candidate.content, 'parts', None)}")
                    print(f"[WARNING] candidate.content.role: {getattr(candidate.content, 'role', None)}")
            
            # If no tool calls and no content, something went wrong
            result["content"] = (
                "Desculpe, não consegui gerar uma resposta. "
                "Por favor, tente reformular sua pergunta ou verifique se há dados disponíveis."
            )
            print(f"[WARNING] Added fallback message due to empty response")
    
    return result


def _convert_tools_to_gemini_format(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Convert OpenAI/Anthropic tool format to Gemini function declaration format.
    
    Args:
        tools: List of tool definitions in OpenAI format
        
    Returns:
        List of function declarations in Gemini format (dicts)
    """
    gemini_functions = []
    for tool in tools:
        if "function" in tool:
            func_def = tool["function"]
            # Gemini uses the same JSON schema format as OpenAI
            gemini_functions.append({
                "name": func_def["name"],
                "description": func_def.get("description", ""),
                "parameters": func_def.get("parameters", {}),
            })
    return gemini_functions


async def process_chat_message(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID,
    user_message: str,
    recent_messages: List[Dict[str, str]],
    conversation_summary: Optional[str] = None,
    include_context_pack: bool = False,
) -> Dict[str, Any]:
    """
    Process a chat message through the AI gateway with tool orchestration.
    
    Args:
        db: Database session
        user_id: User ID (from JWT)
        conversation_id: Conversation ID
        user_message: User's message text
        recent_messages: Recent messages for context
        conversation_summary: Optional conversation summary
        include_context_pack: Whether to inject finance context pack (default False)
        
    Returns:
        Assistant response dict with content, optional tool results, and metadata
        
    Raises:
        ValueError: If API key is missing
        Exception: If LLM call fails
    """
    print(f"[DEBUG] ========== Processing chat message ==========")
    print(f"[DEBUG] User: {user_id}, Conversation: {conversation_id}")
    print(f"[DEBUG] User message: {user_message[:100]}...")
    print(f"[DEBUG] AI Provider: {AI_PROVIDER}, Model: {AI_MODEL_CHAT}")
    print(f"[DEBUG] Include context pack: {include_context_pack}")
    
    # Check for API key
    api_key = get_api_key(user_id)
    print(f"[DEBUG] API key found: {bool(api_key)}")
    if not api_key:
        # Return a message asking for API key (with empty metadata)
        metadata = ChatAssistantMeta()
        return {
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
            "metadata": metadata.model_dump(),
        }
    
    # Build context messages
    messages: List[Dict[str, str]] = []
    
    # Add system prompt
    messages.append({
        "role": "system",
        "content": SYSTEM_PROMPT,
    })
    
    # Add conversation summary if available
    if conversation_summary:
        messages.append({
            "role": "system",
            "content": f"Resumo da conversa anterior: {conversation_summary}",
        })
    
    # Optionally inject finance context pack
    if include_context_pack:
        try:
            import json
            context_pack = await build_finance_context_pack(db, user_id)
            context_json = json.dumps(context_pack, ensure_ascii=False)
            messages.append({
                "role": "system",
                "content": f"FINANCE_CONTEXT_PACK (server, scoped to user): {context_json}",
            })
        except Exception as e:
            print(f"[WARNING] Failed to build context pack: {e}")
            # Continue without context pack
    
    # Add recent messages
    messages.extend(recent_messages)
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": user_message,
    })
    
    # Determine if tools should be attached
    attach_tools = should_attach_tools(user_message, include_context_pack)
    if not attach_tools and should_force_tools_from_context(recent_messages):
        attach_tools = True
        print("[DEBUG] Forcing tools due to clarification context from previous assistant message")
    tools_to_use = TOOLS if attach_tools else None
    
    # Debug: Log why tools are/aren't being attached
    if AI_TOOLS_MODE == "heuristic":
        user_text_lower = user_message.lower()
        matched_keywords = [kw for kw in [
            "criar", "registrar", "adicionar", "create", "add", "register",
            "alterar", "altera", "mudar", "muda", "editar", "edita", "atualizar", "atualiza",
            "update", "edit", "change", "modify", "modificar",
            "deletar", "deleta", "remover", "remove", "excluir", "exclui", "apagar", "apaga",
            "delete", "remove", "exclude",
            "saldo", "gasto", "gastei", "receita", "despesa", "extrato",
            "quanto", "balance", "transaction", "spending",
            "transação", "transacao",
            "listar", "list", "mostrar", "show", "ver", "ver todas",
        ] if kw in user_text_lower]
        print(f"[DEBUG] Heuristic mode: attach_tools={attach_tools}, include_context_pack={include_context_pack}, matched_keywords={matched_keywords}")
    
    # First LLM call (may include tool calls)
    print(f"[DEBUG] Calling LLM with {len(messages)} messages, {len(tools_to_use) if tools_to_use else 0} tools (mode: {AI_TOOLS_MODE})")
    try:
        llm_response = await call_llm(messages, tools=tools_to_use, api_key=api_key)
        print(f"[DEBUG] LLM response received: {bool(llm_response.get('content'))}, tool_calls: {len(llm_response.get('tool_calls', []))}")
        
        # Check if response contains an error (from Gemini error handling)
        if llm_response.get("error"):
            llm_response["metadata"] = ChatAssistantMeta().model_dump()
            return llm_response
    except Exception as e:
        print(f"[ERROR] LLM call failed: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
        # For Gemini, try to return user-friendly error
        if AI_PROVIDER == "gemini":
            try:
                from google.genai import errors as genai_errors
                if isinstance(e, (genai_errors.ServerError, genai_errors.ClientError, genai_errors.APIError)):
                    metadata = ChatAssistantMeta()
                    return {
                        "role": "assistant",
                        "content": (
                            "Desculpe, ocorreu um erro ao processar sua mensagem. "
                            "Por favor, tente novamente em alguns instantes."
                        ),
                        "tool_calls": [],
                        "error": "api_error",
                        "metadata": metadata.model_dump(),
                    }
            except ImportError:
                pass
        raise
    
    # Track metadata for UI events
    metadata = ChatAssistantMeta()

    # Multi-step tool loop (allows list -> update in a single user turn)
    max_tool_iterations = 2 if AI_PROVIDER == "gemini" else 1
    tool_iterations = 0
    current_response = llm_response
    all_tool_results: list[dict] = []

    while current_response.get("tool_calls") and tool_iterations < max_tool_iterations:
        tool_iterations += 1
        tool_results = []
        print(f"[DEBUG] Executing {len(current_response['tool_calls'])} tool calls (iteration {tool_iterations}/{max_tool_iterations})")
        for tool_call in current_response["tool_calls"]:
            try:
                import json
                tool_args = json.loads(tool_call["arguments"]) if isinstance(tool_call["arguments"], str) else tool_call["arguments"]
                print(f"[DEBUG] Executing tool: {tool_call['name']} with args: {tool_args}")
                result = await execute_tool(db, user_id, tool_call["name"], tool_args)
                print(f"[DEBUG] Tool {tool_call['name']} executed successfully. Result type: {type(result)}, Result keys: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")
                if isinstance(result, dict):
                    print(f"[DEBUG] Result has 'error' key: {'error' in result}, Result has 'id' key: {'id' in result}")
                tool_results.append({
                    "tool_call_id": tool_call["id"],
                    "name": tool_call["name"],
                    "result": result,
                })

                # Track transaction creation for UI metadata
                if tool_call["name"] == "create_transaction" and isinstance(result, dict) and "id" in result:
                    metadata.did_create_transaction = True
                    try:
                        metadata.created_transaction_id = UUID(result["id"])
                    except (ValueError, TypeError):
                        pass
                    is_income = result.get("type") == "INCOME"
                    metadata.ui_events.append(
                        ChatUiEvent(
                            type="success_card",
                            variant="neon",
                            accent="electric_lime",
                            title=get_random_confirmation_title(),
                            subtitle=get_random_confirmation_subtitle(is_income),
                            data={
                                "transaction": {
                                    "id": result.get("id"),
                                    "amount": result.get("amount"),
                                    "type": result.get("type"),
                                    "category": result.get("category"),
                                    "description": result.get("description"),
                                    "occurred_at": result.get("occurred_at"),
                                }
                            },
                        )
                    )

                # Track transaction update for UI metadata
                elif tool_call["name"] == "update_transaction" and isinstance(result, dict) and "id" in result:
                    metadata.did_update_transaction = True
                    try:
                        metadata.updated_transaction_id = UUID(result["id"])
                    except (ValueError, TypeError):
                        pass
                    metadata.ui_events.append(
                        ChatUiEvent(
                            type="success_card",
                            variant="neon",
                            accent="electric_lime",
                            title="Atualizado.",
                            subtitle="Transação atualizada.",
                            data={
                                "transaction": {
                                    "id": result.get("id"),
                                    "amount": result.get("amount"),
                                    "type": result.get("type"),
                                    "category": result.get("category"),
                                    "description": result.get("description"),
                                    "occurred_at": result.get("occurred_at"),
                                }
                            },
                        )
                    )

                # Track transaction deletion for UI metadata
                elif tool_call["name"] == "delete_transaction" and isinstance(result, dict) and "deleted" in result:
                    metadata.did_delete_transaction = True
                    try:
                        metadata.deleted_transaction_id = UUID(result["id"])
                    except (ValueError, TypeError):
                        pass
                    metadata.ui_events.append(
                        ChatUiEvent(
                            type="info_card",
                            variant="neon",
                            accent="deep_indigo",
                            title="Removido.",
                            subtitle="Transação excluída.",
                            data={
                                "deleted_transaction_id": result.get("id"),
                                "amount": result.get("amount"),
                                "category": result.get("category"),
                            },
                        )
                    )
            except Exception as e:
                import traceback
                print(f"[ERROR] Tool execution failed: {tool_call.get('name')}: {e}")
                print(f"[ERROR] Tool args were: {tool_args}")
                print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
                error_message = str(e)
                tool_results.append({
                    "tool_call_id": tool_call["id"],
                    "name": tool_call["name"],
                    "result": {
                        "error": "Failed to execute tool",
                        "message": error_message,
                    },
                })
                print(f"[ERROR] Added error result to tool_results. Total results: {len(tool_results)}")

        all_tool_results.extend(tool_results)

        assistant_content = current_response.get("content", "")
        messages.append({
            "role": "assistant",
            "content": assistant_content if assistant_content else "",
            "tool_calls": current_response["tool_calls"],
        })

        tool_results_text = []
        for tool_result in tool_results:
            result = tool_result["result"]
            if isinstance(result, dict) and result.get("error"):
                error_msg = result.get("message", result.get("error", "Erro desconhecido"))
                tool_results_text.append(
                    f"ERRO na função {tool_result['name']}: {error_msg}\n"
                    f"Se o erro mencionar 'not found' ou 'não encontrada', você deve primeiro usar list_transactions "
                    f"para encontrar a transação correta antes de tentar atualizar ou deletar novamente."
                )
            else:
                result_str = compact_tool_result(result)
                tool_results_text.append(f"Função {tool_result['name']} executada com sucesso. Resultado:\n{result_str}")

        if tool_results_text:
            combined_results = "\n\n".join(tool_results_text)
            if len(combined_results) > AI_TOOL_RESULTS_MAX_CHARS:
                combined_results = combined_results[:AI_TOOL_RESULTS_MAX_CHARS] + "... (truncated)"

            has_errors = any("ERRO" in text for text in tool_results_text)
            if has_errors:
                instruction = (
                    "Analise os resultados acima. Se houver ERROS, você deve:\n"
                    "1. Se o erro mencionar que a transação não foi encontrada, use list_transactions primeiro para encontrar a transação correta.\n"
                    "2. Use os IDs das transações encontradas para tentar novamente a operação solicitada.\n"
                    "3. Se não conseguir encontrar a transação, informe o usuário de forma clara e sugira listar todas as transações.\n"
                    "4. Responda ao usuário de forma útil mesmo se houver erros."
                )
            else:
                instruction = "Analise esses resultados e responda à pergunta do usuário de forma clara e útil."

            messages.append({
                "role": "user",
                "content": f"Aqui estão os resultados das funções executadas:\n\n{combined_results}\n\n{instruction}",
            })

        print(f"[DEBUG] Calling LLM with tool results (iteration {tool_iterations})")
        print(f"[DEBUG] Messages count: {len(messages)}, Last message role: {messages[-1]['role'] if messages else 'N/A'}")
        print(f"[DEBUG] Tool results count: {len(tool_results)}")
        print(f"[DEBUG] Tool results summary: {[(tr['name'], 'SUCCESS' if not (isinstance(tr.get('result'), dict) and tr.get('result', {}).get('error')) else 'ERROR') for tr in tool_results]}")
        try:
            current_response = await call_llm(messages, tools=TOOLS, api_key=api_key)
            print(f"[DEBUG] LLM response received after tools: {bool(current_response.get('content'))}, tool_calls: {len(current_response.get('tool_calls', []))}")
            if current_response.get("error"):
                current_response["metadata"] = metadata.model_dump()
                return current_response
        except Exception as e:
            print(f"[ERROR] LLM call failed after tools: {type(e).__name__}: {e}")
            import traceback
            print(f"[ERROR] Traceback:\n{traceback.format_exc()}")
            break

    final_response = current_response

    if not final_response.get("content") and all_tool_results:
        print(f"[DEBUG] Final response has no content but tools were executed. Checking tool results...")
        print(f"[DEBUG] Tool results: {[(tr['name'], 'error' in tr.get('result', {}) if isinstance(tr.get('result'), dict) else 'no error') for tr in all_tool_results]}")
        successful_tools = [tr for tr in all_tool_results if not (isinstance(tr.get("result"), dict) and tr.get("result", {}).get("error"))]
        print(f"[DEBUG] Successful tools: {[tr['name'] for tr in successful_tools]}")
        if successful_tools:
            tool_names = [tr["name"] for tr in successful_tools]
            print(f"[DEBUG] Tool names from successful tools: {tool_names}")
            if "update_transaction" in tool_names:
                final_response["content"] = "Transação atualizada com sucesso!"
                print(f"[DEBUG] Generated update confirmation message")
            elif "delete_transaction" in tool_names:
                final_response["content"] = "Transação excluída com sucesso!"
                print(f"[DEBUG] Generated delete confirmation message")
            elif "create_transaction" in tool_names:
                final_response["content"] = "Transação registrada com sucesso!"
                print(f"[DEBUG] Generated create confirmation message")
            else:
                final_response["content"] = "Operação realizada com sucesso!"
                print(f"[DEBUG] Generated generic confirmation message for tools: {tool_names}")
        else:
            print(f"[WARNING] No successful tools found in tool_results. All results: {[tr.get('result') for tr in all_tool_results]}")

    final_response["metadata"] = metadata.model_dump()
    print(f"[DEBUG] ========== Returning final response ==========")
    print(f"[DEBUG] Content length: {len(final_response.get('content', ''))}")
    print(f"[DEBUG] Metadata: did_update={metadata.did_update_transaction}, did_delete={metadata.did_delete_transaction}, did_create={metadata.did_create_transaction}")
    print(f"[DEBUG] UI events count: {len(metadata.ui_events)}")
    return final_response
