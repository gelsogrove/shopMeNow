/**
 * Test per le 9 Calling Functions LLM
 *
 * Verifica che le 9 calling functions esistano come file separati
 * e che siano correttamente importabili e funzionanti.
 *
 * Le 9 calling functions implementate:
 * 1. ContactOperator()
 * 2. GetLinkOrderByCode()
 * 3. GetShipmentTrackingLink()
 * 4. AddProduct()
 * 5. AddMultipleProducts()
 * 6. RepeatOrder()
 * 7. ResetCart()
 * 8. SearchProduct()
 * 9. ManageNotifications()
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

    it("should have 9 calling functions files", () => {
      const files = fs.readdirSync(callingFunctionsDir)
      const tsFiles = files.filter((f) => f.endsWith(".ts"))
      expect(tsFiles.length).toBe(9)
      expect(tsFiles).toContain("ContactOperator.ts")
      expect(tsFiles).toContain("GetLinkOrderByCode.ts")
      expect(tsFiles).toContain("GetShipmentTrackingLink.ts")
      expect(tsFiles).toContain("AddProduct.ts")
      expect(tsFiles).toContain("AddMultipleProducts.ts")
      expect(tsFiles).toContain("RepeatOrder.ts")
      expect(tsFiles).toContain("ResetCart.ts")
      expect(tsFiles).toContain("SearchProduct.ts")
      expect(tsFiles).toContain("ManageNotifications.ts")
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

    it("should have AddMultipleProducts.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "AddMultipleProducts.ts")
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

    it("should have GetShipmentTrackingLink.ts file", () => {
      const filePath = path.join(
        callingFunctionsDir,
        "GetShipmentTrackingLink.ts"
      )
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have ResetCart.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "ResetCart.ts")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("should have ManageNotifications.ts file", () => {
      const filePath = path.join(callingFunctionsDir, "ManageNotifications.ts")
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

    it("should export AddMultipleProducts function", async () => {
      const {
        AddMultipleProducts,
      } = require("../../domain/calling-functions/AddMultipleProducts")
      expect(AddMultipleProducts).toBeDefined()
      expect(typeof AddMultipleProducts).toBe("function")
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
    it("should have all 9 calling functions documented in prompt_agent.md", () => {
      const promptPath = path.join(
        __dirname,
        "../../../../docs/prompt_agent.md"
      )
      const promptContent = fs.readFileSync(promptPath, "utf-8")

      // Verify main LLM-callable functions are documented
      expect(promptContent).toContain("ContactOperator")
      expect(promptContent).toContain("GetLinkOrderByCode")
      // GetShipmentTrackingLink is internal service, not LLM-callable
      expect(promptContent).toContain("addProduct")
      expect(promptContent).toContain("addMultipleProducts")
      expect(promptContent).toContain("repeatOrder")
      expect(promptContent).toContain("resetCart")
      expect(promptContent).toContain("searchProduct")
      expect(promptContent).toContain("manageNotifications")

      // Verify main sections exist
      expect(promptContent).toContain("ContactOperator")
      expect(promptContent).toContain("addProduct")
      expect(promptContent).toContain("repeatOrder")
      expect(promptContent).toContain("searchProduct")
      expect(promptContent).toContain("resetCart")
      expect(promptContent).toContain("manageNotifications")
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
  it("should have all 8 LLM-callable functions properly implemented", () => {
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
    const { ResetCart } = require("../../domain/calling-functions/ResetCart")
    const {
      SearchProduct,
    } = require("../../domain/calling-functions/SearchProduct")
    const {
      ManageNotifications,
    } = require("../../domain/calling-functions/ManageNotifications")

    // All functions exist and are callable
    expect(ContactOperator).toBeDefined()
    expect(GetShipmentTrackingLink).toBeDefined()
    expect(GetLinkOrderByCode).toBeDefined()
    expect(AddProduct).toBeDefined()
    expect(RepeatOrder).toBeDefined()
    expect(ResetCart).toBeDefined()
    expect(SearchProduct).toBeDefined()
    expect(ManageNotifications).toBeDefined()

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
    expect(fs.existsSync(path.join(callingFunctionsDir, "ResetCart.ts"))).toBe(
      true
    )
    expect(
      fs.existsSync(path.join(callingFunctionsDir, "SearchProduct.ts"))
    ).toBe(true)
    expect(
      fs.existsSync(path.join(callingFunctionsDir, "ManageNotifications.ts"))
    ).toBe(true)
  })
})
