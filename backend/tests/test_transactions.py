"""
Integration tests for transaction endpoints.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_transaction_success(async_client: AsyncClient, test_user: dict) -> None:
    """Test creating a transaction returns 201 with transaction data."""
    # Arrange
    transaction_data = {
        "amount": 100.50,
        "type": "EXPENSE",
        "category": "Food",
        "description": "Lunch",
    }
    
    # Act
    response = await async_client.post(
        "/transactions",
        json=transaction_data,
        headers=test_user["headers"],
    )
    
    # Assert
    assert response.status_code == 201
    data = response.json()
    assert float(data["amount"]) == 100.50
    assert data["type"] == "EXPENSE"
    assert data["category"] == "Food"
    assert data["description"] == "Lunch"
    assert "id" in data
    assert "created_at" in data
    assert "occurred_at" in data


@pytest.mark.asyncio
async def test_create_transaction_unauthorized(async_client: AsyncClient) -> None:
    """Test creating a transaction without token returns 401."""
    # Arrange
    transaction_data = {
        "amount": 100.50,
        "type": "EXPENSE",
        "category": "Food",
    }
    
    # Act
    response = await async_client.post("/transactions", json=transaction_data)
    
    # Assert
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_transactions_isolation(async_client: AsyncClient) -> None:
    """Test that users only see their own transactions."""
    # Arrange - Create two users
    user1_data = {
        "email": "user1@example.com",
        "password": "password123",
    }
    user2_data = {
        "email": "user2@example.com",
        "password": "password123",
    }
    
    # Register users
    resp1 = await async_client.post("/auth/register", json=user1_data)
    resp2 = await async_client.post("/auth/register", json=user2_data)
    token1 = resp1.json()["access_token"]
    token2 = resp2.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    # Create transactions for user1
    tx1 = {
        "amount": 50.0,
        "type": "EXPENSE",
        "category": "Food",
    }
    await async_client.post("/transactions", json=tx1, headers=headers1)
    
    # Create transactions for user2
    tx2 = {
        "amount": 200.0,
        "type": "INCOME",
        "category": "Salary",
    }
    await async_client.post("/transactions", json=tx2, headers=headers2)
    
    # Act - List transactions for user1
    response1 = await async_client.get("/transactions", headers=headers1)
    
    # Assert - User1 should only see their own transaction
    assert response1.status_code == 200
    transactions1 = response1.json()
    assert len(transactions1) == 1
    assert float(transactions1[0]["amount"]) == 50.0
    assert transactions1[0]["type"] == "EXPENSE"
    
    # Act - List transactions for user2
    response2 = await async_client.get("/transactions", headers=headers2)
    
    # Assert - User2 should only see their own transaction
    assert response2.status_code == 200
    transactions2 = response2.json()
    assert len(transactions2) == 1
    assert float(transactions2[0]["amount"]) == 200.0
    assert transactions2[0]["type"] == "INCOME"


@pytest.mark.asyncio
async def test_list_transactions_limit(async_client: AsyncClient, test_user: dict) -> None:
    """Test that limit parameter works correctly."""
    # Arrange - Create multiple transactions
    for i in range(5):
        tx_data = {
            "amount": float(10 + i),
            "type": "EXPENSE",
            "category": f"Category{i}",
        }
        await async_client.post(
            "/transactions",
            json=tx_data,
            headers=test_user["headers"],
        )
    
    # Act - List with limit=2
    response = await async_client.get(
        "/transactions?limit=2",
        headers=test_user["headers"],
    )
    
    # Assert
    assert response.status_code == 200
    transactions = response.json()
    assert len(transactions) == 2


@pytest.mark.asyncio
async def test_delete_transaction_success(async_client: AsyncClient, test_user: dict) -> None:
    """Test deleting own transaction returns 204."""
    # Arrange - Create a transaction
    tx_data = {
        "amount": 75.0,
        "type": "EXPENSE",
        "category": "Shopping",
    }
    create_response = await async_client.post(
        "/transactions",
        json=tx_data,
        headers=test_user["headers"],
    )
    transaction_id = create_response.json()["id"]
    
    # Act - Delete the transaction
    delete_response = await async_client.delete(
        f"/transactions/{transaction_id}",
        headers=test_user["headers"],
    )
    
    # Assert
    assert delete_response.status_code == 204
    
    # Verify transaction is deleted
    list_response = await async_client.get(
        "/transactions",
        headers=test_user["headers"],
    )
    transactions = list_response.json()
    assert len(transactions) == 0


@pytest.mark.asyncio
async def test_delete_transaction_not_found(async_client: AsyncClient, test_user: dict) -> None:
    """Test deleting non-existent transaction returns 404."""
    # Arrange
    from uuid import uuid4
    fake_id = uuid4()
    
    # Act
    response = await async_client.delete(
        f"/transactions/{fake_id}",
        headers=test_user["headers"],
    )
    
    # Assert
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_transaction_other_user(async_client: AsyncClient) -> None:
    """Test deleting another user's transaction returns 404."""
    # Arrange - Create two users
    user1_data = {"email": "owner@example.com", "password": "password123"}
    user2_data = {"email": "other@example.com", "password": "password123"}
    
    resp1 = await async_client.post("/auth/register", json=user1_data)
    resp2 = await async_client.post("/auth/register", json=user2_data)
    token1 = resp1.json()["access_token"]
    token2 = resp2.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    # User1 creates a transaction
    tx_data = {"amount": 100.0, "type": "EXPENSE", "category": "Food"}
    create_resp = await async_client.post("/transactions", json=tx_data, headers=headers1)
    transaction_id = create_resp.json()["id"]
    
    # Act - User2 tries to delete user1's transaction
    response = await async_client.delete(
        f"/transactions/{transaction_id}",
        headers=headers2,
    )
    
    # Assert
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
