"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle({ variant = "header" }: { variant?: "header" | "standalone" }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${variant === "header" ? "bg-primary-foreground/10" : "bg-muted"}`} />
    )
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <button
      onClick={toggleTheme}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 active:scale-95 ${
        variant === "header"
          ? "bg-primary-foreground/10 hover:bg-primary-foreground/20"
          : "bg-muted hover:bg-muted/80"
      }`}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      <Sun
        className={`h-4 w-4 transition-all duration-300 ${
          variant === "header" ? "text-primary-foreground" : "text-foreground"
        } ${resolvedTheme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          variant === "header" ? "text-primary-foreground" : "text-foreground"
        } ${resolvedTheme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
      />
    </button>
  )
}
