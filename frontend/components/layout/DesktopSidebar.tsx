"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Home,
  BarChart3,
  Receipt,
  LogOut,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react"
import type { UserProfile } from "@/lib/types"
import { ThemeToggle } from "../theme-toggle"
import { cn } from "@/lib/utils"

interface DesktopSidebarProps {
  currentRoute: string
  userProfile: UserProfile
  onLogout: () => void
}

export function DesktopSidebar({
  currentRoute,
  userProfile,
  onLogout,
}: DesktopSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const router = useRouter()

  const navItems = [
    { route: "/", icon: Home, label: "Dashboard" },
    { route: "/chat", icon: Sparkles, label: "Zefa" },
    { route: "/insights", icon: BarChart3, label: "Insights" },
    { route: "/transactions", icon: Receipt, label: "Transações" },
  ]

  const handleAddTransaction = () => {
    // Open drawer/modal for adding transaction
    // This will be handled by a context or state management
    router.push("/transactions?add=true")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col border-r border-border/50 bg-card/95 backdrop-blur-xl transition-all duration-300",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border/50">
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center w-full")}>
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg glow-primary">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold gradient-text">Ze Finance</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Finance Manager</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
            isCollapsed && "absolute -right-3 top-7 bg-card border border-border shadow-md"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* User Profile Section */}
      {!isCollapsed && (
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-accent-foreground font-bold text-lg">
              {userProfile.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{userProfile.name}</p>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent" />
                <span className="text-xs text-muted-foreground">{userProfile.streak} day streak</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Button */}
      <div className="p-4">
        <button
          onClick={handleAddTransaction}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] glow-primary",
            isCollapsed && "aspect-square p-0"
          )}
        >
          <Plus className="h-5 w-5" />
          {!isCollapsed && <span>Adicionar Transação</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map(({ route, icon: Icon, label }) => {
            const isActive = currentRoute === route || (route === "/" && currentRoute === "dashboard")
            return (
              <li key={route}>
                <button
                  onClick={() => router.push(route)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  {!isCollapsed && <span>{label}</span>}
                  {isActive && !isCollapsed && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-primary glow-primary" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 p-4 space-y-2">
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between px-2")}>
          {!isCollapsed && <span className="text-xs text-muted-foreground">Theme</span>}
          <ThemeToggle variant="standalone" />
        </div>
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
