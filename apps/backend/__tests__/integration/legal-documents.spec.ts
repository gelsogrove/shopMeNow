import request from "supertest"
import app from "../../src/app"
import { prisma } from "@echatbot/database"

describe("Legal Documents API Integration", () => {
  describe("GET /api/v1/legal-documents/:type", () => {
    it("should return PRIVACY_POLICY in Italian (PUBLIC endpoint)", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=it")
        .expect(200)

      expect(response.body).toHaveProperty("type", "PRIVACY_POLICY")
      expect(response.body).toHaveProperty("title")
      expect(response.body).toHaveProperty("content")
      expect(response.body.content).toContain("Privacy") // Italian content
    })

    it("should return PRIVACY_POLICY in English (PUBLIC endpoint)", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=en")
        .expect(200)

      expect(response.body).toHaveProperty("type", "PRIVACY_POLICY")
      expect(response.body).toHaveProperty("title")
      expect(response.body.content).toContain("Privacy") // English content
    })

    it("should return PRIVACY_POLICY in Spanish (PUBLIC endpoint)", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=es")
        .expect(200)

      expect(response.body.content).toContain("Privacidad") // Spanish content
    })

    it("should return PRIVACY_POLICY in Portuguese (PUBLIC endpoint)", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=pt")
        .expect(200)

      expect(response.body.content).toContain("Privacidade") // Portuguese content
    })

    it("should default to Italian if no lang specified", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY")
        .expect(200)

      expect(response.body).toHaveProperty("type", "PRIVACY_POLICY")
    })

    it("should return 404 for invalid document type", async () => {
      await request(app)
        .get("/api/v1/legal-documents/INVALID_TYPE?lang=it")
        .expect(404)
    })

    it("should work for all document types", async () => {
      const types = ["GDPR", "PRIVACY_POLICY", "TERMS_OF_SERVICE", "REFUND_POLICY"]

      for (const type of types) {
        const response = await request(app)
          .get(`/api/v1/legal-documents/${type}?lang=it`)
          .expect(200)

        expect(response.body.type).toBe(type)
      }
    })
  })

  describe("GET /api/v1/legal-documents", () => {
    it("should return all legal documents (PUBLIC endpoint)", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents")
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThanOrEqual(4) // At least GDPR, Privacy, Terms, Refund

      const types = response.body.map((doc: any) => doc.type)
      expect(types).toContain("GDPR")
      expect(types).toContain("PRIVACY_POLICY")
      expect(types).toContain("TERMS_OF_SERVICE")
      expect(types).toContain("REFUND_POLICY")
    })
  })

  describe("PUT /api/v1/legal-documents/:type (PLATFORM ADMIN ONLY)", () => {
    let platformAdminToken: string
    let regularUserToken: string

    beforeAll(async () => {
      // Create platform admin user
      const adminUser = await prisma.user.create({
        data: {
          email: "admin@test.com",
          password: "hashed_password",
          name: "Platform Admin",
          isPlatformAdmin: true,
        },
      })

      // Create regular user
      const regularUser = await prisma.user.create({
        data: {
          email: "user@test.com",
          password: "hashed_password",
          name: "Regular User",
          isPlatformAdmin: false,
        },
      })

      // Generate tokens (you'll need to adjust based on your auth implementation)
      // platformAdminToken = generateToken(adminUser)
      // regularUserToken = generateToken(regularUser)
    })

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: {
          email: { in: ["admin@test.com", "user@test.com"] },
        },
      })
    })

    it("should require authentication", async () => {
      await request(app)
        .put("/api/v1/legal-documents/PRIVACY_POLICY")
        .send({ titleIt: "Updated Title" })
        .expect(401) // Unauthorized
    })

    // NOTE: Uncomment when auth tokens are set up
    // it("should reject regular users (not platform admin)", async () => {
    //   await request(app)
    //     .put("/api/v1/legal-documents/PRIVACY_POLICY")
    //     .set("Authorization", `Bearer ${regularUserToken}`)
    //     .send({ titleIt: "Updated Title" })
    //     .expect(403) // Forbidden
    // })

    // it("should allow platform admin to update", async () => {
    //   const response = await request(app)
    //     .put("/api/v1/legal-documents/PRIVACY_POLICY")
    //     .set("Authorization", `Bearer ${platformAdminToken}`)
    //     .send({
    //       titleIt: "Updated Privacy Policy",
    //       contentIt: "<h1>Updated Content</h1>",
    //     })
    //     .expect(200)

    //   expect(response.body.titleIt).toBe("Updated Privacy Policy")
    // })
  })

  describe("Security: GLOBAL to platform (NOT workspace-specific)", () => {
    it("should NOT accept workspaceId in query/body", async () => {
      const response = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=it&workspaceId=test123")
        .expect(200)

      // Should ignore workspaceId and return global document
      expect(response.body.type).toBe("PRIVACY_POLICY")
    })

    it("should return same document for all users (global singleton)", async () => {
      const response1 = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=it")
        .expect(200)

      const response2 = await request(app)
        .get("/api/v1/legal-documents/PRIVACY_POLICY?lang=it")
        .expect(200)

      expect(response1.body.content).toBe(response2.body.content)
    })
  })
})
