/**
 * Test: Plan Features Configuration
 * 
 * SCENARIO: Verify that plan features are correctly configured
 * RULE: Analytics feature should only be available for PREMIUM and ENTERPRISE plans
 * RULE: BASIC and FREE_TRIAL should NOT have Analytics access
 */

import { describe, it, expect } from "vitest"
import {
  PLAN_CONFIGS_FALLBACK,
  buildPlanConfigsFromApi,
  FEATURE_KEYS,
} from "@/config/planFeatures"
import { PlanInfo } from "@/services/subscriptionBillingApi"

describe("planFeatures - Configuration", () => {
  describe("PLAN_CONFIGS_FALLBACK", () => {
    // SCENARIO: Verify Analytics feature is correctly configured per plan
    // RULE: Only PREMIUM and ENTERPRISE should have Analytics included
    
    it("FREE_TRIAL should NOT have Analytics feature included", () => {
      const freeTrial = PLAN_CONFIGS_FALLBACK.FREE_TRIAL
      const analyticsFeature = freeTrial.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature).toBeDefined()
      expect(analyticsFeature?.included).toBe(false)
    })

    it("BASIC should NOT have Analytics feature included", () => {
      const basic = PLAN_CONFIGS_FALLBACK.BASIC
      const analyticsFeature = basic.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature).toBeDefined()
      expect(analyticsFeature?.included).toBe(false)
    })

    it("PREMIUM should have Analytics feature included", () => {
      const premium = PLAN_CONFIGS_FALLBACK.PREMIUM
      const analyticsFeature = premium.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature).toBeDefined()
      expect(analyticsFeature?.included).toBe(true)
    })

    it("ENTERPRISE should have Analytics feature included", () => {
      const enterprise = PLAN_CONFIGS_FALLBACK.ENTERPRISE
      const analyticsFeature = enterprise.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature).toBeDefined()
      expect(analyticsFeature?.included).toBe(true)
    })

    // SCENARIO: Verify all plans have required base features
    it("all plans should have CHANNELS feature included", () => {
      const planTypes = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"] as const
      
      planTypes.forEach(planType => {
        const plan = PLAN_CONFIGS_FALLBACK[planType]
        const channelsFeature = plan.features.find(f => f.key === FEATURE_KEYS.CHANNELS)
        expect(channelsFeature?.included).toBe(true)
      })
    })

    it("all plans should have MULTI_LANGUAGE feature included", () => {
      const planTypes = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"] as const
      
      planTypes.forEach(planType => {
        const plan = PLAN_CONFIGS_FALLBACK[planType]
        const multiLangFeature = plan.features.find(f => f.key === FEATURE_KEYS.MULTI_LANGUAGE)
        expect(multiLangFeature?.included).toBe(true)
      })
    })
  })

  describe("buildPlanConfigsFromApi", () => {
    // SCENARIO: Verify buildPlanConfigsFromApi correctly sets Analytics based on plan type
    
    const mockPlans: PlanInfo[] = [
      {
        planType: "FREE_TRIAL",
        displayName: "Free Trial",
        monthlyFee: 0,
        maxChannels: 1,
        maxCustomers: 50,
        maxTeamMembers: 0,
      },
      {
        planType: "BASIC",
        displayName: "Basic",
        monthlyFee: 22,
        maxChannels: 1,
        maxCustomers: 50,
        maxTeamMembers: 0,
      },
      {
        planType: "PREMIUM",
        displayName: "Premium",
        monthlyFee: 45,
        maxChannels: 2,
        maxCustomers: 100,
        maxTeamMembers: 3,
      },
      {
        planType: "ENTERPRISE",
        displayName: "Enterprise",
        monthlyFee: 140,
        maxChannels: 999999,
        maxCustomers: 999999,
        maxTeamMembers: 999999,
      },
    ]

    it("should set Analytics=false for FREE_TRIAL when built from API", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      const analyticsFeature = configs.FREE_TRIAL.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature?.included).toBe(false)
    })

    it("should set Analytics=false for BASIC when built from API", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      const analyticsFeature = configs.BASIC.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature?.included).toBe(false)
    })

    it("should set Analytics=true for PREMIUM when built from API", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      const analyticsFeature = configs.PREMIUM.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature?.included).toBe(true)
    })

    it("should set Analytics=true for ENTERPRISE when built from API", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      const analyticsFeature = configs.ENTERPRISE.features.find(f => f.key === FEATURE_KEYS.ANALYTICS)
      
      expect(analyticsFeature?.included).toBe(true)
    })

    // SCENARIO: Verify TEAM_MEMBERS feature is correctly set
    // RULE: Only PREMIUM and ENTERPRISE should have TEAM_MEMBERS
    it("should set TEAM_MEMBERS=false for BASIC plans", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      
      const freeTrialTeam = configs.FREE_TRIAL.features.find(f => f.key === FEATURE_KEYS.TEAM_MEMBERS)
      const basicTeam = configs.BASIC.features.find(f => f.key === FEATURE_KEYS.TEAM_MEMBERS)
      
      expect(freeTrialTeam?.included).toBe(false)
      expect(basicTeam?.included).toBe(false)
    })

    it("should set TEAM_MEMBERS=true for PREMIUM and ENTERPRISE plans", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      
      const premiumTeam = configs.PREMIUM.features.find(f => f.key === FEATURE_KEYS.TEAM_MEMBERS)
      const enterpriseTeam = configs.ENTERPRISE.features.find(f => f.key === FEATURE_KEYS.TEAM_MEMBERS)
      
      expect(premiumTeam?.included).toBe(true)
      expect(enterpriseTeam?.included).toBe(true)
    })

    // SCENARIO: Verify INTEGRATIONS and DEDICATED_SERVER are Enterprise-only
    it("should set INTEGRATIONS=true only for ENTERPRISE", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      
      expect(configs.FREE_TRIAL.features.find(f => f.key === FEATURE_KEYS.INTEGRATIONS)?.included).toBe(false)
      expect(configs.BASIC.features.find(f => f.key === FEATURE_KEYS.INTEGRATIONS)?.included).toBe(false)
      expect(configs.PREMIUM.features.find(f => f.key === FEATURE_KEYS.INTEGRATIONS)?.included).toBe(false)
      expect(configs.ENTERPRISE.features.find(f => f.key === FEATURE_KEYS.INTEGRATIONS)?.included).toBe(true)
    })

    it("should set DEDICATED_SERVER=true only for ENTERPRISE", () => {
      const configs = buildPlanConfigsFromApi(mockPlans)
      
      expect(configs.FREE_TRIAL.features.find(f => f.key === FEATURE_KEYS.DEDICATED_SERVER)?.included).toBe(false)
      expect(configs.BASIC.features.find(f => f.key === FEATURE_KEYS.DEDICATED_SERVER)?.included).toBe(false)
      expect(configs.PREMIUM.features.find(f => f.key === FEATURE_KEYS.DEDICATED_SERVER)?.included).toBe(false)
      expect(configs.ENTERPRISE.features.find(f => f.key === FEATURE_KEYS.DEDICATED_SERVER)?.included).toBe(true)
    })
  })
})
