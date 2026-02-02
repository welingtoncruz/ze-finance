"""
Integration tests for dashboard endpoints.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_summary_totals(async_client: AsyncClient, test_user: dict) -> None:
    """Test dashboard summary calculates correct totals."""
    # Arrange - Create income and expense transactions
    income_tx = {
        "amount": 1000.0,
        "type": "INCOME",
        "category": "Salary",
    }
    expense_tx1 = {
        "amount": 200.0,
        "type": "EXPENSE",
        "category": "Food",
    }
    expense_tx2 = {
        "amount": 150.0,
        "type": "EXPENSE",
        "category": "Transport",
    }
    
    await async_client.post("/transactions", json=income_tx, headers=test_user["headers"])
    await async_client.post("/transactions", json=expense_tx1, headers=test_user["headers"])
    await async_client.post("/transactions", json=expense_tx2, headers=test_user["headers"])
    
    # Act
    response = await async_client.get("/dashboard/summary", headers=test_user["headers"])
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_income"]) == 1000.0
    assert float(data["total_expense"]) == 350.0
    assert float(data["total_balance"]) == 650.0


@pytest.mark.asyncio
async def test_dashboard_summary_category_breakdown(async_client: AsyncClient, test_user: dict) -> None:
    """Test dashboard summary includes category breakdown."""
    # Arrange - Create multiple transactions in different categories
    transactions = [
        {"amount": 100.0, "type": "EXPENSE", "category": "Food"},
        {"amount": 50.0, "type": "EXPENSE", "category": "Food"},
        {"amount": 200.0, "type": "EXPENSE", "category": "Transport"},
        {"amount": 300.0, "type": "INCOME", "category": "Salary"},
    ]
    
    for tx in transactions:
        await async_client.post("/transactions", json=tx, headers=test_user["headers"])
    
    # Act
    response = await async_client.get("/dashboard/summary", headers=test_user["headers"])
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "by_category" in data
    assert len(data["by_category"]) == 2  # Food and Transport (expenses only)
    
    # Check category totals
    category_dict = {cat["name"]: float(cat["value"]) for cat in data["by_category"]}
    assert category_dict["Food"] == 150.0
    assert category_dict["Transport"] == 200.0


@pytest.mark.asyncio
async def test_dashboard_summary_empty(async_client: AsyncClient, test_user: dict) -> None:
    """Test dashboard summary with no transactions returns zeros."""
    # Act
    response = await async_client.get("/dashboard/summary", headers=test_user["headers"])
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert float(data["total_income"]) == 0.0
    assert float(data["total_expense"]) == 0.0
    assert float(data["total_balance"]) == 0.0
    assert data["by_category"] == []


@pytest.mark.asyncio
async def test_dashboard_summary_isolation(async_client: AsyncClient) -> None:
    """Test dashboard summary only includes data for authenticated user."""
    # Arrange - Create two users
    user1_data = {"email": "dash1@example.com", "password": "password123"}
    user2_data = {"email": "dash2@example.com", "password": "password123"}
    
    resp1 = await async_client.post("/auth/register", json=user1_data)
    resp2 = await async_client.post("/auth/register", json=user2_data)
    assert resp1.status_code == 201, f"Expected 201, got {resp1.status_code}: {resp1.json()}"
    assert resp2.status_code == 201, f"Expected 201, got {resp2.status_code}: {resp2.json()}"
    token1 = resp1.json()["access_token"]
    token2 = resp2.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    # User1 creates transactions
    tx1 = {"amount": 500.0, "type": "INCOME", "category": "Salary"}
    tx2 = {"amount": 100.0, "type": "EXPENSE", "category": "Food"}
    await async_client.post("/transactions", json=tx1, headers=headers1)
    await async_client.post("/transactions", json=tx2, headers=headers1)
    
    # User2 creates transactions
    tx3 = {"amount": 2000.0, "type": "INCOME", "category": "Salary"}
    await async_client.post("/transactions", json=tx3, headers=headers2)
    
    # Act - Get dashboard for user1
    response1 = await async_client.get("/dashboard/summary", headers=headers1)
    
    # Assert - User1 should only see their own data
    assert response1.status_code == 200
    data1 = response1.json()
    assert float(data1["total_income"]) == 500.0
    assert float(data1["total_expense"]) == 100.0
    assert float(data1["total_balance"]) == 400.0
    
    # Act - Get dashboard for user2
    response2 = await async_client.get("/dashboard/summary", headers=headers2)
    
    # Assert - User2 should only see their own data
    assert response2.status_code == 200
    data2 = response2.json()
    assert float(data2["total_income"]) == 2000.0
    assert float(data2["total_expense"]) == 0.0
    assert float(data2["total_balance"]) == 2000.0


@pytest.mark.asyncio
async def test_dashboard_summary_unauthorized(async_client: AsyncClient) -> None:
    """Test dashboard summary without token returns 401."""
    # Act
    response = await async_client.get("/dashboard/summary")
    
    # Assert
    assert response.status_code == 401
