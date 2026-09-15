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

/** Icon per plan for a tourist office, not for a shop. */
const PITCH: Record<string, { icon: typeof Star }> = {
  FREE_TRIAL: { icon: Gift },
  BASIC: { icon: Sparkles },
  PREMIUM: { icon: Star },
  ENTERPRISE: { icon: Server },
}

/** The usage line under the plans, as [before, between, after] text around the two cost figures so they can be styled on their own. */
const USAGE: Record<string, [string, string, string]> = {
  it: ["Consumi a parte: ", " a messaggio · ", " a notifica push. Si paga solo quello che si usa."],
  en: ["Usage billed separately: ", " per message · ", " per push notification. You pay only for what you use."],
  es: ["Consumos aparte: ", " por mensaje · ", " por notificación push. Se paga solo lo que se usa."],
  ca: ["Consums a part: ", " per missatge · ", " per notificació push. Es paga només el que es fa servir."],
  fr: ["Consommation à part : ", " par message · ", " par notification push. Vous ne payez que ce que vous utilisez."],
  de: ["Verbrauch separat: ", " pro Nachricht · ", " pro Push-Nachricht. Sie zahlen nur, was Sie nutzen."],
}

/** Button labels per language — the component had Italian literals only. */
const CTA_SIGNUP: Record<string, string> = {
  it: "Registrati", en: "Sign up", es: "Regístrate",
  ca: "Registra't", fr: "Inscrivez-vous", de: "Registrieren",
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

              <h3 className="text-lg font-semibold text-slate-900">
                {plan.displayName}
              </h3>

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

              {/* The free plan is the only one you can start on your own, so
                  it is the only one with a button: it goes to the sign-up
                  wizard, which really does create the account. The paid plans
                  are read, not clicked (Andrea, 2026-09-15: "togli richiedi
                  informazioni alle colonne basic, premium, enterprise") — the
                  page already closes with one contact band, and nothing here
                  can take a payment anyway. */}
              {plan.planType === "FREE_TRIAL" && (
                <a
                  href="/onboarding"
                  className="mt-7 block rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  {CTA_SIGNUP[language] ?? CTA_SIGNUP.it}
                </a>
              )}
            </div>
          )
        })}
      </div>

      {/* Usage costs, from the same rows — the numbers the system really bills.
          Andrea, 2026-09-15: the two cost figures are 3px bigger and bold so
          they stand out from the surrounding sentence. */}
      {perMessage !== undefined && (() => {
        const [before, between, after] = USAGE[language] ?? USAGE.it
        return (
          <p className="mt-8 text-center text-sm text-slate-500">
            {before}
            <span className="font-bold" style={{ fontSize: "17px" }}>{usd(perMessage)}</span>
            {between}
            <span className="font-bold" style={{ fontSize: "17px" }}>{usd(perPush!)}</span>
            {after}
          </p>
        )
      })()}
    </div>
  )
}
