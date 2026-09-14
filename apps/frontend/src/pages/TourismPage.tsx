import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  MessageCircle,
  Phone,
  Play,
  Send,
  ShieldOff,
  Video,
  X,
} from "lucide-react"
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
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
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

                {/* The two things the product does, stated before the fold. */}
                <motion.div
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.13 }}
                  className="mt-7 flex flex-wrap gap-3"
                >
                  <span className="inline-flex items-center gap-2 rounded-xl border border-green-400/25 bg-green-400/[0.07] px-4 py-2.5 text-sm font-semibold text-green-200">
                    <MessageCircle className="h-4 w-4" />
                    {t.heroModeIn}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-2.5 text-sm font-semibold text-amber-200">
                    <BellRing className="h-4 w-4" />
                    {t.heroModeOut}
                  </span>
                </motion.div>

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
                </motion.div>
                <motion.p
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.18 }}
                  className="mt-3 text-sm text-slate-400"
                >
                  {t.ctaSub}
                </motion.p>

                <motion.div
                  {...intro}
                  transition={{ ...intro.transition, delay: 0.2 }}
                  className="mt-10 flex flex-wrap gap-8 border-t border-white/10 pt-8"
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

              {/* Right: full WhatsApp phone — the page's main "this is WhatsApp" signal. */}
              <PhoneMock t={t} />
            </div>
          </div>
        </section>

        {/* ===================== PAIN → FIX (the desk today) ============== */}
        <section id="oggi" className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.painTitle} accent={t.painAccent} sub={t.painSub} />

            <div className="mb-4 hidden grid-cols-2 gap-5 px-1 md:grid">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t.painColPain}
              </p>
              <p className="text-sm font-semibold uppercase tracking-wide text-green-400">
                {t.painColFix}
              </p>
            </div>

            <div className="space-y-3">
              {t.painRows.map((row, idx) => (
                <motion.div
                  key={row.pain}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.05 }}
                  className="grid grid-cols-1 gap-3 overflow-hidden rounded-2xl border border-white/10 md:grid-cols-2 md:gap-0"
                >
                  <div className="flex gap-3 bg-slate-900/60 p-5 lg:p-6">
                    <span className="text-2xl leading-none">{row.icon}</span>
                    <p className="text-[15px] leading-relaxed text-slate-400">{row.pain}</p>
                  </div>
                  <div className="flex gap-3 border-t border-white/10 bg-green-400/[0.05] p-5 md:border-l md:border-t-0 lg:p-6">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                    <p className="text-[15px] leading-relaxed text-slate-200">{row.fix}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= HOW IT WORKS ======================== */}
        <section id="come-funziona" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.howTitle} accent={t.howAccent} sub={t.howSub} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {t.howSteps.map((step, idx) => (
                <motion.div
                  key={step.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.06 }}
                  className="relative rounded-2xl border border-white/10 bg-slate-900/40 p-6 lg:p-7"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-400/15 font-mono text-sm font-bold text-green-300">
                    {step.badge}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-400">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= WHAT IT ANSWERS ====================== */}
        <section id="cosa-risponde" className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.whatTitle} accent={t.whatAccent} sub={t.whatSub} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {t.capabilities.map((c, idx) => (
                <motion.div
                  key={c.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 transition-colors hover:border-green-400/30 lg:p-7"
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
        <section id="push" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.span
              {...reveal}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-amber-300"
            >
              <BellRing className="h-4 w-4" />
              {t.heroModeOut}
            </motion.span>
            <SectionHeading title={t.pushTitle} accent={t.pushAccent} sub={t.pushSub} />
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                {t.pushSteps.map((step, idx) => (
                  <motion.div
                    key={step.title}
                    {...reveal}
                    transition={{ ...reveal.transition, delay: idx * 0.06 }}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/40 p-5 lg:p-6"
                  >
                    <span className="h-fit shrink-0 rounded-lg bg-amber-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-amber-300">
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

        {/* ========================= RESULTS BAND ========================= */}
        <section className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.metricsTitle} accent={t.metricsAccent} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {t.metrics.map((m, idx) => (
                <motion.div
                  key={m.label}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6"
                >
                  <p className="text-4xl font-extrabold text-green-400">{m.value}</p>
                  <p className="mt-2 font-bold text-white">{m.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{m.desc}</p>
                </motion.div>
              ))}
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

        {/* ============================== FAQ ============================= */}
        <section id="faq" className="border-t border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.faqTitle} accent={t.faqAccent} />
            <div className="space-y-3">
              {t.faqItems.map((item, idx) => (
                <FaqRow key={item.q} item={item} delay={idx * 0.04} />
              ))}
            </div>
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

/**
 * Full-height WhatsApp phone for the hero.
 * Deliberately literal — green header, wallpaper, bubble tails, input bar —
 * because the page's first job is making "this is WhatsApp" obvious at a glance.
 */
function PhoneMock({ t }: { t: TourismCopy }) {
  const [shown, setShown] = useState(0)
  const [typing, setTyping] = useState(false)
  const script = t.heroScript

  // Each line appears in turn; a "typing…" hint precedes every bot reply,
  // then the loop restarts so the hero is never a frozen screenshot.
  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const run = () => {
      setShown(0)
      setTyping(false)
      script.forEach((line, i) => {
        const at = 700 + i * 1500
        if (line.role === "bot") {
          timers.push(setTimeout(() => !cancelled && setTyping(true), at - 700))
        }
        timers.push(
          setTimeout(() => {
            if (cancelled) return
            setTyping(false)
            setShown(i + 1)
          }, at),
        )
      })
      timers.push(setTimeout(run, 700 + script.length * 1500 + 3200))
    }
    run()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [script])

  return (
    <motion.div
      /* No scale on the way in: the phone is a fixed object, and growing it
         from 96% read as the handset "narrowing then opening" before the chat
         appeared (Andrea, 2026-09-14). A plain fade + rise keeps the chrome
         still while the conversation types itself in. */
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-[340px]"
    >
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-tr from-green-500/25 via-emerald-400/10 to-transparent blur-2xl" />

      {/* Phone body */}
      <div className="relative overflow-hidden rounded-[2.5rem] border-[10px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-800" />

        {/* WhatsApp header */}
        <div className="relative z-10 flex items-center gap-3 bg-[#075E54] px-3 pb-2.5 pt-8 text-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-base">
            🏔️
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold">{t.heroCardTitle}</p>
            <p className="text-[11px] text-green-200">
              {typing ? t.heroPhoneTyping : t.heroCardStatus}
            </p>
          </div>
          <Video className="h-4 w-4 text-white/70" />
          <Phone className="h-4 w-4 text-white/70" />
        </div>

        {/* Chat wallpaper */}
        <div className="relative min-h-[430px] bg-[#0b1a14] px-3 py-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />

          <div className="relative space-y-2">
            <AnimatePresence>
              {script.slice(0, shown).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${line.role === "guest" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 text-[13px] leading-snug shadow-sm ${
                      line.role === "guest"
                        ? "rounded-xl rounded-br-sm bg-[#005C4B] text-white"
                        : "rounded-xl rounded-bl-sm bg-[#1f2c33] text-slate-100"
                    }`}
                  >
                    {line.tag && (
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-amber-400">
                        {line.tag}
                      </p>
                    )}
                    {/* Media preview above the text, the way WhatsApp shows a
                        photo or video with its caption underneath. */}
                    {line.media && (
                      <div className="mb-1.5 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                        <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-slate-700/60 to-slate-800/60 text-3xl">
                          {line.media.emoji}
                          {line.media.kind === "video" && (
                            <>
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/25">
                                  <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                                </span>
                              </span>
                              {line.media.duration && (
                                <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[9px] text-white">
                                  {line.media.duration}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <p className="px-2 py-1 text-[11px] text-slate-300">{line.media.caption}</p>
                      </div>
                    )}
                    <span className="whitespace-pre-line">{line.text}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {typing && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex gap-1 rounded-xl rounded-bl-sm bg-[#1f2c33] px-3 py-2.5">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
                      className="h-1.5 w-1.5 rounded-full bg-slate-400"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* WhatsApp input bar */}
        <div className="flex items-center gap-2 bg-[#1f2c33] px-3 py-2.5">
          <div className="flex-1 rounded-full bg-[#2a3942] px-3.5 py-2 text-[12px] text-slate-500">
            {t.heroPhoneInput}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00A884]">
            <Send className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Outbound-message mock.
 * The point of this one is the SECOND message: it shows the duplicate guard
 * stopping a send, which is the part nobody expects a chatbot to do.
 */
function PushMock({ t }: { t: TourismCopy }) {
  const [showGuard, setShowGuard] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      setShowGuard(false)
      timers.push(setTimeout(() => !cancelled && setShowGuard(true), 1400))
      timers.push(setTimeout(run, 6500))
    }
    run()
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <motion.div {...reveal} className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-[2rem] border-[8px] border-slate-800 bg-slate-800 shadow-2xl ring-1 ring-white/10">
        {/* WhatsApp header */}
        <div className="flex items-center gap-3 bg-[#075E54] px-3 py-2.5 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">
            🏔️
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">{t.pushBoardTitle}</p>
            <p className="text-[11px] text-green-200">{t.pushBoardStatus}</p>
          </div>
        </div>

        <div className="relative min-h-[260px] space-y-3 bg-[#0b1a14] p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />

          {/* Message that goes out */}
          <div className="relative">
            <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-green-400">
              <Check className="h-3 w-3" /> {t.pushLabelSent}
            </p>
            <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-[#1f2c33] px-3 py-2 text-[13px] leading-snug text-slate-100 shadow-sm">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-amber-400">
                {t.pushFirstTag}
              </p>
              {t.pushFirstText}
            </div>
          </div>

          {/* Message the guard stops — struck through, never delivered */}
          <AnimatePresence>
            {showGuard && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative"
              >
                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-red-400">
                  <X className="h-3 w-3" /> {t.pushLabelBlocked}
                </p>
                <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-dashed border-red-400/40 bg-red-500/5 px-3 py-2 text-[13px] leading-snug text-slate-400 shadow-sm">
                  <p className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-red-400/80 line-through">
                    {t.pushGuardTag}
                  </p>
                  <p className="flex gap-1.5">
                    <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    <span>{t.pushGuardText}</span>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/** Scenario picker + animated conversation, rendered as a WhatsApp thread. */
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
      className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 lg:grid-cols-[280px_1fr]"
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

      <div className="flex min-h-[400px] flex-col p-6 lg:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-white">{scenario.title}</h3>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] text-slate-400">
            {scenario.rule}
          </span>
        </div>

        {/* WhatsApp-styled thread, so it reads as the same product as the hero. */}
        <div className="relative flex-1 rounded-xl bg-[#0b1a14] p-4">
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative space-y-2.5">
            <AnimatePresence mode="popLayout">
              {scenario.script.slice(0, shown).map((line, i) => (
                <motion.div
                  key={`${active}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${line.role === "guest" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                      line.role === "guest"
                        ? "rounded-2xl rounded-br-sm bg-[#005C4B] text-white"
                        : "rounded-2xl rounded-bl-sm bg-[#1f2c33] text-slate-100"
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
        </div>

        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-green-400/40 hover:text-green-300"
        >
          ↻ {t.tryReplay}
        </button>
      </div>
    </motion.div>
  )
}

/** Single collapsible FAQ row. */
function FaqRow({ item, delay }: { item: { q: string; a: string }; delay: number }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      {...reveal}
      transition={{ ...reveal.transition, delay }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left lg:p-6"
      >
        <span className="font-semibold text-white">{item.q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-green-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-400 lg:px-6 lg:pb-6">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
