/**
 * Widget Chat Test Fixtures
 * Used across all widget feature tests
 */

export const WIDGET_FIXTURES = {
  visitorIds: {
    valid_1: "visitor_1726262000000_a7k2m9x1",
    valid_2: "visitor_1726262001000_b8l3n0y2",
    invalid_format: "invalid_visitor_id",
    expired: "visitor_1704067200000_expired123", // Timestamp from Dec 2023
  },

  sessionIds: {
    active_1: "session_uuid_12345678",
    active_2: "session_uuid_87654321",
    invalid: "not_a_valid_uuid",
  },

  messages: {
    simple: {
      visitorId: "visitor_1726262000000_a7k2m9x1",
      message: "Ciao! Mi serve aiuto",
      sessionId: "session_uuid_12345678",
    },
    empty: {
      visitorId: "visitor_1726262000000_a7k2m9x1",
      message: "",
      sessionId: "session_uuid_12345678",
    },
    xss_attempt: {
      visitorId: "visitor_1726262000000_a7k2m9x1",
      message: "<script>alert('XSS')</script>",
      sessionId: "session_uuid_12345678",
    },
    long_message: {
      visitorId: "visitor_1726262000000_a7k2m9x1",
      message: "A".repeat(5000), // Test max length validation
      sessionId: "session_uuid_12345678",
    },
  },

  responses: {
    pending: {
      status: "pending",
      message: null,
      retryAfter: 500,
      isComplete: false,
    },
    ready: {
      status: "ready",
      message: "Grazie per la tua domanda! Ecco la risposta...",
      retryAfter: null,
      isComplete: true,
    },
    blocked: {
      status: "blocked",
      message: "Servizio temporaneamente indisponibile",
      retryAfter: 3600,
      isComplete: false,
    },
    error: {
      status: "error",
      message: "Si è verificato un errore",
      retryAfter: 500,
      isComplete: false,
    },
  },

  scenarios: {
    happy_path: {
      description: "User sends valid message, receives response",
      steps: [
        { action: "POST /api/v1/widget/chat", payload: "messages.simple" },
        { action: "GET /api/v1/widget/poll", attempt: 1, expectStatus: "pending" },
        { action: "GET /api/v1/widget/poll", attempt: 30, expectStatus: "ready" },
      ],
    },
    timeout: {
      description: "Message processing exceeds 15 seconds",
      steps: [
        { action: "POST /api/v1/widget/chat", payload: "messages.simple" },
        { action: "GET /api/v1/widget/poll", attempt: 30, expectStatus: "ready" },
        { action: "GET /api/v1/widget/poll", attempt: 31, expectStatus: "error" },
      ],
    },
    rate_limit: {
      description: "Too many requests from same visitor",
      steps: [
        { action: "POST /api/v1/widget/chat", expectStatus: 200 },
        { action: "POST /api/v1/widget/chat", expectStatus: 200 },
        { action: "POST /api/v1/widget/chat", expectStatus: 429 }, // Too Many Requests
      ],
    },
  },
};

// Type helpers for testing
export type WidgetMessage = typeof WIDGET_FIXTURES.messages.simple;
export type WidgetResponse = typeof WIDGET_FIXTURES.responses.pending;
export type WidgetScenario = keyof typeof WIDGET_FIXTURES.scenarios;
