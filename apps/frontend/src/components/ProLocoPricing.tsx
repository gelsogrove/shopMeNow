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
const PITCH: Record<string, { tagline: string; icon: typeof Star }> = {
  FREE_TRIAL: {
    tagline: "Il piano Basic, per 14 giorni",
    icon: Gift,
  },
  BASIC: {
    tagline: "Il territorio risponde, senza scadenza",
    icon: Sparkles,
  },
  PREMIUM: {
    tagline: "Ogni lingua, e i dati per capire i vostri turisti",
    icon: Star,
  },
  ENTERPRISE: {
    tagline: "Server dedicato, solo per il vostro ente",
    icon: Server,
  },
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
                {pitch?.tagline}
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
                  ? "Inizia gratis"
                  : "Richiedi informazioni"}
              </a>
            </div>
          )
        })}
      </div>

      {/* Usage costs, from the same rows — the numbers the system really bills. */}
      {perMessage !== undefined && (
        <p className="mt-8 text-center text-sm text-slate-500">
          Consumi a parte: {usd(perMessage)} a messaggio ·{" "}
          {usd(perPush!)} a notifica push. Si paga solo quello che si usa.
        </p>
      )}
    </div>
  )
}
