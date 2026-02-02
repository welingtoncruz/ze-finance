"use client"

export function SkeletonLoader() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 theme-transition">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 gradient-header px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary-foreground/15" />
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-primary-foreground/20" />
              <div className="h-5 w-24 rounded bg-primary-foreground/15" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 rounded-full bg-primary-foreground/15" />
            <div className="h-9 w-9 rounded-xl bg-primary-foreground/15" />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-5">
        {/* Balance card skeleton */}
        <div className="glass-card rounded-2xl p-6">
          <div className="skeleton-shimmer h-4 w-24 rounded" />
          <div className="skeleton-shimmer mt-2 h-10 w-48 rounded" />
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
              <div className="space-y-1">
                <div className="skeleton-shimmer h-3 w-12 rounded" />
                <div className="skeleton-shimmer h-4 w-20 rounded" />
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
              <div className="space-y-1">
                <div className="skeleton-shimmer h-3 w-12 rounded" />
                <div className="skeleton-shimmer h-4 w-20 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Budget progress skeleton */}
        <div className="glass-card rounded-2xl p-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="skeleton-shimmer h-4 w-24 rounded" />
              <div className="skeleton-shimmer h-4 w-20 rounded" />
            </div>
            <div className="skeleton-shimmer h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <div className="skeleton-shimmer h-3 w-16 rounded" />
              <div className="skeleton-shimmer h-3 w-16 rounded" />
            </div>
          </div>
        </div>

        {/* Insights skeleton */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-start gap-4">
            <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-4 w-28 rounded" />
              <div className="skeleton-shimmer h-3 w-full rounded" />
            </div>
          </div>
        </div>

        {/* Chart skeleton */}
        <div className="glass-card rounded-2xl p-5">
          <div className="skeleton-shimmer mb-4 h-4 w-32 rounded" />
          <div className="skeleton-shimmer h-40 w-full rounded-xl" />
        </div>

        {/* Transactions skeleton */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex justify-between mb-4">
            <div className="skeleton-shimmer h-4 w-36 rounded" />
            <div className="skeleton-shimmer h-4 w-16 rounded" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="skeleton-shimmer h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-4 w-24 rounded" />
                  <div className="skeleton-shimmer h-3 w-14 rounded" />
                </div>
                <div className="skeleton-shimmer h-5 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
