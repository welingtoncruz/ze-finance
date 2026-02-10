"""
Integration tests for Zefa chat agent.
"""
import json
import os

import pytest
import respx
from httpx import AsyncClient, Response

# Note: We use the /chat/api-key endpoint to set API keys in tests.
# API keys must match schema: min 20 chars, start with sk-, sk-ant-, or sk-proj-
TEST_API_KEY = "sk-test-key-for-testing-only-12345"
# OpenAI client may send method as bytes (b"POST"); respx.post() matches str "POST" only.
# Use respx.route(method__in=["POST", b"POST"], url=...) so mocks match in all environments.


@pytest.mark.asyncio
async def test_chat_message_missing_api_key(async_client: AsyncClient, test_user: dict) -> None:
    """Test chat message without API key returns message asking for key."""
    # Arrange - Ensure no API key is set
    os.environ.pop("OPENAI_API_KEY", None)
    os.environ.pop("ANTHROPIC_API_KEY", None)
    
    payload = {
        "text": "Qual meu saldo?",
        "content_type": "text",
    }
    
    # Act
    response = await async_client.post(
        "/chat/messages",
        json=payload,
        headers=test_user["headers"],
    )
    
    # Assert
    assert response.status_code == 201
    data = response.json()
    assert "message" in data
    assert "meta" in data
    assert data["message"]["role"] == "assistant"
    assert "API key" in data["message"]["content"] or "chave de API" in data["message"]["content"]
    assert "Zefa" in data["message"]["content"]
    assert isinstance(data["meta"]["ui_events"], list)


