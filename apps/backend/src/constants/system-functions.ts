/**
 * System Function Definitions — SINGLE SOURCE OF TRUTH
 * 
 * These are the default definitions for system calling functions.
 * Used by:
 *   - workspace.service.ts (workspace creation)
 *   - seed.ts (database seeding)
 *   - system-functions-sync.service.ts (startup sync for new functions)
 * 
 * The DATABASE is the source of truth for descriptions at runtime.
 * These defaults are only used when CREATING new functions.
 * Admin UI edits to descriptions are NEVER overwritten.
 */

export interface SystemFunctionDef {
  functionName: string
  description: string
  parameters: Record<string, any>
  isSystemFunction: true
  executionType: "INTERNAL" | "DELEGATE_TO_AGENT"
  isActive: true
}

// ─── ALWAYS-AVAILABLE FUNCTIONS (both ecommerce and informational) ───

export const CHANGE_LANGUAGE: SystemFunctionDef = {
  functionName: "changeLanguage",
  description: "Change the customer's preferred language. Supported: Italian (it), English (en), Spanish (es), Portuguese (pt).",
  parameters: {
    type: "object",
    properties: {
      language: { type: "string", enum: ["it", "en", "es", "pt"], description: "ISO 639-1 language code" }
    },
    required: ["language"]
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

export const CUSTOMER_SUPPORT_AGENT: SystemFunctionDef = {
  functionName: "customerSupportAgent",
  description: "Delegate to Customer Support Agent for complaints, issues, human operator contact. Use when customer is frustrated or has problems. NOT for notification management.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Support request" }
    },
    required: ["query"]
  },
  isSystemFunction: true,
  executionType: "DELEGATE_TO_AGENT",
  isActive: true
}

export const PROFILE_MANAGEMENT_AGENT: SystemFunctionDef = {
  functionName: "profileManagementAgent",
  description: "Delegate to Profile Management Agent for email updates, notification preferences, profile data changes. Use for notification subscribe/unsubscribe, email change.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Profile-related request" }
    },
    required: ["query"]
  },
  isSystemFunction: true,
  executionType: "DELEGATE_TO_AGENT",
  isActive: true
}

export const MANAGE_NOTIFICATIONS: SystemFunctionDef = {
  functionName: "manageNotifications",
  description: "Manage push notification preferences (subscribe/unsubscribe).",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["subscribe", "unsubscribe"],
        description: "Action to perform"
      }
    },
    required: ["action"]
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

// ─── ECOMMERCE-ONLY FUNCTIONS ───

export const PRODUCT_SEARCH_AGENT: SystemFunctionDef = {
  functionName: "productSearchAgent",
  description: "Delegate to Product Search Agent for product catalog browsing, search, filters. Use when customer asks about products, prices, categories, certifications.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Customer's product search query" }
    },
    required: ["query"]
  },
  isSystemFunction: true,
  executionType: "DELEGATE_TO_AGENT",
  isActive: true
}

export const CART_MANAGEMENT_AGENT: SystemFunctionDef = {
  functionName: "cartManagementAgent",
  description: "Delegate to Cart Management Agent for add/remove products, view cart, modify quantities. Use when customer wants to add to cart or modify cart contents.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Cart-related request" }
    },
    required: ["query"]
  },
  isSystemFunction: true,
  executionType: "DELEGATE_TO_AGENT",
  isActive: true
}

export const ORDER_TRACKING_AGENT: SystemFunctionDef = {
  functionName: "orderTrackingAgent",
  description: "Delegate to Order Tracking Agent for order history, tracking, checkout confirmation. Use for orders, delivery status, checkout.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Order-related question" }
    },
    required: ["query"]
  },
  isSystemFunction: true,
  executionType: "DELEGATE_TO_AGENT",
  isActive: true
}

// ─── APPOINTMENT BOOKING FUNCTIONS ───

