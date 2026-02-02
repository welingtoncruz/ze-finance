import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import TransactionsPage from "@/app/transactions/page"
import { AuthProvider } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiTransactionResponse } from "@/lib/types/api"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
  usePathname: () => "/transactions",
}))

// Mock api module
vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("TransactionsPage Add Flow Integration", () => {
  const mockApiGet = vi.mocked(api.get)
  const mockApiPost = vi.mocked(api.post)

  beforeEach(() => {
    vi.clearAllMocks()

    // Set up authenticated state in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("zefa_token", "test-token")
    }

    // Mock initial empty transactions list
    mockApiGet.mockResolvedValue({
      data: [],
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    })
  })

  it("does not call API when drawer is opened", async () => {
    render(
      <AuthProvider>
        <TransactionsPage />
      </AuthProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/transactions?limit=50")
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /nova transação/i })
    await userEvent.click(addButton)

    // Verify no POST call yet
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it("calls api.post when transaction form is submitted", async () => {
    const user = userEvent.setup()

    // Mock successful POST response
    const mockCreatedTransaction: ApiTransactionResponse = {
      id: "new-tx-id",
      amount: 123.45,
      type: "EXPENSE",
      category: "Groceries",
      description: "Test transaction",
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    mockApiPost.mockResolvedValue({
      data: mockCreatedTransaction,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as any,
    })

    render(
      <AuthProvider>
        <TransactionsPage />
      </AuthProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled()
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /nova transação/i })
    await user.click(addButton)

    // Wait for drawer to be visible
    await waitFor(() => {
      expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
    })

    // Fill form
    const amountInput = screen.getByTestId("tx-amount")
    await user.type(amountInput, "123.45")

    const categoryButton = screen.getByTestId("tx-category-Groceries")
    await user.click(categoryButton)

    const descriptionInput = screen.getByTestId("tx-description")
    await user.type(descriptionInput, "Test transaction")

    // Submit
    const submitButton = screen.getByTestId("tx-submit")
    await user.click(submitButton)

    // Verify API call
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(1)
    })

    const postCall = mockApiPost.mock.calls[0]
    expect(postCall[0]).toBe("/transactions")
    expect(postCall[1]).toMatchObject({
      amount: 123.45,
      type: "EXPENSE",
      category: "Groceries",
      description: "Test transaction",
    })
  })

  it("displays new transaction in list after successful submission", async () => {
    const user = userEvent.setup()

    const mockCreatedTransaction: ApiTransactionResponse = {
      id: "new-tx-id",
      amount: 123.45,
      type: "EXPENSE",
      category: "Groceries",
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    mockApiPost.mockResolvedValue({
      data: mockCreatedTransaction,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as any,
    })

    render(
      <AuthProvider>
        <TransactionsPage />
      </AuthProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled()
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /nova transação/i })
    await user.click(addButton)

    // Wait for drawer
    await waitFor(() => {
      expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
    })

    // Fill and submit form
    const amountInput = screen.getByTestId("tx-amount")
    await user.type(amountInput, "123.45")

    const categoryButton = screen.getByTestId("tx-category-Groceries")
    await user.click(categoryButton)

    const submitButton = screen.getByTestId("tx-submit")
    await user.click(submitButton)

    // Wait for transaction to appear in list
    await waitFor(() => {
      // Transaction should appear - check for category label or amount
      const categoryLabel = screen.queryByText(/alimentação/i)
      expect(categoryLabel || screen.queryByText(/123.45/)).toBeTruthy()
    })
  })

  it("closes drawer after successful submission", async () => {
    const user = userEvent.setup()

    const mockCreatedTransaction: ApiTransactionResponse = {
      id: "new-tx-id",
      amount: 100,
      type: "EXPENSE",
      category: "Groceries",
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    mockApiPost.mockResolvedValue({
      data: mockCreatedTransaction,
      status: 201,
      statusText: "Created",
      headers: {},
      config: {} as any,
    })

    render(
      <AuthProvider>
        <TransactionsPage />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled()
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /nova transação/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
    })

    // Fill and submit
    const amountInput = screen.getByTestId("tx-amount")
    await user.type(amountInput, "100")

    const categoryButton = screen.getByTestId("tx-category-Groceries")
    await user.click(categoryButton)

    const submitButton = screen.getByTestId("tx-submit")
    await user.click(submitButton)

    // Drawer should close
    await waitFor(() => {
      expect(screen.queryByTestId("tx-drawer")).not.toBeInTheDocument()
    })
  })
})