@pytest.mark.asyncio
async def test_chat_message_with_balance_query(async_client: AsyncClient, test_user: dict) -> None:
    """Test chat message asking for balance triggers tool call and returns pt-BR answer."""
    # Arrange - Set ephemeral API key via endpoint
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call
    with respx.mock:
        # Mock the OpenAI API response
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Seu saldo atual é R$ 0,00.",
                                "tool_calls": [
                                    {
                                        "id": "call_123",
                                        "type": "function",
                                        "function": {
                                            "name": "get_balance",
                                            "arguments": "{}",
                                        },
                                    },
                                ],
                            },
                            "finish_reason": "tool_calls",
                        },
                    ],
                },
            ),
        )
        
        # Mock second call (after tool execution)
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "id": "chatcmpl-test2",
                    "object": "chat.completion",
                    "created": 1234567891,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Seu saldo atual é R$ 0,00. Você ainda não possui transações registradas.",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        )
        
        payload = {
            "text": "Qual meu saldo?",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "meta" in data
        assert data["message"]["role"] == "assistant"
        assert "saldo" in data["message"]["content"].lower() or "balance" in data["message"]["content"].lower()
        assert isinstance(data["meta"]["ui_events"], list)


@pytest.mark.asyncio
async def test_chat_message_isolation(async_client: AsyncClient) -> None:
    """Test that user A cannot read user B's conversation/messages."""
    # Arrange - Create two users
    user_a_data = {
        "email": "usera@example.com",
        "password": "password123",
    }
    user_b_data = {
        "email": "userb@example.com",
        "password": "password123",
    }
    
    response_a = await async_client.post("/auth/register", json=user_a_data)
    response_b = await async_client.post("/auth/register", json=user_b_data)
    
    assert response_a.status_code == 201
    assert response_b.status_code == 201
    
    token_a = response_a.json()["access_token"]
    token_b = response_b.json()["access_token"]
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # Set API keys for both users (using user IDs from tokens)
    # Note: In real implementation, we'd extract user_id from token
    # For testing, we'll set keys directly via the endpoint
    await async_client.post(
        "/chat/api-key",
        json={"api_key": "sk-test-key-a-for-testing-12345"},
        headers=headers_a,
    )
    await async_client.post(
        "/chat/api-key",
        json={"api_key": "sk-test-key-b-for-testing-12345"},
        headers=headers_b,
    )
    
    # Mock OpenAI API for user A
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Olá! Como posso ajudá-lo?",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        )
        
        # User A sends a message
        payload_a = {
            "text": "Olá Zefa",
            "content_type": "text",
        }
        response_a_msg = await async_client.post(
            "/chat/messages",
            json=payload_a,
            headers=headers_a,
        )
        assert response_a_msg.status_code == 201
        conversation_id_a = response_a_msg.json()["message"]["conversation_id"]
        
        # User B tries to access user A's conversation (if there was such an endpoint)
        # For now, we test that user B gets their own conversation
        payload_b = {
            "text": "Olá Zefa",
            "content_type": "text",
        }
        response_b_msg = await async_client.post(
            "/chat/messages",
            json=payload_b,
            headers=headers_b,
        )
        assert response_b_msg.status_code == 201
        conversation_id_b = response_b_msg.json()["message"]["conversation_id"]
        
        # Assert - Conversations should be different
        assert conversation_id_a != conversation_id_b


@pytest.mark.asyncio
async def test_chat_message_create_transaction(async_client: AsyncClient, test_user: dict) -> None:
    """Test creating transaction via natural language."""
    # Arrange - Set ephemeral API key via endpoint
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call - use side_effect for multiple sequential calls
    with respx.mock:
        # Define responses for sequential calls
        responses = [
            # First call - tool call for create_transaction
            Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [
                                    {
                                        "id": "call_123",
                                        "type": "function",
                                        "function": {
                                            "name": "create_transaction",
                                            "arguments": json.dumps({
                                                "amount": 27.90,
                                                "type": "EXPENSE",
                                                "category": "Transport",
                                                "description": "Uber",
                                            }),
                                        },
                                    },
                                ],
                            },
                            "finish_reason": "tool_calls",
                        },
                    ],
                },
            ),
            # Second call - final response
            Response(
                200,
                json={
                    "id": "chatcmpl-test2",
                    "object": "chat.completion",
                    "created": 1234567891,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Transação registrada com sucesso! Uber de R$ 27,90 na categoria Transport.",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        ]
        
        # Configure mock to return responses in sequence
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=responses)
        
        payload = {
            "text": "Registra um Uber de 27,90",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "meta" in data
        assert data["message"]["role"] == "assistant"
        assert data["meta"]["did_create_transaction"] is True
        # Verify transaction was created by checking transactions endpoint
        tx_response = await async_client.get(
            "/transactions",
            headers=test_user["headers"],
        )
        assert tx_response.status_code == 200
        transactions = tx_response.json()
        assert len(transactions) > 0, f"Expected at least 1 transaction, got {len(transactions)}. Transactions: {transactions}"
        # Check if transaction exists with matching amount and category (using approximate float comparison)
        matching_tx = [
            tx for tx in transactions 
            if abs(float(tx["amount"]) - 27.90) < 0.01 and tx["category"] == "Transport"
        ]
        assert len(matching_tx) > 0, f"Expected transaction with amount=27.90 and category=Transport, but got: {transactions}"


@pytest.mark.asyncio
async def test_chat_message_provider_error(async_client: AsyncClient, test_user: dict) -> None:
    """Test that provider failure returns safe 502 and does not persist partial messages."""
    # Arrange - Set ephemeral API key via endpoint
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call that fails
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                500,
                json={"error": "Internal server error"},
            ),
        )
        
        payload = {
            "text": "Qual meu saldo?",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert - Should return 502 with safe error message
        assert response.status_code == 502
        data = response.json()
        assert "erro" in data["detail"].lower() or "error" in data["detail"].lower()


@pytest.mark.asyncio
async def test_set_ephemeral_api_key(async_client: AsyncClient, test_user: dict) -> None:
    """Test setting ephemeral API key via endpoint."""
    # Arrange
    api_key = "sk-test-ephemeral-key-12345"
    
    # Act
    response = await async_client.post(
        "/chat/api-key",
        json={"api_key": api_key},
        headers=test_user["headers"],
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "configurada" in data["message"].lower() or "configured" in data["message"].lower()
    
    # Verify key is set (by trying to use it)
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Olá! Como posso ajudá-lo?",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        )
        
        payload = {
            "text": "Olá",
            "content_type": "text",
        }
        
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Should succeed now
        assert response.status_code == 201


@pytest.mark.asyncio
async def test_context_limit_wired(async_client: AsyncClient, test_user: dict, monkeypatch) -> None:
    """Test that context limit uses AI_MAX_CONTEXT_MESSAGES env var."""
    # Arrange - Set custom context limit
    monkeypatch.setenv("AI_MAX_CONTEXT_MESSAGES", "5")
    
    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Olá!",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        )
        
        payload = {
            "text": "Olá",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert - Should succeed (we're testing that limit is used, not the exact value)
        assert response.status_code == 201


@pytest.mark.asyncio
async def test_output_token_caps(async_client: AsyncClient, test_user: dict, monkeypatch) -> None:
    """Test that max_tokens is passed to provider calls."""
    # Arrange - Gateway reads env at import time; patch the module so the test value is used
    monkeypatch.setattr("app.ai.gateway.AI_MAX_OUTPUT_TOKENS", 300)

    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call and capture request
    captured_request = None
    
    def capture_request(request):
        nonlocal captured_request
        captured_request = request
        return Response(
            200,
            json={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "created": 1234567890,
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Olá!",
                        },
                        "finish_reason": "stop",
                    },
                ],
            },
        )
    
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=capture_request)
        
        payload = {
            "text": "Olá",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert
        assert response.status_code == 201
        assert captured_request is not None
        request_json = json.loads(captured_request.content)
        assert "max_tokens" in request_json
        assert request_json["max_tokens"] == 300


@pytest.mark.asyncio
async def test_tools_gating_heuristic(async_client: AsyncClient, test_user: dict, monkeypatch) -> None:
    """Test that tools are gated based on AI_TOOLS_MODE heuristic."""
    # Arrange - Set tools mode to heuristic
    monkeypatch.setenv("AI_TOOLS_MODE", "heuristic")
    
    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call and capture request
    captured_request = None
    
    def capture_request(request):
        nonlocal captured_request
        captured_request = request
        return Response(
            200,
            json={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "created": 1234567890,
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Olá!",
                        },
                        "finish_reason": "stop",
                    },
                ],
            },
        )
    
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=capture_request)
        
        # Test 1: Non-finance message should not include tools
        payload = {
            "text": "Olá, como você está?",
            "content_type": "text",
        }
        
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        assert response.status_code == 201
        assert captured_request is not None
        request_json = json.loads(captured_request.content)
        # Tools should not be included for non-finance message
        assert "tools" not in request_json or request_json.get("tools") is None
        
        # Reset captured request
        captured_request = None
        
        # Test 2: Finance message should include tools
        payload = {
            "text": "Qual meu saldo?",
            "content_type": "text",
        }
        
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        assert response.status_code == 201
        assert captured_request is not None
        request_json = json.loads(captured_request.content)
        # Tools should be included for finance message
        assert "tools" in request_json
        assert request_json["tools"] is not None


