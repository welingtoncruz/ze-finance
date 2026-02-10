import type React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import TransactionsPage from "@/app/transactions/page"
import { AuthProvider } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiTransactionResponse } from "@/lib/types/api"

let mockSearchParamsAdd: string | null = null

const stableSearchParams = {
  get: (key: string) => (key === "add" ? mockSearchParamsAdd : null),
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => stableSearchParams,
  usePathname: () => "/transactions",
}))

// Mock api module
vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
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

    const mockApiResponse = {
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as unknown,
    }
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/user/profile")) {
        return Promise.resolve({
          ...mockApiResponse,
          data: { id: "1", email: "a@b.com", full_name: "Test", monthly_budget: 5000 },
        })
      }
      if (url.includes("/transactions")) {
        return Promise.resolve({ ...mockApiResponse, data: [] })
      }
      return Promise.resolve({ ...mockApiResponse, data: null })
    })

    mockSearchParamsAdd = null
  })

  const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    )
  }

  it("does not call API when drawer is opened", async () => {
    mockSearchParamsAdd = "true"
    renderWithProviders(<TransactionsPage />)

    // Wait for initial load and drawer to open (from add=true in URL)
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/transactions?limit=50")
    })
    await waitFor(
      () => {
        expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Verify no POST call yet
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it("calls api.post when transaction form is submitted", async () => {
    const user = userEvent.setup()
    mockSearchParamsAdd = "true"

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

    renderWithProviders(<TransactionsPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled()
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /adicionar transação/i })
    await user.click(addButton)

    // Wait for drawer to be visible
    await waitFor(
      () => {
        expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

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
    mockSearchParamsAdd = "true"

    const mockCreatedTransaction: ApiTransactionResponse = {
      id: "new-tx-id",
      amount: 123.45,
      type: "EXPENSE",
      category: "Groceries",
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    const transactionsData: ApiTransactionResponse[] = []
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/user/profile")) {
        return Promise.resolve({
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as unknown,
          data: { id: "1", email: "a@b.com", full_name: "Test", monthly_budget: 5000 },
        })
      }
      if (url.includes("/transactions")) {
        return Promise.resolve({
          status: 200,
          statusText: "OK",
          headers: {},
          config: {} as unknown,
          data: [...transactionsData],
        })
      }
      return Promise.resolve({ status: 200, statusText: "OK", headers: {}, config: {} as unknown, data: null })
    })
    mockApiPost.mockImplementation((_url, data) => {
      const newTx: ApiTransactionResponse = {
        id: "new-tx-id",
        amount: data?.amount ?? 123.45,
        type: data?.type ?? "EXPENSE",
        category: data?.category ?? "Groceries",
        description: data?.description ?? null,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
      transactionsData.push(newTx)
      return Promise.resolve({
        data: newTx,
        status: 201,
        statusText: "Created",
        headers: {},
        config: {} as unknown,
      })
    })

    renderWithProviders(<TransactionsPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled()
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /adicionar transação/i })
    await user.click(addButton)

    // Wait for drawer
    await waitFor(
      () => {
        expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Fill and submit form
    const amountInput = screen.getByTestId("tx-amount")
    await user.type(amountInput, "123.45")

    const categoryButton = screen.getByTestId("tx-category-Groceries")
    await user.click(categoryButton)

    const submitButton = screen.getByTestId("tx-submit")
    await user.click(submitButton)

    // Wait for drawer to close and transaction to appear in list
    await waitFor(
      () => {
        expect(screen.queryByTestId("tx-drawer")).not.toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    await waitFor(
      () => {
        const categoryLabel = screen.queryByText(/alimentação/i)
        const amountElements = screen.queryAllByText(/123/)
        expect(categoryLabel || amountElements.length > 0).toBeTruthy()
      },
      { timeout: 3000 }
    )
  })

  it("closes drawer after successful submission", async () => {
    const user = userEvent.setup()
    mockSearchParamsAdd = "true"

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

    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled()
    })

    // Open drawer
    const addButton = screen.getByRole("button", { name: /adicionar transação/i })
    await user.click(addButton)

    await waitFor(
      () => {
        expect(screen.getByTestId("tx-drawer")).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // Fill and submit
    const amountInput = screen.getByTestId("tx-amount")
    await user.type(amountInput, "100")

    const categoryButton = screen.getByTestId("tx-category-Groceries")
    await user.click(categoryButton)

    const submitButton = screen.getByTestId("tx-submit")
    await user.click(submitButton)

    // Drawer should close
    await waitFor(
      () => {
        expect(screen.queryByTestId("tx-drawer")).not.toBeInTheDocument()
      },
      { timeout: 5000 }
    )
  })
})
