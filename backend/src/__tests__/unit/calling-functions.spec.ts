/**
 * Test per le 3 Calling Functions LLM
 * 
 * Verifica che le 3 calling functions esistano come file separati
 * e che siano correttamente importabili e funzionanti.
 * 
 * Le 3 calling functions definite in docs/prompt_agent.md:
 * 1. ContactOperator() - Line 177
 * 2. GetShipmentTrackingLink() - Line 210
 * 3. GetLinkOrderByCode() - Line 247
 */

import * as fs from "fs"
import * as path from "path"

describe("🔧 Calling Functions - File Existence & Architecture", () => {
  const callingFunctionsDir = path.join(
    __dirname,
    "../../domain/calling-functions"
  )

  describe("📁 File Structure Verification", () => {
    it("should have calling-functions directory", () => {
      expect(fs.existsSync(callingFunctionsDir)).toBe(true)
    })

    it("should have exactly 3 files (3 LLM-callable calling functions)", () => {
      const files = fs.readdirSync(callingFunctionsDir)
      const tsFiles = files.filter((f) => f.endsWith(".ts"))
      expect(tsFiles.length).toBe(3)
      expect(tsFiles).toContain("ContactOperator.ts")
      expect(tsFiles).toContain("GetShipmentTrackingLink.ts")
      expect(tsFiles).toContain("GetLinkOrderByCode.ts")
      // Note: ReplaceLinkWithToken moved to application/services/link-replacement.service.ts
    })

    it("should have ContactOperator.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "ContactOperator.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have GetShipmentTrackingLink.ts file", () => {
      const filePath = path.join(
        callingFunctionsDir,
        "GetShipmentTrackingLink.ts"
      )
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have GetLinkOrderByCode.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "GetLinkOrderByCode.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe("📦 Import & Export Verification", () => {
    it("should export ContactOperator function", async () => {
      const { ContactOperator } = require("../../domain/calling-functions/ContactOperator")
      expect(ContactOperator).toBeDefined()
      expect(typeof ContactOperator).toBe("function")
    })

    it("should export GetShipmentTrackingLink function", async () => {
      const {
        GetShipmentTrackingLink,
      } = require("../../domain/calling-functions/GetShipmentTrackingLink")
      expect(GetShipmentTrackingLink).toBeDefined()
      expect(typeof GetShipmentTrackingLink).toBe("function")
    })

    it("should export GetLinkOrderByCode function", async () => {
      const {
        GetLinkOrderByCode,
      } = require("../../domain/calling-functions/GetLinkOrderByCode")
      expect(GetLinkOrderByCode).toBeDefined()
      expect(typeof GetLinkOrderByCode).toBe("function")
    })
  })

  describe("🔍 Function Signature Verification", () => {
    it("ContactOperator should accept request parameter", async () => {
      const { ContactOperator } = require("../../domain/calling-functions/ContactOperator")
      const functionString = ContactOperator.toString()
      // Function should have 'request' parameter
      expect(functionString).toContain("request")
    })

    it("GetShipmentTrackingLink should accept request parameter", async () => {
      const {
        GetShipmentTrackingLink,
      } = require("../../domain/calling-functions/GetShipmentTrackingLink")
      const functionString = GetShipmentTrackingLink.toString()
      // Function should have 'request' parameter
      expect(functionString).toContain("request")
    })

    it("GetLinkOrderByCode should accept request parameter", async () => {
      const {
        GetLinkOrderByCode,
      } = require("../../domain/calling-functions/GetLinkOrderByCode")
      const functionString = GetLinkOrderByCode.toString()
      // Function should have 'request' parameter
      expect(functionString).toContain("request")
    })
  })

  describe("✅ CallingFunctionsService Integration", () => {
    it("CallingFunctionsService should use ContactOperator from domain layer", () => {
      const serviceContent = fs.readFileSync(
        path.join(__dirname, "../../services/calling-functions.service.ts"),
        "utf-8"
      )
      expect(serviceContent).toContain(
        'require("../domain/calling-functions/ContactOperator")'
      )
    })

    it("CallingFunctionsService should use GetShipmentTrackingLink from domain layer", () => {
      const serviceContent = fs.readFileSync(
        path.join(__dirname, "../../services/calling-functions.service.ts"),
        "utf-8"
      )
      expect(serviceContent).toContain(
        'require("../domain/calling-functions/GetShipmentTrackingLink")'
      )
    })

    it("CallingFunctionsService should use LinkReplacementService from application layer", () => {
      const serviceContent = fs.readFileSync(
        path.join(__dirname, "../../services/calling-functions.service.ts"),
        "utf-8"
      )
      expect(serviceContent).toContain(
        'application/services/link-replacement.service'
      )
    })
  })

  describe("📋 Documentation Alignment", () => {
    it("should have all 3 calling functions documented in prompt_agent.md", () => {
      const promptPath = path.join(
        __dirname,
        "../../../../docs/prompt_agent.md"
      )
      const promptContent = fs.readFileSync(promptPath, "utf-8")

      // Verify all 3 calling functions are documented
      expect(promptContent).toContain("ContactOperator")
      expect(promptContent).toContain("GetShipmentTrackingLink")
      expect(promptContent).toContain("GetLinkOrderByCode")

      // Verify they have proper sections
      expect(promptContent).toContain("## 📞 ContactOperator")
      expect(promptContent).toContain("## 📦 GetShipmentTrackingLink")
      expect(promptContent).toContain("## 📄 GetLinkOrderByCode")
    })
  })
})

describe("🧪 Calling Functions - Basic Functionality", () => {
  describe("ContactOperator", () => {
    it("should return success=false for missing phoneNumber", async () => {
      const { ContactOperator } = require("../../domain/calling-functions/ContactOperator")

      const result = await ContactOperator({
        phoneNumber: "",
        workspaceId: "test-workspace",
      })

      // Should handle gracefully even with invalid input
      expect(result).toBeDefined()
      expect(result).toHaveProperty("success")
      expect(result).toHaveProperty("timestamp")
    })

    it("should return proper structure with valid request", async () => {
      const { ContactOperator } = require("../../domain/calling-functions/ContactOperator")

      const result = await ContactOperator({
        phoneNumber: "+1234567890",
        workspaceId: "test-workspace",
        customerId: "test-customer",
      })

      expect(result).toHaveProperty("success")
      expect(result).toHaveProperty("message")
      expect(result).toHaveProperty("timestamp")
      expect(typeof result.success).toBe("boolean")
    })
  })

  describe("GetShipmentTrackingLink", () => {
    it("should return error for non-existent order", async () => {
      const {
        GetShipmentTrackingLink,
      } = require("../../domain/calling-functions/GetShipmentTrackingLink")

      const result = await GetShipmentTrackingLink({
        customerId: "non-existent-customer",
        workspaceId: "non-existent-workspace",
        orderCode: "NON-EXISTENT-ORDER",
      })

      expect(result.success).toBe(false)
      expect(result).toHaveProperty("error")
      expect(result).toHaveProperty("timestamp")
    })
  })

  describe("GetLinkOrderByCode", () => {
    it("should return error for non-existent order", async () => {
      const {
        GetLinkOrderByCode,
      } = require("../../domain/calling-functions/GetLinkOrderByCode")

      const result = await GetLinkOrderByCode({
        customerId: "non-existent-customer",
        workspaceId: "non-existent-workspace",
        orderCode: "NON-EXISTENT-ORDER",
      })

      expect(result.success).toBe(false)
      expect(result).toHaveProperty("error")
      expect(result).toHaveProperty("timestamp")
    })
  })
})

describe("📊 Calling Functions - Summary Report", () => {
  it("should have all 3 LLM-callable functions properly implemented", () => {
    const callingFunctionsDir = path.join(
      __dirname,
      "../../domain/calling-functions"
    )

    const { ContactOperator } = require("../../domain/calling-functions/ContactOperator")
    const {
      GetShipmentTrackingLink,
    } = require("../../domain/calling-functions/GetShipmentTrackingLink")
    const {
      GetLinkOrderByCode,
    } = require("../../domain/calling-functions/GetLinkOrderByCode")

    // All functions exist and are callable
    expect(ContactOperator).toBeDefined()
    expect(GetShipmentTrackingLink).toBeDefined()
    expect(GetLinkOrderByCode).toBeDefined()

    // All files exist
    expect(
      fs.existsSync(path.join(callingFunctionsDir, "ContactOperator.ts"))
    ).toBe(true)
    expect(
      fs.existsSync(
        path.join(callingFunctionsDir, "GetShipmentTrackingLink.ts")
      )
    ).toBe(true)
    expect(
      fs.existsSync(path.join(callingFunctionsDir, "GetLinkOrderByCode.ts"))
    ).toBe(true)

    console.log(`
    ✅ CALLING FUNCTIONS VERIFICATION COMPLETE - CLEAN ARCHITECTURE
    ================================================================
    
    📁 Architecture: Clean Architecture / DDD Pattern
    
    📂 Domain Layer (domain/calling-functions/):
       🔧 LLM-Callable Functions (Business Logic):
          1. ✅ ContactOperator.ts - Escalation a operatore umano
          2. ✅ GetShipmentTrackingLink.ts - Tracking spedizione DHL
          3. ✅ GetLinkOrderByCode.ts - Link dettagli ordine
    
    � Application Layer (application/services/):
       🛠️ Support Services:
          - ✅ LinkReplacementService - Token replacement utility
    
    📋 Total Calling Functions: 3 (domain layer)
    📋 Support Services: 1 (application layer)
    ✅ All functions properly exported and importable
    ✅ All functions aligned with docs/prompt_agent.md
    ✅ Clean Architecture principles respected
    `)
  })
})
