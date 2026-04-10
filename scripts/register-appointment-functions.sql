-- ========================================
-- Register Appointment Calling Functions
-- Workspace: echatbot-hq-support
-- ========================================
-- Purpose: Enable appointment booking by registering 5 calling functions
-- Required for: Router Agent to offer bookAppointment, listAvailableSlots, etc.

BEGIN;

-- 1. listAvailableSlots
INSERT INTO workspace_calling_functions (
  "workspaceId",
  "functionName",
  description,
  parameters,
  "isSystemFunction",
  "executionType",
  "isActive"
) VALUES (
  'echatbot-hq-support',
  'listAvailableSlots',
  'Show available slots for appointment booking. Use when customer wants to book an appointment, asks about availability.',
  '{
    "type": "object",
    "properties": {
      "appointmentTypeId": {"type": "string", "description": "ID of appointment type (optional)"},
      "daysAhead": {"type": "number", "description": "How many days ahead to search (default 7, max 14)"}
    },
    "required": []
  }'::jsonb,
  true,
  'INTERNAL',
  true
) ON CONFLICT ("workspaceId", "functionName") DO NOTHING;

-- 2. bookAppointment
INSERT INTO workspace_calling_functions (
  "workspaceId",
  "functionName",
  description,
  parameters,
  "isSystemFunction",
  "executionType",
  "isActive"
) VALUES (
  'echatbot-hq-support',
  'bookAppointment',
  'Confirm an appointment booking. Use when customer has chosen a slot and confirms. Requires appointmentTypeId and startTime.',
  '{
    "type": "object",
    "properties": {
      "appointmentTypeId": {"type": "string", "description": "ID of appointment type"},
      "startTime": {"type": "string", "description": "Start time in ISO 8601 format"},
      "customerNotes": {"type": "string", "description": "Optional customer notes"}
    },
    "required": ["appointmentTypeId", "startTime"]
  }'::jsonb,
  true,
  'INTERNAL',
  true
) ON CONFLICT ("workspaceId", "functionName") DO NOTHING;

-- 3. cancelAppointment
INSERT INTO workspace_calling_functions (
  "workspaceId",
  "functionName",
  description,
  parameters,
  "isSystemFunction",
  "executionType",
  "isActive"
) VALUES (
  'echatbot-hq-support',
  'cancelAppointment',
  'Cancel an existing appointment. Use when customer wants to cancel a booked appointment.',
  '{
    "type": "object",
    "properties": {
      "appointmentId": {"type": "string", "description": "ID of appointment to cancel"},
      "reason": {"type": "string", "description": "Cancellation reason (optional)"}
    },
    "required": ["appointmentId"]
  }'::jsonb,
  true,
  'INTERNAL',
  true
) ON CONFLICT ("workspaceId", "functionName") DO NOTHING;

-- 4. getCustomerAppointments
INSERT INTO workspace_calling_functions (
  "workspaceId",
  "functionName",
  description,
  parameters,
  "isSystemFunction",
  "executionType",
  "isActive"
) VALUES (
  'echatbot-hq-support',
  'getCustomerAppointments',
  'Show customer''s upcoming appointments. Use when customer asks about their bookings.',
  '{
    "type": "object",
    "properties": {},
    "required": []
  }'::jsonb,
  true,
  'INTERNAL',
  true
) ON CONFLICT ("workspaceId", "functionName") DO NOTHING;

-- 5. rescheduleAppointment
INSERT INTO workspace_calling_functions (
  "workspaceId",
  "functionName",
  description,
  parameters,
  "isSystemFunction",
  "executionType",
  "isActive"
) VALUES (
  'echatbot-hq-support',
  'rescheduleAppointment',
  'Reschedule an existing appointment to a new time. Use when customer wants to move their appointment to a different slot.',
  '{
    "type": "object",
    "properties": {
      "appointmentId": {"type": "string", "description": "ID of appointment to reschedule"},
      "newStartTime": {"type": "string", "description": "New start time in ISO 8601 format"},
      "reason": {"type": "string", "description": "Reason for rescheduling (optional)"}
    },
    "required": ["appointmentId", "newStartTime"]
  }'::jsonb,
  true,
  'INTERNAL',
  true
) ON CONFLICT ("workspaceId", "functionName") DO NOTHING;

-- 6. Update Router Agent's availableFunctions array
UPDATE agent_configs
SET "availableFunctions" = "availableFunctions" || '["listAvailableSlots", "bookAppointment", "cancelAppointment", "getCustomerAppointments", "rescheduleAppointment"]'::jsonb
WHERE "workspaceId" = 'echatbot-hq-support'
  AND type = 'ROUTER'
  AND NOT ("availableFunctions" ? 'bookAppointment'); -- Only if not already present

COMMIT;

-- Verify
SELECT 'Calling Functions Registered:' AS status, COUNT(*) AS count
FROM workspace_calling_functions
WHERE "workspaceId" = 'echatbot-hq-support'
  AND "functionName" LIKE '%ppointment%';

SELECT 'Router Agent Functions:' AS status, "availableFunctions"
FROM agent_configs
WHERE "workspaceId" = 'echatbot-hq-support'
  AND type = 'ROUTER';
