"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  TrendingUp,
  TrendingDown,
  Target,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  Tooltip,
} from "recharts"
import type { Transaction, UserProfile } from "@/lib/types"
import { BudgetProgress } from "../dashboard/BudgetProgress"
import { MonthSelector } from "../filters/MonthSelector"

interface InsightsScreenProps {
  transactions: Transaction[]
  userProfile: UserProfile
  isLoading?: boolean
}

export function InsightsScreen({ transactions, userProfile, isLoading: externalLoading }: InsightsScreenProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  const displayLoading = externalLoading || isLoading

  const thisMonth = selectedMonth
  const lastMonthDate = new Date(
    Number(thisMonth.slice(0, 4)),
    Number(thisMonth.slice(5, 7)) - 1,
    1
  )
  const lastMonth = new Date(lastMonthDate.setMonth(lastMonthDate.getMonth() - 1))
    .toISOString()
    .slice(0, 7)

  const monthlyIncome = transactions
    .filter((t) => t.type === "income" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const lastMonthExpenses = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(lastMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const expenseChange =
    lastMonthExpenses > 0
      ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
      : 0

  // Monthly trend data (last 6 months)
  const monthlyTrend = generateMonthlyTrend(transactions)

  const categoryData = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const categoryChartData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  const COLORS = [
    "var(--color-primary)",
    "var(--color-accent)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
    "var(--color-muted-foreground)",
  ]

  const totalSaved = monthlyIncome - monthlyExpenses
  const savingsProgress = Math.min(
    (userProfile.totalSaved + Math.max(totalSaved, 0)) / userProfile.savingsGoal,
    1
  ) * 100

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (displayLoading) {
    return (
      <div className="flex-1 py-5 px-3 lg:p-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="nav-bottom-spacer flex min-h-screen flex-col pb-28 lg:pb-8 theme-transition">
      <div className="flex-1 py-5 px-3 lg:p-8 animate-slide-up">
        {/* Monthly Overview - Responsive Grid */}
        <div className="flex flex-col gap-4 mb-6 lg:mb-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Resumo mensal
            </h2>
            <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card className="glass-card border-0 hover-lift stat-card">
            <CardContent className="p-4 lg:p-5">
              <div className="flex items-center gap-2 text-accent-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium">Receita</span>
              </div>
              <p className="mt-2 text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(monthlyIncome)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Este mês</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-0 hover-lift stat-card">
            <CardContent className="p-4 lg:p-5">
              <div className="flex items-center gap-2 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs font-medium">Despesas</span>
              </div>
              <p className="mt-2 text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                {formatCurrency(monthlyExpenses)}
              </p>
              <div className="mt-1 flex items-center gap-1">
                {expenseChange !== 0 && (
                  <>
                    {expenseChange > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-destructive" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-accent-foreground" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        expenseChange > 0 ? "text-destructive" : "text-accent-foreground"
                      }`}
                    >
                      {Math.abs(expenseChange).toFixed(0)}%
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-0 hover-lift stat-card">
            <CardContent className="p-4 lg:p-5">
              <div className="flex items-center gap-2 text-primary">
                <Target className="h-4 w-4" />
                <span className="text-xs font-medium">Saldo</span>
              </div>
              <p className={`mt-2 text-xl lg:text-2xl font-bold tabular-nums ${
                totalSaved >= 0 ? "text-accent-foreground" : "text-destructive"
              }`}>
                {formatCurrency(totalSaved)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Este mês</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-0 hover-lift stat-card">
            <CardContent className="p-4 lg:p-5">
              <div className="flex items-center gap-2 text-accent">
                <PiggyBank className="h-4 w-4" />
                <span className="text-xs font-medium">Economias</span>
              </div>
              <p className="mt-2 text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                {savingsProgress.toFixed(0)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">da meta</p>
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Budget Progress - Circular */}
          <Card className="glass-card border-0 hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Target className="h-4 w-4" />
                Orçamento Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-6">
              <BudgetProgress
                spent={monthlyExpenses}
                budget={userProfile.monthlyBudget}
                size={160}
              />
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card className="glass-card border-0 hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Saldo diário no mês
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={generateDailyBalanceData(transactions, selectedMonth)}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                        background: "var(--color-card)",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      fill="url(#incomeGradient)"
                      name="Saldo acumulado"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent" />
                  <span className="text-xs text-muted-foreground">Saldo acumulado</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Savings Goal */}
          <Card className="glass-card border-0 hover-lift">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
                Meta de Economia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  {formatCurrency(userProfile.totalSaved + Math.max(totalSaved, 0))}
                </span>
                <span className="text-sm text-muted-foreground">
                  de {formatCurrency(userProfile.savingsGoal)}
                </span>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out"
                  style={{ width: `${savingsProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {savingsProgress >= 100
                  ? "Parabéns! Você alcançou sua meta!"
                  : `${formatCurrency(userProfile.savingsGoal - (userProfile.totalSaved + Math.max(totalSaved, 0)))} restantes`}
              </p>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          {categoryChartData.length > 0 && (
            <Card className="glass-card border-0 hover-lift">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  Gastos por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                          background: "var(--color-card)",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                        {categoryChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {categoryChartData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function generateMonthlyTrend(transactions: Transaction[]) {
  const months: { month: string; income: number; expense: number }[] = []
  const today = new Date()

  for (let i = 5; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const monthStr = date.toISOString().slice(0, 7)
    const monthLabel = date.toLocaleDateString("pt-BR", { month: "short" })

    const income = transactions
      .filter((t) => t.type === "income" && t.date.startsWith(monthStr))
      .reduce((sum, t) => sum + t.amount, 0)

    const expense = transactions
      .filter((t) => t.type === "expense" && t.date.startsWith(monthStr))
      .reduce((sum, t) => sum + t.amount, 0)

    months.push({ month: monthLabel, income, expense })
  }

  return months
}

function generateDailyBalanceData(transactions: Transaction[], month: string) {
  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1

  const startDate = new Date(year, monthIndex, 1)
  const endDate = new Date(year, monthIndex + 1, 0)

  const dates: { day: string; balance: number }[] = []
  let runningBalance = 0

  for (let day = 1; day <= endDate.getDate(); day++) {
    const date = new Date(year, monthIndex, day)
    const dateStr = date.toISOString().split("T")[0]

    const dayIncome = transactions
      .filter((t) => t.type === "income" && t.date === dateStr)
      .reduce((sum, t) => sum + t.amount, 0)

    const dayExpense = transactions
      .filter((t) => t.type === "expense" && t.date === dateStr)
      .reduce((sum, t) => sum + t.amount, 0)

    runningBalance += dayIncome - dayExpense

    dates.push({
      day: String(day),
      balance: runningBalance,
    })
  }

  return dates
}
