"use client"

import { Wallet, FileText, TrendingUp } from "lucide-react"

interface EmptyStateProps {
  title: string
  description: string
  type?: "transactions" | "history" | "default"
}

export function EmptyState({ title, description, type = "default" }: EmptyStateProps) {
  const illustrations = {
    transactions: (
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
        </div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10">
          <Wallet className="h-10 w-10 text-primary/60" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
          <TrendingUp className="h-4 w-4 text-accent-foreground/60" />
        </div>
      </div>
    ),
    history: (
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        </div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5">
          <FileText className="h-10 w-10 text-primary/60" />
        </div>
      </div>
    ),
    default: (
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-20 rounded-full bg-muted blur-xl" />
        </div>
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
          <Wallet className="h-8 w-8 text-muted-foreground/50" />
        </div>
      </div>
    ),
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {illustrations[type]}
      <h3 className="mt-6 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-[200px] text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