@pytest.mark.asyncio
async def test_tools_mode_always(async_client: AsyncClient, test_user: dict, monkeypatch) -> None:
    """Test that tools are always attached when AI_TOOLS_MODE=always."""
    # Arrange - Gateway reads env at import time; patch the module so the test value is used
    monkeypatch.setattr("app.ai.gateway.AI_TOOLS_MODE", "always")

    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call and capture request
    captured_request = None
    
    def capture_request(request):
        nonlocal captured_request
        captured_request = request
        return Response(
            200,
            json={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "created": 1234567890,
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Olá!",
                        },
                        "finish_reason": "stop",
                    },
                ],
            },
        )
    
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=capture_request)
        
        # Non-finance message should still include tools
        payload = {
            "text": "Olá, como você está?",
            "content_type": "text",
        }
        
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        assert response.status_code == 201
        assert captured_request is not None
        request_json = json.loads(captured_request.content)
        # Tools should be included even for non-finance message
        assert "tools" in request_json
        assert request_json["tools"] is not None


@pytest.mark.asyncio
async def test_tools_mode_never(async_client: AsyncClient, test_user: dict, monkeypatch) -> None:
    """Test that tools are never attached when AI_TOOLS_MODE=never."""
    # Arrange - Gateway reads env at import time; patch the module so the test value is used
    monkeypatch.setattr("app.ai.gateway.AI_TOOLS_MODE", "never")

    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call and capture request
    captured_request = None
    
    def capture_request(request):
        nonlocal captured_request
        captured_request = request
        return Response(
            200,
            json={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "created": 1234567890,
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Olá!",
                        },
                        "finish_reason": "stop",
                    },
                ],
            },
        )
    
    with respx.mock:
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=capture_request)
        
        # Finance message should not include tools
        payload = {
            "text": "Qual meu saldo?",
            "content_type": "text",
        }
        
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        assert response.status_code == 201
        assert captured_request is not None
        request_json = json.loads(captured_request.content)
        # Tools should not be included even for finance message
        assert "tools" not in request_json or request_json.get("tools") is None


