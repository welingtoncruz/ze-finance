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

  // Routes that should not show navigation
  const hideNavigation = pathname === "/login" || pathname === "/register" || pathname === "/onboarding"

  // Get current route for navigation highlighting
  const getCurrentRoute = (): string => {
    if (pathname === "/") return "dashboard"
    if (pathname.startsWith("/transactions")) return "transactions"
    if (pathname.startsWith("/insights")) return "insights"
    if (pathname.startsWith("/chat")) return "chat"
    return "dashboard"
  }

  const defaultProfile: UserProfile = {
    name: "User",
    monthlyBudget: 5000,
    savingsGoal: 10000,
    streak: 1,
    totalSaved: 0,
    ...userProfile,
  }

  return (
    <div className="min-h-screen bg-background bg-mesh-gradient theme-transition">
      {/* Desktop Sidebar - only show when authenticated */}
      {!hideNavigation && (
        <DesktopSidebar
          currentRoute={getCurrentRoute()}
          userProfile={defaultProfile}
          onLogout={logout}
        />
      )}

      {/* Main Content Area */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          !hideNavigation ? "lg:ml-72" : ""
        }`}
      >
        {/* Content Container - responsive width */}
        <div className={`mx-auto ${!hideNavigation ? "max-w-6xl" : "max-w-lg"}`}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - hide on desktop and when in auth routes */}
      {!hideNavigation && (
        <div className="lg:hidden">
          <BottomNavigation currentRoute={getCurrentRoute()} />
        </div>
      )}
    </div>
  )
}
