import { motion } from "framer-motion"

export interface Metric {
  value: string
  label: string
  sub?: string
}

type MetricsVariant = "whatsapp" | "green" | "compact"

interface MetricsSectionProps {
  title: string
  metrics: Metric[]
  /**
   * whatsapp — glass card, WhatsApp-green value, sub line (SmartPush/Appointment)
   * green — flat card, green-600 value, sub line (HumanSupport)
   * compact — glass card with shadow, extrabold value, no sub (TeamCollaboration)
   */
  variant?: MetricsVariant
}

const VARIANTS = {
  whatsapp: {
    section: "py-16 border-y border-white/10",
    grid: "grid grid-cols-2 lg:grid-cols-4 gap-8",
    card: "text-center p-6 bg-slate-900/50 backdrop-blur rounded-2xl border border-white/10",
    value: "text-4xl font-bold mb-2 text-[#25D366]",
    label: "font-semibold text-white mb-1",
    sub: "text-sm text-slate-400",
  },
  green: {
    section: "py-16 border-y border-white/10",
    grid: "grid grid-cols-2 lg:grid-cols-4 gap-8",
    card: "text-center p-6 bg-slate-900/40 rounded-2xl border border-white/10",
    value: "text-4xl font-bold text-green-600 mb-2",
    label: "font-semibold text-white mb-1",
    sub: "text-sm text-slate-500",
  },
  compact: {
    section: "py-16",
    grid: "grid grid-cols-2 lg:grid-cols-4 gap-6",
    card: "text-center p-6 bg-slate-900/50 backdrop-blur rounded-2xl shadow-2xl border border-white/10",
    value: "text-4xl font-extrabold text-[#25D366] mb-2",
    label: "text-sm text-slate-400 leading-tight",
    sub: "",
  },
} as const

/**
 * MetricsSection — "the numbers" band: section title plus a responsive grid
 * of metric cards (value / label / optional sub line).
 */
export function MetricsSection({ title, metrics, variant = "whatsapp" }: MetricsSectionProps) {
  const v = VARIANTS[variant]
  const entry =
    variant === "compact"
      ? { initial: { opacity: 0, scale: 0.85 }, whileInView: { opacity: 1, scale: 1 } }
      : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 } }

  return (
    <section className={v.section}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-white text-center mb-12">{title}</h2>
        <div className={v.grid}>
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              {...entry}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={v.card}
            >
              <div className={v.value}>{m.value}</div>
              <div className={v.label}>{m.label}</div>
              {m.sub && <div className={v.sub}>{m.sub}</div>}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
