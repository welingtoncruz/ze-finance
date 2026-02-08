import { describe, it, expect } from "vitest"
import {
  getCategoriesByType,
  getCategoryLabel,
  getCategoryByValue,
  resolveCategoryValue,
  isPredefinedCategory,
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

  describe("resolveCategoryValue", () => {
    it("returns canonical value for exact match", () => {
      const result = resolveCategoryValue("Salary")
      expect(result).toBe("Salary")
    })

    it("returns canonical value for case-insensitive value match", () => {
      const result = resolveCategoryValue("salary")
      expect(result).toBe("Salary")
    })

    it("returns canonical value for Portuguese label match", () => {
      const result = resolveCategoryValue("Alimentação")
      expect(result).toBe("Groceries")
    })

    it("returns canonical value for case-insensitive label match", () => {
      const result = resolveCategoryValue("alimentação")
      expect(result).toBe("Groceries")
    })

    it("returns null for custom/unknown category", () => {
      const result = resolveCategoryValue("CustomCategory")
      expect(result).toBeNull()
    })

    it("returns null for empty string", () => {
      const result = resolveCategoryValue("")
      expect(result).toBeNull()
    })

    it("trims whitespace before matching", () => {
      const result = resolveCategoryValue("  Salary  ")
      expect(result).toBe("Salary")
    })
  })

  describe("isPredefinedCategory", () => {
    it("returns true for predefined category value", () => {
      expect(isPredefinedCategory("Salary")).toBe(true)
      expect(isPredefinedCategory("Groceries")).toBe(true)
      expect(isPredefinedCategory("Other")).toBe(true)
    })

    it("returns false for custom category", () => {
      expect(isPredefinedCategory("CustomCategory")).toBe(false)
      expect(isPredefinedCategory("Food")).toBe(false)
    })

    it("returns false for case mismatch", () => {
      expect(isPredefinedCategory("salary")).toBe(false)
      expect(isPredefinedCategory("GROCERIES")).toBe(false)
    })
  })
})
