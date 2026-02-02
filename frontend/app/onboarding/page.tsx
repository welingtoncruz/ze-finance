"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function OnboardingPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    } else if (isHydrated && isAuthenticated) {
      // Skip onboarding for now - redirect to dashboard
      router.push("/")
    }
  }, [isHydrated, isAuthenticated, router])

  if (!isHydrated) {
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
    <div className="min-h-screen bg-background bg-mesh-gradient flex items-center justify-center p-4">
      <Card className="glass-card border-0 max-w-md w-full">
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Onboarding flow will be available here. This feature is coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
