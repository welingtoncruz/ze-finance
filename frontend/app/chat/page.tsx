"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { ZefaChatScreen } from "@/components/chat/ZefaChatScreen"

export default function ChatPage() {
  const router = useRouter()
  const { isAuthenticated, isHydrated } = useAuth()

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login")
    }
  }, [isHydrated, isAuthenticated, router])

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

  return (
    <div className="min-h-screen bg-background bg-mesh-gradient theme-transition">
      <ZefaChatScreen />
    </div>
  )
}
