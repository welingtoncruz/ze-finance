"use client"

import { useEffect, useState } from "react"

interface BudgetBarProps {
  spent: number
  budget: number
}

export function BudgetBar({ spent, budget }: BudgetBarProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0)
  const percentage = Math.min((spent / budget) * 100, 100)
  const remaining = Math.max(budget - spent, 0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(percentage)
    }, 100)
    return () => clearTimeout(timer)
  }, [percentage])

  const getColor = () => {
    if (percentage >= 90) return "bg-destructive"
    if (percentage >= 70) return "bg-chart-4"
    return "bg-primary"
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
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Monthly Budget</span>
        <span className="font-medium text-foreground">{formatCurrency(remaining)} left</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${getColor()} transition-all duration-700 ease-out`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(spent)} spent</span>
        <span>{formatCurrency(budget)} budget</span>
      </div>
    </div>
  )
}
