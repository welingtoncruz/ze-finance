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
import { Loader2 } from "lucide-react"

interface AuthFormProps {
  mode: "login" | "register"
  onSubmit: (email: string, password: string) => Promise<void>
  error?: string | null
}

export function AuthForm({ mode, onSubmit, error }: AuthFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onSubmit(email, password)
    } catch (err) {
      // Error handling is done by parent component
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="relative z-10 w-full max-w-md glass-card border-0 shadow-2xl animate-slide-up">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Create account"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Enter your credentials to continue"
            : "Sign up to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
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
            <Input
              id="password"
              type="password"
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              className="h-12 rounded-xl border-border/50 bg-background/50 transition-all focus:bg-background focus:shadow-md focus:ring-2 focus:ring-primary/20"
              data-testid="auth-password"
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
            data-testid="auth-submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              mode === "login" ? "Sign In" : "Sign Up"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
