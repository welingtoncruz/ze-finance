"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import type { ApiToken, ApiUserCreate } from "@/lib/types/api"

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  isHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_STORAGE_KEY = "zefa_token"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()

  // Hydrate token from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (storedToken) {
        setToken(storedToken)
      }
      setIsHydrated(true)
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        // OAuth2 form-encoded request
        const formData = new URLSearchParams()
        formData.append("username", email)
        formData.append("password", password)

        const response = await api.post<ApiToken>("/token", formData, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })

        const { access_token } = response.data
        setToken(access_token)
        localStorage.setItem(TOKEN_STORAGE_KEY, access_token)
      } catch (error) {
        console.error("Login error:", error)
        throw error
      }
    },
    []
  )

  const register = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        const userData: ApiUserCreate = { email, password }
        const response = await api.post<ApiToken>("/auth/register", userData)

        const { access_token } = response.data
        setToken(access_token)
        localStorage.setItem(TOKEN_STORAGE_KEY, access_token)
      } catch (error) {
        console.error("Register error:", error)
        throw error
      }
    },
    []
  )

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    router.push("/login")
  }, [router])

  const value: AuthContextType = {
    token,
    isAuthenticated: !!token,
    isHydrated,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
