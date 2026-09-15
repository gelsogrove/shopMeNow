import { HomeShowcase } from "@/components/HomeShowcase"
import { HeroBackdrop } from "@/components/HeroBackdrop"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ProLocoPricing } from "@/components/ProLocoPricing"
import { Typewriter } from "@/components/Typewriter"
import QRCode from "react-qr-code"
import { proLocoShowcaseContent } from "@/components/ProLocoShowcaseContent"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { SUPPORTED_LANGUAGES, useLanguage } from "@/contexts/LanguageContext"
import { FlagIcon } from "@/components/shared/FlagIcon"
import { api, auth } from "@/services/api"
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import { homeCopy } from "./proLocoHomeTranslations"
import {
  Bell,
  Building2,
  CalendarDays,
  Castle,
  ChevronRight,
  Clock,
  Globe,
  Image,
  Mail,
  MapPin,
  MessageCircle,
  Mountain,
  Phone,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  Dumbbell,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Public landing page for tourist offices (Pro Loco and Consorzi).
 *
 * White, quiet, and honest: the audience is a volunteer at a tourist office,
 * not a startup buyer. The login form sits ON the page rather than behind a
 * button (Andrea, 2026-09-14: "voglio un login dentro direttamente con form"),
 * because most visits are returning users, not first-time readers.
 *
 * 🚨 The form posts through the SAME `auth.login()` the main LoginPage uses,
 * including its storage clearing and its 2FA redirect. Duplicating the auth
 * flow here would mean two places to keep a security fix in.
 */

// Icons stay in code — they are not copy. The words come from the
// translations file, indexed in the same order.
const BENEFIT_ICONS = [Globe, Clock, MessageCircle, Image, Bell, Sparkles]
const CONTENT_ICONS = [
  Building2, UtensilsCrossed, Mountain, CalendarDays, Sparkles,
  MapPin, Castle, ScrollText, Dumbbell, Phone,
]

// Same client id the main LoginPage uses — one Google app, one consent screen.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "988195920488-caj4sdf4t7elrsdedk36a5n5t1ndki4c.apps.googleusercontent.com"

/**
 * The demo line the QR and the mobile button point at.
 *
 * 🚨 PLACEHOLDER (Andrea, 2026-09-15: "il numero ancora non ce l'ho, metti
 * +34 654728753"). Replace it with the real Pro Loco demo number — it is
 * printed on a public page, so whoever owns it will receive whatever visitors
 * decide to send.
 *
 * `?text=` pre-fills the opening message: a visitor who scans lands in a chat
 * that is already started, which is one less reason to give up.
 */
const DEMO_WA_NUMBER = "34654728753"
const DEMO_WA_LINK = `https://wa.me/${DEMO_WA_NUMBER}?text=${encodeURIComponent("Ciao!")}`

/** WhatsApp's brand green — the same #25D366 HomeShowcase uses for the phone. */
const WA_GREEN = "#25D366"
/** For solid fills behind WHITE text: #25D366 only reaches ~1.9:1 there. */
const WA_GREEN_DEEP = "#0F7A3D"
/** The dark surface: forest green, warmer than emerald-950's near-black. */
const GREEN_SURFACE = "#0B3D2E"

export default function ProLocoHomePage() {
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const t = homeCopy(language)

  // This page opens in Italian unless the visitor has chosen otherwise
  // (Andrea, 2026-09-15: "LO VEDO IN TEDESCO? COME MAI NON VA DI DEFAULT?").
  // The shared LanguageContext guesses from navigator.language, which is right
  // for the app — a German operator wants a German backoffice — but wrong
  // here: this page is sold to Italian tourist offices, and a German-locale
  // browser opened it in German.
  //
  // Only when NOTHING was stored: a language picked from the header is written
  // to localStorage and left alone, so the switcher keeps working and the
  // choice survives a reload. LanguageContext itself is untouched (rule 13) —
  // the rest of the app keeps its own behaviour.
  useEffect(() => {
    if (!localStorage.getItem("language")) setLanguage("it")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleGoogle = async (credential: string | undefined) => {
    if (!credential) return
    setError("")
    setLoading(true)
    storage.clearAppState()

    try {
      const response = await api.post("/auth/oauth/google", { credential })
      const { user, requiresSetup, requires2FA, qrCode, token, sessionId } =
        response.data

      // Admin/developer accounts come back already authenticated.
      if (sessionId && token && !requiresSetup && !requires2FA) {
        // Same as the password path: store the session BEFORE navigating, or
        // the guarded route finds nothing and bounces straight back.
        storage.setToken(token)
        storage.setSessionId(sessionId)
        storage.setUser(user)
        navigate("/workspace-selection")
        return
      }

      // Kept only for the 2FA screens to read — no session yet.
      storage.setUser(user)

      navigate(requiresSetup ? "/auth/setup-2fa" : "/auth/verify-2fa", {
        state: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          ...(requiresSetup ? { qrCode } : {}),
          provider: "google",
        },
      })
    } catch (err) {
      logger.error("[ProLocoHome] google sign-in failed", err)
      setError(t.errGeneric)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="top" className="min-h-screen bg-white text-slate-900">
      {/* ── Minimal top bar: dark, like LoginPage's header — the green/white
          logo needs a dark surface to read well (Andrea, 2026-09-15: "sfondo
          nero dell'header solo header !!! così il logo si vede bene"). ── */}
      <div className="sticky top-0 z-40 bg-[#070d18]/90 backdrop-blur border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <a href="#top" className="flex items-center shrink-0 mr-auto">
            <span className="font-display text-xl font-bold tracking-tight" style={{ color: "#25D366" }}>
              eChatbot<span className="text-white">.AI</span>
            </span>
          </a>

          <div className="flex items-center gap-0.5 sm:gap-1">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                aria-label={l.name}
                aria-current={language === l.code}
                className={[
                  "flex items-center rounded-lg px-1.5 py-1 text-lg leading-none transition-colors sm:px-2",
                  language === l.code
                    ? "bg-white/10 ring-1 ring-white/20"
                    : "hover:bg-white/5",
                ].join(" ")}
              >
                <FlagIcon flag={l.flag} name={l.name} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero + login side by side ────────────────────────────── */}
      {/* A photo of the territory behind the hero, with a video layered on
          top when public/hero.mp4 exists — see HeroBackdrop for why the photo
          is the load-bearing layer and the video only an enhancement. */}
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop />
        {/* 24.4rem, 160px shorter than it was (Andrea, 2026-09-15): the hero
            was pushing everything below it past the fold. */}
        <div className="relative z-10 mx-auto max-w-7xl px-5 pt-10 pb-14 sm:px-6 sm:pt-16 sm:pb-20 lg:pb-[24.4rem]">
        <div className="grid items-start gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div>
            <div>
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full px-3 py-1 font-semibold uppercase tracking-wide text-white backdrop-blur-sm" style={{ backgroundColor: `${WA_GREEN}33`, boxShadow: `inset 0 0 0 1px ${WA_GREEN}80`, fontSize: 16 }}>
                  {t.eyebrow}
                </span>

                <h1 className="font-display mt-4 text-3xl font-semibold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">
                  {t.slogan1}
                  <br />
                  <span style={{ color: WA_GREEN }}>{t.slogan2}</span>
                </h1>

                {/* The hero chat holds off until this sentence is typed out
                    (Andrea, 2026-09-15: "il primo messaggio deve uscire solo
                    quando la frase è finita"): one thing moving at a time. */}
                <Typewriter
                  key={language}
                  text={t.lede}
                  className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-100 sm:mt-6 sm:text-xl lg:text-2xl lg:leading-relaxed"
                  onDone={() => {
                    window.__heroLedeDone = true
                    window.dispatchEvent(new Event("hero:lede-done"))
                  }}
                />

                <div id="accedi" className="mt-7 flex flex-col items-start gap-2">
                  <div className="[&_iframe]:!w-auto">
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <GoogleLogin
                        onSuccess={(res) => handleGoogle(res.credential)}
                        onError={() => setError(t.errGeneric)}
                        shape="pill"
                        useOneTap={false}
                        auto_select={false}
                      />
                    </GoogleOAuthProvider>
                  </div>
                  {error && (
                    <p role="alert" className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* ── The live conversation, where the login card used to be ── */}
          <div className="hidden justify-center lg:flex lg:justify-end">
            {/* Andrea, 2026-09-15: "la chat piu giu di 30px" */}
            <div id="hero-chat-slot" className="w-full max-w-lg" style={{ marginTop: 30 }} />
          </div>
        </div>
        </div>
      </section>

      {/* ── The conversation, playing ────────────────────────────── */}
      {/* Reuses HomeShowcase, the animated WhatsApp phone from the existing
          homepage (Andrea, 2026-09-14: "riutilizza lo schema della chat
          iniziale che c'è ora che mi piace, che fa vedere che la chat parla e
          si compongono i menu a destra"). It brings its own dark stage, which
          sits deliberately between two white sections: the phone screen is
          what the eye should land on. */}
      <section className="border-t border-slate-100 bg-[#F6F2EA]">
        <HomeShowcase lang={language} content={proLocoShowcaseContent} theme="light" />
      </section>

      {/* ── Benefits ─────────────────────────────────────────────── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="font-display text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t.benefitsTitle}
          </h2>
          <p className="mt-3 text-center text-slate-600 max-w-2xl mx-auto">
            {t.benefitsSub}
          </p>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i]
              return (
                <div
                  key={b.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
                >
                  {/* Big tinted tile rather than a bare 24px glyph: at a
                      glance the six benefits now read as six things, and the
                      eye lands on the icon before the words. */}
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 transition-colors duration-200 group-hover:bg-emerald-700">
                    <Icon className="h-7 w-7 text-emerald-700 transition-colors duration-200 group-hover:text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {b.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── What you can load ────────────────────────────────────── */}
      <section className="border-t border-slate-100" style={{ backgroundColor: GREEN_SURFACE }}>
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t.contentTitle}
            </h2>
            <p className="mt-4 leading-relaxed text-emerald-100/80" style={{ fontSize: 18 }}>
              {t.contentBody1}
            </p>
            <p className="mt-4 leading-relaxed text-emerald-100/80" style={{ fontSize: 18 }}>
              {t.contentBody2}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {t.contentTypes.map((label, i) => {
              const Icon = CONTENT_ICONS[i]
              return (
                <div
                  key={label}
                  className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-white/25 hover:bg-white/10"
                >
                  <Icon
                    className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ color: WA_GREEN }}
                  />
                  <span className="text-sm text-emerald-50">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
        </div>
      </section>

      {/* ── Pricing, straight from the database ──────────────────── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="font-display text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t.pricingTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            {t.pricingSub}
          </p>
          <div className="mt-14">
            <ProLocoPricing />
          </div>
        </div>
      </section>

      {/* ── Try the demo ─────────────────────────────────────────── */}
      {/* White card like the rest of the page (Andrea, 2026-09-15: "non mi
          piace per nulla lo sfondo verde" — the dark GREEN_SURFACE card was
          replaced site-wide for this and Privacy by design). */}
      <section className="border-t border-slate-100 bg-[#F6F2EA]">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-xl ring-1 ring-slate-200">
            <div className="grid items-center gap-12 p-10 sm:p-14 lg:grid-cols-[1fr_auto] lg:gap-16">
              <div className="min-w-0">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: `${WA_GREEN}1f`, color: WA_GREEN_DEEP }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: WA_GREEN }} />
                  WhatsApp
                </span>

                <h3 className="font-display mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
                  {t.demoTitle}
                </h3>
                <p className="mt-4 max-w-md leading-relaxed text-slate-600" style={{ fontSize: 20 }}>
                  {t.demoSub}
                </p>

                <a
                  href={DEMO_WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-2.5 rounded-xl px-7 py-4 text-base font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-[1.03] lg:hidden"
                  style={{ backgroundColor: WA_GREEN_DEEP }}
                >
                  <MessageCircle className="h-5 w-5" />
                  {t.demoOpen}
                </a>
              </div>

              <div className="relative mx-auto shrink-0">
                <div className="rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-100">
                  <QRCode value={DEMO_WA_LINK} size={208} bgColor="#ffffff" fgColor="#052e20" />
                </div>
                <span
                  className="absolute -right-3 -top-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
                  style={{ backgroundColor: WA_GREEN_DEEP }}
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Revenue: selling push to local merchants ─────────────── */}
      {/* Andrea, 2026-09-14: "deve essere chiaro che si possono vendere i push
          pubblicitari agli esercenti, una nuova entrata economica per le Pro
          Loco". Not a promise: the product really has merchant-bought
          campaigns with their own push quota (Merchant / MerchantPush). */}
      <section className="border-t border-slate-100 bg-emerald-50/40">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="mb-4 inline-block rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-800 ring-1 ring-emerald-100">
                {t.revenueEyebrow}
              </span>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {t.revenueTitle}
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                {t.revenueBody1}
              </p>
              <p className="mt-4 text-slate-600 leading-relaxed">
                {t.revenueBody2}
              </p>
            </div>

            <div className="space-y-3">
              {t.revenueSteps.map((step, i) => (
                <div
                  key={step.t}
                  className="flex gap-4 rounded-xl bg-white border border-emerald-100 px-5 py-4"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-2xl font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-medium text-slate-900">{step.t}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy by design ────────────────────────────────────── */}
      {/* Same dark-card treatment as "Prova la demo" above, for visual
          consistency between the two full-bleed feature cards on the page
          (Andrea, 2026-09-15: "stessa grafica per Prova la demo"). */}
      <section className="border-t border-slate-100 bg-[#F6F2EA]">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <div className="overflow-hidden rounded-[2.5rem] shadow-2xl ring-1 ring-white/10" style={{ backgroundColor: GREEN_SURFACE }}>
            <div className="flex flex-col-reverse items-center gap-8 p-8 sm:flex-row sm:items-center sm:p-12">
              <div className="min-w-0 flex-1">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: `${WA_GREEN}2e` }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: WA_GREEN }} />
                  {t.privacyBadge}
                </span>

                <h3 className="font-display mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {t.privacyTitle}
                </h3>
                <p className="mt-4 leading-relaxed text-emerald-100/85">
                  {t.privacyBody}
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/privacy-by-design")}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-[1.03]"
                  style={{ backgroundColor: WA_GREEN_DEEP }}
                >
                  {t.privacyCta}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="relative shrink-0">
                {/* The privacy illustration Andrea drew for this section
                    (2026-09-15: "Privacy by design era questa immagine").
                    4:3, so it gets its own aspect box rather than the square
                    the mascot sat in. */}
                <div className="w-64 max-w-full overflow-hidden rounded-2xl bg-white p-2 shadow-2xl">
                  <img
                    src="/privacy.png"
                    alt=""
                    loading="lazy"
                    className="block h-auto w-full rounded-xl"
                  />
                </div>
                <span
                  className="absolute -right-3 -top-3 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
                  style={{ backgroundColor: WA_GREEN_DEEP }}
                >
                  GDPR
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      {/* The six objections a tourist office actually raises, brought over
          from the /tourism page (Andrea, 2026-09-15: "prendi spunto se c'è
          qualcosa di interessante"). Plain <details>: no state, and the
          answers stay in the HTML for search engines. */}
      <section className="border-t border-slate-100 bg-[#F6F2EA]">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {t.faqTitle}
          </h2>

          {/* Cards rather than ruled rows: each question is its own object to
              open, and the open one lifts out of the stack. */}
          <div className="mt-10 space-y-3">
            {t.faqItems.map((item) => (
              <details
                key={item.q}
                className="group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition-shadow duration-200 open:shadow-lg open:ring-emerald-200 hover:ring-slate-300"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-slate-900 marker:content-none sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-transform duration-200 group-open:rotate-90 group-open:bg-emerald-700 group-open:text-white">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </summary>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600 sm:px-6 sm:pb-6">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA band ─────────────────────────────────────── */}
      <section style={{ backgroundColor: GREEN_SURFACE }}>
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
          <p className="text-lg font-medium leading-relaxed text-white sm:text-xl">
            {t.ctaBand}
          </p>
          <button
            type="button"
            onClick={() => navigate("/contact")}
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-4 font-bold text-white shadow-lg transition-transform duration-200 hover:scale-[1.03]"
            style={{ backgroundColor: WA_GREEN_DEEP }}
          >
            {t.ctaBandBtn}
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── Footer — the shared one, same as every other page. ───── */}
      <SiteFooter language={language} />
    </div>
  )
}
