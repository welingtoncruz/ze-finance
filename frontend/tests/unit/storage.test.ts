import { describe, it, expect, beforeEach, vi } from "vitest"
import { clearAllZefaStorage } from "@/lib/storage"

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
  }
})()

describe("clearAllZefaStorage", () => {
  beforeEach(() => {
    localStorageMock.clear()
    Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true })
  })

  it("removes all zefa_* keys from localStorage", () => {
    localStorageMock.setItem("zefa_token", "jwt-123")
    localStorageMock.setItem("zefa_profile", '{"id":"u1","name":"User"}')
    localStorageMock.setItem("zefa_chat_v1:u1", '{"messages":[]}')
    localStorageMock.setItem("zefa_local_edits_v2", "{}")
    localStorageMock.setItem("zefa_pwa_prompt_dismissed_until", "123456")
    localStorageMock.setItem("other_app_key", "keep")

    clearAllZefaStorage()

    expect(localStorageMock.getItem("zefa_token")).toBeNull()
    expect(localStorageMock.getItem("zefa_profile")).toBeNull()
    expect(localStorageMock.getItem("zefa_chat_v1:u1")).toBeNull()
    expect(localStorageMock.getItem("zefa_local_edits_v2")).toBeNull()
    expect(localStorageMock.getItem("zefa_pwa_prompt_dismissed_until")).toBeNull()
    expect(localStorageMock.getItem("other_app_key")).toBe("keep")
  })

  it("does nothing when no zefa_ keys exist", () => {
    localStorageMock.setItem("other_key", "value")
    clearAllZefaStorage()
    expect(localStorageMock.getItem("other_key")).toBe("value")
  })
})
