"use client"

export function TypingIndicator() {
  return (
    <div className="chat-message flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50" />
          <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50" />
          <div className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/50" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Zefa está digitando...</p>
      </div>
    </div>
  )
}
