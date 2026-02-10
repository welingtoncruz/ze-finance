/**
 * API client with Axios instance and interceptors.
 * Handles authentication token injection and 401 redirects with refresh support.
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios"
import type { ApiToken } from "@/lib/types/api"
import { clearAllZefaStorage } from "@/lib/storage"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
})

// Request interceptor: inject Authorization header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("zefa_token")
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

let isRefreshing = false
let refreshSubscribers: Array<(token: string | null) => void> = []

const subscribeTokenRefresh = (callback: (token: string | null) => void) => {
  refreshSubscribers.push(callback)
}

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((callback) => callback(token))
  refreshSubscribers = []
}

// Response interceptor: handle 401 with a single refresh attempt
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { response, config } = error
    const originalRequest = config as InternalAxiosRequestConfig & { _retry?: boolean }

    const requestUrl = (originalRequest.url || response?.config?.url || "").toString()

    // Do not trigger refresh logic for the login endpoint itself.
    // Wrong credentials on /token should surface as a normal 401 error,
    // so the login form can show a friendly message without redirecting or reloading.
    const isLoginRequest = requestUrl.includes("/token")

    if (response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      originalRequest._retry = true

      if (!isRefreshing) {
        isRefreshing = true
        const refreshClient = axios.create({
          baseURL: API_BASE_URL,
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        })

        try {
          const refreshResponse = await refreshClient.post<ApiToken>("/auth/refresh")
          const { access_token } = refreshResponse.data

          if (typeof window !== "undefined") {
            localStorage.setItem("zefa_token", access_token)
          }

          isRefreshing = false
          onRefreshed(access_token)
        } catch (refreshError) {
          isRefreshing = false
          onRefreshed(null)

          if (typeof window !== "undefined") {
            clearAllZefaStorage()
            window.location.href = "/login"
          }

          return Promise.reject(refreshError)
        }
      }

      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          if (!token) {
            reject(error)
            return
          }

          if (!originalRequest.headers) {
            originalRequest.headers = {} as InternalAxiosRequestConfig["headers"]
          }
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    return Promise.reject(error)
  }
)

export default api
