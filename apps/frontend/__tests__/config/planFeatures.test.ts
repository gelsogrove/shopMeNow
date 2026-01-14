/**
 * Plan Features Configuration Tests
 * 
 * Tests for dynamic plan limits and fixed feature ordering.
 * Ensures channels, teamMembers, and customers are read from database.
 */

import { describe, it, expect } from 'vitest'
import {
  buildPlanConfigsFromApi,
  FEATURE_DISPLAY_ORDER,
  FEATURE_KEYS,
  getPlanFeaturesWithText,
  updatePlanConfigs,
} from '../../src/config/planFeatures'
import { PlanInfo } from '../../src/services/subscriptionBillingApi'

// Mock PlanInfo data (simulates API response)
const mockPlans: PlanInfo[] = [
  {
    planType: 'FREE_TRIAL',
    displayName: 'Free Trial',
    monthlyFee: 0,
    maxChannels: 999, // Should be overridden by dynamic limits
    maxCustomers: 50,
    maxTeamMembers: 999, // Should be overridden by dynamic limits
    lowBalanceThreshold: 5,
    messageCost: 0.1,
  },
  {
    planType: 'BASIC',
    displayName: 'Basic',
    monthlyFee: 22,
    maxChannels: 999,
    maxCustomers: 50,
    maxTeamMembers: 999,
    lowBalanceThreshold: 5,
    messageCost: 0.1,
  },
  {
    planType: 'PREMIUM',
    displayName: 'Premium',
    monthlyFee: 45,
    maxChannels: 999,
    maxCustomers: 100,
    maxTeamMembers: 999,
    lowBalanceThreshold: 10,
    messageCost: 0.1,
  },
  {
    planType: 'ENTERPRISE',
    displayName: 'Enterprise',
    monthlyFee: 140,
    maxChannels: 999999,
    maxCustomers: 999999,
    maxTeamMembers: 999999,
    lowBalanceThreshold: 20,
    messageCost: 0.1,
  },
]

// Mock dynamic limits from platform config (from database)
const mockDynamicLimits: Record<string, number> = {
  FREE_TRIAL_CHANNELS: 1,
  FREE_TRIAL_TEAM_MEMBERS: 0,
  BASIC_CHANNELS: 1,
  BASIC_TEAM_MEMBERS: 0,
  PREMIUM_CHANNELS: 2,
  PREMIUM_TEAM_MEMBERS: 3,
  ENTERPRISE_CHANNELS: 999999,
  ENTERPRISE_TEAM_MEMBERS: 999999,
}

