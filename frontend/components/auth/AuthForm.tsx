"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Eye, EyeOff, Loader2 } from "lucide-react"

type LoginSubmit = (email: string, password: string, rememberMe?: boolean) => Promise<void>
type RegisterSubmit = (
  email: string,
  password: string,
  profile: { name: string; monthlyBudget: string }
) => Promise<void>

interface AuthFormProps {
  mode: "login" | "register"
  onSubmit: LoginSubmit | RegisterSubmit
  error?: string | null
}

export function AuthForm({ mode, onSubmit, error }: AuthFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [name, setName] = useState("")
  const [monthlyBudget, setMonthlyBudget] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (mode === "login") {
        await (onSubmit as LoginSubmit)(email, password, rememberMe)
      } else {
        await (onSubmit as RegisterSubmit)(email, password, {
          name,
          monthlyBudget,
        })
      }
    } catch {
      // Error handling is done by parent component
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-md glass-card border-0 shadow-2xl animate-slide-up">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold">
          {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Digite suas credenciais para continuar"
            : "Cadastre-se para começar"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border/50 bg-background/50 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
                  data-testid="auth-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl border-border/50 bg-background/50 pr-10 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
                    data-testid="auth-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl border-border/50 bg-background/50 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
                    data-testid="auth-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Como você quer ser chamado"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl border-border/50 bg-background/50 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo de 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12 rounded-xl border-border/50 bg-background/50 pr-10 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
                      data-testid="auth-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyBudget" className="text-sm font-medium">
                    Orçamento mensal padrão
                  </Label>
                  <Input
                    id="monthlyBudget"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Ex: 5000"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    className="h-12 rounded-xl border-border/50 bg-background/50 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </>
          )}
          {mode === "login" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border/50 bg-background/50 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                <Label htmlFor="remember-me" className="text-sm text-muted-foreground">
                  Lembrar de mim
                </Label>
              </div>
            </div>
          )}
          <Button
            type="submit"
            className="h-12 w-full rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
            data-testid="auth-submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "login" ? "Entrando..." : "Criando conta..."}
              </>
            ) : (
              mode === "login" ? "Entrar" : "Cadastrar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
