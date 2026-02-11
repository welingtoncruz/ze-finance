"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, ChevronRight, Settings } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type { Transaction, UserProfile } from "@/lib/types"
import type { ApiDashboardSummary } from "@/lib/types/api"
import { TransactionItem } from "../transactions/TransactionItem"
import { EmptyState } from "../empty/EmptyState"
import { ThemeToggle } from "../theme-toggle"
import { InsightsCard } from "./InsightsCard"
import { BudgetBar } from "./BudgetBar"

interface DashboardScreenProps {
  transactions: Transaction[]
  userProfile: UserProfile
  dashboardSummary: ApiDashboardSummary | null
  onViewHistory: () => void
}

export function DashboardScreen({
  transactions,
  userProfile,
  dashboardSummary,
  onViewHistory,
}: DashboardScreenProps) {
  const router = useRouter()
  const thisMonth = new Date().toISOString().slice(0, 7)

  // Use backend summary if available, otherwise compute from transactions
  const totalIncome = dashboardSummary
    ? Number(dashboardSummary.total_income)
    : transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = dashboardSummary
    ? Number(dashboardSummary.total_expense)
    : transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0)

  const balance = dashboardSummary
    ? Number(dashboardSummary.total_balance)
    : totalIncome - totalExpense

  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const chartData = generateChartData(transactions)

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <div className="nav-bottom-spacer flex min-h-screen flex-col pb-28 lg:pb-8 theme-transition bg-mesh-gradient">
      {/* Mobile Header */}
      <header className="sticky top-0 z-10 gradient-header px-3 py-4 sm:px-6 sm:py-5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-primary-foreground/70">Bem-vindo de volta,</p>
              <h1 className="text-lg font-bold text-primary-foreground tracking-tight truncate">
                {userProfile.name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Streak pill hidden until backend-driven implementation is available */}
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Bem-vindo de volta,</p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">
              {userProfile.name}
            </h1>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Editar perfil</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 py-4 px-3 sm:p-5 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Balance Section */}
          <Card className="glass-card overflow-hidden border-0 shadow-xl hover-lift">
            <CardContent className="relative p-5 sm:p-6 lg:p-8">
              {/* Animated background blobs */}
              <div className="absolute -right-8 -top-8 h-28 w-28 sm:h-32 sm:w-32 lg:h-48 lg:w-48 rounded-full bg-accent/15 blur-3xl animated-blob" />
              <div className="absolute -left-8 bottom-0 h-20 w-20 sm:h-24 sm:w-24 lg:h-36 lg:w-36 rounded-full bg-primary/10 blur-2xl animated-blob-delayed" />

              <div className="relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Saldo total
                    </p>
                    <p className="mt-1 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground animate-count tabular-nums">
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>

                {/* Income/Expense Stats */}
                <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-8">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-success/15">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-success-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Receita</p>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-success-foreground tabular-nums truncate">
                        {formatCurrency(totalIncome)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="h-8 sm:h-10 w-px bg-border/50" />
                  
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                      <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Despesas</p>
                      <p className="text-sm sm:text-base lg:text-lg font-semibold text-destructive tabular-nums truncate">
                        {formatCurrency(totalExpense)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responsive Grid Layout */}
          <div className="mt-5 sm:mt-6 grid gap-4 sm:gap-5 lg:gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {/* Budget Progress */}
            <Card className="glass-card border-0 hover-lift sm:col-span-1">
              <CardContent className="p-4 lg:p-5">
                <BudgetBar spent={monthlyExpenses} budget={userProfile.monthlyBudget} />
              </CardContent>
            </Card>

            {/* Smart Insights - Full width on tablet */}
            <div className="sm:col-span-1 xl:col-span-2">
              <InsightsCard transactions={transactions} monthlyBudget={userProfile.monthlyBudget} />
            </div>
          </div>

          {/* Chart and Transactions Grid */}
          <div className="mt-5 sm:mt-6 grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
            {/* Chart Section */}
            {chartData.some((d) => d.amount > 0) && (
              <Card className="glass-card border-0 hover-lift">
                <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
                  <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Gastos dos últimos 7 dias
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4 px-2 sm:px-4">
                  <div className="h-44 sm:h-48 lg:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                          dy={8}
                        />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid var(--color-border)",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                            background: "var(--color-card)",
                            color: "var(--color-foreground)",
                            fontSize: "12px",
                            padding: "8px 12px",
                          }}
                          formatter={(value: number) => [formatCurrencyFull(value), "Gasto"]}
                          labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: "4px" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fill="url(#colorExpense)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Transactions */}
            <Card className="glass-card border-0 hover-lift">
              <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
                <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Transações recentes
                </CardTitle>
                {recentTransactions.length > 0 && (
                  <button
                    onClick={onViewHistory}
                    className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 touch-target"
                  >
                    <span className="hidden sm:inline">Ver todas</span>
                    <span className="sm:hidden">Todas</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </CardHeader>
              <CardContent className="space-y-0.5 px-2 sm:px-3 pb-3">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="stagger-item">
                      <TransactionItem transaction={transaction} />
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Nenhuma transação ainda"
                    description="Toque no + para adicionar sua primeira transação"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function generateChartData(transactions: Transaction[]) {
  const last7Days: { day: string; amount: number }[] = []
  const today = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split("T")[0]

    const dayExpenses = transactions
      .filter((t) => t.type === "expense" && t.date === dateStr)
      .reduce((sum, t) => sum + t.amount, 0)

    last7Days.push({
      day: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2),
      amount: dayExpenses,
    })
  }

  return last7Days
}
