"use client"

import { useEffect, useState } from "react"

interface BudgetProgressProps {
  spent: number
  budget: number
  size?: number
}

export function BudgetProgress({ spent, budget, size = 120 }: BudgetProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const percentage = Math.min((spent / budget) * 100, 100)
  const remaining = Math.max(budget - spent, 0)

  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(percentage)
    }, 300)
    return () => clearTimeout(timer)
  }, [percentage])

  const getColor = () => {
    if (percentage >= 90) return "oklch(0.58 0.22 25)" // destructive
    if (percentage >= 70) return "oklch(0.72 0.19 85)" // accent/warning
    return "oklch(0.55 0.16 165)" // primary teal
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/50"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="progress-ring-circle"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{Math.round(percentage)}%</span>
        <span className="text-xs text-muted-foreground">do orçamento</span>
      </div>
    </div>
  )
}
