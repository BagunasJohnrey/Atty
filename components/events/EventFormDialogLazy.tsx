"use client"

import dynamic from "next/dynamic"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

// Deferred until first interaction: pulls the dialog primitive subtree
// out of the initial /events bundle. Must live in a Client Component —
// `ssr: false` is not allowed in Server Components.
export const EventFormDialogLazy = dynamic(
  () => import("./EventFormDialog").then((m) => m.EventFormDialog),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="clay-btn clay-btn-primary">
        <Plus className="size-4" aria-hidden /> New Event
      </Button>
    ),
  }
)
