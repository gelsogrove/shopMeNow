/**
 * Tests for production environment safety checks
 */

import { isProductionEnvironment, isDestructiveOperationsAllowed } from "../scripts/check-env-safety"

describe("Production Environment Safety", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset env for each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe("isProductionEnvironment", () => {
    it("should return true when NODE_ENV is production", () => {
      process.env.NODE_ENV = "production"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should return true when NODE_ENV is prod", () => {
      process.env.NODE_ENV = "prod"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should return true when NODE_ENV is PRODUCTION (case insensitive)", () => {
      process.env.NODE_ENV = "PRODUCTION"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should return false when NODE_ENV is development", () => {
      process.env.NODE_ENV = "development"
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
      expect(isProductionEnvironment()).toBe(false)
    })

    it("should return false when NODE_ENV is test", () => {
      process.env.NODE_ENV = "test"
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
      expect(isProductionEnvironment()).toBe(false)
    })

    it("should detect production from DATABASE_URL containing 'production'", () => {
      process.env.NODE_ENV = "development"
      process.env.DATABASE_URL = "postgresql://user:pass@production-db.example.com:5432/db"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should detect production from DATABASE_URL containing 'railway'", () => {
      process.env.NODE_ENV = "development"
      process.env.DATABASE_URL = "postgresql://user:pass@containers-us-west-1.railway.app:5432/db"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should detect production from DATABASE_URL containing 'supabase'", () => {
      process.env.NODE_ENV = "development"
      process.env.DATABASE_URL = "postgresql://user:pass@db.supabase.co:5432/postgres"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should detect production from DATABASE_URL containing 'neon.tech'", () => {
      process.env.NODE_ENV = "development"
      process.env.DATABASE_URL = "postgresql://user:pass@ep-cool-name.neon.tech/db"
      expect(isProductionEnvironment()).toBe(true)
    })

    it("should return false for localhost DATABASE_URL in development", () => {
      process.env.NODE_ENV = "development"
      process.env.DATABASE_URL = "postgresql://echatbotfy:echatbotfy@localhost:5434/echatbotfy"
      expect(isProductionEnvironment()).toBe(false)
    })
  })

  describe("isDestructiveOperationsAllowed", () => {
    it("should return true when ALLOW_DESTRUCTIVE_OPERATIONS is 'true'", () => {
      process.env.ALLOW_DESTRUCTIVE_OPERATIONS = "true"
      expect(isDestructiveOperationsAllowed()).toBe(true)
    })

    it("should return false when ALLOW_DESTRUCTIVE_OPERATIONS is 'false'", () => {
      process.env.ALLOW_DESTRUCTIVE_OPERATIONS = "false"
      expect(isDestructiveOperationsAllowed()).toBe(false)
    })

    it("should return false when ALLOW_DESTRUCTIVE_OPERATIONS is not set", () => {
      delete process.env.ALLOW_DESTRUCTIVE_OPERATIONS
      expect(isDestructiveOperationsAllowed()).toBe(false)
    })

    it("should return false for any value other than 'true'", () => {
      process.env.ALLOW_DESTRUCTIVE_OPERATIONS = "yes"
      expect(isDestructiveOperationsAllowed()).toBe(false)

      process.env.ALLOW_DESTRUCTIVE_OPERATIONS = "1"
      expect(isDestructiveOperationsAllowed()).toBe(false)

      process.env.ALLOW_DESTRUCTIVE_OPERATIONS = "TRUE"
      expect(isDestructiveOperationsAllowed()).toBe(false)
    })
  })
})
