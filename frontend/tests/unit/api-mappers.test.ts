import { describe, it, expect } from "vitest"
import {
  mapUiTransactionToApiCreate,
  mapApiTransactionToUi,
  type ApiTransactionResponse,
} from "@/lib/types/api"
import type { Transaction } from "@/lib/types"

describe("API Mappers", () => {
  describe("mapUiTransactionToApiCreate", () => {
    it("converts income type to uppercase", () => {
      const uiTx: Omit<Transaction, "id"> = {
        amount: 100.5,
        type: "income",
        category: "Salary",
        date: "2024-01-15",
        description: "Monthly salary",
      }

      const result = mapUiTransactionToApiCreate(uiTx)

      expect(result.type).toBe("INCOME")
      expect(result.amount).toBe(100.5)
      expect(result.category).toBe("Salary")
      expect(result.description).toBe("Monthly salary")
    })

    it("converts expense type to uppercase", () => {
      const uiTx: Omit<Transaction, "id"> = {
        amount: 50.25,
        type: "expense",
        category: "Groceries",
        date: "2024-01-15",
      }

      const result = mapUiTransactionToApiCreate(uiTx)

      expect(result.type).toBe("EXPENSE")
      expect(result.amount).toBe(50.25)
      expect(result.category).toBe("Groceries")
    })

    it("converts date to ISO string", () => {
      const uiTx: Omit<Transaction, "id"> = {
        amount: 100,
        type: "income",
        category: "Salary",
        date: "2024-01-15",
      }

      const result = mapUiTransactionToApiCreate(uiTx)

      expect(result.occurred_at).toBe(new Date("2024-01-15").toISOString())
    })

    it("handles optional description", () => {
      const uiTx: Omit<Transaction, "id"> = {
        amount: 100,
        type: "expense",
        category: "Groceries",
        date: "2024-01-15",
        description: undefined,
      }

      const result = mapUiTransactionToApiCreate(uiTx)

      expect(result.description).toBeUndefined()
    })

    it("handles empty description as undefined", () => {
      const uiTx: Omit<Transaction, "id"> = {
        amount: 100,
        type: "expense",
        category: "Groceries",
        date: "2024-01-15",
        description: "",
      }

      const result = mapUiTransactionToApiCreate(uiTx)

      expect(result.description).toBe("")
    })
  })

  describe("mapApiTransactionToUi", () => {
    it("converts INCOME type to lowercase", () => {
      const apiTx: ApiTransactionResponse = {
        id: "123",
        amount: 100.5,
        type: "INCOME",
        category: "Salary",
        description: "Monthly salary",
        occurred_at: "2024-01-15T10:00:00Z",
        created_at: "2024-01-15T10:00:00Z",
      }

      const result = mapApiTransactionToUi(apiTx)

      expect(result.type).toBe("income")
      expect(result.amount).toBe(100.5)
      expect(result.category).toBe("Salary")
      expect(result.description).toBe("Monthly salary")
    })

    it("converts EXPENSE type to lowercase", () => {
      const apiTx: ApiTransactionResponse = {
        id: "456",
        amount: 50.25,
        type: "EXPENSE",
        category: "Groceries",
        occurred_at: "2024-01-15T10:00:00Z",
        created_at: "2024-01-15T10:00:00Z",
      }

      const result = mapApiTransactionToUi(apiTx)

      expect(result.type).toBe("expense")
      expect(result.amount).toBe(50.25)
      expect(result.category).toBe("Groceries")
    })

    it("converts occurred_at ISO string to YYYY-MM-DD date", () => {
      const apiTx: ApiTransactionResponse = {
        id: "789",
        amount: 100,
        type: "INCOME",
        category: "Salary",
        occurred_at: "2024-01-15T14:30:00Z",
        created_at: "2024-01-15T10:00:00Z",
      }

      const result = mapApiTransactionToUi(apiTx)

      expect(result.date).toBe("2024-01-15")
    })

    it("converts null description to undefined", () => {
      const apiTx: ApiTransactionResponse = {
        id: "999",
        amount: 100,
        type: "EXPENSE",
        category: "Groceries",
        description: null,
        occurred_at: "2024-01-15T10:00:00Z",
        created_at: "2024-01-15T10:00:00Z",
      }

      const result = mapApiTransactionToUi(apiTx)

      expect(result.description).toBeUndefined()
    })

    it("preserves non-null description", () => {
      const apiTx: ApiTransactionResponse = {
        id: "888",
        amount: 100,
        type: "EXPENSE",
        category: "Groceries",
        description: "Test description",
        occurred_at: "2024-01-15T10:00:00Z",
        created_at: "2024-01-15T10:00:00Z",
      }

      const result = mapApiTransactionToUi(apiTx)

      expect(result.description).toBe("Test description")
    })
  })
})
