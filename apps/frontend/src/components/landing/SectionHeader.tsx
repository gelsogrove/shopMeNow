import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** Override wrapper spacing (default mb-16) */
  className?: string
  /** Extra classes for the h2 (e.g. lg:text-5xl) */
  titleClassName?: string
  /** Override subtitle width constraint (default max-w-3xl mx-auto) */
  subtitleClassName?: string
}

/**
 * SectionHeader — centered section title with optional subtitle,
 * used above feature grids on marketing pages.
 */
export function SectionHeader({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName = "max-w-3xl mx-auto",
}: SectionHeaderProps) {
  return (
    <div className={cn("text-center mb-16", className)}>
      <h2 className={cn("text-4xl font-bold text-white mb-4", titleClassName)}>{title}</h2>
      {subtitle && <p className={cn("text-xl text-slate-400", subtitleClassName)}>{subtitle}</p>}
    </div>
  )
}
