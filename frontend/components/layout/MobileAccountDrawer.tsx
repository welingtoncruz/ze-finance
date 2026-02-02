"use client"

import { SwipeDrawer } from "@/components/overlay/SwipeDrawer"
import { Button } from "@/components/ui/button"
import { LogOut, User, Settings } from "lucide-react"
import { useAuth } from "@/context/AuthContext"

interface MobileAccountDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileAccountDrawer({ isOpen, onClose }: MobileAccountDrawerProps) {
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    onClose()
  }

  return (
    <SwipeDrawer isOpen={isOpen} onClose={onClose} title="Conta">
      <div className="space-y-4">
        {/* User Info */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">Minha Conta</p>
            <p className="text-sm text-muted-foreground">Gerenciar sua conta</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12"
            onClick={onClose}
          >
            <Settings className="h-5 w-5" />
            Configurações
          </Button>
          <Button
            variant="destructive"
            className="w-full justify-start gap-3 h-12"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Sair
          </Button>
        </div>
      </div>
    </SwipeDrawer>
  )
}
