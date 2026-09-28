"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      className="clay-btn rounded-full"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 scale-100 dark:scale-0" aria-hidden />
      <Moon className="absolute size-4 scale-0 dark:scale-100" aria-hidden />
    </Button>
  )
}
