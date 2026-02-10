"use client"

import { usePathname } from "next/navigation"
import { DesktopSidebar } from "./DesktopSidebar"
import { BottomNavigation } from "./BottomNavigation"
import { useAuth } from "@/context/AuthContext"
import type { UserProfile } from "@/lib/types"

interface AppShellProps {
  children: React.ReactNode
  userProfile?: UserProfile
}

export function AppShell({ children, userProfile }: AppShellProps) {
  const pathname = usePathname()
  const { logout } = useAuth()

  const isAuthRoute = ["/login", "/register", "/onboarding"].includes(pathname)
  const isChatRoute = pathname.startsWith("/chat")
  const hideDesktopNavigation = isAuthRoute
  const hideMobileNavigation = isAuthRoute || isChatRoute

  // Get current route for navigation highlighting
  const getCurrentRoute = (): string => {
    if (pathname === "/") return "dashboard"
    if (pathname.startsWith("/transactions")) return "transactions"
    if (pathname.startsWith("/insights")) return "insights"
    if (pathname.startsWith("/chat")) return "chat"
    if (pathname.startsWith("/settings")) return "settings"
    return "dashboard"
  }

  const defaultProfile: UserProfile = userProfile ?? {
    name: "User",
    monthlyBudget: 5000,
    savingsGoal: 10000,
    streak: 0,
    totalSaved: 0,
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-gradient theme-transition">
      {/* Desktop Sidebar - only show when not on auth routes */}
      {!hideDesktopNavigation && (
        <DesktopSidebar
          currentRoute={getCurrentRoute()}
          userProfile={defaultProfile}
          onLogout={logout}
        />
      )}

      {/* Main Content Area */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          !hideDesktopNavigation ? "lg:ml-72" : ""
        }`}
      >
        {/* Content Container - no lateral padding (headers full-width like bottom nav); screens add px to content only */}
        <div className={`w-full ${!hideDesktopNavigation ? "px-0 lg:pl-0 lg:pr-6" : "mx-auto max-w-lg px-4"}`}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - hide on desktop and when in auth or chat routes */}
      {!hideMobileNavigation && (
        <div className="lg:hidden">
          <BottomNavigation currentRoute={getCurrentRoute()} />
        </div>
      )}
    </div>
  )
}
