import { CardSkeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
