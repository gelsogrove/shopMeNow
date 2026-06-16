import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface CtaSectionProps {
  title: string
  subtitle: string
  ctaLabel: string
  /** Link destination, defaults to the contact page */
  to?: string
  /** Optional secondary demo link destination (renders a second button when set together with demoLabel) */
  demoTo?: string
  /** Optional secondary demo button label */
  demoLabel?: string
  /** Tailwind gradient stops for the section background */
  gradientClassName?: string
  /** Text color of the white CTA button */
  buttonClassName?: string
  /** Color of the subtitle text */
  subtitleClassName?: string
  /** Fade-in on scroll (FeaturesPage style) */
  animated?: boolean
  /** Wider container with larger title (FeaturesPage style) */
  wide?: boolean
}

/**
 * CtaSection — end-of-page call-to-action band shared by all marketing pages:
 * green gradient background, centered title + subtitle, white pill button.
 */
export function CtaSection({
  title,
  subtitle,
  ctaLabel,
  to = "/contact",
  demoTo,
  demoLabel,
  gradientClassName = "from-green-600 to-emerald-700",
  buttonClassName = "text-green-600",
  subtitleClassName = "text-green-100",
  animated = false,
  wide = false,
}: CtaSectionProps) {
  const content = (
    <>
      <h2 className={cn("text-4xl font-bold text-white mb-6", wide && "lg:text-5xl")}>{title}</h2>
      <p className={cn("text-xl mb-8", wide && "mb-10", subtitleClassName)}>{subtitle}</p>
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          to={to}
          className={cn(
            "inline-flex items-center gap-3 bg-white hover:bg-slate-50 font-semibold px-10 py-5 rounded-2xl shadow-lg text-lg transition-all",
            wide && "hover:shadow-xl duration-300",
            buttonClassName
          )}
        >
          <Zap className="h-6 w-6" />
          {ctaLabel}
        </Link>
        {demoTo && demoLabel && (
          <Link
            to={demoTo}
            className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-10 py-5 rounded-2xl text-lg transition-all hover:bg-white/10"
          >
            {demoLabel}
          </Link>
        )}
      </div>
    </>
  )

  return (
    <section className={cn("py-20 bg-gradient-to-br", gradientClassName)}>
      <div className={cn("mx-auto px-6 text-center", wide ? "max-w-4xl lg:px-8" : "max-w-3xl")}>
        {animated ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {content}
          </motion.div>
        ) : (
          content
        )}
      </div>
    </section>
  )
}
