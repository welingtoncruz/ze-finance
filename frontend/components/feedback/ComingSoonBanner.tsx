"use client"

import { Sparkles, Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ComingSoonBannerProps {
  icon?: "sparkles" | "info"
  message?: string
}

export function ComingSoonBanner({ icon = "sparkles", message }: ComingSoonBannerProps) {
  const Icon = icon === "sparkles" ? Sparkles : Info
  const defaultMessage = "Esta funcionalidade está em desenvolvimento. Esta é uma prévia com funcionalidade simulada."

  return (
    <Card className="glass-card border-0 mb-4 lg:mb-6">
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1">Em breve</p>
            <p className="text-xs text-muted-foreground">
              {message || defaultMessage}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
