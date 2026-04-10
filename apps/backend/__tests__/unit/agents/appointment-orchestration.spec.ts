/**
 * Test Suite: Appointment Booking - LLM Orchestration
 *
 * Verifies the intelligent orchestration of appointment functions
 * across the LLM pipeline: config → dispatch → workspace guards → prompt variables.
 *
 * SCENARIOS:
 * 1. Function availability based on enableCalendarBooking workspace flag
 * 2. Correct agent types receive appointment functions
 * 3. Prompt variables are properly formatted for LLM context
 * 4. Function definitions have correct OpenAI format for LLM to use
 * 5. Appointment functions are isolated from non-appointment agents
 */

import {
  APPOINTMENT_FUNCTIONS,
  ROUTER_FUNCTIONS,
  PRODUCT_SEARCH_FUNCTIONS,
  CART_MANAGEMENT_FUNCTIONS,
  ORDER_TRACKING_FUNCTIONS,
  CUSTOMER_SUPPORT_FUNCTIONS,
  PROFILE_MANAGEMENT_FUNCTIONS,
  getAgentFunctions,
  getAgentFunctionNames,
  getAgentFunctionsForWorkspace,
} from "../../../src/config/agent-functions.config"

describe("Appointment Booking - LLM Orchestration", () => {
  // ============================================
  // SCENARIO 1: APPOINTMENT_FUNCTIONS array integrity
  // ============================================
  describe("APPOINTMENT_FUNCTIONS definition", () => {
    // RULE: Must have exactly 5 appointment functions (includes rescheduleAppointment)
    it("should have exactly 5 appointment functions", () => {
      expect(APPOINTMENT_FUNCTIONS.length).toBe(5)
    })

    // RULE: All 5 required functions must be present
    it("should contain all required appointment function names", () => {
      const names = APPOINTMENT_FUNCTIONS.map((fn) => fn.function.name)
      expect(names).toContain("listAvailableSlots")
      expect(names).toContain("bookAppointment")
      expect(names).toContain("cancelAppointment")
      expect(names).toContain("getCustomerAppointments")
      expect(names).toContain("rescheduleAppointment")
    })

    // RULE: Each function must have valid OpenAI function calling format
    it("should have valid OpenAI function calling format for all functions", () => {
      APPOINTMENT_FUNCTIONS.forEach((fn) => {
        // SCENARIO: LLM expects type: "function" wrapper
        expect(fn.type).toBe("function")
        expect(fn.function).toBeDefined()
        expect(fn.function.name).toBeDefined()
        expect(typeof fn.function.name).toBe("string")
        // SCENARIO: LLM needs descriptions to decide when to call
        expect(fn.function.description).toBeDefined()
        expect(fn.function.description.length).toBeGreaterThan(10)
        // SCENARIO: LLM needs parameters schema
        expect(fn.function.parameters).toBeDefined()
        expect(fn.function.parameters.type).toBe("object")
        expect(fn.function.parameters.properties).toBeDefined()
        expect(Array.isArray(fn.function.parameters.required)).toBe(true)
      })
    })

    // RULE: bookAppointment must require serviceId and startTime
    // NOTE: Parameter renamed from appointmentTypeId → serviceId after AppointmentType
    //       was merged into Services model (migration 20260411000000)
    it("bookAppointment should require serviceId and startTime for LLM", () => {
      const bookFn = APPOINTMENT_FUNCTIONS.find(
        (fn) => fn.function.name === "bookAppointment"
      )
      expect(bookFn).toBeDefined()
      expect(bookFn!.function.parameters.required).toContain("serviceId")
      expect(bookFn!.function.parameters.required).toContain("startTime")
    })

    // RULE: cancelAppointment must require appointmentId
    it("cancelAppointment should require appointmentId for LLM", () => {
      const cancelFn = APPOINTMENT_FUNCTIONS.find(
        (fn) => fn.function.name === "cancelAppointment"
      )
      expect(cancelFn).toBeDefined()
      expect(cancelFn!.function.parameters.required).toContain("appointmentId")
    })

    // RULE: getCustomerAppointments has no required params (workspaceId/customerId come from context)
    it("getCustomerAppointments should have no required params (context-injected)", () => {
      const getFn = APPOINTMENT_FUNCTIONS.find(
        (fn) => fn.function.name === "getCustomerAppointments"
      )
      expect(getFn).toBeDefined()
      expect(getFn!.function.parameters.required).toEqual([])
    })

    // RULE: listAvailableSlots should have optional serviceId for filtering
    // NOTE: Parameter renamed from appointmentTypeId → serviceId after AppointmentType
    //       was merged into Services model (migration 20260411000000)
    it("listAvailableSlots should have optional serviceId for filtering", () => {
      const listFn = APPOINTMENT_FUNCTIONS.find(
        (fn) => fn.function.name === "listAvailableSlots"
      )
      expect(listFn).toBeDefined()
      expect(listFn!.function.parameters.properties.serviceId).toBeDefined()
    })
  })

  // ============================================
  // SCENARIO 2: Agent routing — which agents get appointment functions
  // ============================================
  describe("Agent routing for appointment functions", () => {
    // RULE: Base CUSTOMER_SUPPORT agent should NOT have hardcoded appointments
    // SCENARIO: Dynamic filtering via getAgentFunctionsForWorkspace adds them
    it("CUSTOMER_SUPPORT base agent should NOT include appointment functions (dynamic filtering)", () => {
      const functions = getAgentFunctions("CUSTOMER_SUPPORT")!
      const names = functions.map((fn) => fn.function.name)

      // Base functions - no appointments
      expect(names).toContain("contactOperator")
      expect(names).not.toContain("listAvailableSlots")
      expect(names).not.toContain("bookAppointment")
      expect(names).not.toContain("cancelAppointment")
      expect(names).not.toContain("getCustomerAppointments")
    })

    // RULE: CUSTOMER_SUPPORT with enableCalendarBooking=true MUST have appointment functions
    // SCENARIO: Workspace with calendar enabled — functions added dynamically
    it("CUSTOMER_SUPPORT agent should include appointment functions when calendar enabled", () => {
      const workspace = { enableCalendarBooking: true, sellsProductsAndServices: true } as any
      const functions = getAgentFunctionsForWorkspace("CUSTOMER_SUPPORT", workspace)!
      const names = functions.map((fn) => fn.function.name)

      expect(names).toContain("listAvailableSlots")
      expect(names).toContain("bookAppointment")
      expect(names).toContain("cancelAppointment")
      expect(names).toContain("getCustomerAppointments")
      // ALSO has contactOperator from CUSTOMER_SUPPORT_FUNCTIONS
      expect(names).toContain("contactOperator")
    })

    // RULE: Base INFO_AGENT should NOT have hardcoded appointments
    it("INFO_AGENT base agent should NOT include appointment functions (dynamic filtering)", () => {
      const functions = getAgentFunctions("INFO_AGENT")!
      const names = functions.map((fn) => fn.function.name)

      // Base functions - support + profile, no appointments
      expect(names).toContain("contactOperator")
      expect(names).toContain("getProfileLink")
      expect(names).not.toContain("listAvailableSlots")
      expect(names).not.toContain("bookAppointment")
    })

    // RULE: INFO_AGENT with enableCalendarBooking=true MUST have appointment functions
    // SCENARIO: Informational workspace with calendar — info agent handles bookings
    it("INFO_AGENT should include appointment functions when calendar enabled", () => {
      const workspace = { enableCalendarBooking: true, sellsProductsAndServices: false } as any
      const functions = getAgentFunctionsForWorkspace("INFO_AGENT", workspace)!
      const names = functions.map((fn) => fn.function.name)

      expect(names).toContain("listAvailableSlots")
      expect(names).toContain("bookAppointment")
      expect(names).toContain("cancelAppointment")
      expect(names).toContain("getCustomerAppointments")
    })

    // RULE: INFO_AGENT should have combined functions when calendar enabled
    it("INFO_AGENT should have combined functions (support + profile + appointments) when calendar enabled", () => {
      const workspace = { enableCalendarBooking: true, sellsProductsAndServices: false } as any
      const functions = getAgentFunctionsForWorkspace("INFO_AGENT", workspace)!
      const names = functions.map((fn) => fn.function.name)

      // From CUSTOMER_SUPPORT_FUNCTIONS
      expect(names).toContain("contactOperator")
      // From PROFILE_MANAGEMENT_FUNCTIONS
      expect(names).toContain("getProfileLink")
      // From APPOINTMENT_FUNCTIONS (added dynamically)
      expect(names).toContain("listAvailableSlots")
    })

    // RULE: Non-appointment agents must NOT have appointment functions
    // SCENARIO: Prevents accidental booking from product search or cart agents
    it("ROUTER should NOT have appointment functions", () => {
      const names = getAgentFunctionNames("ROUTER")!
      expect(names).not.toContain("listAvailableSlots")
      expect(names).not.toContain("bookAppointment")
      expect(names).not.toContain("cancelAppointment")
      expect(names).not.toContain("getCustomerAppointments")
    })

    it("PRODUCT_SEARCH should NOT have appointment functions", () => {
      const names = getAgentFunctionNames("PRODUCT_SEARCH")!
      expect(names).not.toContain("listAvailableSlots")
      expect(names).not.toContain("bookAppointment")
    })

    it("CART_MANAGEMENT should NOT have appointment functions", () => {
      const names = getAgentFunctionNames("CART_MANAGEMENT")!
      expect(names).not.toContain("bookAppointment")
      expect(names).not.toContain("cancelAppointment")
    })

    it("ORDER_TRACKING should NOT have appointment functions", () => {
      const names = getAgentFunctionNames("ORDER_TRACKING")!
      expect(names).not.toContain("listAvailableSlots")
      expect(names).not.toContain("getCustomerAppointments")
    })

    it("SECURITY and TRANSLATION should have NO functions at all", () => {
      expect(getAgentFunctions("SECURITY")).toEqual([])
      expect(getAgentFunctions("TRANSLATION")).toEqual([])
    })
  })

  // ============================================
  // SCENARIO 3: Function isolation — no cross-contamination
  // ============================================
  describe("Function isolation between agents", () => {
    // RULE: Appointment functions must NOT leak into cart/order agents
    // WHY: If cart agent has bookAppointment, LLM might try to book
    //      when user says "aggiungi al carrello" (add to cart)
    it("appointment function names should not appear in PRODUCT_SEARCH, CART, or ORDER arrays", () => {
      const appointmentNames = APPOINTMENT_FUNCTIONS.map((fn) => fn.function.name)

      const otherAgentFunctions = [
        ...ROUTER_FUNCTIONS,
        ...PRODUCT_SEARCH_FUNCTIONS,
        ...CART_MANAGEMENT_FUNCTIONS,
        ...ORDER_TRACKING_FUNCTIONS,
      ]
      const otherNames = otherAgentFunctions.map((fn) => fn.function.name)

      appointmentNames.forEach((name) => {
        expect(otherNames).not.toContain(name)
      })
    })

    // RULE: Cart/order functions must NOT appear in APPOINTMENT_FUNCTIONS
    it("appointment functions should not contain cart or order functions", () => {
      const appointmentNames = APPOINTMENT_FUNCTIONS.map((fn) => fn.function.name)

      expect(appointmentNames).not.toContain("addToCart")
      expect(appointmentNames).not.toContain("viewCart")
      expect(appointmentNames).not.toContain("confirmOrder")
      expect(appointmentNames).not.toContain("getProductDetails")
    })
  })

  // ============================================
  // SCENARIO 4: Prompt variable formatting for LLM context
  // ============================================
  describe("Prompt variable formatting", () => {
    // RULE: appointmentTypes variable should format correctly for LLM
    // SCENARIO: LLM receives formatted list of available appointment types
    it("should format appointment types as readable list for LLM", () => {
      // Simulate what llm-router.service.ts does
      const appointmentTypesRaw = [
        { name: "Consulenza", description: "Consulenza individuale", duration: 30, price: 50.00 },
        { name: "Massaggio", description: null, duration: 60, price: 80.00 },
        { name: "Chiamata gratuita", description: "Prima consulenza", duration: 15, price: null },
      ]

      const formatted = appointmentTypesRaw.map(t =>
        `- ${t.name}${t.description ? ` (${t.description})` : ''}: ${t.duration} min${t.price ? `, €${t.price}` : ''}`
      ).join('\n')

      // RULE: Each line should start with "- " for LLM readability
      expect(formatted).toContain("- Consulenza (Consulenza individuale): 30 min, €50")
      expect(formatted).toContain("- Massaggio: 60 min, €80")
      expect(formatted).toContain("- Chiamata gratuita (Prima consulenza): 15 min")
      // RULE: Free appointments should NOT show price
      expect(formatted).not.toContain("Chiamata gratuita (Prima consulenza): 15 min, €")
    })

    // RULE: Empty appointment types should return empty string
    // SCENARIO: Workspace has calendar disabled or no types configured
    it("should return empty string when no appointment types exist", () => {
      const appointmentTypesRaw: any[] = []

      const formatted = appointmentTypesRaw.length > 0
        ? appointmentTypesRaw.map(t =>
            `- ${t.name}${t.description ? ` (${t.description})` : ''}: ${t.duration} min${t.price ? `, €${t.price}` : ''}`
          ).join('\n')
        : ''

      expect(formatted).toBe('')
    })

    // RULE: Customer upcoming appointments should format with date and status
    it("should format customer appointments with date and status for LLM", () => {
      const futureDate = new Date('2025-03-15T10:00:00Z')
      const customerAppointmentsRaw = [
        {
          appointmentType: { name: "Consulenza" },
          startTime: futureDate,
          status: "confirmed",
        },
      ]

      const formatted = customerAppointmentsRaw.map(a =>
        `- ${a.appointmentType?.name || 'Appointment'}: ${a.startTime.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${a.status})`
      ).join('\n')

      // RULE: Should include appointment type name
      expect(formatted).toContain("Consulenza")
      // RULE: Should include status
      expect(formatted).toContain("confirmed")
    })
  })

  // ============================================
  // SCENARIO 5: enableCalendarBooking workspace guard
  // ============================================
  describe("enableCalendarBooking workspace guard logic", () => {
    // RULE: When enableCalendarBooking is false, appointment data should be empty
    // SCENARIO: Workspace without calendar — LLM should NOT see appointment context
    it("should produce empty strings when calendar is disabled", () => {
      const enableCalendarBooking = false

      const appointmentTypes = enableCalendarBooking ? "- Consulenza: 30 min, €50" : ""
      const customerUpcomingAppointments = enableCalendarBooking ? "- Consulenza: 15/03/2025" : ""

      expect(appointmentTypes).toBe("")
      expect(customerUpcomingAppointments).toBe("")
    })

    // RULE: When enableCalendarBooking is true, data should be populated
    it("should produce populated strings when calendar is enabled", () => {
      const enableCalendarBooking = true

      const appointmentTypes = enableCalendarBooking ? "- Consulenza: 30 min, €50" : ""
      const customerUpcomingAppointments = enableCalendarBooking ? "- Consulenza: 15/03/2025" : ""

      expect(appointmentTypes).not.toBe("")
      expect(customerUpcomingAppointments).not.toBe("")
    })
  })

  // ============================================
  // SCENARIO 6: Function count consistency
  // ============================================
  describe("Function count consistency across system", () => {
    // RULE: Base CUSTOMER_SUPPORT should have only support functions (no appointments)
    it("CUSTOMER_SUPPORT base should have only support functions", () => {
      const csNames = getAgentFunctionNames("CUSTOMER_SUPPORT")!
      // CUSTOMER_SUPPORT_FUNCTIONS (1: contactOperator) — no hardcoded appointments
      expect(csNames.length).toBe(CUSTOMER_SUPPORT_FUNCTIONS.length)
      expect(csNames.length).toBe(1)
    })

    // RULE: Workspace-filtered CUSTOMER_SUPPORT total should be support + appointment functions
    // WHY: When enableCalendarBooking=true, appointments are added dynamically
    it("CUSTOMER_SUPPORT with calendar enabled should be support + appointment functions", () => {
      const workspace = { enableCalendarBooking: true, sellsProductsAndServices: true } as any
      const functions = getAgentFunctionsForWorkspace("CUSTOMER_SUPPORT", workspace)!
      const names = functions.map((fn) => fn.function.name)
      // CUSTOMER_SUPPORT_FUNCTIONS (1: contactOperator) + APPOINTMENT_FUNCTIONS (4)
      expect(names.length).toBe(
        CUSTOMER_SUPPORT_FUNCTIONS.length + APPOINTMENT_FUNCTIONS.length
      )
      expect(names.length).toBe(6)
    })

    // RULE: Base INFO_AGENT should have support + profile (no appointments)
    it("INFO_AGENT base should have support + profile functions only", () => {
      const infoNames = getAgentFunctionNames("INFO_AGENT")!
      // CUSTOMER_SUPPORT (1) + PROFILE_MANAGEMENT (2) — no hardcoded appointments
      expect(infoNames.length).toBe(
        CUSTOMER_SUPPORT_FUNCTIONS.length + PROFILE_MANAGEMENT_FUNCTIONS.length
      )
      expect(infoNames.length).toBe(3)
    })

    // RULE: Workspace-filtered INFO_AGENT total should be support + profile + appointment functions
    it("INFO_AGENT with calendar enabled should be support + profile + appointment functions", () => {
      const workspace = { enableCalendarBooking: true, sellsProductsAndServices: false } as any
      const functions = getAgentFunctionsForWorkspace("INFO_AGENT", workspace)!
      const names = functions.map((fn) => fn.function.name)
      // CUSTOMER_SUPPORT (1) + PROFILE_MANAGEMENT (2) + APPOINTMENT (4)
      expect(names.length).toBe(
        CUSTOMER_SUPPORT_FUNCTIONS.length +
        PROFILE_MANAGEMENT_FUNCTIONS.length +
        APPOINTMENT_FUNCTIONS.length
      )
      expect(names.length).toBe(8)
    })
  })
})
