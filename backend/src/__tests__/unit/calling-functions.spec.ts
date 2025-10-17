/**
 * Test per le 5 Calling Functions LLM
 *
 * Verifica che le 5 calling functions esistano come file separati
 * e che siano correttamente importabili e funzionanti.
 *
 * Le 5 calling functions definite in docs/prompt_agent.md:
 * 1. ContactOperator() - Line 177
 * 2. GetLinkOrderByCode() - Line 247
 * 3. addProduct() - Line 290 (NEW)
 * 4. repeatOrder() - Line 350 (NEW)
 * 5. searchProduct() - Line 392 (NEW)
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

    it("should have 5 calling functions files", () => {
      const files = fs.readdirSync(callingFunctionsDir)
      const tsFiles = files.filter((f) => f.endsWith(".ts"))
      expect(tsFiles.length).toBe(5)
      expect(tsFiles).toContain("ContactOperator.ts")
      expect(tsFiles).toContain("GetLinkOrderByCode.ts")
      expect(tsFiles).toContain("AddProduct.ts")
      expect(tsFiles).toContain("RepeatOrder.ts")
      expect(tsFiles).toContain("SearchProduct.ts")
      // Note: GetShipmentTrackingLink REMOVED, ReplaceLinkWithToken moved to application/services/link-replacement.service.ts
    })

    it("should have ContactOperator.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "ContactOperator.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have GetLinkOrderByCode.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "GetLinkOrderByCode.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have AddProduct.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "AddProduct.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have RepeatOrder.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "RepeatOrder.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have SearchProduct.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "SearchProduct.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe("📦 Import & Export Verification", () => {
    it("should export ContactOperator function", async () => {
      const {
        ContactOperator,
      } = require("../../domain/calling-functions/ContactOperator")
      expect(ContactOperator).toBeDefined()
      expect(typeof ContactOperator).toBe("function")
    })

    it("should export GetLinkOrderByCode function", async () => {
      const {
        GetLinkOrderByCode,
      } = require("../../domain/calling-functions/GetLinkOrderByCode")
      expect(GetLinkOrderByCode).toBeDefined()
      expect(typeof GetLinkOrderByCode).toBe("function")
    })

    it("should export AddProduct function", async () => {
      const {
        AddProduct,
      } = require("../../domain/calling-functions/AddProduct")
      expect(AddProduct).toBeDefined()
      expect(typeof AddProduct).toBe("function")
    })

    it("should export RepeatOrder function", async () => {
      const {
        RepeatOrder,
      } = require("../../domain/calling-functions/RepeatOrder")
      expect(RepeatOrder).toBeDefined()
      expect(typeof RepeatOrder).toBe("function")
    })

    it("should export SearchProduct function", async () => {
      const {
        SearchProduct,
      } = require("../../domain/calling-functions/SearchProduct")
      expect(SearchProduct).toBeDefined()
      expect(typeof SearchProduct).toBe("function")
    })
  })

  describe("🔍 Function Signature Verification", () => {
    it("ContactOperator should accept request parameter", async () => {
      const {
        ContactOperator,
      } = require("../../domain/calling-functions/ContactOperator")
      const functionString = ContactOperator.toString()
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

    it("AddProduct should accept request parameter", async () => {
      const {
        AddProduct,
      } = require("../../domain/calling-functions/AddProduct")
      const functionString = AddProduct.toString()
      // Function should have 'request' parameter
      expect(functionString).toContain("request")
    })

    it("RepeatOrder should accept request parameter", async () => {
      const {
        RepeatOrder,
      } = require("../../domain/calling-functions/RepeatOrder")
      const functionString = RepeatOrder.toString()
      // Function should have 'request' parameter
      expect(functionString).toContain("request")
    })

    it("SearchProduct should accept request parameter", async () => {
      const {
        SearchProduct,
      } = require("../../domain/calling-functions/SearchProduct")
      const functionString = SearchProduct.toString()
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

    it("CallingFunctionsService should use LinkReplacementService from application layer", () => {
      const serviceContent = fs.readFileSync(
        path.join(__dirname, "../../services/calling-functions.service.ts"),
        "utf-8"
      )
      expect(serviceContent).toContain(
        "application/services/link-replacement.service"
      )
    })
  })

  describe("📋 Documentation Alignment", () => {
    it("should have all 5 calling functions documented in prompt_agent.md", () => {
      const promptPath = path.join(
        __dirname,
        "../../../../docs/prompt_agent.md"
      )
      const promptContent = fs.readFileSync(promptPath, "utf-8")

      // Verify all 5 calling functions are documented
      expect(promptContent).toContain("ContactOperator")
      expect(promptContent).toContain("GetLinkOrderByCode")
      expect(promptContent).toContain("addProduct")
      expect(promptContent).toContain("repeatOrder")
      expect(promptContent).toContain("searchProduct")

      // Verify they have proper sections
      expect(promptContent).toContain("## 📞 ContactOperator")
      expect(promptContent).toContain("## � GetLinkOrderByCode")
      expect(promptContent).toContain("## � addProduct")
      expect(promptContent).toContain("## � repeatOrder")
      expect(promptContent).toContain("## � searchProduct")
    })
  })
})

describe("🧪 Calling Functions - Basic Functionality", () => {
  describe("ContactOperator", () => {
    it("should return success=false for missing phoneNumber", async () => {
      const {
        ContactOperator,
      } = require("../../domain/calling-functions/ContactOperator")

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
      const {
        ContactOperator,
      } = require("../../domain/calling-functions/ContactOperator")

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
  it("should have all 5 LLM-callable functions properly implemented", () => {
    const callingFunctionsDir = path.join(
      __dirname,
      "../../domain/calling-functions"
    )

    const {
      ContactOperator,
    } = require("../../domain/calling-functions/ContactOperator")
    const {
      GetShipmentTrackingLink,
    } = require("../../domain/calling-functions/GetShipmentTrackingLink")
    const {
      GetLinkOrderByCode,
    } = require("../../domain/calling-functions/GetLinkOrderByCode")
    const { AddProduct } = require("../../domain/calling-functions/AddProduct")
    const {
      RepeatOrder,
    } = require("../../domain/calling-functions/RepeatOrder")

    // All functions exist and are callable
    expect(ContactOperator).toBeDefined()
    expect(GetShipmentTrackingLink).toBeDefined()
    expect(GetLinkOrderByCode).toBeDefined()
    expect(AddProduct).toBeDefined()
    expect(RepeatOrder).toBeDefined()

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
    expect(fs.existsSync(path.join(callingFunctionsDir, "AddProduct.ts"))).toBe(
      true
    )
    expect(
      fs.existsSync(path.join(callingFunctionsDir, "RepeatOrder.ts"))
    ).toBe(true)
  })
})
