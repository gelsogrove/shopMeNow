import { useLanguage } from "@/contexts/LanguageContext"
import { api } from "@/services/api"
import { Check, Gift, Loader2, Server, Sparkles, Star } from "lucide-react"
import { useEffect, useState } from "react"

interface Plan {
  planType: string
  displayName: string
  monthlyFee: number
  features: string[]
  messageCost: number
  pushCost: number
}

/** Copy that frames each plan for a tourist office, not for a shop. */
const PITCH: Record<string, { tagline: Record<string, string>; icon: typeof Star }> = {
  FREE_TRIAL: {
    tagline: {
      it: "Il piano Basic, per 14 giorni", en: "The Basic plan, for 14 days",
      es: "El plan Basic, 14 días", ca: "El pla Basic, 14 dies",
      fr: "Le plan Basic, 14 jours", de: "Der Basic-Plan, 14 Tage",
    },
    icon: Gift,
  },
  BASIC: {
    tagline: {
      it: "Il territorio risponde, senza scadenza", en: "Your area answers, with no end date",
      es: "El territorio responde, sin caducidad", ca: "El territori respon, sense caducitat",
      fr: "Votre territoire répond, sans échéance", de: "Ihre Region antwortet, ohne Ablaufdatum",
    },
    icon: Sparkles,
  },
  PREMIUM: {
    tagline: {
      it: "Ogni lingua, e i dati per capire i vostri turisti",
      en: "Every language, plus the data to understand your visitors",
      es: "Todos los idiomas y los datos para entender a vuestros turistas",
      ca: "Totes les llengües i les dades per entendre els vostres turistes",
      fr: "Toutes les langues, et les données pour comprendre vos visiteurs",
      de: "Jede Sprache und die Daten, um Ihre Gäste zu verstehen",
    },
    icon: Star,
  },
  ENTERPRISE: {
    tagline: {
      it: "Server dedicato, solo per il vostro ente", en: "A dedicated server, yours alone",
      es: "Servidor dedicado, solo para vuestra entidad", ca: "Servidor dedicat, només per a vosaltres",
      fr: "Serveur dédié, rien que pour vous", de: "Dedizierter Server, nur für Sie",
    },
    icon: Server,
  },
}

/** The usage line under the plans. */
const USAGE: Record<string, (m: string, p: string) => string> = {
  it: (m, p) => `Consumi a parte: ${m} a messaggio · ${p} a notifica push. Si paga solo quello che si usa.`,
  en: (m, p) => `Usage billed separately: ${m} per message · ${p} per push notification. You pay only for what you use.`,
  es: (m, p) => `Consumos aparte: ${m} por mensaje · ${p} por notificación push. Se paga solo lo que se usa.`,
  ca: (m, p) => `Consums a part: ${m} per missatge · ${p} per notificació push. Es paga només el que es fa servir.`,
  fr: (m, p) => `Consommation à part : ${m} par message · ${p} par notification push. Vous ne payez que ce que vous utilisez.`,
  de: (m, p) => `Verbrauch separat: ${m} pro Nachricht · ${p} pro Push-Nachricht. Sie zahlen nur, was Sie nutzen.`,
}

/** Button labels per language — the component had Italian literals only. */
const CTA_SIGNUP: Record<string, string> = {
  it: "Registrati", en: "Sign up", es: "Regístrate",
  ca: "Registra't", fr: "Inscrivez-vous", de: "Registrieren",
}
const CTA_INFO: Record<string, string> = {
  it: "Richiedi informazioni", en: "Request information", es: "Solicitar información",
  ca: "Demana informació", fr: "Demander des informations", de: "Informationen anfordern",
}

/** The plan highlighted as recommended. */
const FEATURED = "PREMIUM"

const usd = (n: number) =>
  n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`

/**
 * The plans, read from the DATABASE — never hardcoded (CLAUDE.md §1).
 *
 * The same `/api/subscription/plans` the billing pages use, so a price shown
 * here can never drift from the price actually charged — including the usage
 * costs printed underneath.
 */
export function ProLocoPricing() {
  const { language } = useLanguage()
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get("/subscription/plans")
      .then((res) => {
        if (cancelled) return
        const all: Plan[] = res.data?.data ?? []
        // FREE_TRIAL included (Andrea, 2026-09-14: "manca il free"): for a
        // volunteer-run tourist office, "try it, nothing to pay" is the entry
        // point — hiding it made the cheapest visible option the paid plan.
        setPlans(all.sort((a, b) => a.monthlyFee - b.monthlyFee))
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return null // A pricing table that failed to load is worse than none.

  if (!plans) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  const perMessage = plans[0]?.messageCost
  const perPush = plans[0]?.pushCost

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
        {plans.map((plan) => {
          const featured = plan.planType === FEATURED
          const pitch = PITCH[plan.planType]
          const Icon = pitch?.icon ?? Sparkles

          return (
            <div
              key={plan.planType}
              className={[
                "group relative flex flex-col rounded-2xl border p-7 transition-all duration-200",
                // Lift on hover — the whole card is the affordance.
                "hover:-translate-y-1 hover:shadow-xl",
                featured
                  ? "border-emerald-500 bg-white shadow-lg md:-mt-4 md:mb-4"
                  : "border-slate-200 bg-white hover:border-emerald-300",
              ].join(" ")}
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Il più scelto
                </span>
              )}

              <div
                className={[
                  "mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                  featured
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="text-lg font-semibold text-slate-900">
                {plan.displayName}
              </h3>
              <p className="mt-1 min-h-[2.5rem] text-sm text-slate-500">
                {pitch?.tagline[language] ?? pitch?.tagline.it}
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {usd(plan.monthlyFee)}
                </span>
                {plan.monthlyFee > 0 && (
                  <span className="text-sm text-slate-500">/ mese</span>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* The free plan is the one you can start on your own: it goes
                  to the sign-up wizard, which really does create the account
                  (/auth/register). The paid plans stay a conversation —
                  nothing on this page can take a payment yet. */}
              <a
                href={plan.planType === "FREE_TRIAL" ? "/onboarding" : "#contatti"}
                className={[
                  "mt-7 block rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors",
                  plan.planType === "FREE_TRIAL"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : featured
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-200 text-slate-700 hover:border-emerald-600 hover:text-emerald-700",
                ].join(" ")}
              >
                {plan.planType === "FREE_TRIAL"
                  ? (CTA_SIGNUP[language] ?? CTA_SIGNUP.it)
                  : (CTA_INFO[language] ?? CTA_INFO.it)}
              </a>
            </div>
          )
        })}
      </div>

      {/* Usage costs, from the same rows — the numbers the system really bills. */}
      {perMessage !== undefined && (
        <p className="mt-8 text-center text-sm text-slate-500">
          {(USAGE[language] ?? USAGE.it)(usd(perMessage), usd(perPush!))}
        </p>
      )}
    </div>
  )
}
