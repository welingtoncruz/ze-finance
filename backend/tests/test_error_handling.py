"""
Tests for global error handling and sanitized AI/chat errors.
"""
from typing import Any

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_unhandled_exception_returns_safe_500(async_client: AsyncClient) -> None:
  """
  Unhandled exceptions must be converted into a generic 500 error
  without leaking internal details.
  """
  response = await async_client.get("/__test_unhandled_error")

  assert response.status_code == 500
  body = response.json()
  assert body.get("detail") == "Internal server error"
  # Do not expose traceback or internal error string
  assert "boom" not in str(body)


@pytest.mark.asyncio
async def test_chat_ai_value_error_is_sanitized(
  async_client: AsyncClient,
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  """
  AI ValueError (non-API-key case) must return a sanitized 502 response
  without exposing internal error messages.
  """
  # Arrange: register user and obtain token
  user_data = {
      "email": "chat-error@example.com",
      "password": "testpassword123",
  }
  register_response = await async_client.post("/auth/register", json=user_data)
  assert register_response.status_code == 201
  token = register_response.json()["access_token"]
  headers = {"Authorization": f"Bearer {token}"}

  # Monkeypatch gateway to raise a ValueError that should be sanitized
  from app import ai as ai_module  # type: ignore
  from app.ai import gateway as gateway_module  # type: ignore

  async def _fake_process_chat_message(*_: Any, **__: Any) -> Dict[str, Any]:
    raise ValueError("internal LLM error: timeout while contacting provider")

  monkeypatch.setattr(gateway_module, "process_chat_message", _fake_process_chat_message)

  payload = {
      "conversation_id": None,
      "text": "Teste de erro no chat",
      "content_type": "text",
  }

  # Act
  response = await async_client.post("/chat/messages", json=payload, headers=headers)

  # Assert
  assert response.status_code == 502
  body = response.json()
  assert body.get("detail") == "AI service is temporarily unavailable. Please try again later."
  # Internal details must not be present
  assert "internal LLM error" not in str(body)

