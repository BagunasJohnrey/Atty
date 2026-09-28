import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("clay-pressed animate-pulse bg-muted/60", className ?? "h-24 w-full")}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="clay flex flex-col gap-3 p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}
