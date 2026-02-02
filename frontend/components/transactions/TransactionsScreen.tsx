"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Receipt, Search, Plus, TrendingUp, TrendingDown, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Transaction } from "@/lib/types"
import { TransactionItem } from "./TransactionItem"
import { EmptyState } from "../empty/EmptyState"
import { ThemeToggle } from "../theme-toggle"
import { SkeletonLoader } from "../loading/SkeletonLoader"

interface TransactionsScreenProps {
  transactions: Transaction[]
  isLoading: boolean
  onAddTransaction: () => void
  onEditTransaction: (transaction: Transaction) => void
  onDeleteTransaction: (id: string) => void
}

export function TransactionsScreen({
  transactions,
  isLoading,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionsScreenProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all")

  if (isLoading) {
    return <SkeletonLoader />
  }

  const filteredTransactions = transactions
    .filter((t) => t.category.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t) => filterType === "all" || t.type === filterType)

  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const groupedTransactions = sortedTransactions.reduce(
    (groups, transaction) => {
      const date = new Date(transaction.date)
      const monthYear = date.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
      if (!groups[monthYear]) {
        groups[monthYear] = []
      }
      groups[monthYear].push(transaction)
      return groups
    },
    {} as Record<string, Transaction[]>
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="flex min-h-screen flex-col pb-28 lg:pb-8 theme-transition bg-mesh-gradient">
      {/* Mobile Header */}
      <header className="sticky top-0 z-10 gradient-header px-5 py-5 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
              <Receipt className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground tracking-tight">Transações</h1>
              <p className="text-xs text-primary-foreground/70">{transactions.length} registros</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={onAddTransaction}
              size="sm"
              className="h-10 w-10 rounded-xl bg-primary-foreground/15 hover:bg-primary-foreground/25 p-0"
            >
              <Plus className="h-5 w-5 text-primary-foreground" />
            </Button>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transações</h1>
            <p className="text-sm text-muted-foreground">{transactions.length} registros totais</p>
          </div>
          <Button 
            onClick={onAddTransaction}
            className="gap-2 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-5 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6">
            <Card className="glass-card border-0 hover-lift stat-card">
              <CardContent className="p-4 lg:p-5">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-primary/10 items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
                  </div>
                  <div className="w-full">
                    <p className="text-[10px] lg:text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-lg lg:text-2xl font-bold text-foreground tabular-nums mt-1">{filteredTransactions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 hover-lift stat-card">
              <CardContent className="p-4 lg:p-5">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-success/15 items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-success-foreground" />
                  </div>
                  <div className="w-full">
                    <p className="text-[10px] lg:text-xs text-muted-foreground uppercase tracking-wide">Receitas</p>
                    <p className="text-base lg:text-2xl font-bold text-success-foreground tabular-nums mt-1 truncate">{formatCurrency(totalIncome)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card border-0 hover-lift stat-card">
              <CardContent className="p-4 lg:p-5">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 lg:h-12 lg:w-12 rounded-xl bg-destructive/10 items-center justify-center shrink-0">
                    <TrendingDown className="h-5 w-5 lg:h-6 lg:w-6 text-destructive" />
                  </div>
                  <div className="w-full">
                    <p className="text-[10px] lg:text-xs text-muted-foreground uppercase tracking-wide">Despesas</p>
                    <p className="text-base lg:text-2xl font-bold text-destructive tabular-nums mt-1 truncate">{formatCurrency(totalExpense)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-border/50 bg-card/50 pl-10 transition-all focus:bg-card focus:shadow-md"
              />
            </div>
            <div className="flex gap-2">
              {([
                { key: "all", label: "Todas" },
                { key: "income", label: "Receitas" },
                { key: "expense", label: "Despesas" }
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`px-3 lg:px-4 py-2 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap ${
                    filterType === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions List */}
          {Object.keys(groupedTransactions).length === 0 ? (
            <Card className="glass-card border-0">
              <CardContent className="p-8">
                <EmptyState
                  title="No transactions found"
                  description="Add your first transaction to get started"
                  type="transactions"
                />
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedTransactions).map(([monthYear, monthTransactions]) => (
              <Card key={monthYear} className="glass-card border-0">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">
                    {monthYear}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {monthTransactions.map((transaction) => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      onDelete={onDeleteTransaction}
                      onClick={onEditTransaction}
                      showDesktopActions={true}
                    />
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={onAddTransaction}
        className="fab-glow fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary lg:hidden touch-target"
        aria-label="Add transaction"
      >
        <Plus className="h-6 w-6 text-primary-foreground" />
      </button>
    </div>
  )
}
