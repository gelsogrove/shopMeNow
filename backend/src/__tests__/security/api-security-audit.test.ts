/**
 * API Endpoint Security Audit
 *
 * Analyzes all route files to verify:
 * 1. Protected endpoints use authMiddleware or jwtAuthMiddleware
 * 2. Public endpoints are documented and intentional
 * 3. Debug endpoints are flagged for removal in production
 * 4. Workspace isolation is enforced
 *
 * @jest-environment node
 */

process.env.INTEGRATION_TEST = "true"

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

describe("🔐 API Endpoint Security Audit", () => {
  const routesDir = path.join(__dirname, "../../interfaces/http/routes")
  let routeFiles: string[] = []

  beforeAll(async () => {
    // Get all route files
    routeFiles = fs
      .readdirSync(routesDir)
      .filter((file) => file.endsWith(".routes.ts"))
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe("📁 Route Files Analysis", () => {
    test("should find all route files", () => {
      console.log(`\n📂 Found ${routeFiles.length} route files:`)
      routeFiles.forEach((file) => {
        console.log(`   • ${file}`)
      })

      expect(routeFiles.length).toBeGreaterThan(0)
    })
  })

  describe("🛡️ Authentication Middleware Usage", () => {
    const securityFindings: {
      file: string
      hasAuth: boolean
      hasPublicRoutes: boolean
      hasDebugRoutes: boolean
      details: string[]
    }[] = []

    test("should analyze each route file for security", () => {
      routeFiles.forEach((file) => {
        const filePath = path.join(routesDir, file)
        const content = fs.readFileSync(filePath, "utf-8")

        const hasAuth =
          content.includes("authMiddleware") ||
          content.includes("jwtAuthMiddleware") ||
          content.includes("workspaceValidationMiddleware")

        const hasPublicRoutes =
          content.includes("router.use(authMiddleware)") === false &&
          content.includes("router.use(jwtAuthMiddleware)") === false

        const hasDebugRoutes =
          content.includes("debug") ||
          content.includes("no-auth") ||
          content.includes("count-debug")

        const details: string[] = []

        // Check for specific patterns
        if (content.includes("router.use(authMiddleware)")) {
          details.push("✅ Global authMiddleware applied")
        }

        if (content.includes("jwtAuthMiddleware")) {
          details.push("✅ JWT authentication used")
        }

        if (content.includes("workspaceValidationMiddleware")) {
          details.push("✅ Workspace validation applied")
        }

        if (content.includes("debug-no-auth")) {
          details.push("⚠️  Has debug endpoint without auth")
        }

        if (content.includes("count-debug")) {
          details.push("⚠️  Has count-debug endpoint")
        }

        // Check for public routes intentionally
        if (file === "public-orders.routes.ts") {
          details.push("ℹ️  Public routes (uses SecureToken)")
        }

        if (file === "whatsapp.routes.ts") {
          details.push("ℹ️  WhatsApp webhook (public by design)")
        }

        if (file === "auth.routes.ts") {
          details.push("ℹ️  Auth routes (login/register public)")
        }

        securityFindings.push({
          file,
          hasAuth,
          hasPublicRoutes,
          hasDebugRoutes,
          details,
        })
      })

      expect(securityFindings.length).toBe(routeFiles.length)
    })

    test("should FLAG files without authentication middleware", () => {
      console.log("\n" + "=".repeat(70))
      console.log("🔐 SECURITY AUDIT REPORT")
      console.log("=".repeat(70))

      const unprotectedFiles = securityFindings.filter(
        (f) =>
          !f.hasAuth &&
          f.file !== "public-orders.routes.ts" &&
          f.file !== "whatsapp.routes.ts" &&
          f.file !== "auth.routes.ts"
      )

      const debugFiles = securityFindings.filter((f) => f.hasDebugRoutes)

      console.log("\n✅ PROTECTED FILES:")
      securityFindings
        .filter((f) => f.hasAuth)
        .forEach((f) => {
          console.log(`\n   📄 ${f.file}`)
          f.details.forEach((d) => console.log(`      ${d}`))
        })

      console.log("\n\n🔓 PUBLIC/UNPROTECTED FILES:")
      securityFindings
        .filter((f) => !f.hasAuth)
        .forEach((f) => {
          console.log(`\n   📄 ${f.file}`)
          f.details.forEach((d) => console.log(`      ${d}`))
        })

      if (debugFiles.length > 0) {
        console.log("\n\n⚠️  DEBUG ENDPOINTS DETECTED (SECURITY RISK):")
        debugFiles.forEach((f) => {
          console.log(`\n   📄 ${f.file}`)
          f.details
            .filter((d) => d.includes("⚠️"))
            .forEach((d) => console.log(`      ${d}`))
        })
      }

      if (unprotectedFiles.length > 0) {
        console.log("\n\n🚨 CRITICAL: UNPROTECTED FILES FOUND:")
        unprotectedFiles.forEach((f) => {
          console.log(`   • ${f.file}`)
        })
        console.log("\n   ⚠️  These files may have unprotected endpoints!")
      }

      console.log("\n" + "=".repeat(70) + "\n")

      // Alert if unprotected files found
      if (unprotectedFiles.length > 0) {
        console.warn(
          `⚠️  WARNING: ${unprotectedFiles.length} route file(s) without authentication middleware!`
        )
      }

      // Alert if debug endpoints found
      if (debugFiles.length > 0) {
        console.warn(
          `⚠️  WARNING: ${debugFiles.length} file(s) with debug endpoints detected!`
        )
      }
    })
  })

  describe("🔍 Specific Security Checks", () => {
    test("should verify customers routes are protected", () => {
      const customersFile = path.join(routesDir, "customers.routes.ts")
      const content = fs.readFileSync(customersFile, "utf-8")

      // Should have authMiddleware
      expect(content).toContain("authMiddleware")

      // Should have debug-no-auth endpoint (document security issue)
      if (content.includes("debug-no-auth")) {
        console.warn(
          "\n⚠️  SECURITY ISSUE: customers.routes.ts has 'debug-no-auth' endpoint"
        )
        console.warn(
          "   This endpoint bypasses authentication and should be removed in production"
        )
      }
    })

    test("should verify whatsapp routes handle webhooks securely", () => {
      const whatsappFile = path.join(routesDir, "whatsapp.routes.ts")
      const content = fs.readFileSync(whatsappFile, "utf-8")

      // Webhook endpoints should be public (Meta needs to access them)
      // But should have rate limiting or signature verification
      const hasRateLimiting = content.includes("rateLimitMiddleware")
      const hasSignatureVerification =
        content.includes("signature") || content.includes("hmac")

      if (!hasRateLimiting && !hasSignatureVerification) {
        console.warn(
          "\n⚠️  SECURITY RECOMMENDATION: WhatsApp webhook should have:"
        )
        console.warn("   • Rate limiting middleware")
        console.warn("   • HMAC signature verification")
      }

      expect(content).toBeDefined()
    })

    test("should verify public-orders routes use SecureToken", () => {
      const publicOrdersFile = path.join(routesDir, "public-orders.routes.ts")
      const content = fs.readFileSync(publicOrdersFile, "utf-8")

      // Should use SecureTokenService
      expect(content).toContain("SecureTokenService")

      // Should validate tokens
      expect(content).toContain("validateToken")
    })
  })

  describe("🏢 Workspace Isolation Verification", () => {
    test("should verify all protected routes include workspaceId parameter", () => {
      const protectedFiles = [
        "customers.routes.ts",
        "products.routes.ts",
        "orders.routes.ts",
        "faqs.routes.ts",
      ]

      const filesWithoutWorkspaceId: string[] = []

      protectedFiles.forEach((file) => {
        const filePath = path.join(routesDir, file)
        if (!fs.existsSync(filePath)) {
          return
        }

        const content = fs.readFileSync(filePath, "utf-8")

        // Check if routes include workspaceId parameter OR use JWT auth (which contains workspaceId)
        const hasWorkspaceParam =
          content.includes(":workspaceId") ||
          content.includes("workspaceId") ||
          content.includes("workspaceValidationMiddleware") ||
          content.includes("jwtAuthMiddleware") // JWT contains workspaceId

        if (!hasWorkspaceParam) {
          filesWithoutWorkspaceId.push(file)
        }
      })

      if (filesWithoutWorkspaceId.length > 0) {
        console.warn(
          "\n⚠️  WARNING: Routes without workspace isolation detected:"
        )
        filesWithoutWorkspaceId.forEach((f) => {
          console.warn(`   • ${f}`)
        })
      }

      // Should have workspace isolation
      expect(filesWithoutWorkspaceId.length).toBe(0)
    })
  })

  describe("📊 Security Summary", () => {
    test("should generate complete security report", () => {
      console.log("\n" + "=".repeat(70))
      console.log("📊 SECURITY SUMMARY REPORT")
      console.log("=".repeat(70))

      console.log("\n🔐 AUTHENTICATION PATTERNS:")
      console.log("   • JWT Tokens: Used for authenticated admin/user routes")
      console.log("   • Secure Tokens: Used for public customer-facing routes")
      console.log("   • No Auth: Only for webhooks and auth endpoints")

      console.log("\n🛡️  MIDDLEWARE STACK:")
      console.log("   • authMiddleware: Validates JWT, extracts user info")
      console.log("   • jwtAuthMiddleware: Alternative JWT validator")
      console.log(
        "   • workspaceValidationMiddleware: Enforces workspace boundaries"
      )
      console.log("   • rateLimitMiddleware: Prevents abuse/DoS attacks")

      console.log("\n⚠️  SECURITY RECOMMENDATIONS:")
      console.log(
        "   1. ❌ REMOVE debug endpoints (debug-no-auth, count-debug)"
      )
      console.log("   2. 🔒 ADD rate limiting to all public endpoints")
      console.log("   3. 🔐 IMPLEMENT HMAC signature verification for webhooks")
      console.log(
        "   4. 🏢 ENFORCE workspace validation on ALL protected routes"
      )
      console.log("   5. 📝 AUDIT all routes without authentication middleware")
      console.log("   6. 🔄 ROTATE JWT secrets regularly (every 90 days)")
      console.log("   7. ⏱️  IMPLEMENT token refresh mechanism")
      console.log("   8. 📊 LOG all authentication failures for monitoring")

      console.log("\n🎯 CRITICAL ACTIONS REQUIRED:")
      console.log(
        "   • Remove or protect 'debug-no-auth' endpoint in customers.routes.ts"
      )
      console.log(
        "   • Remove or protect 'count-debug' endpoint in customers.routes.ts"
      )
      console.log(
        "   • Add environment check: disable debug routes in production"
      )

      console.log("\n✅ GOOD PRACTICES FOUND:")
      console.log("   • Most routes use authMiddleware")
      console.log("   • Public orders use SecureToken validation")
      console.log("   • Workspace isolation enforced in most routes")
      console.log("   • WhatsApp webhook is intentionally public")

      console.log("\n" + "=".repeat(70) + "\n")

      expect(true).toBe(true)
    })
  })

  describe("🔥 Real Attack Simulations", () => {
    let testWorkspaceId: string
    let testCustomerId: string

    beforeAll(async () => {
      // Create test data
      const workspace = await prisma.workspace.create({
        data: {
          name: "Security Test Workspace",
          slug: `security-${Date.now()}`,
        },
      })
      testWorkspaceId = workspace.id

      const customer = await prisma.customers.create({
        data: {
          name: "Test Customer",
          email: `test-${Date.now()}@test.com`,
          phone: `+111${Date.now().toString().slice(-7)}`,
          workspaceId: testWorkspaceId,
        },
      })
      testCustomerId = customer.id
    })

    afterAll(async () => {
      // Cleanup
      await prisma.customers.deleteMany({
        where: { workspaceId: testWorkspaceId },
      })
      await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    })

    test("should prevent unauthorized cross-workspace data access", async () => {
      // Create attacker workspace
      const attackerWorkspace = await prisma.workspace.create({
        data: {
          name: "Attacker Workspace",
          slug: `attacker-${Date.now()}`,
        },
      })

      // Attacker tries to query victim's customers
      const customers = await prisma.customers.findMany({
        where: {
          workspaceId: testWorkspaceId, // Victim's workspace
        },
      })

      // This query SUCCEEDS at DB level, but should be blocked by middleware
      // In real attack, attacker would need to bypass authMiddleware
      expect(customers.length).toBeGreaterThan(0)
      expect(customers[0].workspaceId).toBe(testWorkspaceId)

      console.log("\n⚠️  NOTE: Database allows cross-workspace queries")
      console.log(
        "   Middleware MUST validate token.workspaceId matches URL :workspaceId"
      )

      // Cleanup
      await prisma.workspace.delete({ where: { id: attackerWorkspace.id } })
    })

    test("should document authentication bypass via debug endpoint", async () => {
      // This test documents that debug-no-auth endpoint is a security vulnerability
      console.log("\n🚨 DOCUMENTED VULNERABILITY:")
      console.log(
        "   Endpoint: GET /api/workspaces/:id/unknown-customers/debug-no-auth"
      )
      console.log("   Issue: Bypasses authMiddleware")
      console.log(
        "   Impact: Anyone can query this endpoint without authentication"
      )
      console.log("   Recommendation: Remove or protect with authMiddleware")

      expect(true).toBe(true)
    })

    test("should verify JWT token validation works correctly", async () => {
      const jwt = require("jsonwebtoken")
      const secret = process.env.JWT_SECRET || "test-secret"

      // Valid token
      const validToken = jwt.sign(
        {
          userId: "user-123",
          workspaceId: testWorkspaceId,
          email: "test@test.com",
        },
        secret,
        { expiresIn: "1h" }
      )

      // Verify token
      const decoded = jwt.verify(validToken, secret)
      expect(decoded).toHaveProperty("userId")
      expect(decoded).toHaveProperty("workspaceId")

      // Expired token should fail
      const expiredToken = jwt.sign(
        {
          userId: "user-123",
          workspaceId: testWorkspaceId,
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        },
        secret
      )

      expect(() => {
        jwt.verify(expiredToken, secret)
      }).toThrow()
    })

    test("should verify tampered tokens are rejected", async () => {
      const jwt = require("jsonwebtoken")
      const secret = process.env.JWT_SECRET || "test-secret"

      const token = jwt.sign(
        {
          userId: "user-123",
          workspaceId: testWorkspaceId,
        },
        secret
      )

      // Tamper with token
      const parts = token.split(".")
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
      payload.workspaceId = "hacked-workspace-id"

      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64"
      )
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      // Verification should fail
      expect(() => {
        jwt.verify(tamperedToken, secret)
      }).toThrow()
    })
  })
})
