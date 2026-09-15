import { motion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Scroll-reveal wrapper: content slides in and fades in the first time it
 * enters the viewport (Andrea, 2026-09-15: "quando scendiamo i componenti si
 * animano... come fa wordpress"). Animates once — it does not replay on
 * every scroll past, which reads as flicker rather than polish.
 */
export function Reveal({
  children,
  from = "up",
  delay = 0,
  className,
}: {
  children: ReactNode
  from?: "left" | "right" | "up"
  delay?: number
  className?: string
}) {
  const offset =
    from === "left" ? { x: -48, y: 0 } :
    from === "right" ? { x: 48, y: 0 } :
    { x: 0, y: 40 }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
