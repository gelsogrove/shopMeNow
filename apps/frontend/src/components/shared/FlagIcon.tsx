/**
 * Renders a language flag that may be an emoji (most languages) or a data-URI
 * SVG (Catalan — no standard emoji flag exists, see LanguageContext.tsx).
 */
export function FlagIcon({ flag, className }: { flag: string; className?: string }) {
  if (flag.startsWith("data:image")) {
    return <img src={flag} alt="" className={className ?? "inline-block h-[1em] w-[1.33em] align-middle rounded-[2px]"} />
  }
  return <span className={className}>{flag}</span>
}
