import { useEffect, useState, type ReactNode } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  BarChart3,
  Bot,
  Camera,
  Check,
  Cpu,
  Database,
  Eye,
  Factory,
  HardHat,
  Info,
  MessageCircle,
  Monitor,
  PackageCheck,
  Ruler,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CtaSection } from "@/components/landing/CtaSection"
import {
  INDUSTRY40_I18N,
  type ActionStep,
  type DecisionScenario,
  type ExampleCopy,
  type Industry40Copy,
  type Industry40Lang,
  type ProcessesCopy,
} from "./industry40/industry40.i18n"

// ---------------------------------------------------------------------------
// Icon registry — i18n copy stays data-only (string keys); the component owns
// the actual lucide icons rendered for each solution block.
// ---------------------------------------------------------------------------
function solutionIcon(key: string) {
  const cls = "w-7 h-7 text-green-400"
  switch (key) {
    case "bot":
      return <Bot className={cls} />
    case "vision":
      return <Eye className={cls} />
    default:
      return <Cpu className={cls} />
  }
}

// Reveal-on-scroll wrapper to keep motion props DRY across sections.
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: "easeOut" as const },
}

// Above-the-fold variant: plays on mount (no scroll trigger needed).
const intro = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: "easeOut" as const },
}

export function Industry40Page() {
  const { language } = useLanguage()
  const t =
    INDUSTRY40_I18N[(language as Industry40Lang) ?? "en"] ?? INDUSTRY40_I18N.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        keywords={t.seoKeys}
        url="/industry-40"
        lang={language as Industry40Lang}
        type="article"
        serviceType="AI for Industry 4.0 Manufacturing"
      />
      <SiteHeader />

      <main className="bg-[#070d18] text-slate-200">
        {/* ====================== ARTICLE HEADER ====================== */}
        <section className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-20">
          <div className="pointer-events-none absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-green-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:34px_34px] opacity-60" />

          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <motion.span
              {...intro}
              className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-green-300"
            >
              <Cpu className="h-4 w-4" />
              {t.badge}
            </motion.span>
            <motion.h1
              {...intro}
              transition={{ ...intro.transition, delay: 0.05 }}
              className="mt-6 text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl lg:text-6xl"
            >
              {t.heroTitle}
            </motion.h1>
            <motion.p
              {...intro}
              transition={{ ...intro.transition, delay: 0.1 }}
              className="mt-6 text-lg leading-relaxed text-slate-300 lg:text-xl"
            >
              {t.heroLead}
            </motion.p>
          </div>

          {/* Hero image (robot.png by default; swap with /industry40/hero.jpg) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8"
          >
            <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              <div className="absolute -inset-1 -z-10 bg-gradient-to-tr from-green-500/30 via-emerald-400/10 to-transparent blur-xl" />
              <SwapImage
                src="/industry40/hero.jpg"
                fallbackSrc="/robot.png"
                alt={t.heroImageAlt}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070d18] via-transparent to-transparent" />
            </div>
          </motion.div>
        </section>

        {/* ================ A DUO THAT CHANGES THE RULES =============== */}
        <section className="py-16 lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <motion.h2
              {...reveal}
              className="text-3xl font-bold leading-tight text-white lg:text-4xl"
            >
              {t.duoTitle}
            </motion.h2>
            <div className="mt-6 space-y-5">
              {t.duoParagraphs.map((p, i) => (
                <motion.p
                  key={i}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: i * 0.05 }}
                  className="text-lg leading-relaxed text-slate-300"
                >
                  {p}
                </motion.p>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== SOLUTIONS ============================ */}
        <section className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.div {...reveal} className="mb-12 max-w-3xl lg:mb-16">
              <h2 className="text-3xl font-bold leading-tight text-white lg:text-4xl">
                {t.solutionsTitle}
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-slate-400">
                {t.solutionsLead}
              </p>
            </motion.div>

            <div className="space-y-16 lg:space-y-24">
              {t.solutions.map((sol, idx) => (
                <SolutionRow
                  key={sol.title}
                  sol={sol}
                  reversed={idx % 2 === 1}
                  visual={idx === 0 ? <ChatMockup t={t} /> : <ScanMockup t={t} />}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ============ REAL EXAMPLE: DEFECT → DECISION → ACTION ======= */}
        <ExampleSection ex={t.example} />

        {/* ============ AUTOMATE PROCESSES ACROSS YOUR BUSINESS ======== */}
        <ProcessesSection p={t.processes} />

        {/* ===================== OUR APPROACH ========================= */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <motion.span
              {...reveal}
              className="text-sm font-semibold uppercase tracking-wide text-green-400"
            >
              {t.approachEyebrow}
            </motion.span>
            <motion.h2
              {...reveal}
              className="mt-3 text-3xl font-bold leading-tight text-white lg:text-4xl"
            >
              {t.approachTitle}
            </motion.h2>
            <div className="mt-6 space-y-5">
              {t.approachParagraphs.map((p, i) => (
                <motion.p
                  key={i}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: i * 0.05 }}
                  className="text-lg leading-relaxed text-slate-300"
                >
                  {p}
                </motion.p>
              ))}
            </div>

            <motion.div {...reveal} className="mt-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t.approachFactorsLabel}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {t.approachFactors.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-400/20 bg-green-400/5 px-3 py-1.5 text-sm font-medium text-green-200"
                  >
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    {f}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <CtaSection
          title={t.ctaTitle}
          subtitle={t.ctaDesc}
          ctaLabel={t.cta}
          animated
          wide
        />
      </main>

      <SiteFooter language={language} />
    </>
  )
}

