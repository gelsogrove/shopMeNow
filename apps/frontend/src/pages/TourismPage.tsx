import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Check, MessageCircle, ShieldOff } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CtaSection } from "@/components/landing/CtaSection"
import {
  TOURISM_I18N,
  type ChatLine,
  type TourismCopy,
  type TourismLang,
} from "./tourism/tourism.i18n"

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

function SectionHeading({
  title,
  accent,
  sub,
}: {
  title: string
  accent?: string
  sub?: string
}) {
  return (
    <motion.div {...reveal} className="mb-10 lg:mb-14 max-w-3xl">
      <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
        {title} {accent && <span className="text-green-400">{accent}</span>}
      </h2>
      {sub && <p className="mt-3 text-lg text-slate-400 leading-relaxed">{sub}</p>}
    </motion.div>
  )
}

export function TourismPage() {
  const { language } = useLanguage()
  const t = TOURISM_I18N[(language as TourismLang) ?? "en"] ?? TOURISM_I18N.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        keywords={t.seoKeys}
        url="/tourism"
        lang={language as TourismLang}
        serviceType="Tourism Board WhatsApp Chatbot"
      />
      <SiteHeader />

      <main className="bg-[#070d18] text-slate-200">
        {/* ============================ HERO ============================ */}
        <section className="relative overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28">
          <div className="pointer-events-none absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-green-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:34px_34px] opacity-60" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              {/* Left: copy */}
              <div>
                <motion.span
                  {...intro}
                  className="inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-green-300"
                >
                  {t.badge}
                </motion.span>
                <motion.h1
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.05 }}
                  className="mt-6 text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl"
                >
                  {t.heroTitleTop}
                  <br />
                  <span className="text-green-400">{t.heroTitleAccent}</span>
                </motion.h1>
                <motion.p
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.1 }}
                  className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300"
                >
                  {t.heroSub}
                </motion.p>
                <motion.div
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.15 }}
                  className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"
                >
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-8 py-4 font-bold text-slate-950 shadow-lg shadow-green-500/20 transition-all hover:bg-green-400 hover:shadow-green-400/30"
                  >
                    {t.cta} <ArrowRight className="h-5 w-5" />
                  </Link>
                  <a
                    href="#prova"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-4 font-bold text-white transition-all hover:border-white/40 hover:bg-white/5"
                  >
                    {t.tryDemo}
                  </a>
                  <span className="text-sm text-slate-400">{t.ctaSub}</span>
                </motion.div>
                <motion.div
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.2 }}
                  className="mt-10 flex flex-wrap gap-8"
                >
                  <div>
                    <p className="text-2xl font-bold text-green-400">4+</p>
                    <p className="text-sm text-slate-400">{t.heroProof1}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">24/7</p>
                    <p className="text-sm text-slate-400">{t.heroProof2}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">1</p>
                    <p className="text-sm text-slate-400">{t.heroProof3}</p>
                  </div>
                </motion.div>
              </div>

              {/* Right: photo + floating WhatsApp mock */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative mx-auto w-full max-w-sm"
              >
                <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-green-500/30 via-emerald-400/10 to-transparent blur-xl" />
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 shadow-2xl">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:22px_22px]" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-3 pt-10 text-6xl">
                    <span>⛰️</span>
                    <span>🏘️</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
                    <div className="rounded-2xl bg-slate-950/90 p-3 backdrop-blur">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                          <MessageCircle className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="leading-tight">
                          <p className="text-xs font-semibold text-white">{t.heroCardTitle}</p>
                          <p className="text-[10px] text-slate-400">{t.heroCardStatus}</p>
                        </div>
                      </div>
                      <HeroThread script={t.heroScript} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ========================= HOW IT WORKS ======================== */}
        <section id="come-funziona" className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.howTitle} accent={t.howAccent} sub={t.howSub} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {t.howSteps.map((step, idx) => (
                <motion.div
                  key={step.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 lg:p-7"
                >
                  <span className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-400">
                    {step.badge}
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= WHAT IT ANSWERS ====================== */}
        <section id="cosa-risponde" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.whatTitle} accent={t.whatAccent} sub={t.whatSub} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {t.capabilities.map((c, idx) => (
                <motion.div
                  key={c.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 lg:p-7"
                >
                  <span className="text-3xl leading-none">{c.icon}</span>
                  <h3 className="mt-4 text-lg font-bold text-white">{c.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{c.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= OUTBOUND MESSAGES / PUSH ============= */}
        <section id="push" className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.pushTitle} accent={t.pushAccent} sub={t.pushSub} />
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                {t.pushSteps.map((step, idx) => (
                  <motion.div
                    key={step.title}
                    {...reveal}
                    transition={{ ...reveal.transition, delay: idx * 0.06 }}
                    className="flex gap-4"
                  >
                    <span className="h-fit shrink-0 rounded-lg bg-green-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-green-300">
                      {step.badge}
                    </span>
                    <div>
                      <h4 className="font-bold text-white">{step.title}</h4>
                      <p className="mt-1 text-[15px] leading-relaxed text-slate-400">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <PushMock t={t} />
            </div>
          </div>
        </section>

        {/* ========================= TRY IT (SCENARIOS) =================== */}
        <section id="prova" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.tryTitle} accent={t.tryAccent} sub={t.trySub} />
            <ScenarioDemo t={t} />
          </div>
        </section>

        <CtaSection title={`${t.ctaTitle} 👋`} subtitle={t.ctaDesc} ctaLabel={t.cta} animated wide />
      </main>

      <SiteFooter language={language} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Demo mock components
// ---------------------------------------------------------------------------

/** Typing-then-reveal chat thread, replayable, used by the hero mock. */
function HeroThread({ script }: { script: ChatLine[] }) {
  const [shown, setShown] = useState(0)
  const [key, setKey] = useState(0)

  useEffect(() => {
    setShown(0)
    if (script.length === 0) return
    const timers: ReturnType<typeof setTimeout>[] = []
    script.forEach((_, i) => {
      timers.push(setTimeout(() => setShown(i + 1), 500 + i * 900))
    })
    return () => timers.forEach(clearTimeout)
  }, [script, key])

  return (
    <div className="space-y-1.5">
      <div className="min-h-[104px] space-y-1.5">
        <AnimatePresence>
          {script.slice(0, shown).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${line.role === "guest" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-2.5 py-1.5 text-[11px] leading-snug ${
                  line.role === "guest"
                    ? "bg-green-500/20 text-green-100"
                    : "bg-white/10 text-slate-200"
                }`}
              >
                {line.tag && (
                  <p className="mb-0.5 font-mono text-[9px] uppercase tracking-wide text-amber-400">
                    {line.tag}
                  </p>
                )}
                {line.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={() => setKey((k) => k + 1)}
        className="w-full rounded-lg border border-dashed border-white/15 py-1.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-green-400/40 hover:text-green-300"
      >
        ↻
      </button>
    </div>
  )
}

/** Outbound-message mock with the duplicate-content guard visualized. */
function PushMock({ t }: { t: TourismCopy }) {
  const [showGuard, setShowGuard] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    setShowGuard(false)
    const id = setTimeout(() => setShowGuard(true), 1100)
    return () => clearTimeout(id)
  }, [key])

  return (
    <motion.div {...reveal} className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0B3D20] p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 px-1 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{t.pushBoardTitle}</p>
            <p className="text-[11px] text-white/60">{t.pushBoardStatus}</p>
          </div>
        </div>
        <div className="min-h-[170px] space-y-2.5 rounded-2xl bg-white p-3">
          <div className="max-w-[88%] rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2 text-[13px] text-gray-800 shadow-sm">
            <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-600">
              {t.pushFirstTag}
            </p>
            {t.pushFirstText}
          </div>
          <AnimatePresence>
            {showGuard && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[88%] rounded-xl rounded-tl-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 shadow-sm"
              >
                <p className="mb-0.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-amber-700">
                  <ShieldOff className="h-3 w-3" /> {t.pushGuardTag}
                </p>
                {t.pushGuardText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="mt-3 w-full rounded-lg border border-dashed border-white/25 py-2 font-mono text-[11px] text-white/70 transition-colors hover:border-amber-400 hover:text-amber-300"
        >
          ↻
        </button>
      </div>
    </motion.div>
  )
}

/** Scenario picker + animated conversation, mirrors the artifact prototype. */
function ScenarioDemo({ t }: { t: TourismCopy }) {
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState(0)
  const [key, setKey] = useState(0)
  const scenario = t.scenarios[active]

  useEffect(() => {
    setShown(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    scenario.script.forEach((_, i) => {
      timers.push(setTimeout(() => setShown(i + 1), 400 + i * 850))
    })
    return () => timers.forEach(clearTimeout)
  }, [active, key, scenario.script])

  return (
    <motion.div
      {...reveal}
      className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 lg:grid-cols-[260px_1fr]"
    >
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 p-4 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r">
        {t.scenarios.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setActive(i)}
            className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
              i === active
                ? "bg-green-400/15 text-green-300"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <span className="mr-2 font-mono text-xs text-amber-400">
              {String(i + 1).padStart(2, "0")}
            </span>
            {s.title}
          </button>
        ))}
      </div>

      <div className="flex min-h-[380px] flex-col p-6 lg:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-white">{scenario.title}</h3>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] text-slate-400">
            {scenario.rule}
          </span>
        </div>
        <div className="flex-1 space-y-3">
          <AnimatePresence mode="popLayout">
            {scenario.script.slice(0, shown).map((line, i) => (
              <motion.div
                key={`${active}-${i}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${line.role === "guest" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                    line.role === "guest"
                      ? "rounded-tr-sm bg-green-500/15 text-green-50"
                      : "rounded-tl-sm bg-white/[0.06] text-slate-200"
                  }`}
                >
                  {line.tag && (
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-amber-400">
                      {line.tag}
                    </p>
                  )}
                  {line.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-green-400/40 hover:text-green-300"
        >
          <Check className="h-3.5 w-3.5" /> ↻
        </button>
      </div>
    </motion.div>
  )
}
