/**
 * Billing Page
 * Feature 185: Subscription & Billing System
 *
 * Dedicated page for billing management:
 * - Current plan info
 * - Credit balance with recharge
 * - Usage stats
 * - Transaction history
 * - Upgrade options
 *
 * Accessible via header credit display click
 */

import { PageLayout } from "@/components/layout/PageLayout"
import { BillingSection } from "@/components/billing/BillingSection"
import { useLanguage } from "@/contexts/LanguageContext"

export default function BillingPage() {
  const { t } = useLanguage()

  return (
    <PageLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("billing.pageTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("billing.pageDescription")}
          </p>
        </div>
        
        <BillingSection />
      </div>
    </PageLayout>
  )
}
