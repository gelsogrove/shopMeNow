import { HomeShowcase } from "@/components/HomeShowcase"
import { ProLocoPricing } from "@/components/ProLocoPricing"
import { proLocoShowcaseContent } from "@/components/ProLocoShowcaseContent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { SUPPORTED_LANGUAGES, useLanguage } from "@/contexts/LanguageContext"
import { auth } from "@/services/api"
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
  Loader2,
  MapPin,
  MessageCircle,
  Mountain,
  Phone,
  ScrollText,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import { useState } from "react"
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
  MapPin, Castle, ScrollText, Phone,
]

export default function ProLocoHomePage() {
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const t = homeCopy(language)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Same order as LoginPage: storage is cleared BEFORE the call, so a
    // failed login can never leave a previous session's workspace behind.
    storage.clearAppState()

    try {
      const response = await auth.login({ email, password })

      // A user with two-factor enabled must not be logged in here: the token
      // is issued only after the code is verified.
      if (response.data?.requires2FA) {
        navigate("/auth/verify-2fa", {
          state: {
            userId: response.data.userId,
            email: response.data.email,
            provider: "email",
          },
        })
        return
      }

      navigate("/workspace-selection")
    } catch (err: any) {
      logger.error("[ProLocoHome] login failed", err)
      // Deliberately vague: a precise message would say whether the address
      // exists, which is an account-enumeration hint.
      setError(
        err?.response?.status === 401
          ? t.errBadCredentials
          : t.errGeneric
      )
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
            <MessageCircle className="h-6 w-6 text-emerald-600" />
            <span className="font-semibold tracking-tight">eChatbot</span>
            <span className="hidden text-sm text-slate-400 lg:inline">
              {t.audience}
            </span>
          </a>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language picker — the page itself proves the multilingual
                claim it makes. Flags only on wide screens: on a phone the
                two-letter code is legible and the flags are not. */}
            <div className="hidden items-center gap-0.5 sm:flex">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  aria-label={l.name}
                  aria-current={language === l.code}
                  className={[
                    "rounded-md px-1.5 py-1 text-base transition-all",
                    language === l.code
                      ? "bg-emerald-50 ring-1 ring-emerald-200"
                      : "opacity-50 hover:opacity-100",
                  ].join(" ")}
                >
                  {l.flag}
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
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <p className="text-emerald-700 font-medium text-sm mb-4">
              {t.eyebrow}
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] text-slate-900">
              {t.slogan1}
              <br />
              <span className="text-emerald-700">{t.slogan2}</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
              {t.lede}
            </p>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-emerald-600" /> {t.chipMulti}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" /> {t.chip24}
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600" /> {t.chipNoApp}
              </span>
            </div>
          </div>

          {/* ── Login form, on the page ──────────────────────────── */}
          <div id="accedi" className="lg:pl-8">
            <div className="rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                {t.loginTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t.loginSub}
              </p>

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@proloco.it"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t.loginLoading}
                    </>
                  ) : (
                    t.loginCta
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="w-full text-center text-sm text-slate-500 hover:text-emerald-700 transition-colors"
                >
                  {t.forgot}
                </button>
              </form>
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
      <section className="border-t border-slate-100">
        <HomeShowcase lang="it" content={proLocoShowcaseContent} />
      </section>

      {/* ── Benefits ─────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center">
            {t.benefitsTitle}
          </h2>
          <p className="mt-3 text-center text-slate-600 max-w-2xl mx-auto">
            {t.benefitsSub}
          </p>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i]
              return (
                <div key={b.title} className="group">
                  <Icon className="h-6 w-6 text-emerald-600 transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="mt-4 font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{b.body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── What you can load ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {t.contentTitle}
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              {t.contentBody1}
            </p>
            <p className="mt-4 text-slate-600 leading-relaxed">
              {t.contentBody2}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {t.contentTypes.map((label, i) => {
              const Icon = CONTENT_ICONS[i]
              return (
                <div
                  key={label}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50/40 hover:shadow-sm"
                >
                  <Icon className="h-5 w-5 text-emerald-600 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="text-sm text-slate-700">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing, straight from the database ──────────────────── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
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
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-emerald-700 font-medium text-sm mb-3">
              {t.revenueEyebrow}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
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

      {/* ── Closing ──────────────────────────────────────────────── */}
      <section className="border-t border-slate-100">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t.closingTitle}
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            {t.closingBody}
          </p>
          <a
            href="#accedi"
            className="mt-8 inline-flex items-center gap-1.5 text-emerald-700 font-medium hover:gap-2.5 transition-all"
          >
            {t.closingCta}
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-400">
          {t.footer}
        </div>
      </footer>
    </div>
  )
}
