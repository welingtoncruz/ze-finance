import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import type { Transaction } from "@/lib/types"

describe("TransactionForm Integration", () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Form validation", () => {
    it("disables submit button when amount is missing", async () => {
      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByTestId("tx-submit")
      expect(submitButton).toBeDisabled()
    })

    it("disables submit button when category is not selected", async () => {
      const user = userEvent.setup()
      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const amountInput = screen.getByTestId("tx-amount")
      await user.type(amountInput, "100")

      const submitButton = screen.getByTestId("tx-submit")
      expect(submitButton).toBeDisabled()
    })

    it("enables submit button when amount and category are provided", async () => {
      const user = userEvent.setup()
      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const amountInput = screen.getByTestId("tx-amount")
      await user.type(amountInput, "100")

      const categoryButton = screen.getByTestId("tx-category-Groceries")
      await user.click(categoryButton)

      const submitButton = screen.getByTestId("tx-submit")
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe("Form submission", () => {
    it("calls onSubmit with correct payload when form is submitted", async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)

      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Fill form
      const amountInput = screen.getByTestId("tx-amount")
      await user.type(amountInput, "123.45")

      const categoryButton = screen.getByTestId("tx-category-Groceries")
      await user.click(categoryButton)

      const dateInput = screen.getByTestId("tx-date")
      const today = new Date().toISOString().split("T")[0]
      await user.clear(dateInput)
      await user.type(dateInput, today)

      const descriptionInput = screen.getByTestId("tx-description")
      await user.type(descriptionInput, "Test description")

      // Submit
      const submitButton = screen.getByTestId("tx-submit")
      await user.click(submitButton)

      // Verify payload
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })

      const callArgs = mockOnSubmit.mock.calls[0][0]
      expect(callArgs.amount).toBe(123.45)
      expect(callArgs.type).toBe("expense")
      expect(callArgs.category).toBe("Groceries")
      expect(callArgs.date).toBe(today)
      expect(callArgs.description).toBe("Test description")
    })

    it("defaults date to today if not changed", async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)

      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const amountInput = screen.getByTestId("tx-amount")
      await user.type(amountInput, "100")

      const categoryButton = screen.getByTestId("tx-category-Groceries")
      await user.click(categoryButton)

      const submitButton = screen.getByTestId("tx-submit")
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })

      const callArgs = mockOnSubmit.mock.calls[0][0]
      const today = new Date().toISOString().split("T")[0]
      expect(callArgs.date).toBe(today)
    })

    it("converts empty description to undefined", async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)

      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const amountInput = screen.getByTestId("tx-amount")
      await user.type(amountInput, "100")

      const categoryButton = screen.getByTestId("tx-category-Groceries")
      await user.click(categoryButton)

      const submitButton = screen.getByTestId("tx-submit")
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })

      const callArgs = mockOnSubmit.mock.calls[0][0]
      expect(callArgs.description).toBeUndefined()
    })

    it("parses amount as number", async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)

      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const amountInput = screen.getByTestId("tx-amount")
      await user.type(amountInput, "99.99")

      const categoryButton = screen.getByTestId("tx-category-Groceries")
      await user.click(categoryButton)

      const submitButton = screen.getByTestId("tx-submit")
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })

      const callArgs = mockOnSubmit.mock.calls[0][0]
      expect(typeof callArgs.amount).toBe("number")
      expect(callArgs.amount).toBe(99.99)
    })
  })

  describe("Type toggle", () => {
    it("resets category when switching from expense to income if category is invalid", async () => {
      const user = userEvent.setup()

      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Select expense category
      const expenseCategory = screen.getByTestId("tx-category-Groceries")
      await user.click(expenseCategory)

      // Switch to income
      const incomeToggle = screen.getByRole("button", { name: /receita/i })
      await user.click(incomeToggle)

      // Groceries should not be available for income
      const groceriesButton = screen.queryByTestId("tx-category-Groceries")
      expect(groceriesButton).not.toBeInTheDocument()

      // Category should be reset
      const submitButton = screen.getByTestId("tx-submit")
      expect(submitButton).toBeDisabled()
    })

    it("keeps category when switching types if category is valid for both", async () => {
      const user = userEvent.setup()

      render(
        <TransactionForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Select "Other" category (valid for both types)
      const otherCategory = screen.getByTestId("tx-category-Other")
      await user.click(otherCategory)

      // Wait for category to be selected
      await waitFor(() => {
        expect(otherCategory).toHaveAttribute("aria-pressed", "true")
      })

      // Switch to income
      const incomeToggle = screen.getByRole("button", { name: /receita/i })
      await user.click(incomeToggle)

      // Other should still be selected (wait for state update)
      await waitFor(() => {
        const otherButton = screen.getByTestId("tx-category-Other")
        expect(otherButton).toHaveAttribute("aria-pressed", "true")
      })
    })
  })

  describe("Edit mode", () => {
    it("pre-fills form with initial transaction data", () => {
      const initialTransaction: Partial<Transaction> = {
        amount: 200,
        type: "income",
        category: "Salary",
        date: "2024-01-15",
        description: "Initial description",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const amountInput = screen.getByTestId("tx-amount") as HTMLInputElement
      expect(amountInput.value).toBe("200")

      const dateInput = screen.getByTestId("tx-date") as HTMLInputElement
      expect(dateInput.value).toBe("2024-01-15")

      const descriptionInput = screen.getByTestId(
        "tx-description"
      ) as HTMLInputElement
      expect(descriptionInput.value).toBe("Initial description")

      const salaryButton = screen.getByTestId("tx-category-Salary")
      expect(salaryButton).toHaveAttribute("aria-pressed", "true")
    })

    it("includes id in onSubmit payload when in edit mode", async () => {
      const user = userEvent.setup()
      mockOnSubmit.mockResolvedValue(undefined)

      const initialTransaction: Partial<Transaction> = {
        id: "test-id-123",
        amount: 200,
        type: "income",
        category: "Salary",
        date: "2024-01-15",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByTestId("tx-submit")
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })

      const callArgs = mockOnSubmit.mock.calls[0][0] as Transaction
      expect(callArgs.id).toBe("test-id-123")
    })

    it("preserves custom category when editing transaction with non-predefined category", () => {
      const initialTransaction: Partial<Transaction> = {
        amount: 200,
        type: "expense",
        category: "Food",
        date: "2024-01-15",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Custom category should be shown and selected
      const customCategoryButton = screen.getByTestId("tx-category-Food")
      expect(customCategoryButton).toBeInTheDocument()
      expect(customCategoryButton).toHaveAttribute("aria-pressed", "true")
      
      // Submit button should be enabled (category is selected)
      const submitButton = screen.getByTestId("tx-submit")
      expect(submitButton).not.toBeDisabled()
    })

    it("normalizes category label to canonical value (Portuguese label -> English value)", () => {
      const initialTransaction: Partial<Transaction> = {
        amount: 200,
        type: "expense",
        category: "Alimentação", // Portuguese label for Groceries
        date: "2024-01-15",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Should match to Groceries (canonical value)
      const groceriesButton = screen.getByTestId("tx-category-Groceries")
      expect(groceriesButton).toBeInTheDocument()
      expect(groceriesButton).toHaveAttribute("aria-pressed", "true")
    })

    it("normalizes category case-insensitively (lowercase -> canonical case)", () => {
      const initialTransaction: Partial<Transaction> = {
        amount: 200,
        type: "expense",
        category: "groceries", // lowercase
        date: "2024-01-15",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Should match to Groceries (canonical case)
      const groceriesButton = screen.getByTestId("tx-category-Groceries")
      expect(groceriesButton).toBeInTheDocument()
      expect(groceriesButton).toHaveAttribute("aria-pressed", "true")
    })

    it("keeps custom category when switching transaction type", async () => {
      const user = userEvent.setup()

      const initialTransaction: Partial<Transaction> = {
        amount: 200,
        type: "expense",
        category: "CustomCategory",
        date: "2024-01-15",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Custom category should be selected
      const customButton = screen.getByTestId("tx-category-CustomCategory")
      expect(customButton).toHaveAttribute("aria-pressed", "true")

      // Switch to income
      const incomeToggle = screen.getByRole("button", { name: /receita/i })
      await user.click(incomeToggle)

      // Custom category should still be selected (not cleared)
      await waitFor(() => {
        const customButtonAfter = screen.getByTestId("tx-category-CustomCategory")
        expect(customButtonAfter).toHaveAttribute("aria-pressed", "true")
      })
    })

    it("clears predefined category when switching to invalid type", async () => {
      const user = userEvent.setup()

      const initialTransaction: Partial<Transaction> = {
        amount: 200,
        type: "expense",
        category: "Groceries", // Predefined expense category
        date: "2024-01-15",
      }

      render(
        <TransactionForm
          mode="edit"
          initial={initialTransaction}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Groceries should be selected
      const groceriesButton = screen.getByTestId("tx-category-Groceries")
      expect(groceriesButton).toHaveAttribute("aria-pressed", "true")

      // Switch to income
      const incomeToggle = screen.getByRole("button", { name: /receita/i })
      await user.click(incomeToggle)

      // Groceries should be cleared (not valid for income)
      await waitFor(() => {
        const groceriesButtonAfter = screen.queryByTestId("tx-category-Groceries")
        expect(groceriesButtonAfter).not.toBeInTheDocument()
        
        // Submit should be disabled (no category selected)
        const submitButton = screen.getByTestId("tx-submit")
        expect(submitButton).toBeDisabled()
      })
    })
  })
})
