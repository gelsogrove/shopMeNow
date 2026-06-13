import * as React from "react"

import { cn } from "@/lib/utils"

// Gradient accents for the tilted frame behind the card.
// Mirrors the homepage feature-card palette (LoginPage sections).
const ACCENTS = {
  green: "from-green-500/20 to-emerald-500/10",
  emerald: "from-emerald-500/20 to-green-500/10",
  blue: "from-blue-500/15 to-cyan-500/10",
  purple: "from-purple-500/15 to-violet-500/10",
  amber: "from-amber-500/15 to-orange-500/10",
} as const

export type GlowCardAccent = keyof typeof ACCENTS

export interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Gradient accent of the tilted frame behind the card */
  accent?: GlowCardAccent
  /** Lift the card and rotate the frame further on hover (homepage feature-card behavior) */
  lift?: boolean
  /** Classes for the inner card surface (padding, overflow, text alignment) */
  innerClassName?: string
}

/**
 * GlowCard — the site's signature card: a tilted gradient frame behind a
 * dark glass surface with a green border highlight on hover.
 * Reusable wrapper so landing/survey/marketing pages share one look.
 */
export function GlowCard({
  accent = "green",
  lift = false,
  className,
  innerClassName,
  children,
  ...props
}: GlowCardProps) {
  return (
    <div className={cn("group relative", className)} {...props}>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-3xl bg-gradient-to-br shadow-lg rotate-0 scale-100 sm:rotate-1 sm:scale-[1.01] transition-transform duration-500",
          ACCENTS[accent],
          lift && "group-hover:rotate-2"
        )}
      />
      <div
        className={cn(
          "relative bg-slate-900/50 backdrop-blur rounded-3xl shadow-2xl border border-white/10 hover:border-green-400/30 transition-all duration-500",
          lift && "hover:-translate-y-1",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  )
}
