"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Wallet, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthForm } from "@/components/auth/AuthForm"
import { useAuth } from "@/context/AuthContext"
import api from "@/lib/api"
import { getUserFriendlyApiError } from "@/lib/errors/apiErrorMapper"

export default function RegisterPage() {
  const router = useRouter()
  const { register, isAuthenticated, isHydrated } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push("/")
    }
  }, [isHydrated, isAuthenticated, router])

  const handleRegister = async (
    email: string,
    password: string,
    profile: { name: string; monthlyBudget: string }
  ) => {
    try {
      setError(null)
      await register(email, password)
      const parsedBudget = Number(profile.monthlyBudget)
      if (Number.isFinite(parsedBudget) && parsedBudget > 0) {
        await api.patch("/user/profile", {
          full_name: profile.name.trim() || null,
          monthly_budget: parsedBudget,
        })
      } else if (profile.name.trim()) {
        await api.patch("/user/profile", {
          full_name: profile.name.trim(),
        })
      }
      router.push("/")
    } catch (err: unknown) {
      setError(getUserFriendlyApiError(err, "auth"))
    }
  }

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
    <div className="relative flex min-h-screen overflow-hidden theme-transition">
      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle variant="standalone" />
      </div>

      {/* Right Panel - Register Form */}
      <div className="w-full flex flex-col items-center justify-center p-6 lg:p-12 bg-background relative">
        {/* Mobile background blobs */}
        <div className="lg:hidden absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl animated-blob" />
        <div className="lg:hidden absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-accent/15 blur-3xl animated-blob-delayed" />

        {/* Mobile Logo */}
        <div className="lg:hidden relative z-10 mb-10 flex flex-col items-center animate-slide-up">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl animate-pulse" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/80 shadow-2xl glow-primary">
              <Wallet className="h-11 w-11 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mt-8 text-4xl font-bold gradient-text">Ze Finance</h1>
          <div className="mt-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-base font-medium text-muted-foreground">Gestor de finanças premium</p>
          </div>
        </div>

        <AuthForm mode="register" onSubmit={handleRegister} error={error} />

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <button
              onClick={() => router.push("/login")}
              className="font-semibold text-primary hover:underline"
            >
              Entrar
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
