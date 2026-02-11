"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Wallet, Sparkles, BarChart3, Shield, Zap } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthForm } from "@/components/auth/AuthForm"
import { useAuth } from "@/context/AuthContext"
import { getUserFriendlyApiError } from "@/lib/errors/apiErrorMapper"

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, isHydrated } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push("/")
    }
  }, [isHydrated, isAuthenticated, router])

  const handleLogin = async (email: string, password: string, rememberMe?: boolean) => {
    try {
      setError(null)
      await login(email, password, rememberMe)
      router.push("/")
    } catch (err: unknown) {
      setError(getUserFriendlyApiError(err, "auth"))
    }
  }

  const features = [
    { icon: BarChart3, title: "Análises inteligentes", description: "Insights com IA sobre seus gastos" },
    { icon: Shield, title: "Segurança de nível bancário", description: "Seus dados são criptografados e protegidos" },
    { icon: Zap, title: "Sincronização em tempo real", description: "Atualizações instantâneas em todos os dispositivos" },
  ]

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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden overflow-y-auto theme-transition">
      {/* Theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle variant="standalone" />
      </div>

      {/* Desktop: Split Layout */}
      <div className="flex min-h-0 flex-1 w-full">
        {/* Left Panel - Features (Desktop Only) */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-center p-12 xl:p-20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          {/* Animated background blobs */}
          <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl animated-blob" />
          <div className="absolute left-1/4 bottom-1/4 h-80 w-80 rounded-full bg-accent/10 blur-3xl animated-blob-delayed" />
          
          <div className="relative z-10 max-w-xl">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-12">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl glow-primary">
                  <Wallet className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold gradient-text">Ze Finance</h1>
                <p className="text-muted-foreground">Gestor de finanças premium</p>
              </div>
            </div>

            <h2 className="text-4xl xl:text-5xl font-bold text-foreground leading-tight mb-6">
              Assuma o controle do seu{" "}
              <span className="gradient-text">futuro financeiro</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-12">
              Acompanhe gastos, defina orçamentos e alcance suas metas de economia com insights inteligentes.
            </p>

            {/* Feature Cards */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all hover:bg-card/80 hover:border-border stagger-item"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form - scrollable on mobile when keyboard opens */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col items-center justify-center min-h-0 overflow-y-auto p-6 lg:p-12 bg-background relative">
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

          <AuthForm mode="login" onSubmit={handleLogin} error={error} />

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{" "}
              <button
                onClick={() => router.push("/register")}
                className="font-semibold text-primary hover:underline"
              >
                Cadastrar-se
              </button>
            </p>
          </div>

          {/* Feature highlights - Mobile only */}
          <div className="lg:hidden relative z-10 mt-8 flex items-center gap-6 text-xs text-muted-foreground animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Insights inteligentes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Modo escuro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Seguro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
