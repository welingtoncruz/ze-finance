"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingDown, TrendingUp, Lightbulb, AlertTriangle } from "lucide-react"
import type { Transaction } from "@/lib/types"

interface InsightsCardProps {
  transactions: Transaction[]
  monthlyBudget: number
}

export function InsightsCard({ transactions, monthlyBudget }: InsightsCardProps) {
  const thisMonth = new Date().toISOString().slice(0, 7)
  
  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const budgetUsed = (monthlyExpenses / monthlyBudget) * 100
  const remaining = monthlyBudget - monthlyExpenses

  // Calculate most spent category
  const categorySpending = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const topCategory = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)[0]

  // Generate insight
  let insight = {
    type: "tip" as const,
    icon: Lightbulb,
    title: "Getting Started",
    message: "Add some transactions to see personalized insights!",
    color: "text-primary",
    bg: "bg-primary/10",
  }

  if (budgetUsed > 90) {
    insight = {
      type: "warning",
      icon: AlertTriangle,
      title: "Budget Alert",
      message: `You've used ${Math.round(budgetUsed)}% of your monthly budget. Consider reducing expenses.`,
      color: "text-destructive",
      bg: "bg-destructive/10",
    }
  } else if (budgetUsed > 70) {
    insight = {
      type: "warning",
      icon: TrendingDown,
      title: "Heads Up",
      message: `${Math.round(budgetUsed)}% of budget used. R$${remaining.toFixed(0)} remaining this month.`,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    }
  } else if (topCategory) {
    insight = {
      type: "tip",
      icon: Lightbulb,
      title: "Spending Pattern",
      message: `Your top expense category is ${topCategory[0]} at R$${topCategory[1].toFixed(0)} this month.`,
      color: "text-primary",
      bg: "bg-primary/10",
    }
  } else if (remaining > monthlyBudget * 0.5) {
    insight = {
      type: "tip",
      icon: TrendingUp,
      title: "Great Progress!",
      message: `You have R$${remaining.toFixed(0)} remaining. Consider adding to your savings!`,
      color: "text-success-foreground",
      bg: "bg-success/15",
    }
  }

  const Icon = insight.icon

  return (
    <Card className="glass-card border-0 overflow-hidden h-full">
      <CardContent className="flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 h-full">
        <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${insight.bg}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${insight.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] sm:text-sm font-semibold ${insight.color} truncate`}>
            {insight.title}
          </p>
          <p className="mt-0.5 text-[12px] sm:text-sm text-muted-foreground leading-relaxed text-truncate-2">
            {insight.message}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
