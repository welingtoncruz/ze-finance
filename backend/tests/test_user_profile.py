"""
Integration tests for user profile endpoints.
"""
from decimal import Decimal

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_profile_with_defaults(async_client: AsyncClient) -> None:
  """
  GET /user/profile should return profile with default monthly budget for a new user.
  """
  # Arrange: create user and get auth headers
  user_data = {
      "email": "profile-default@example.com",
      "password": "testpassword123",
  }
  register_response = await async_client.post("/auth/register", json=user_data)
  assert register_response.status_code == 201
  token = register_response.json()["access_token"]
  headers = {"Authorization": f"Bearer {token}"}

  # Act
  response = await async_client.get("/user/profile", headers=headers)

  # Assert
  assert response.status_code == 200
  data = response.json()
  assert data["email"] == user_data["email"]
  assert data["full_name"] is None
  # Default monthly budget should be a positive value (5000 by default)
  assert Decimal(str(data["monthly_budget"])) > Decimal("0")


@pytest.mark.asyncio
async def test_update_profile_name_and_budget(async_client: AsyncClient) -> None:
  """
  PATCH /user/profile should update full_name and monthly_budget.
  """
  # Arrange: create user and get auth headers
  user_data = {
      "email": "profile-update@example.com",
      "password": "testpassword123",
  }
  register_response = await async_client.post("/auth/register", json=user_data)
  assert register_response.status_code == 201
  token = register_response.json()["access_token"]
  headers = {"Authorization": f"Bearer {token}"}

  # Act: update profile
  payload = {
      "full_name": "Test User",
      "monthly_budget": "7500.00",
  }
  update_response = await async_client.patch(
      "/user/profile",
      json=payload,
      headers=headers,
  )

  # Assert update response
  assert update_response.status_code == 200
  data = update_response.json()
  assert data["full_name"] == "Test User"
  assert Decimal(str(data["monthly_budget"])) == Decimal("7500.00")

  # Act: fetch profile again to ensure persistence
  get_response = await async_client.get("/user/profile", headers=headers)
  assert get_response.status_code == 200
  data_again = get_response.json()
  assert data_again["full_name"] == "Test User"
  assert Decimal(str(data_again["monthly_budget"])) == Decimal("7500.00")


@pytest.mark.asyncio
async def test_update_profile_invalid_budget(async_client: AsyncClient) -> None:
  """
  PATCH /user/profile with non-positive monthly_budget should fail.
  """
  # Arrange: create user and get auth headers
  user_data = {
      "email": "profile-invalid-budget@example.com",
      "password": "testpassword123",
  }
  register_response = await async_client.post("/auth/register", json=user_data)
  assert register_response.status_code == 201
  token = register_response.json()["access_token"]
  headers = {"Authorization": f"Bearer {token}"}

  # Act: send invalid monthly_budget
  payload = {
      "monthly_budget": 0,
  }
  response = await async_client.patch(
      "/user/profile",
      json=payload,
      headers=headers,
  )

  # Assert: FastAPI validation should reject this
  assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_profile_unauthorized(async_client: AsyncClient) -> None:
  """
  GET /user/profile without authentication should be unauthorized.
  """
  response = await async_client.get("/user/profile")
  assert response.status_code == 401

