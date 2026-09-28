import { LookupForm } from "@/components/lookup/LookupForm"

export default function LookupPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student Lookup</h1>
        <p className="text-sm text-muted-foreground">Verify an SRCODE against the Masterlist.</p>
      </div>
      <LookupForm />
    </div>
  )
}
