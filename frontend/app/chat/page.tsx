"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { useAuth } from "@/context/AuthContext"
import { ZefaChatScreen } from "@/components/chat/ZefaChatScreen"
import api from "@/lib/api"
import type { ApiUserProfileResponse } from "@/lib/types/api"
import { mapApiUserProfileToUi } from "@/lib/types/api"
const PROFILE_STORAGE_KEY = "zefa_profile"

export default function ChatPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()
  const [profileLoaded, setProfileLoaded] = useState(false)

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get<ApiUserProfileResponse>("/user/profile")
      const mapped = mapApiUserProfileToUi(response.data)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(mapped))
      }
    } catch (error) {
      console.error("Failed to load profile for chat:", error)
      // Continue: useChat will fall back to anonymous key if zefa_profile is missing/stale
    } finally {
      setProfileLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [isHydrated, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated && isHydrated) {
      void loadProfile()
    }
  }, [isAuthenticated, isHydrated, loadProfile])

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background bg-mesh-gradient flex items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
        </div>
      </div>
    )
  }

  // Wait for profile to be loaded (or failed) so zefa_profile has current user id before chat hydrates
  if (!profileLoaded) {
    return (
      <div className="min-h-screen bg-background bg-mesh-gradient flex items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <ZefaChatScreen />
    </AppShell>
  )
}
