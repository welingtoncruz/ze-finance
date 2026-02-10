"use client"

import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type {
  ApiDashboardSummary,
  ApiTransactionResponse,
  ApiUserProfileResponse,
} from "@/lib/types/api"
import {
  mapApiTransactionToUi,
  mapApiUserProfileToUi,
} from "@/lib/types/api"
import type { Transaction, UserProfile } from "@/lib/types"
import { queryKeys } from "./keys"

const PROFILE_STORAGE_KEY = "zefa_profile"

async function fetchProfile(): Promise<UserProfile> {
  const res = await api.get<ApiUserProfileResponse>("/user/profile")
  const mapped = mapApiUserProfileToUi(res.data)
  if (typeof window !== "undefined") {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(mapped))
  }
  return mapped
}

async function fetchTransactions(): Promise<Transaction[]> {
  const res = await api.get<ApiTransactionResponse[]>("/transactions?limit=50")
  return res.data.map(mapApiTransactionToUi)
}

async function fetchDashboardSummary(): Promise<ApiDashboardSummary> {
  const res = await api.get<ApiDashboardSummary>("/dashboard/summary")
  return res.data
}

export function useUserProfileQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: fetchProfile,
    enabled,
  })
}

export function useTransactionsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: fetchTransactions,
    enabled,
  })
}

export function useDashboardSummaryQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: fetchDashboardSummary,
    enabled,
  })
}