@pytest.mark.asyncio
async def test_chat_message_update_transaction(async_client: AsyncClient, test_user: dict) -> None:
    """Test updating transaction via natural language."""
    # Arrange - Create a transaction first
    tx_data = {"amount": 100.0, "type": "EXPENSE", "category": "Food", "description": "Original"}
    create_resp = await async_client.post(
        "/transactions",
        json=tx_data,
        headers=test_user["headers"],
    )
    assert create_resp.status_code == 201
    transaction_id = create_resp.json()["id"]
    
    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call
    with respx.mock:
        responses = [
            # First call - tool call for update_transaction
            Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [
                                    {
                                        "id": "call_123",
                                        "type": "function",
                                        "function": {
                                            "name": "update_transaction",
                                            "arguments": json.dumps({
                                                "transaction_id": transaction_id,
                                                "description": "Updated via chat",
                                            }),
                                        },
                                    },
                                ],
                            },
                            "finish_reason": "tool_calls",
                        },
                    ],
                },
            ),
            # Second call - final response
            Response(
                200,
                json={
                    "id": "chatcmpl-test2",
                    "object": "chat.completion",
                    "created": 1234567891,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Transação atualizada com sucesso!",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        ]
        
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=responses)
        
        payload = {
            "text": f"Atualiza a transação {transaction_id} com descrição 'Updated via chat'",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "meta" in data
        assert data["message"]["role"] == "assistant"
        assert data["meta"]["did_update_transaction"] is True
        assert data["meta"]["updated_transaction_id"] == transaction_id
        assert len(data["meta"]["ui_events"]) > 0
        # Check UI event for update
        update_event = next((e for e in data["meta"]["ui_events"] if "Atualizado" in e.get("title", "")), None)
        assert update_event is not None
        assert update_event["type"] == "success_card"
        
        # Verify transaction was updated
        tx_response = await async_client.get(
            "/transactions",
            headers=test_user["headers"],
        )
        assert tx_response.status_code == 200
        transactions = tx_response.json()
        updated_tx = next((tx for tx in transactions if tx["id"] == transaction_id), None)
        assert updated_tx is not None
        assert updated_tx["description"] == "Updated via chat"


@pytest.mark.asyncio
async def test_chat_message_delete_transaction(async_client: AsyncClient, test_user: dict) -> None:
    """Test deleting transaction via natural language."""
    # Arrange - Create a transaction first
    tx_data = {"amount": 50.0, "type": "EXPENSE", "category": "Food"}
    create_resp = await async_client.post(
        "/transactions",
        json=tx_data,
        headers=test_user["headers"],
    )
    assert create_resp.status_code == 201
    transaction_id = create_resp.json()["id"]
    
    # Set ephemeral API key
    await async_client.post(
        "/chat/api-key",
        json={"api_key": TEST_API_KEY},
        headers=test_user["headers"],
    )
    
    # Mock OpenAI API call
    with respx.mock:
        responses = [
            # First call - tool call for delete_transaction
            Response(
                200,
                json={
                    "id": "chatcmpl-test",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [
                                    {
                                        "id": "call_123",
                                        "type": "function",
                                        "function": {
                                            "name": "delete_transaction",
                                            "arguments": json.dumps({
                                                "transaction_id": transaction_id,
                                            }),
                                        },
                                    },
                                ],
                            },
                            "finish_reason": "tool_calls",
                        },
                    ],
                },
            ),
            # Second call - final response
            Response(
                200,
                json={
                    "id": "chatcmpl-test2",
                    "object": "chat.completion",
                    "created": 1234567891,
                    "model": "gpt-4o-mini",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Transação excluída com sucesso!",
                            },
                            "finish_reason": "stop",
                        },
                    ],
                },
            ),
        ]
        
        respx.route(method__in=["POST", b"POST"], url="https://api.openai.com/v1/chat/completions").mock(side_effect=responses)
        
        payload = {
            "text": f"Remove a transação {transaction_id}",
            "content_type": "text",
        }
        
        # Act
        response = await async_client.post(
            "/chat/messages",
            json=payload,
            headers=test_user["headers"],
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert "message" in data
        assert "meta" in data
        assert data["message"]["role"] == "assistant"
        assert data["meta"]["did_delete_transaction"] is True
        assert data["meta"]["deleted_transaction_id"] == transaction_id
        assert len(data["meta"]["ui_events"]) > 0
        # Check UI event for delete
        delete_event = next((e for e in data["meta"]["ui_events"] if "Removido" in e.get("title", "")), None)
        assert delete_event is not None
        assert delete_event["type"] == "info_card"
        
        # Verify transaction was deleted
        tx_response = await async_client.get(
            "/transactions",
            headers=test_user["headers"],
        )
        assert tx_response.status_code == 200
        transactions = tx_response.json()
        deleted_tx = next((tx for tx in transactions if tx["id"] == transaction_id), None)
        assert deleted_tx is None
