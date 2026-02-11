"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Home, Receipt, BarChart3, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileAccountDrawer } from "./MobileAccountDrawer"

interface BottomNavigationProps {
  currentRoute: string
}

export function BottomNavigation({ currentRoute }: BottomNavigationProps) {
  const router = useRouter()
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false)

  const navItems = [
    { route: "/", icon: Home, label: "Início" },
    { route: "/insights", icon: BarChart3, label: "Análises" },
    { route: "/chat", icon: MessageCircle, label: "Chat" },
    { route: "/transactions", icon: Receipt, label: "Transações" },
  ]

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="w-full safe-area-bottom bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.map(({ route, icon: Icon, label }) => {
              const routeMap: Record<string, string> = {
                "/": "dashboard",
                "/transactions": "transactions",
                "/insights": "insights",
                "/chat": "chat",
              }
              const mappedRoute = routeMap[route] || route
              const isActive = currentRoute === mappedRoute || (route === "/" && currentRoute === "dashboard")

              return (
                <button
                  key={route}
                  onClick={() => router.push(route)}
                  className="group flex flex-col items-center justify-center gap-1 py-2 transition-all touch-target flex-1"
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-all duration-200",
                        isActive
                          ? "text-primary scale-110"
                          : "text-muted-foreground group-hover:text-foreground group-active:scale-95"
                      )}
                    />
                    {/* Active indicator dot with glow */}
                    <div
                      className={cn(
                        "nav-active-dot transition-all duration-300",
                        isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-colors duration-200 text-center",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
            {/* Account/Menu Button */}
            <button
              onClick={() => setIsAccountDrawerOpen(true)}
              className="group flex flex-col items-center justify-center gap-1 py-2 transition-all touch-target flex-1"
              aria-label="Conta"
            >
              <div className="relative flex items-center justify-center">
                <User
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isAccountDrawerOpen
                      ? "text-primary scale-110"
                      : "text-muted-foreground group-hover:text-foreground group-active:scale-95"
                  )}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200 text-center">
                Conta
              </span>
            </button>
          </div>
        </div>
      </nav>
      <MobileAccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
      />
    </>
  )
}
