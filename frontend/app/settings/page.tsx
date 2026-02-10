"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/AppShell"
import { UserSettingsForm } from "@/components/settings/UserSettingsForm"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"
import type { ApiUserProfileResponse } from "@/lib/types/api"
import { mapApiUserProfileToUi, mapUiUserProfileToApi } from "@/lib/types/api"
import type { UserProfile } from "@/lib/types"

export default function SettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [isHydrated, isAuthenticated, router])

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api.get<ApiUserProfileResponse>("/user/profile")
      const mapped = mapApiUserProfileToUi(response.data)
      setUserProfile(mapped)
      if (typeof window !== "undefined") {
        localStorage.setItem("zefa_profile", JSON.stringify(mapped))
      }
    } catch (error) {
      console.error("Failed to load profile:", error)

      if (typeof window !== "undefined") {
        const savedProfile = localStorage.getItem("zefa_profile")
        if (savedProfile) {
          setUserProfile(JSON.parse(savedProfile))
        } else {
          setUserProfile({
            name: "User",
            monthlyBudget: 5000,
            savingsGoal: 10000,
            streak: 0,
            totalSaved: 0,
          })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      void loadProfile()
    }
  }, [isAuthenticated, loadProfile])

  const handleProfileUpdated = async (updatedProfile: UserProfile) => {
    try {
      const payload = mapUiUserProfileToApi(updatedProfile)
      await api.patch("/user/profile", payload)
      setUserProfile(updatedProfile)
      if (typeof window !== "undefined") {
        localStorage.setItem("zefa_profile", JSON.stringify(updatedProfile))
      }
    } catch (error) {
      console.error("Failed to update profile:", error)
      throw error
    }
  }

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

  const effectiveProfile: UserProfile = userProfile || {
    name: "User",
    monthlyBudget: 5000,
    savingsGoal: 10000,
    streak: 0,
    totalSaved: 0,
  }

  return (
    <AppShell userProfile={effectiveProfile}>
      <div className="min-h-screen bg-mesh-gradient px-3 py-6 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Configurações
            </h1>
            <p className="text-sm text-muted-foreground">
              Personalize como seu nome e orçamento mensal aparecem no Zefa Finance.
            </p>
          </div>

          {isLoading ? (
            <div className="h-48 rounded-2xl skeleton-shimmer" />
          ) : (
            <UserSettingsForm
              initialProfile={effectiveProfile}
              onProfileUpdated={handleProfileUpdated}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}

