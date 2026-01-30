/**
 * FeatureGate Component
 * Feature 185: Subscription & Billing System
 * 
 * Protects features based on plan type.
 * Shows a blurred overlay with upgrade CTA when feature is not available.
 * 
 * Usage:
 * <FeatureGate feature="ANALYTICS" fallbackPlan="PREMIUM">
 *   <AnalyticsContent />
 * </FeatureGate>
 */

import { Button } from "@/components/ui/button"
import { PLAN_CONFIGS, FEATURE_KEYS } from "@/config/planFeatures"
import { useBilling } from "@/contexts/BillingContext"
import { Lock, Sparkles } from "lucide-react"
import { ReactNode } from "react"
import { useNavigate } from "react-router-dom"

export type FeatureKey = keyof typeof FEATURE_KEYS

interface FeatureGateProps {
  /** The feature key to check (e.g., "ANALYTICS", "BRANDING") */
  feature: FeatureKey
  /** The minimum plan that includes this feature */
  requiredPlan: "BASIC" | "PREMIUM" | "ENTERPRISE"
  /** Children to render if feature is available */
  children: ReactNode
  /** Optional: Custom message to show */
  message?: string
}

/**
 * Check if a plan includes a specific feature
 */
function planHasFeature(planType: string | null, featureKey: string): boolean {
  if (!planType) return false
  
  const plan = PLAN_CONFIGS[planType]
  if (!plan) return false
  
  const feature = plan.features.find(f => f.key === featureKey)
  return feature?.included ?? false
}

/**
 * Get the display name for a plan
 */
function getPlanDisplayName(planType: string): string {
  const plan = PLAN_CONFIGS[planType]
  return plan?.name ?? planType
}

export function FeatureGate({ 
  feature, 
  requiredPlan,
  children, 
  message 
}: FeatureGateProps) {
  const { planType, isLoadingBalance } = useBilling()
  const navigate = useNavigate()
  
  const featureKey = FEATURE_KEYS[feature]
  const hasFeature = planHasFeature(planType, featureKey)
  
  // Show loading state while checking plan OR if planType not yet loaded
  if (isLoadingBalance || planType === null) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-96" />
    )
  }
  
  // User has access - render children
  if (hasFeature) {
    return <>{children}</>
  }
  
  // User doesn't have access - show upgrade overlay
  const upgradeMessage = message ?? `Upgrade to ${getPlanDisplayName(requiredPlan)} to unlock this feature`
  
  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="filter blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/90 to-white/95 flex items-start justify-center pt-16">
        <div className="text-center max-w-md px-6 py-8 bg-white/95 rounded-2xl shadow-xl border border-gray-200">
          {/* Lock Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          
          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Feature Premium
          </h3>
          
          {/* Message */}
          <p className="text-gray-600 mb-6">
            {upgradeMessage}
          </p>
          
          {/* Current plan indicator */}
          {planType && (
            <p className="text-sm text-gray-500 mb-4">
              Piano attuale: <span className="font-medium">{getPlanDisplayName(planType)}</span>
            </p>
          )}
          
          {/* CTA Button */}
          <Button 
            onClick={() => navigate("/workspace-selection?upgrade=true")}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade a {getPlanDisplayName(requiredPlan)}
          </Button>
          
          {/* Benefits hint */}
          <p className="text-xs text-gray-400 mt-4">
            Sblocca tutte le funzionalità avanzate
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check if current plan has a specific feature
 */
export function useFeatureAccess(feature: FeatureKey): {
  hasAccess: boolean
  isLoading: boolean
  planType: string | null
} {
  const { planType, isLoadingBalance } = useBilling()
  const featureKey = FEATURE_KEYS[feature]
  const hasAccess = planHasFeature(planType, featureKey)
  
  return {
    hasAccess,
    isLoading: isLoadingBalance,
    planType,
  }
}
