import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface StepItem {
  icon: string
  title: string
  desc: string
}

interface StepCardGridProps {
  steps: StepItem[]
  /** glass — backdrop blur + heavy shadow; plain — lighter shadow, no blur */
  variant?: "glass" | "plain"
}

/**
 * StepCardGrid — "how it works" 4-column grid of icon/title/description cards
 * with a staggered fade-up entrance.
 */
export function StepCardGrid({ steps, variant = "glass" }: StepCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className={cn(
            "bg-slate-900/50 rounded-2xl p-6 border border-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
            variant === "glass" ? "backdrop-blur shadow-2xl" : "shadow-lg"
          )}
        >
          <div className="text-4xl mb-4">{step.icon}</div>
          <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
        </motion.div>
      ))}
    </div>
  )
}
