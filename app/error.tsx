"use client"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="clay flex flex-col gap-3 p-6" role="alert">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="clay-btn w-fit px-4 py-2 text-sm font-medium">
        Try again
      </button>
    </div>
  )
}
