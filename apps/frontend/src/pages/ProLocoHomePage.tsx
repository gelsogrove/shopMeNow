import { HomeShowcase } from "@/components/HomeShowcase"
import { HeroBackdrop } from "@/components/HeroBackdrop"
import HeroRobot from "@/components/landing/HeroRobot"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { ProLocoPricing } from "@/components/ProLocoPricing"
import { Typewriter } from "@/components/Typewriter"
import QRCode from "react-qr-code"
import { proLocoShowcaseContent } from "@/components/ProLocoShowcaseContent"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { SUPPORTED_LANGUAGES, useLanguage } from "@/contexts/LanguageContext"
import { api, auth } from "@/services/api"
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import { homeCopy } from "./proLocoHomeTranslations"
import {
  Bell,
  Building2,
  CalendarDays,
  Castle,
  ClipboardList,
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
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <a href="#top" className="flex items-center gap-2 shrink-0">
            <MessageCircle className="h-6 w-6 text-emerald-700" />
            <span className="font-display text-lg font-bold tracking-tight text-emerald-800">
              eChatbot<span className="text-slate-400">.AI</span>
            </span>
            <span className="hidden text-sm text-slate-500 lg:inline">
              {t.audience}
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-slate-600 lg:flex">
            {[
              { to: "/features", label: t.navFeatures },
              { to: "/human-support", label: t.navHuman },
              { to: "/smart-push-ai", label: t.navPush },
              { to: "/tourism", label: t.navTourism },
            ].map((l) => (
              <button
                key={l.to}
                type="button"
                onClick={() => navigate(l.to)}
                className="transition-colors duration-200 hover:text-emerald-800"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language picker — the page itself proves the multilingual
                claim it makes. Two controls, one per size: a native select on
                phones (one tap, no horizontal room) and the flag row from sm
                up, where six targets fit and read. */}
            <label className="sm:hidden">
              <span className="sr-only">{language}</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="hidden items-center gap-0.5 sm:flex">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  aria-label={l.name}
                  aria-current={language === l.code}
                  className={[
                    "rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors duration-200",
                    language === l.code
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                >
                  {l.code}
                </button>
              ))}
            </div>

            <a
              href="#accedi"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              {t.loginCta}
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero + login side by side ────────────────────────────── */}
      {/* A photo of the territory behind the hero, with a video layered on
          top when public/hero.mp4 exists — see HeroBackdrop for why the photo
          is the load-bearing layer and the video only an enhancement. */}
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop />
        <div className="relative z-10 mx-auto max-w-7xl px-5 pt-10 pb-14 sm:px-6 sm:pt-16 sm:pb-20 lg:pb-[34.4rem]">
        <div className="grid items-start gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div>
            {/* The mascot used to sit here, beside the headline. It moved to
                the questions section below (Andrea, 2026-09-15: "robottino
                mettilo sotto 'Ogni giorno, le stesse'"), where it introduces
                the questions it is the one answering instead of competing with
                the headline for the same width. */}
            <div>
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm" style={{ backgroundColor: `${WA_GREEN}33`, boxShadow: `inset 0 0 0 1px ${WA_GREEN}80` }}>
                  {t.eyebrow}
                </span>

                <h1 className="font-display mt-4 text-3xl font-semibold leading-[1.1] tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">
                  {t.slogan1}
                  <br />
                  <span style={{ color: WA_GREEN }}>{t.slogan2}</span>
                </h1>

                <Typewriter
                  key={language}
                  text={t.lede}
                  className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-100 sm:mt-6 sm:text-xl lg:text-2xl lg:leading-relaxed"
                />

                <div id="accedi" className="mt-7 flex flex-col items-start gap-2">
                  <div className="[&_iframe]:!w-auto">
                    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                      <GoogleLogin
                        onSuccess={(res) => handleGoogle(res.credential)}
                        onError={() => setError(t.errGeneric)}
                        shape="pill"
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
            <div id="hero-chat-slot" className="w-full max-w-lg" />
          </div>
        </div>
        </div>
      </section>

      {/* ── The questions they answer every day ─────────────────── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t.closingTitle}
          </h2>

          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:flex-row sm:gap-8 sm:p-7 sm:text-left">
            <div className="relative shrink-0">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <QRCode value={DEMO_WA_LINK} size={130} bgColor="#ffffff" fgColor="#0f172a" />
              </div>
              <span
                className="absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow"
                style={{ backgroundColor: WA_GREEN }}
              >
                Live
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <HeroRobot className="w-14 shrink-0 [&_img]:w-full [&_img]:h-auto" />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#047857" }}>
                    WhatsApp
                  </span>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    {t.demoTitle}
                  </h3>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {t.demoSub}
              </p>

              <a
                href={DEMO_WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform duration-200 hover:scale-[1.03] lg:hidden"
                style={{ backgroundColor: WA_GREEN }}
              >
                <MessageCircle className="h-4 w-4" />
                {t.demoOpen}
              </a>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-slate-600 leading-relaxed">
            {t.closingBody}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <a
              href="#accedi"
              className="inline-flex items-center gap-1.5 font-medium text-emerald-800 transition-all hover:gap-2.5"
            >
              {t.closingCta}
              <ChevronRight className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={() => navigate("/contact")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-emerald-800"
            >
              <Mail className="h-4 w-4" />
              {t.infoCta}
            </button>
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
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
                >
                  {/* Big tinted tile rather than a bare 24px glyph: at a
                      glance the six benefits now read as six things, and the
                      eye lands on the icon before the words. */}
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 transition-colors duration-200 group-hover:bg-emerald-600">
                    <Icon className="h-7 w-7 text-emerald-600 transition-colors duration-200 group-hover:text-white" />
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
      <section className="border-t border-slate-100 bg-emerald-950">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t.contentTitle}
            </h2>
            <p className="mt-4 leading-relaxed text-emerald-100/80">
              {t.contentBody1}
            </p>
            <p className="mt-4 leading-relaxed text-emerald-100/80">
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

      {/* ── Revenue: selling push to local merchants ─────────────── */}
      {/* Andrea, 2026-09-14: "deve essere chiaro che si possono vendere i push
          pubblicitari agli esercenti, una nuova entrata economica per le Pro
          Loco". Not a promise: the product really has merchant-bought
          campaigns with their own push quota (Merchant / MerchantPush). */}
      <section className="border-t border-slate-100 bg-emerald-50/40">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-emerald-700 font-medium text-sm mb-3">
              {t.revenueEyebrow}
              </p>
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
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
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
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-start sm:gap-8">
              <div className="shrink-0 rounded-2xl border border-slate-200 bg-emerald-50/50 p-4 shadow-sm">
                <ShieldCheck className="h-24 w-24" style={{ color: WA_GREEN }} strokeWidth={1.3} />
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${WA_GREEN}1f`, color: "#047857" }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t.privacyBadge}
                </span>

                <h3 className="font-display mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {t.privacyTitle}
                </h3>
                <p className="mt-3 leading-relaxed text-slate-600">
                  {t.privacyBody}
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/privacy-by-design")}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-[1.03]"
                  style={{ backgroundColor: WA_GREEN }}
                >
                  {t.privacyCta}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Survey ───────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-[#F6F2EA]">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
          <span className="inline-block rounded-full bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-800">
            {t.surveyEyebrow}
          </span>
          <h2 className="font-display mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t.surveyTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-600">
            {t.surveyBody}
          </p>
          <button
            type="button"
            onClick={() => navigate("/survey")}
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-white shadow-lg transition-colors duration-200"
            style={{ backgroundColor: WA_GREEN }}
          >
            <ClipboardList className="h-5 w-5" />
            {t.surveyCta}
          </button>
        </div>
      </section>

      {/* ── Closing CTA band ─────────────────────────────────────── */}
      <section className="bg-emerald-950">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-20">
          <p className="text-lg font-medium leading-relaxed text-white sm:text-xl">
            {t.ctaBand}
          </p>
          <button
            type="button"
            onClick={() => navigate("/contact")}
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-8 py-4 font-bold text-white shadow-lg transition-transform duration-200 hover:scale-[1.03]"
            style={{ backgroundColor: WA_GREEN }}
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
