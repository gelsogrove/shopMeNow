import { useEffect, useState, type ReactNode } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { Link } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  MessageCircle,
  Megaphone,
  MapPin,
  Bot,
  ShieldCheck,
  Server,
  Maximize2,
  Users,
  Check,
  Clock,
  Tag,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CtaSection } from "@/components/landing/CtaSection"
import { BEAUTY_I18N, type BeautyCopy, type BeautyLang } from "./beauty/beauty.i18n"

// ---------------------------------------------------------------------------
// Icon registry — string keys in i18n map to lucide icons here, so copy stays
// data-only and the component owns presentation.
// ---------------------------------------------------------------------------
function solutionIcon(key: string) {
  const cls = "w-6 h-6 text-green-400"
  switch (key) {
    case "whatsapp":
      return <MessageCircle className={cls} />
    case "megaphone":
      return <Megaphone className={cls} />
    case "pin":
      return <MapPin className={cls} />
    case "bot":
      return <Bot className={cls} />
    default:
      return <MapPin className={cls} />
  }
}

function dataIcon(key: string) {
  const cls = "w-6 h-6 text-green-400"
  switch (key) {
    case "shield":
      return <ShieldCheck className={cls} />
    case "server":
      return <Server className={cls} />
    case "expand":
      return <Maximize2 className={cls} />
    case "together":
      return <Users className={cls} />
    default:
      return <ShieldCheck className={cls} />
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

export function BeautyPage() {
  const { language } = useLanguage()
  const t = BEAUTY_I18N[(language as BeautyLang) ?? "en"] ?? BEAUTY_I18N.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <SEO
        title={t.seoTitle}
        description={t.seoDesc}
        keywords={t.seoKeys}
        url="/beauty"
        lang={language as BeautyLang}
        serviceType="Multi-Location Beauty-Center WhatsApp Chatbot"
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
                  <Link
                    to="/demo/demobeauty"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-4 font-semibold text-white transition-all hover:border-white/40 hover:bg-white/5"
                  >
                    {t.tryDemo}
                  </Link>
                  <span className="text-sm text-slate-400">{t.ctaSub}</span>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative"
              >
                <div className="absolute -inset-2 rounded-[2rem] bg-gradient-to-tr from-green-500/30 via-emerald-400/10 to-transparent blur-xl" />
                <img
                  src="/beauty.png"
                  alt="eChatbot AI assistant for multi-location beauty centers"
                  className="relative w-full rounded-3xl border border-white/10 shadow-2xl"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ========================= INDUSTRIES ========================= */}
        <section className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.industriesTitle} sub={t.industriesSub} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {t.industries.map((ind, idx) => (
                <motion.div
                  key={ind.label}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.04 }}
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 px-5 py-4 transition-colors hover:border-green-400/40 hover:bg-slate-900"
                >
                  <span className="text-2xl leading-none transition-transform group-hover:scale-110">
                    {ind.icon}
                  </span>
                  <span className="font-semibold text-slate-200">{ind.label}</span>
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-sm italic text-slate-500">{t.industriesNote}</p>
          </div>
        </section>

        {/* ===================== PROBLEMS → SOLUTIONS ==================== */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.problemsTitle} accent={t.problemsSub} />
            <div className="space-y-5">
              {t.problems.map((p, idx) => (
                <motion.div
                  key={p.num}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.05 }}
                  className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 md:grid-cols-2"
                >
                  <div className="flex items-start gap-5 p-6 lg:p-8">
                    <span className="text-5xl font-black leading-none text-rose-400/70">
                      {p.num}
                    </span>
                    <p className="pt-1 text-lg font-semibold text-slate-100">{p.problem}</p>
                  </div>
                  <div className="relative flex items-start gap-4 border-t border-white/10 bg-green-500/[0.04] p-6 md:border-l md:border-t-0 lg:p-8">
                    <div className="absolute -left-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-green-400/30 bg-[#070d18] md:flex">
                      <ArrowRight className="h-4 w-4 text-green-400" />
                    </div>
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-400/10">
                      {solutionIcon(p.icon)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-300">{p.solutionTitle}</h3>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">
                        {p.solutionDesc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              {...reveal}
              className="mt-8 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 shadow-lg shadow-green-900/30 lg:px-8"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Check className="h-5 w-5 text-white" />
              </span>
              <p className="text-lg font-bold text-white">{t.problemsBanner}</p>
            </motion.div>
          </div>
        </section>

        {/* ===================== PER-SEDE CATALOG LOADER ================ */}
        <section className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.sedesTitle} accent={t.sedesAccent} sub={t.sedesSub} />
            <SedeLoader t={t} />
          </div>
        </section>

        {/* ===================== LANGUAGE ============================== */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-400/10 px-3 py-1 text-sm font-semibold text-green-300">
                  🌐 {t.langBadge}
                </span>
                <h2 className="text-3xl font-bold text-white lg:text-4xl">
                  {t.langTitle} <span className="text-green-400">{t.langTitleAccent}</span>
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">{t.langDesc}</p>
                <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-3">
                  <span className="text-3xl leading-none">🌍</span>
                  <span className="text-base font-semibold text-white">{t.langEvery}</span>
                </div>
              </div>
              <BookingChat t={t} />
            </div>
          </div>
        </section>

        {/* ===================== CAMPAIGNS / PUSH ====================== */}
        <section className="border-y border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              title={t.campaignsTitle}
              accent={t.campaignsTitleAccent}
              sub={t.campaignsDesc}
            />
            <PushMock t={t} />
          </div>
        </section>

        {/* ===================== DATA CONTROL ========================== */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.dataTitle} accent={t.dataTitleAccent} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {t.dataCards.map((c, idx) => (
                <motion.div
                  key={c.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: idx * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 lg:p-7"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-400/10">
                      {dataIcon(c.icon)}
                    </span>
                    <h3 className="text-lg font-bold text-white">{c.title}</h3>
                  </div>
                  <p className="text-[15px] leading-relaxed text-slate-400">{c.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              {...reveal}
              className="mt-8 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-5 shadow-lg shadow-green-900/30 lg:px-8"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Check className="h-5 w-5 text-white" />
              </span>
              <p className="text-lg font-bold text-white">{t.dataBanner}</p>
            </motion.div>
          </div>
        </section>

        {/* ===================== FAQ =================================== */}
        <section className="border-t border-white/5 bg-white/[0.02] py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <SectionHeading title={t.faqTitle} accent={t.faqTitleAccent} />
            <div className="space-y-3">
              {t.faqs.map((f, idx) => (
                <FaqRow key={idx} q={f.q} a={f.a} idx={idx} />
              ))}
            </div>
          </div>
        </section>

        <CtaSection
          title={`${t.ctaTitle} ✨`}
          subtitle={t.ctaDesc}
          ctaLabel={t.cta}
          demoTo="/demo/demobeauty"
          demoLabel={t.tryDemo}
          animated
          wide
        />
      </main>

      <SiteFooter language={language} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Demo mock components
// ---------------------------------------------------------------------------

/** WhatsApp booking chat: AI books a treatment, upsells, builds a cart. */
function BookingChat({ t }: { t: BeautyCopy }) {
  return (
    <motion.div {...reveal} className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl">
        <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-base">
            ✨
          </div>
          <div className="leading-tight">
            <p className="flex items-center gap-1 text-sm font-semibold">
              {t.bookingBot}
              <Check className="h-3.5 w-3.5 rounded-full bg-sky-400 p-0.5 text-white" />
            </p>
            <p className="text-[11px] text-white/70">online</p>
          </div>
        </div>
        <div className="space-y-2.5 bg-[#ECE5DD] px-3 py-4 text-[13px]">
          <Bubble side="left">{t.bookingCustomer1}</Bubble>
          <Bubble side="right">{t.bookingAi1}</Bubble>
          <Bubble side="left">{t.bookingCustomer2}</Bubble>
          <Bubble side="right">
            <span className="font-medium text-green-700">{t.bookingAi2}</span>
          </Bubble>
          <Bubble side="right" tone="promo">
            <p className="font-bold text-amber-700">{t.bookingCartTitle}</p>
            <p className="mt-0.5">{t.bookingCartText}</p>
          </Bubble>
        </div>
      </div>
    </motion.div>
  )
}

function Bubble({
  side,
  tone,
  children,
}: {
  side: "left" | "right"
  tone?: "promo"
  children: ReactNode
}) {
  const isRight = side === "right"
  const base = isRight
    ? "ml-auto rounded-tr-sm bg-[#DCF8C6]"
    : "mr-auto rounded-tl-sm bg-white"
  const promo = tone === "promo" ? "bg-amber-50" : ""
  return (
    <div
      className={`max-w-[82%] rounded-2xl px-3 py-2 text-gray-800 shadow-sm ${base} ${promo}`}
    >
      {children}
    </div>
  )
}

/** Lock-screen push-notification mock for the campaigns section. */
function PushMock({ t }: { t: BeautyCopy }) {
  return (
    <motion.div {...reveal} className="mx-auto w-full max-w-md">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-6 shadow-2xl">
        <div className="pt-6 text-center text-white">
          <p className="text-6xl font-extralight tracking-tight">11:45</p>
          <p className="mt-1 text-lg text-white/80">{t.pushDate}</p>
        </div>
        <div className="mt-10 rounded-2xl bg-white/90 p-3.5 shadow-xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500 text-xl">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">WhatsApp</p>
                <span className="text-[11px] text-gray-400">now</span>
              </div>
              <p className="text-[13px] font-semibold text-gray-800">{t.bookingBot} ✅</p>
              <p className="mt-0.5 text-[13px] leading-snug text-gray-700">{t.pushText}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/** Collapsible FAQ row. */
function FaqRow({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      {...reveal}
      transition={{ ...reveal.transition, delay: idx * 0.04 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-slate-100">{q}</span>
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
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-400">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Animated per-sede catalog loader — cycles through the centers and "loads"
// each sede's hours, services and address, so the visitor SEES that the AI
// injects the right data per location.
// ---------------------------------------------------------------------------
function SedeLoader({ t }: { t: BeautyCopy }) {
  const [active, setActive] = useState(0)
  const sedes = t.sedes

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % sedes.length), 3800)
    return () => clearInterval(id)
  }, [sedes.length])

  const s = sedes[active]

  const rowVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.45 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, x: 12 },
    show: { opacity: 1, x: 0 },
  }

  return (
    <motion.div {...reveal} className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
      {/* Sede selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {sedes.map((sede, i) => (
          <button
            key={sede.name}
            type="button"
            onClick={() => setActive(i)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors lg:w-full ${
              i === active
                ? "border-green-400/50 bg-green-400/10 text-white"
                : "border-white/10 bg-slate-900/40 text-slate-400 hover:border-white/20 hover:text-slate-200"
            }`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-green-400" />
            {sede.name}
          </button>
        ))}
      </div>

      {/* Data panel */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 lg:p-8">
        <motion.div
          key={`bar-${active}`}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute left-0 top-0 h-0.5 bg-green-400"
        />
        <div className="mb-5 flex items-center gap-2 text-xs font-medium text-green-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t.sedeLoading}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            variants={rowVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <motion.h3
              variants={itemVariants}
              className="mb-1 flex items-center gap-2 text-xl font-bold text-white"
            >
              <MapPin className="h-5 w-5 text-green-400" /> {s.name}
            </motion.h3>
            <motion.p variants={itemVariants} className="mb-5 pl-7 text-sm text-slate-400">
              {t.sedeAddressLabel}: {s.address}
            </motion.p>

            <div className="space-y-3">
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <Clock className="h-5 w-5 shrink-0 text-green-400" />
                <span className="text-sm text-slate-400">{t.sedeHoursLabel}</span>
                <span className="ml-auto font-mono font-semibold text-white">{s.hours}</span>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="mb-2 flex items-center gap-3">
                  <Tag className="h-5 w-5 shrink-0 text-green-400" />
                  <span className="text-sm text-slate-400">{t.sedeServicesLabel}</span>
                </div>
                <div className="space-y-1.5 pl-8 text-sm">
                  {s.services.map((svc) => (
                    <div key={svc.name} className="flex justify-between gap-4">
                      <span className="text-slate-300">{svc.name}</span>
                      <span className="font-mono font-semibold text-green-300">{svc.price}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