export const LIST_AVAILABLE_SLOTS: SystemFunctionDef = {
  functionName: "listAvailableSlots",
  description: "Show available slots for appointment booking. Use when customer wants to book an appointment, asks about availability.",
  parameters: {
    type: "object",
    properties: {
      serviceId: { type: "string", description: "ID of bookable service (optional)" },
      daysAhead: { type: "number", description: "How many days ahead to search (default 7, max 14)" },
      targetDate: { type: "string", description: "Specific date YYYY-MM-DD" }
    },
    required: []
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

export const BOOK_APPOINTMENT: SystemFunctionDef = {
  functionName: "bookAppointment",
  description: "Book an appointment. Use when customer has chosen a slot from the list. Requires serviceId and startTime from the listAvailableSlots response.",
  parameters: {
    type: "object",
    properties: {
      serviceId: { type: "string", description: "ID of bookable service" },
      startTime: { type: "string", description: "Start time in ISO 8601 format" },
      customerNotes: { type: "string", description: "Optional customer notes" }
    },
    required: ["serviceId", "startTime"]
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

export const CANCEL_APPOINTMENT: SystemFunctionDef = {
  functionName: "cancelAppointment",
  description: "Cancel an existing appointment. Use when customer wants to cancel a booked appointment.",
  parameters: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "ID of appointment to cancel" },
      reason: { type: "string", description: "Cancellation reason (optional)" }
    },
    required: ["appointmentId"]
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

export const RESCHEDULE_APPOINTMENT: SystemFunctionDef = {
  functionName: "rescheduleAppointment",
  description: "Reschedule an existing appointment to a new time. Use when customer wants to move their appointment to a different slot.",
  parameters: {
    type: "object",
    properties: {
      appointmentId: { type: "string", description: "ID of appointment to reschedule" },
      newStartTime: { type: "string", description: "New start time in ISO 8601 format" },
      reason: { type: "string", description: "Reason for rescheduling (optional)" }
    },
    required: ["appointmentId", "newStartTime"]
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

export const GET_CUSTOMER_APPOINTMENTS: SystemFunctionDef = {
  functionName: "getCustomerAppointments",
  description: "Show customer's existing/upcoming appointments. Use when customer asks ABOUT their appointments (when is my appointment, do I have a booking, show me my reservations, quando ho l'appuntamento, mis citas, quand est mon rendez-vous). DO NOT use to book new appointments — use listAvailableSlots + bookAppointment for that.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  },
  isSystemFunction: true,
  executionType: "INTERNAL",
  isActive: true
}

// ─── GROUPED EXPORTS ───

export const ALWAYS_AVAILABLE_FUNCTIONS: SystemFunctionDef[] = [
  CUSTOMER_SUPPORT_AGENT,
  PROFILE_MANAGEMENT_AGENT,
  MANAGE_NOTIFICATIONS,
  CHANGE_LANGUAGE,
]

export const ECOMMERCE_FUNCTIONS: SystemFunctionDef[] = [
  PRODUCT_SEARCH_AGENT,
  CART_MANAGEMENT_AGENT,
  ORDER_TRACKING_AGENT,
]

export const APPOINTMENT_FUNCTIONS: SystemFunctionDef[] = [
  LIST_AVAILABLE_SLOTS,
  BOOK_APPOINTMENT,
  CANCEL_APPOINTMENT,
  RESCHEDULE_APPOINTMENT,
  GET_CUSTOMER_APPOINTMENTS,
]

/** All system functions for a full ecommerce workspace */
export const ALL_ECOMMERCE_FUNCTIONS: SystemFunctionDef[] = [
  ...ECOMMERCE_FUNCTIONS,
  ...ALWAYS_AVAILABLE_FUNCTIONS,
  ...APPOINTMENT_FUNCTIONS,
]

/** All system functions for an informational workspace */
export const ALL_INFO_FUNCTIONS: SystemFunctionDef[] = [
  ...ALWAYS_AVAILABLE_FUNCTIONS,
  ...APPOINTMENT_FUNCTIONS,
]
