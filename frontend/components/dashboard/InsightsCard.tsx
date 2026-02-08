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
    title: "Começando",
    message: "Adicione transações para ver insights personalizados!",
    color: "text-primary",
    bg: "bg-primary/10",
  }

  if (budgetUsed > 90) {
    insight = {
      type: "warning",
      icon: AlertTriangle,
      title: "Alerta de orçamento",
      message: `Você usou ${Math.round(budgetUsed)}% do seu orçamento mensal. Considere reduzir gastos.`,
      color: "text-destructive",
      bg: "bg-destructive/10",
    }
  } else if (budgetUsed > 70) {
    insight = {
      type: "warning",
      icon: TrendingDown,
      title: "Atenção",
      message: `${Math.round(budgetUsed)}% do orçamento usado. R$ ${remaining.toFixed(0)} restantes este mês.`,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
    }
  } else if (topCategory) {
    insight = {
      type: "tip",
      icon: Lightbulb,
      title: "Padrão de gastos",
      message: `Sua maior categoria de gastos é ${topCategory[0]} com R$ ${topCategory[1].toFixed(0)} este mês.`,
      color: "text-primary",
      bg: "bg-primary/10",
    }
  } else if (remaining > monthlyBudget * 0.5) {
    insight = {
      type: "tip",
      icon: TrendingUp,
      title: "Ótimo progresso!",
      message: `Você tem R$ ${remaining.toFixed(0)} restantes. Considere aumentar suas economias!`,
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
