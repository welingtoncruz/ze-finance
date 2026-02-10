import { test, expect } from "@playwright/test"

test.describe("Create Transaction Flow (E2E)", () => {
  test("register → create transaction → appears in list", async ({ page }) => {
    // Generate unique email for this test run
    const timestamp = Date.now()
    const testEmail = `test-${timestamp}@example.com`
    const testPassword = "testpassword123"

    // Step 1: Go to register page
    await page.goto("/register")
    await expect(page).toHaveURL(/\/register/)

    // Step 2: Fill email + password and submit
    // Wait for form to be ready and use fallback selectors if testid fails
    await page.waitForLoadState("networkidle")
    
    const emailInput = page.getByTestId("auth-email").or(page.getByLabel("Email"))
    const passwordInput = page.getByTestId("auth-password").or(page.getByLabel("Password"))
    const nameInput = page.getByLabel("Nome")
    const submitButton = page
      .getByTestId("auth-submit")
      .or(page.getByRole("button", { name: /cadastrar|sign up/i }))

    await emailInput.waitFor({ state: "visible" })
    await emailInput.fill(testEmail)

    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill("E2E Test User")
    }

    await passwordInput.waitFor({ state: "visible" })
    await passwordInput.fill(testPassword)

    await submitButton.waitFor({ state: "visible" })
    await submitButton.click()

    // Step 3: Wait for either redirect or connection error (backend unreachable)
    const connectionError = page.getByText(/erro de conexão|verifique sua internet/i)
    const result = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.includes("/register"), { timeout: 10000 })
        .then(() => "success"),
      connectionError.waitFor({ state: "visible", timeout: 8000 }).then(() => "error"),
    ])
    if (result === "error") {
      throw new Error(
        "Backend API unreachable. Start the backend: cd backend && uvicorn app.main:app --reload --port 8000"
      )
    }

    // Step 4: Navigate to transactions page
    await page.goto("/transactions")
    await expect(page).toHaveURL(/\/transactions/)

    // Step 5: Open drawer
    // Try desktop button first, fallback to mobile FAB
    const desktopButton = page.getByRole("button", { name: /nova transação/i })
    const mobileFAB = page.getByRole("button", { name: /add transaction/i })

    if (await desktopButton.isVisible()) {
      await desktopButton.click()
    } else if (await mobileFAB.isVisible()) {
      await mobileFAB.click()
    } else {
      // Fallback: look for any button that opens the drawer
      const addButtons = page.locator('button:has-text("Nova"), button:has-text("Add")')
      await addButtons.first().click()
    }

    // Step 6: Wait for drawer to be visible
    const drawer = page.getByTestId("tx-drawer")
    await expect(drawer).toBeVisible()

    // Step 7: Fill the form
    const amountInput = page.getByTestId("tx-amount")
    await amountInput.fill("123.45")

    // Pick category via data-testid
    const categoryButton = page.getByTestId("tx-category-Groceries")
    await categoryButton.click()

    // Date defaults to today, but we can verify it's set
    const dateInput = page.getByTestId("tx-date")
    const today = new Date().toISOString().split("T")[0]
    const currentDateValue = await dateInput.inputValue()
    // Either use default or set explicitly
    if (currentDateValue !== today) {
      await dateInput.fill(today)
    }

    // Description is optional, skip it for this test

    // Step 8: Submit
    const submitBtn = page.getByTestId("tx-submit")
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // Step 9: Assert success
    // Wait for drawer to close (success indicator)
    await expect(drawer).not.toBeVisible({ timeout: 5000 })

    // Step 10: Assert transaction appears in list
    // Wait for network to be idle or for transaction to appear
    await page.waitForLoadState("networkidle")

    // Look for transaction by amount (formatted in BRL) or category label
    // The amount should appear formatted, and category label "Alimentação" should be visible
    const amountText = page.getByText(/123/)
    const categoryLabel = page.getByText(/alimentação/i)

    // At least one should be visible
    await expect(
      amountText.or(categoryLabel).first()
    ).toBeVisible({ timeout: 5000 })

    // Verify transaction appears in the correct month grouping
    // Transactions are grouped by month, so it should appear under current month
    const currentMonth = new Date().toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    })

    // Check if the month header exists (case-insensitive)
    const monthHeader = page.getByText(new RegExp(currentMonth, "i"))
    await expect(monthHeader).toBeVisible({ timeout: 3000 })
  })

  test("create transaction with description", async ({ page }) => {
    // This test assumes user is already logged in
    // In a real scenario, you might want to set up auth state or use a fixture

    const timestamp = Date.now()
    const testEmail = `test-desc-${timestamp}@example.com`
    const testPassword = "testpassword123"

    // Register first
    await page.goto("/register")
    await page.waitForLoadState("networkidle")
    
    const emailInput = page.getByTestId("auth-email").or(page.getByLabel("Email"))
    const passwordInput = page.getByTestId("auth-password").or(page.getByLabel("Password"))
    const nameInput = page.getByLabel("Nome")
    const submitButton = page
      .getByTestId("auth-submit")
      .or(page.getByRole("button", { name: /cadastrar|sign up/i }))

    await emailInput.waitFor({ state: "visible" })
    await emailInput.fill(testEmail)

    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill("E2E Test User")
    }

    await passwordInput.waitFor({ state: "visible" })
    await passwordInput.fill(testPassword)

    await submitButton.waitFor({ state: "visible" })
    await submitButton.click()

    // Wait for either redirect or connection error
    const connectionError = page.getByText(/erro de conexão|verifique sua internet/i)
    const result = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.includes("/register"), { timeout: 10000 })
        .then(() => "success"),
      connectionError.waitFor({ state: "visible", timeout: 8000 }).then(() => "error"),
    ])
    if (result === "error") {
      throw new Error(
        "Backend API unreachable. Start the backend: cd backend && uvicorn app.main:app --reload --port 8000"
      )
    }

    // Navigate to transactions
    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")
    await expect(page).toHaveURL(/\/transactions/)

    // Open drawer - wait for button to be ready, then click and wait for drawer
    const desktopButton = page.getByRole("button", { name: /nova transação/i })
    const mobileFAB = page.getByRole("button", { name: /add transaction/i })

    if (await desktopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await desktopButton.click()
    } else if (await mobileFAB.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mobileFAB.click()
    } else {
      // Fallback: try to find any button that opens the drawer
      const addButton = page.locator('button:has-text("Nova"), button:has-text("Add")').first()
      await addButton.waitFor({ state: "visible" })
      await addButton.click()
    }

    // Wait for drawer to appear (with longer timeout for animation)
    await expect(page.getByTestId("tx-drawer")).toBeVisible({ timeout: 10000 })

    // Fill form with description
    await page.getByTestId("tx-amount").fill("99.99")
    await page.getByTestId("tx-category-Transport").click()
    await page.getByTestId("tx-description").fill("Uber ride to airport")

    // Submit
    await page.getByTestId("tx-submit").click()

    // Wait for drawer to close
    await expect(page.getByTestId("tx-drawer")).not.toBeVisible({
      timeout: 5000,
    })

    // Verify transaction appears
    await page.waitForLoadState("networkidle")
    const transactionAmount = page.getByText(/99/)
    await expect(transactionAmount).toBeVisible({ timeout: 5000 })
  })
})