// ---------------------------------------------------------------------------
// ProcessesSection — "Automate processes across your business": a grid of
// use-case cards (icon + title + 3 bullets) spanning the whole production
// chain, from raw materials to workforce.
// ---------------------------------------------------------------------------
function processIcon(key: string) {
  const cls = "w-5 h-5 text-green-400"
  switch (key) {
    case "material":
      return <Ruler className={cls} />
    case "production":
      return <Factory className={cls} />
    case "quality":
      return <BadgeCheck className={cls} />
    case "packaging":
      return <PackageCheck className={cls} />
    case "distribution":
      return <Warehouse className={cls} />
    case "maintenance":
      return <Wrench className={cls} />
    case "safety":
      return <HardHat className={cls} />
    case "workforce":
      return <Users className={cls} />
    default:
      return <Cpu className={cls} />
  }
}

function ProcessesSection({ p }: { p: ProcessesCopy }) {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div {...reveal} className="mb-10 max-w-3xl lg:mb-14">
          <h2 className="text-3xl font-bold leading-tight text-white lg:text-4xl">
            {p.title}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-400">{p.lead}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {p.cards.map((card, idx) => (
            <motion.div
              key={card.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: (idx % 4) * 0.05 }}
              className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 transition-colors hover:border-green-400/40 hover:bg-slate-900"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/10">
                {processIcon(card.icon)}
              </span>
              <h3 className="text-lg font-bold text-white">{card.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {card.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                    <span className="text-[14px] leading-relaxed text-slate-400">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// SolutionRow — editorial two-column block: visual on one side, copy on the
// other, alternating sides per index for a blog rhythm. Copy comes first in
// the DOM so that when the grid collapses to one column (mobile) the heading
// shows BEFORE its visual — i.e. each solution's images sit clearly UNDER its
// own title, never bleeding into the previous solution.
// ---------------------------------------------------------------------------
function SolutionRow({
  sol,
  reversed,
  visual,
}: {
  sol: Industry40Copy["solutions"][number]
  reversed: boolean
  visual: ReactNode
}) {
  return (
    <motion.div
      {...reveal}
      className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14"
    >
      {/* Copy (first in DOM → shows above the visual on mobile) */}
      <div className={reversed ? "lg:order-1" : "lg:order-2"}>
        <span className="text-sm font-semibold uppercase tracking-wide text-green-400">
          {sol.eyebrow}
        </span>
        <div className="mt-3 flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-400/10">
            {solutionIcon(sol.icon)}
          </span>
          <h3 className="text-2xl font-bold text-white lg:text-3xl">
            {sol.title}
          </h3>
        </div>
        <p className="mt-4 text-lg font-semibold text-green-300">{sol.lead}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          {sol.paragraph}
        </p>
        <ul className="mt-6 space-y-3">
          {sol.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-400/15">
                <Check className="h-3.5 w-3.5 text-green-400" />
              </span>
              <span className="text-[15px] leading-relaxed text-slate-300">
                {b}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Visual (second in DOM → shows below its heading on mobile) */}
      <div className={reversed ? "lg:order-2" : "lg:order-1"}>{visual}</div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// ExampleSection — real-world story: a detected defect is triaged (stop vs
// flag vs log, by severity + frequency + confidence) and then acted upon
// (monitor → stats → snapshot → DB → remove). Closes with an animated chart
// of defects by time of day.
// ---------------------------------------------------------------------------
function actionIcon(key: string) {
  const cls = "w-5 h-5 text-green-400"
  switch (key) {
    case "monitor":
      return <Monitor className={cls} />
    case "stats":
      return <BarChart3 className={cls} />
    case "camera":
      return <Camera className={cls} />
    case "database":
      return <Database className={cls} />
    case "robot":
      return <Bot className={cls} />
    default:
      return <Cpu className={cls} />
  }
}

// Illustrative defect distribution by time of day — the night shift spikes.
const DEFECTS_BY_HOUR = [
  { label: "06–10", value: 4, night: false },
  { label: "10–14", value: 6, night: false },
  { label: "14–18", value: 5, night: false },
  { label: "18–22", value: 9, night: false },
  { label: "22–02", value: 18, night: true },
  { label: "02–06", value: 22, night: true },
]

function ExampleSection({ ex }: { ex: ExampleCopy }) {
  return (
    <section className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div {...reveal} className="mb-10 max-w-3xl lg:mb-14">
          <span className="text-sm font-semibold uppercase tracking-wide text-green-400">
            {ex.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white lg:text-4xl">
            {ex.title}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-400">{ex.intro}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-200">
            <Eye className="h-4 w-4 text-green-400" />
            {ex.cameraLabel}
          </span>
        </motion.div>

        {/* Decision logic */}
        <motion.h3
          {...reveal}
          className="mb-6 text-xl font-bold text-white lg:text-2xl"
        >
          {ex.decisionTitle}
        </motion.h3>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {ex.scenarios.map((s, idx) => (
            <ScenarioCard key={s.title} s={s} delay={idx * 0.08} />
          ))}
        </div>
        <motion.p
          {...reveal}
          className="mt-5 flex items-start gap-2 text-sm italic text-slate-400"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          {ex.thresholdNote}
        </motion.p>

        {/* Action pipeline */}
        <motion.h3
          {...reveal}
          className="mb-6 mt-14 text-xl font-bold text-white lg:text-2xl"
        >
          {ex.actionsTitle}
        </motion.h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ex.actions.map((a, idx) => (
            <ActionCard key={a.title} a={a} step={idx + 1} delay={idx * 0.08} />
          ))}
        </div>

        {/* Statistics chart */}
        <DefectChart ex={ex} />
      </div>
    </section>
  )
}

// Severity → palette map for the decision cards.
const SEVERITY = {
  critical: {
    ring: "border-rose-400/40",
    glow: "bg-rose-500/10",
    tag: "bg-rose-500 text-white",
    bar: "bg-rose-400",
    text: "text-rose-300",
    icon: <Ban className="h-5 w-5 text-rose-400" />,
  },
  warning: {
    ring: "border-amber-400/40",
    glow: "bg-amber-500/10",
    tag: "bg-amber-400 text-slate-950",
    bar: "bg-amber-400",
    text: "text-amber-300",
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
  },
  low: {
    ring: "border-white/15",
    glow: "bg-slate-500/10",
    tag: "bg-slate-600 text-white",
    bar: "bg-slate-400",
    text: "text-slate-300",
    icon: <Info className="h-5 w-5 text-slate-300" />,
  },
} as const

function ScenarioCard({ s, delay }: { s: DecisionScenario; delay: number }) {
  const c = SEVERITY[s.severity]
  return (
    <motion.div
      {...reveal}
      transition={{ ...reveal.transition, delay }}
      className={`relative overflow-hidden rounded-2xl border ${c.ring} bg-slate-900/40 p-6`}
    >
      <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full ${c.glow} blur-2xl`} />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {c.icon}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${c.tag}`}
            >
              {s.tag}
            </span>
          </span>
        </div>
        <h4 className="text-lg font-bold text-white">{s.title}</h4>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">
          {s.desc}
        </p>

        {/* Confidence meter */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <span>Confidence</span>
            <span className={c.text}>{s.confidence}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${s.confidence}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: delay + 0.2, ease: "easeOut" }}
              className={`h-full rounded-full ${c.bar}`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ActionCard({
  a,
  step,
  delay,
}: {
  a: ActionStep
  step: number
  delay: number
}) {
  return (
    <motion.div
      {...reveal}
      transition={{ ...reveal.transition, delay }}
      className="relative rounded-2xl border border-white/10 bg-slate-900/50 p-5"
    >
      <span className="absolute right-3 top-3 text-xs font-bold text-slate-600">
        {step}
      </span>
      <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/10">
        {actionIcon(a.icon)}
      </span>
      <h4 className="text-[15px] font-bold text-white">{a.title}</h4>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{a.desc}</p>
    </motion.div>
  )
}

function DefectChart({ ex }: { ex: ExampleCopy }) {
  const max = Math.max(...DEFECTS_BY_HOUR.map((d) => d.value))
  return (
    <motion.div
      {...reveal}
      className="mt-14 rounded-3xl border border-white/10 bg-slate-900/40 p-6 lg:p-8"
    >
      <div className="mb-1 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-green-400" />
        <h3 className="text-xl font-bold text-white lg:text-2xl">
          {ex.chartTitle}
        </h3>
      </div>
      <p className="text-[15px] leading-relaxed text-slate-400">
        {ex.chartSubtitle}
      </p>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-5 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-400" />
          {ex.chartLegendDay}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
          {ex.chartLegendNight}
        </span>
        <span className="ml-auto font-mono uppercase tracking-wide text-slate-500">
          n° {ex.chartUnit}
        </span>
      </div>

      {/* Bars */}
      <div className="mt-6 flex h-56 items-end gap-2 sm:gap-4">
        {DEFECTS_BY_HOUR.map((d, i) => (
          <div
            key={d.label}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="text-xs font-bold text-slate-300">{d.value}</span>
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${(d.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
              className={`w-full rounded-t-lg ${d.night ? "bg-rose-400" : "bg-green-400"}`}
            />
            <span className="text-[11px] text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>

      <p className="mt-6 flex items-start gap-2 text-[15px] leading-relaxed text-slate-300">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
        <span>
          <span className="font-semibold text-green-300">Insight — </span>
          {ex.chartInsight}
        </span>
      </p>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// SwapImage — renders an <img>; if the source fails to load (e.g. the
// optional swap-in photo doesn't exist yet) it falls back to `fallbackSrc`,
// and if that also fails it hides itself. Lets Andrea drop real photos into
// /public/industry40/ later without touching code.
// ---------------------------------------------------------------------------
function SwapImage({
  src,
  fallbackSrc,
  alt,
  className,
}: {
  src: string
  fallbackSrc: string
  alt: string
  className?: string
}) {
  const [current, setCurrent] = useState(src)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (current !== fallbackSrc) setCurrent(fallbackSrc)
        else setHidden(true)
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// ChatMockup — WhatsApp-style operator conversation (the Custom Chatbot).
// Swap-in: drop /industry40/chatbot.jpg to replace it with a real photo.
// ---------------------------------------------------------------------------
function ChatMockup({ t }: { t: Industry40Copy }) {
  const [usePhoto, setUsePhoto] = useState(true)
  if (usePhoto) {
    return (
      <PhotoOrFallback
        src="/industry40/chatbot.jpg"
        alt={t.solutions[0]?.title ?? "Custom Chatbots"}
        onMissing={() => setUsePhoto(false)}
      />
    )
  }
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-green-500/25 via-emerald-400/10 to-transparent blur-xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl">
        <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500">
            <MessageCircle className="h-5 w-5 text-white" />
          </span>
          <div className="leading-tight">
            <p className="flex items-center gap-1 text-sm font-semibold">
              {t.chatName}
              <Check className="h-3.5 w-3.5 rounded-full bg-sky-400 p-0.5 text-white" />
            </p>
            <p className="text-[11px] text-white/70">online</p>
          </div>
        </div>
        <div className="space-y-2.5 bg-[#ECE5DD] px-3 py-5 text-[13px]">
          <ChatBubble side="left">{t.chatMsg}</ChatBubble>
          <ChatBubble side="right">{t.chatReply}</ChatBubble>
          <ChatBubble side="right" tone="alert">
            <span className="font-semibold text-rose-700">⚠ {t.scanStatus}</span>
            <span className="block text-gray-700">cam_01 · {t.scanConfidence}</span>
          </ChatBubble>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({
  side,
  tone,
  children,
}: {
  side: "left" | "right"
  tone?: "alert"
  children: ReactNode
}) {
  const isRight = side === "right"
  const base = isRight
    ? "ml-auto rounded-tr-sm bg-[#DCF8C6]"
    : "mr-auto rounded-tl-sm bg-white"
  const alert = tone === "alert" ? "bg-rose-50" : ""
  return (
    <div
      className={`max-w-[82%] rounded-2xl px-3 py-2 text-gray-800 shadow-sm ${base} ${alert}`}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScanMockup — Computer Vision inspection frame with a sweeping scan line and
// a live "defect detected" bounding box over a grid of parts.
// Swap-in: drop /industry40/vision.jpg to replace it with a real photo.
// ---------------------------------------------------------------------------
const VISION_PHOTOS = ["/industry40/vision.jpg"]

function ScanMockup({ t }: { t: Industry40Copy }) {
  const [failed, setFailed] = useState<string[]>([])
  const parts = Array.from({ length: 12 })
  const defectIndex = 6
  const visible = VISION_PHOTOS.filter((src) => !failed.includes(src))

  // Real defect-detection / counting photos stacked as a gallery. Each image
  // hides itself on error; only when ALL are missing do we fall back to the
  // animated scan panel below.
  if (visible.length > 0) {
    const alt = t.solutions[1]?.title ?? "Computer Vision"
    return (
      <div className="relative mx-auto w-full max-w-md space-y-4">
        <div className="pointer-events-none absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-green-500/25 via-emerald-400/10 to-transparent blur-xl" />
        {visible.map((src) => (
          <img
            key={src}
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed((f) => [...f, src])}
            className="relative w-full rounded-3xl border border-white/10 object-cover shadow-2xl"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-green-500/25 via-emerald-400/10 to-transparent blur-xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Eye className="h-4 w-4 text-green-400" />
            {t.scanLabel}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            LIVE
          </span>
        </div>

        <div className="relative p-5">
          <div className="grid grid-cols-4 gap-3">
            {parts.map((_, i) => {
              const isDefect = i === defectIndex
              return (
                <div
                  key={i}
                  className={`relative aspect-square rounded-lg border ${
                    isDefect
                      ? "border-rose-400/70 bg-rose-500/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {isDefect && (
                    <>
                      <motion.span
                        initial={{ opacity: 0.4 }}
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="absolute inset-0 rounded-lg ring-2 ring-rose-400"
                      />
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                        {t.scanStatus}
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <motion.div
            initial={{ top: "8%" }}
            animate={{ top: ["8%", "88%", "8%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute left-5 right-5 h-0.5 bg-green-400 shadow-[0_0_12px_2px_rgba(74,222,128,0.6)]"
          />
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-[11px]">
          <span className="font-mono text-slate-500">cam_01 · 60 fps</span>
          <span className="font-semibold text-green-300">{t.scanConfidence}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PhotoOrFallback — tries to load an optional swap-in photo; calls onMissing()
// when it isn't there so the caller renders its built-in mockup instead.
// ---------------------------------------------------------------------------
function PhotoOrFallback({
  src,
  alt,
  onMissing,
}: {
  src: string
  alt: string
  onMissing: () => void
}) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-green-500/25 via-emerald-400/10 to-transparent blur-xl" />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={onMissing}
        className="relative w-full rounded-3xl border border-white/10 object-cover shadow-2xl"
      />
    </div>
  )
}