describe('Plan Features Configuration', () => {
  describe('buildPlanConfigsFromApi', () => {
    it('should read channels from dynamic limits, not from PlanInfo', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)

      // FREE_TRIAL should have 1 channel (from dynamic limits)
      expect(configs.FREE_TRIAL.limits.channels).toBe(1)
      
      // BASIC should have 1 channel (from dynamic limits)
      expect(configs.BASIC.limits.channels).toBe(1)
      
      // PREMIUM should have 2 channels (from dynamic limits)
      expect(configs.PREMIUM.limits.channels).toBe(2)
      
      // ENTERPRISE should be unlimited (999999 → "unlimited")
      expect(configs.ENTERPRISE.limits.channels).toBe('unlimited')
    })

    it('should read team members from dynamic limits, not from PlanInfo', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)

      // FREE_TRIAL should have 0 team members (from dynamic limits)
      expect(configs.FREE_TRIAL.limits.teamMembers).toBe(0)
      
      // BASIC should have 0 team members (from dynamic limits)
      expect(configs.BASIC.limits.teamMembers).toBe(0)
      
      // PREMIUM should have 3 team members (from dynamic limits)
      expect(configs.PREMIUM.limits.teamMembers).toBe(3)
      
      // ENTERPRISE should be unlimited
      expect(configs.ENTERPRISE.limits.teamMembers).toBe('unlimited')
    })

    it('should read customers from PlanInfo (not dynamic)', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)

      expect(configs.FREE_TRIAL.limits.customers).toBe(50)
      expect(configs.BASIC.limits.customers).toBe(50)
      expect(configs.PREMIUM.limits.customers).toBe(100)
      expect(configs.ENTERPRISE.limits.customers).toBe('unlimited')
    })

    it('should use fallback values when dynamic limits are not provided', () => {
      const configs = buildPlanConfigsFromApi(mockPlans) // No dynamic limits

      // Should fallback to PlanInfo.maxChannels
      expect(configs.FREE_TRIAL.limits.channels).toBe(999)
      expect(configs.PREMIUM.limits.channels).toBe(999)
    })

    it('should convert 999999 to "unlimited"', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)

      expect(configs.ENTERPRISE.limits.channels).toBe('unlimited')
      expect(configs.ENTERPRISE.limits.teamMembers).toBe('unlimited')
      expect(configs.ENTERPRISE.limits.customers).toBe('unlimited')
    })
  })

  describe('Feature Display Order', () => {
    it('should maintain fixed order: Channels(1), Customers(2), Multi-language(3), Analytics(4), Team Members(5)', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)
      
      // Check PREMIUM plan features order
      const premiumFeatures = configs.PREMIUM.features
      
      expect(premiumFeatures[0].key).toBe(FEATURE_KEYS.CHANNELS)
      expect(premiumFeatures[0].order).toBe(1)
      
      expect(premiumFeatures[1].key).toBe(FEATURE_KEYS.CUSTOMERS)
      expect(premiumFeatures[1].order).toBe(2)
      
      expect(premiumFeatures[2].key).toBe(FEATURE_KEYS.MULTI_LANGUAGE)
      expect(premiumFeatures[2].order).toBe(3)
      
      expect(premiumFeatures[3].key).toBe(FEATURE_KEYS.ANALYTICS)
      expect(premiumFeatures[3].order).toBe(4)
      
      expect(premiumFeatures[4].key).toBe(FEATURE_KEYS.TEAM_MEMBERS)
      expect(premiumFeatures[4].order).toBe(5)
    })

    it('should have consistent order across all plans', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)
      
      const freeOrders = configs.FREE_TRIAL.features.map(f => f.order)
      const basicOrders = configs.BASIC.features.map(f => f.order)
      const premiumOrders = configs.PREMIUM.features.map(f => f.order)
      const enterpriseOrders = configs.ENTERPRISE.features.map(f => f.order)
      
      // All plans should have features in the same order
      expect(freeOrders).toEqual(basicOrders)
      expect(basicOrders).toEqual(premiumOrders)
      expect(premiumOrders).toEqual(enterpriseOrders)
    })

    it('should maintain order when calling getPlanFeaturesWithText', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)
      
      // Update global PLAN_CONFIGS for getPlanFeaturesWithText
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const features = getPlanFeaturesWithText('PREMIUM')
      
      // Should maintain order: Channels, Customers, Multi-language, Analytics, Team Members
      expect(features[0].name).toContain('WhatsApp channel')
      expect(features[1].name).toContain('leads')
      expect(features[2].name).toBe('Multi-language support')
      expect(features[3].name).toBe('Advanced Analytics')
      expect(features[4].name).toContain('team members')
    })
  })

  describe('Feature Display Text', () => {
    it('should display "1 WhatsApp channel" for FREE and BASIC', () => {
      const configs = buildPlanConfigsFromApi(mockPlans, mockDynamicLimits)
      
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const freeFeatures = getPlanFeaturesWithText('FREE_TRIAL')
      const basicFeatures = getPlanFeaturesWithText('BASIC')
      
      expect(freeFeatures[0].name).toBe('1 WhatsApp channel')
      expect(basicFeatures[0].name).toBe('1 WhatsApp channel')
    })

    it('should display "2 WhatsApp channels" for PREMIUM', () => {
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const premiumFeatures = getPlanFeaturesWithText('PREMIUM')
      
      expect(premiumFeatures[0].name).toBe('2 WhatsApp channels')
    })

    it('should display "Unlimited WhatsApp channels" for ENTERPRISE', () => {
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const enterpriseFeatures = getPlanFeaturesWithText('ENTERPRISE')
      
      expect(enterpriseFeatures[0].name).toBe('Unlimited WhatsApp channels')
    })

    it('should display "Up to 0 team members" for FREE and BASIC', () => {
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const freeFeatures = getPlanFeaturesWithText('FREE_TRIAL')
      const basicFeatures = getPlanFeaturesWithText('BASIC')
      
      const freeTeamFeature = freeFeatures.find(f => f.name.includes('team members'))
      const basicTeamFeature = basicFeatures.find(f => f.name.includes('team members'))
      
      expect(freeTeamFeature?.name).toBe('Up to 0 team members')
      expect(basicTeamFeature?.name).toBe('Up to 0 team members')
    })

    it('should display "Up to 3 team members" for PREMIUM', () => {
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const premiumFeatures = getPlanFeaturesWithText('PREMIUM')
      const teamFeature = premiumFeatures.find(f => f.name.includes('team members'))
      
      expect(teamFeature?.name).toBe('Up to 3 team members')
    })

    it('should display "Unlimited team members" for ENTERPRISE', () => {
      updatePlanConfigs(mockPlans, mockDynamicLimits)
      
      const enterpriseFeatures = getPlanFeaturesWithText('ENTERPRISE')
      const teamFeature = enterpriseFeatures.find(f => f.name.includes('team members'))
      
      expect(teamFeature?.name).toBe('Unlimited team members')
    })
  })

  describe('Dynamic Limits Integration', () => {
    it('should update when database values change', () => {
      // Simulate database update: PREMIUM now has 5 channels
      const updatedLimits = {
        ...mockDynamicLimits,
        PREMIUM_CHANNELS: 5,
        PREMIUM_TEAM_MEMBERS: 10,
      }
      
      const configs = buildPlanConfigsFromApi(mockPlans, updatedLimits)
      
      expect(configs.PREMIUM.limits.channels).toBe(5)
      expect(configs.PREMIUM.limits.teamMembers).toBe(10)
    })

    it('should handle missing dynamic limit keys gracefully (use fallback)', () => {
      // Provide incomplete dynamic limits
      const partialLimits = {
        FREE_TRIAL_CHANNELS: 1,
        // Missing other keys
      }
      
      const configs = buildPlanConfigsFromApi(mockPlans, partialLimits)
      
      // FREE_TRIAL should use dynamic limit
      expect(configs.FREE_TRIAL.limits.channels).toBe(1)
      
      // BASIC should fallback to PlanInfo
      expect(configs.BASIC.limits.channels).toBe(999)
    })
  })

  describe('Fixed Feature Order Constants', () => {
    it('should define correct display order for all features', () => {
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.CHANNELS]).toBe(1)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.CUSTOMERS]).toBe(2)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.MULTI_LANGUAGE]).toBe(3)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.ANALYTICS]).toBe(4)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.TEAM_MEMBERS]).toBe(5)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.BRANDING]).toBe(6)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.INTEGRATIONS]).toBe(7)
      expect(FEATURE_DISPLAY_ORDER[FEATURE_KEYS.DEDICATED_SERVER]).toBe(8)
    })
  })
})
