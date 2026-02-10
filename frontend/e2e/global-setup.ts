/**
 * E2E Global Setup: Verifies backend API is reachable before running tests.
 * Fails fast with clear instructions if the backend is not running.
 */
async function globalSetup() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
  const healthUrl = `${apiBase.replace(/\/$/, "")}/health`

  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      throw new Error(`Health check returned ${res.status}`)
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err)
    throw new Error(
      `E2E tests require the backend to be running. ` +
        `Start it with: cd backend && uvicorn app.main:app --reload --port 8000\n` +
        `Health check failed (${healthUrl}): ${msg}`
    )
  }
}

export default globalSetup
