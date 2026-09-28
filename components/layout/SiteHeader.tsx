import Link from "next/link"
import { ScanLine } from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"

export function SiteHeader() {
  return (
    <header className="clay clay-topglow app-chrome sticky top-4 z-40 mb-6 flex items-center justify-between gap-3 px-5 py-3">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="clay-gradient flex size-10 items-center justify-center rounded-2xl" aria-hidden>
          <ScanLine className="size-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold">Atty</span>
          <span className="block text-xs text-muted-foreground">Event Attendance</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {/* Auth placeholder: UserSlot will live here when 3rd-party auth lands */}
        <ThemeToggle />
      </div>
    </header>
  )
}
