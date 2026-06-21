import { useEffect, useState, type ReactNode } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { Fragment } from "react"
import {
  ArrowRight,
  Bot,
  Brain,
  Check,
  Cpu,
  Eye,
  Image,
  Lock,
  MessageCircle,
  ScanLine,
  Tags,
  Wallet,
  WifiOff,
  Zap,
} from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CtaSection } from "@/components/landing/CtaSection"
import {
  INDUSTRY40_I18N,
  type EdgeAICopy,
  type FlowCopy,
  type Industry40Copy,
  type Industry40Lang,
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
                <Fragment key={sol.title}>
                  <SolutionRow
                    sol={sol}
                    reversed={idx % 2 === 1}
                    visual={idx === 0 ? <ChatMockup t={t} /> : <ScanMockup t={t} />}
                  />
                  {idx === 0 && <BridgeBand text={t.bridge} />}
                </Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ===================== FLOW (DATA → ACTION) ================= */}
        <FlowSection f={t.flow} />

        {/* ===================== EDGE AI (FUTURE) ===================== */}
        <EdgeAISection e={t.edgeai} />

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
// FlowSection — the ML pipeline as an editorial stepper:
// Dataset → Labelling → Training → Inference → Actions.
// ---------------------------------------------------------------------------
function flowIcon(key: string) {
  const cls = "w-6 h-6 text-green-400"
  switch (key) {
    case "dataset":
      return <Image className={cls} />
    case "labelling":
      return <Tags className={cls} />
    case "training":
      return <Brain className={cls} />
    case "inference":
      return <ScanLine className={cls} />
    case "actions":
      return <Zap className={cls} />
    default:
      return <Cpu className={cls} />
  }
}

function FlowSection({ f }: { f: FlowCopy }) {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div {...reveal} className="mb-10 max-w-3xl lg:mb-14">
          <span className="text-sm font-semibold uppercase tracking-wide text-green-400">
            {f.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white lg:text-4xl">
            {f.title}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-400">{f.lead}</p>
        </motion.div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {f.steps.map((s, i) => (
            <Fragment key={s.title}>
              <motion.div
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
                className="flex-1 rounded-2xl border border-white/10 bg-slate-900/50 p-5 transition-colors hover:border-green-400/40"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/10">
                    {flowIcon(s.icon)}
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                  {s.desc}
                </p>
              </motion.div>
              {i < f.steps.length - 1 && (
                <div className="flex shrink-0 items-center justify-center">
                  <ArrowRight className="h-5 w-5 rotate-90 text-green-400/60 lg:rotate-0" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// EdgeAISection — "a look ahead": the vision model runs ON the line (edge
// device), not in the cloud. Low latency, offline, data stays in the factory,
// low cost. Stats band + benefit cards + technology chips.
// ---------------------------------------------------------------------------
function edgeIcon(key: string) {
  const cls = "w-6 h-6 text-green-400"
  switch (key) {
    case "latency":
      return <Zap className={cls} />
    case "offline":
      return <WifiOff className={cls} />
    case "privacy":
      return <Lock className={cls} />
    case "cost":
      return <Wallet className={cls} />
    default:
      return <Cpu className={cls} />
  }
}

function EdgeAISection({ e }: { e: EdgeAICopy }) {
  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
      <div className="pointer-events-none absolute -top-32 right-0 h-[26rem] w-[26rem] rounded-full bg-green-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div {...reveal} className="mb-10 lg:mb-14">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-400">
            <Cpu className="h-4 w-4" />
            {e.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-white lg:text-4xl">
            {e.title}
          </h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-slate-400">
            {e.lead}
          </p>
        </motion.div>

        {/* Benefit cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {e.points.map((p, idx) => (
            <motion.div
              key={p.title}
              {...reveal}
              transition={{ ...reveal.transition, delay: idx * 0.05 }}
              className="group rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition-colors hover:border-green-400/40 hover:bg-slate-900"
            >
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-400/10 transition-transform group-hover:scale-110">
                {edgeIcon(p.icon)}
              </span>
              <h3 className="text-lg font-bold text-white">{p.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">
                {p.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// BridgeBand — connects the two solutions: an operator sends a photo on the
// WhatsApp chatbot and the computer vision model analyzes it. Shows the two
// solutions are one flow, not separate silos.
// ---------------------------------------------------------------------------
function BridgeBand({ text }: { text: string }) {
  return (
    <motion.div
      {...reveal}
      className="flex flex-col items-center gap-4 rounded-2xl border border-green-400/20 bg-green-400/[0.04] px-6 py-5 text-center sm:flex-row sm:text-left lg:px-8"
    >
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/10">
          <MessageCircle className="h-5 w-5 text-green-400" />
        </span>
        <ArrowRight className="h-5 w-5 text-green-400/60" />
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/10">
          <Eye className="h-5 w-5 text-green-400" />
        </span>
      </div>
      <p className="text-[15px] font-medium leading-relaxed text-slate-200">
        {text}
      </p>
    </motion.div>
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
