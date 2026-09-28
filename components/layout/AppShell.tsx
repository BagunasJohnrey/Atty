import * as React from "react"
import { SiteHeader } from "./SiteHeader"
import { SideNav } from "./SideNav"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-svh w-full max-w-6xl p-4 sm:p-6">
      <SiteHeader />
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <SideNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
