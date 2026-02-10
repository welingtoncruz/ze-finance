/**
 * Centralized storage utilities for Zefa Finance.
 * Ensures consistent cleanup of all user-sensitive data on logout.
 *
 * Security: All keys prefixed with "zefa_" contain user data (tokens, profile,
 * chat messages, transaction edits). This module provides safe cleanup.
 */

const ZEFA_STORAGE_PREFIX = "zefa_"

/**
 * Removes all Zefa-related keys from localStorage.
 * MUST be called on logout to prevent data leakage on shared devices.
 *
 * Clears: zefa_token, zefa_profile, zefa_chat_v1:*, zefa_local_edits_v2,
 * zefa_pwa_prompt_dismissed_until, and any future zefa_* keys.
 */
export function clearAllZefaStorage(): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(ZEFA_STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  } catch (error) {
    console.error("[clearAllZefaStorage] Failed to clear storage:", error)
  }
}
