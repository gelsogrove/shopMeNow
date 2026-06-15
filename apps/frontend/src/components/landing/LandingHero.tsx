import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Breadcrumbs } from "@/components/Breadcrumbs"

interface LandingHeroProps {
  /** Rendered with whitespace-pre-line, so \n creates a line break */
  title: string
  subtitle: string
  ctaLabel: string
  /** Link destination, defaults to the contact page */
  to?: string
  /** Optional pill badge above the title */
  badge?: string
  /** Optional breadcrumb label rendered above the hero */
  breadcrumb?: string
  image: { src: string; alt: string }
  /** Image element classes (size, border, object-fit) */
  imageClassName?: string
  /** Which side the image sits on for desktop */
  imageSide?: "left" | "right"
  /** blur — soft glow behind the image; tilt — rotated gradient frame */
  glow?: "blur" | "tilt"
  /** CTA background classes (e.g. hover shade) */
  buttonClassName?: string
  /** Small note rendered below the CTA button (e.g. "No commitment") */
  note?: string
  /** Optional secondary "try our demo" link destination */
  demoTo?: string
  /** Label for the secondary demo link (required when demoTo is set) */
  demoLabel?: string
}

/**
 * LandingHero — two-column hero shared by marketing pages:
 * image with green glow on one side, badge/title/subtitle/CTA on the other.
 */
export function LandingHero({
  title,
  subtitle,
  ctaLabel,
  to = "/contact",
  badge,
  breadcrumb,
  image,
  imageClassName = "w-full h-auto rounded-3xl shadow-2xl border border-white/10 object-contain",
  imageSide = "left",
  glow = "blur",
  buttonClassName = "bg-[#25D366]",
  note,
  demoTo,
  demoLabel,
}: LandingHeroProps) {
  const imageBlock = (
    <div
      className={cn(
        "relative",
        imageSide === "left" && "order-2 lg:order-1",
        glow === "tilt" && "flex items-center justify-center"
      )}
    >
      <div
        className={
          glow === "blur"
            ? "absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-xl opacity-40"
            : "absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl rotate-1 scale-105 opacity-60"
        }
      />
      <img src={image.src} alt={image.alt} className={cn("relative", imageClassName)} />
    </div>
  )

  const textBlock = (
    <div className={cn(imageSide === "left" && "order-1 lg:order-2")}>
      {badge && (
        <span className="inline-block bg-green-400/10 text-green-300 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
          {badge}
        </span>
      )}
      <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight whitespace-pre-line">
        {title}
      </h1>
      <p className="text-xl text-slate-400 mb-10 leading-relaxed">{subtitle}</p>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Link
          to={to}
          className={cn(
            "inline-flex items-center gap-3 text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg",
            buttonClassName
          )}
        >
          <Zap className="h-5 w-5" />
          {ctaLabel}
        </Link>
        {demoTo && demoLabel && (
          <Link
            to={demoTo}
            className="inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 text-lg"
          >
            {demoLabel}
          </Link>
        )}
        {note && <p className="text-sm text-slate-400">{note}</p>}
      </div>
    </div>
  )

  return (
    <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {breadcrumb && <Breadcrumbs items={[{ label: breadcrumb }]} hideVisual />}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {imageSide === "left" ? (
            <>
              {imageBlock}
              {textBlock}
            </>
          ) : (
            <>
              {textBlock}
              {imageBlock}
            </>
          )}
        </motion.div>
      </div>
    </section>
  )
}
