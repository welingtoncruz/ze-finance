"""
Integration tests for authentication endpoints.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient) -> None:
    """Test successful user registration returns 201 and token."""
    # Arrange
    user_data = {
        "email": "newuser@example.com",
        "password": "securepass123",
    }
    
    # Act
    response = await async_client.post("/auth/register", json=user_data)
    
    # Assert
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert len(data["access_token"]) > 0


@pytest.mark.asyncio
async def test_register_duplicate_email(async_client: AsyncClient) -> None:
    """Test registering with duplicate email returns 400."""
    # Arrange
    user_data = {
        "email": "duplicate@example.com",
        "password": "password123",
    }
    
    # Act - Register first time
    response1 = await async_client.post("/auth/register", json=user_data)
    assert response1.status_code == 201
    
    # Act - Try to register again with same email
    response2 = await async_client.post("/auth/register", json=user_data)
    
    # Assert
    assert response2.status_code == 400
    assert "already registered" in response2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient) -> None:
    """Test successful login returns 200 and token."""
    # Arrange
    user_data = {
        "email": "loginuser@example.com",
        "password": "loginpass123",
    }
    # Register user first
    await async_client.post("/auth/register", json=user_data)
    
    # Act - Login using OAuth2 form
    login_data = {
        "username": user_data["email"],
        "password": user_data["password"],
    }
    response = await async_client.post("/token", data=login_data)
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_email(async_client: AsyncClient) -> None:
    """Test login with invalid email returns 401."""
    # Arrange
    login_data = {
        "username": "nonexistent@example.com",
        "password": "somepassword",
    }
    
    # Act
    response = await async_client.post("/token", data=login_data)
    
    # Assert
    assert response.status_code == 401
    assert "credentials" in response.json()["detail"].lower() or "incorrect" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_invalid_password(async_client: AsyncClient) -> None:
    """Test login with invalid password returns 401."""
    # Arrange
    user_data = {
        "email": "wrongpass@example.com",
        "password": "correctpass123",
    }
    # Register user
    await async_client.post("/auth/register", json=user_data)
    
    # Act - Try login with wrong password
    login_data = {
        "username": user_data["email"],
        "password": "wrongpassword",
    }
    response = await async_client.post("/token", data=login_data)
    
    # Assert
    assert response.status_code == 401
    assert "credentials" in response.json()["detail"].lower() or "incorrect" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_current_user_info(async_client: AsyncClient, test_user: dict) -> None:
    """Test getting current user info with valid token."""
    # Act
    response = await async_client.get("/auth/me", headers=test_user["headers"])
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]


@pytest.mark.asyncio
async def test_get_current_user_info_no_token(async_client: AsyncClient) -> None:
    """Test getting current user info without token returns 401."""
    # Act
    response = await async_client.get("/auth/me")
    
    # Assert
    assert response.status_code == 401
