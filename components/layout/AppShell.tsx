import * as React from "react"
import { SiteHeader } from "./SiteHeader"
import { SideNav } from "./SideNav"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh w-full px-4 pt-4 pb-10 sm:px-8">
      <SiteHeader />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SideNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
