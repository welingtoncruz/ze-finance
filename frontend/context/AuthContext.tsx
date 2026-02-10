"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { clearAllZefaStorage } from "@/lib/storage"
import type { ApiToken, ApiUserCreate } from "@/lib/types/api"

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  isHydrated: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_STORAGE_KEY = "zefa_token"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

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
        setIsHydrated(true)
        return
      }

      const tryInitialRefresh = async () => {
        const refreshClient = axios.create({
          baseURL: API_BASE_URL,
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        })

        try {
          const response = await refreshClient.post<ApiToken>("/auth/refresh")
          const { access_token } = response.data
          setToken(access_token)
          localStorage.setItem(TOKEN_STORAGE_KEY, access_token)
        } catch {
          // If refresh fails, user stays unauthenticated without redirect loop
        } finally {
          setIsHydrated(true)
        }
      }

      void tryInitialRefresh()
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false): Promise<void> => {
      try {
        // OAuth2 form-encoded request
        const formData = new URLSearchParams()
        formData.append("username", email)
        formData.append("password", password)

        const url = rememberMe ? "/token?remember_me=true" : "/token"

        const response = await api.post<ApiToken>(url, formData, {
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

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post("/auth/logout")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setToken(null)
      clearAllZefaStorage()
      router.push("/login")
    }
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
