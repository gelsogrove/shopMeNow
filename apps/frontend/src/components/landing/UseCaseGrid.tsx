import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface UseCaseItem {
  icon: string
  title: string
  desc: string
}

interface UseCaseGridProps {
  items: UseCaseItem[]
  /** glass — backdrop blur + heavy shadow; plain — medium shadow, no blur */
  variant?: "glass" | "plain"
}

/**
 * UseCaseGrid — 2-column grid of icon-left cards (use cases / benefits)
 * sliding in from alternating sides.
 */
export function UseCaseGrid({ items, variant = "glass" }: UseCaseGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className={cn(
            "flex gap-6 p-6 bg-slate-900/50 rounded-2xl border border-white/10 hover:shadow-lg transition-all",
            variant === "glass" ? "backdrop-blur shadow-2xl" : "shadow-md"
          )}
        >
          <div className="text-4xl flex-shrink-0">{item.icon}</div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
            <p className="text-slate-400 leading-relaxed">{item.desc}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
