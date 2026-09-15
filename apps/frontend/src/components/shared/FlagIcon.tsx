import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * Renders a language flag that may be an emoji (most languages) or a data-URI
 * SVG (Catalan — no standard emoji flag exists, see LanguageContext.tsx).
 *
 * When `name` is given, wraps the flag in a black tooltip naming the language
 * (Andrea, 2026-09-15: "bandierine devono avere un tooltips nero sotto che
 * dice la lingua") — needed on flag-only selectors where no text label is
 * shown next to the flag.
 */
export function FlagIcon({ flag, className, name }: { flag: string; className?: string; name?: string }) {
  const icon = flag.startsWith("data:image")
    ? <img src={flag} alt="" className={className ?? "inline-block h-[1em] w-[1.33em] align-middle rounded-[2px]"} />
    : <span className={className}>{flag}</span>

  if (!name) return icon

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{icon}</span>
        </TooltipTrigger>
        <TooltipContent className="border-0 bg-slate-900 text-white">
          {name}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
