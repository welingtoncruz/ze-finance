import { describe, it, expect } from "vitest"
import {
  getCategoriesByType,
  getCategoryLabel,
  getCategoryByValue,
  CATEGORIES,
} from "@/lib/transactions/categories"
import type { TransactionType } from "@/lib/types"

describe("Category Helpers", () => {
  describe("getCategoriesByType", () => {
    it("returns non-empty list for income type", () => {
      const result = getCategoriesByType("income")

      expect(result.length).toBeGreaterThan(0)
      expect(result.every((cat) => cat.type.includes("income"))).toBe(true)
    })

    it("returns non-empty list for expense type", () => {
      const result = getCategoriesByType("expense")

      expect(result.length).toBeGreaterThan(0)
      expect(result.every((cat) => cat.type.includes("expense"))).toBe(true)
    })

    it("returns categories that include both types for 'Other' category", () => {
      const otherCategory = CATEGORIES.find((cat) => cat.value === "Other")
      expect(otherCategory).toBeDefined()
      expect(otherCategory?.type).toContain("income")
      expect(otherCategory?.type).toContain("expense")
    })

    it("returns unique category values (no duplicates)", () => {
      const incomeCategories = getCategoriesByType("income")
      const expenseCategories = getCategoriesByType("expense")

      const incomeValues = incomeCategories.map((cat) => cat.value)
      const expenseValues = expenseCategories.map((cat) => cat.value)

      const incomeUnique = new Set(incomeValues)
      const expenseUnique = new Set(expenseValues)

      expect(incomeValues.length).toBe(incomeUnique.size)
      expect(expenseValues.length).toBe(expenseUnique.size)
    })
  })

  describe("getCategoryLabel", () => {
    it("returns label for existing category value", () => {
      const result = getCategoryLabel("Salary")
      expect(result).toBe("Salário")
    })

    it("returns the value itself if category not found", () => {
      const result = getCategoryLabel("NonExistent")
      expect(result).toBe("NonExistent")
    })
  })

  describe("getCategoryByValue", () => {
    it("returns category definition for existing value", () => {
      const result = getCategoryByValue("Salary")
      expect(result).toBeDefined()
      expect(result?.value).toBe("Salary")
      expect(result?.label).toBe("Salário")
    })

    it("returns undefined for non-existent value", () => {
      const result = getCategoryByValue("NonExistent")
      expect(result).toBeUndefined()
    })
  })
})
