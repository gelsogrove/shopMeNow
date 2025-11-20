# Feature Specification: WhatsApp Message Queue with Cron Processor

**Feature Branch**: `180-whatsapp-queue`  
**Created**: 2025-11-20  
**Status**: Draft  
**Input**: User description: "come hai visto tutto quello che facciamo va a finire in una coda di whatsapp dove molto semplicmente avremo telefono, messaggio, dataora inviato/no poi avremo un cronjob che prende ua row alla volta e manda un mesaggio 'ogni 3 secondi' i messaggi mandati devono avere poi una spunta di inviato nell history e vanno cancellati una volta mandati dallla coda ovviamente whatspp layer non e' ancora stato implemetnato quindi la funzione send diciamo deve controllare di avere ricevuto tutti i campi (valida )ed e' pronta ad inviare il messaggio metteremo un CONSOLE:LOG('SEND MESSAGE WHATSAPP' quindi detto questo voglio nel menu in alto a destra una voce che si chiama queue dove possiamo vedere la situazione questa tabella deve avere anche il campo error: perche' se ha dato errore dobbiamo vedere l'errore se questo messaggio non ha superato AGENT de security dobbiamo segnaalare errore"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Queue Management UI for Monitoring (Priority: P1)

**As an** admin operator  
**I want to** view the WhatsApp message queue status in real-time  
**So that** I can monitor pending messages, delivery status, and errors

**Why this priority**: Critical visibility for operators to monitor system health and troubleshoot delivery issues. Without this, operators are blind to message queue status.

**Independent Test**: Can be fully tested by navigating to Queue page and viewing current pending/failed messages, delivers immediate value for operational monitoring.

**Acceptance Scenarios**:

1. **Given** I am logged in as admin, **When** I click "Queue" in top-right menu, **Then** I see a table with columns: Phone Number, Message, Timestamp, Status (sent/pending/error), Error Message
2. **Given** there are pending messages in queue, **When** I view the queue page, **Then** I see them listed with "pending" status
3. **Given** a message failed security validation, **When** I view the queue, **Then** I see error status with "Safety validation failed" error message
4. **Given** a message failed to send, **When** I view the queue, **Then** I see error details in the Error column

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: QueuePage component with DataTable, real-time refresh, error display
- [ ] Backend API: GET /api/workspaces/:workspaceId/whatsapp-queue route with auth + workspace validation
- [ ] Service Layer: WhatsAppQueueService.getQueueStatus(workspaceId) with workspace isolation
- [ ] Repository: WhatsAppQueueRepository.findByWorkspace(workspaceId) query
- [ ] Database: Migration for whatsapp_queue table, seed with test data
- [ ] Security: authMiddleware + validateWorkspaceOperation on queue routes
- [ ] Testing: Unit tests for queue service, security tests for workspace isolation
- [ ] Documentation: Swagger docs for queue endpoints
- [ ] Concurrency: Read-only operation, no locking needed
- [ ] Code Cleanliness: Single QueuePage component, no duplication

---

### User Story 2 - Automated Message Processing with Cron (Priority: P2)

**As the** system  
**I want to** process queued messages every 3 seconds  
**So that** messages are sent reliably and marked as delivered

**Why this priority**: Core functionality for message delivery. P2 because queue visibility (P1) is needed first for debugging.

**Independent Test**: Can be tested by adding messages to queue and verifying cron job processes them every 3 seconds with console logs.

**Acceptance Scenarios**:

1. **Given** there are messages in the queue, **When** cron job runs (every 3 seconds), **Then** it processes one message and logs "SEND MESSAGE WHATSAPP" to console
2. **Given** a message is successfully "sent", **When** cron processes it, **Then** message is deleted from queue AND marked as delivered in conversation history
3. **Given** a message fails validation, **When** cron processes it, **Then** message stays in queue with error status and error message recorded
4. **Given** cron job is running, **When** it processes messages, **Then** it waits 3 seconds between each message send

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Not applicable (server-side cron)
- [ ] Backend API: Cron scheduler using node-cron or similar
- [ ] Service Layer: WhatsAppQueueService.processPendingMessages() with error handling
- [ ] Repository: findPending(), updateStatus(), deleteMessage(), markDelivered() methods
- [ ] Database: Status field (pending/sent/error), error field, deliveredAt timestamp
- [ ] Security: Cron runs server-side, no external API exposure
- [ ] Testing: Unit tests for cron logic, integration tests simulating queue processing
- [ ] Documentation: Document cron configuration in README
- [ ] Concurrency: Process one message at a time, use row-level locking or sequential processing
- [ ] Code Cleanliness: Separate cron job file, clean error handling

---

### User Story 3 - Message Validation Before Queuing (Priority: P3)

**As the** system  
**I want to** validate all required fields before adding to queue  
**So that** only valid messages are queued for sending

**Why this priority**: P3 because validation can be added after basic queue + cron is working. Helps ensure data quality.

**Independent Test**: Can be tested by attempting to queue messages with missing fields and verifying rejection.

**Acceptance Scenarios**:

1. **Given** a message is ready to queue, **When** phone number is missing, **Then** message is rejected with validation error
2. **Given** a message is ready to queue, **When** message content is empty, **Then** message is rejected with validation error
3. **Given** a message is ready to queue, **When** all fields are valid, **Then** message is added to queue with "pending" status
4. **Given** a message failed safety validation, **When** attempting to queue, **Then** message is added with "error" status and error message "Safety validation failed"

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Not applicable (validation happens server-side before queuing)
- [ ] Backend API: POST /api/whatsapp-queue with validation middleware
- [ ] Service Layer: WhatsAppQueueService.enqueue() with field validation
- [ ] Repository: Insert with validated data only
- [ ] Database: NOT NULL constraints on phone, message, workspaceId fields
- [ ] Security: Workspace isolation on enqueue operation
- [ ] Testing: Unit tests for validation rules, integration tests for queue insertion
- [ ] Documentation: Document required fields in Swagger
- [ ] Concurrency: Transaction on insert to avoid duplicates
- [ ] Code Cleanliness: Validation in service layer, clear error messages

---

### Edge Cases

- **What happens when cron job crashes mid-processing?** Messages remain in queue with "pending" status, next cron run will retry them
- **How does system handle duplicate messages?** Include deduplication check based on customerId + message content + timestamp (within 1 minute window)
- **What if WhatsApp API is down?** Messages stay in queue with retry logic, error logged with status "error" and error message
- **How to handle messages older than 24 hours?** Mark as expired, move to failed messages log, don't retry
- **What if queue grows too large (>1000 messages)?** Add pagination to queue UI, cron continues processing sequentially
- **How to prevent race conditions with concurrent cron jobs?** Use cron job locking mechanism (ensure only one instance runs at a time)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST store queued messages with fields: workspaceId, customerId, phone number, message content, timestamp, status (pending/sent/error), error message, deliveredAt
- **FR-002**: System MUST provide admin UI in top-right menu with "Queue" link
- **FR-003**: Queue UI MUST display table with columns: Phone, Message, Timestamp, Status, Error
- **FR-004**: Queue UI MUST refresh automatically every 5 seconds to show real-time status
- **FR-005**: System MUST run cron job every 3 seconds to process pending messages
- **FR-006**: Cron job MUST process ONE message per execution (sequential, not batch)
- **FR-007**: Cron job MUST validate message fields (phone, message, workspaceId) before sending
- **FR-008**: System MUST log "SEND MESSAGE WHATSAPP" to console when processing (placeholder for future WhatsApp API integration)
- **FR-009**: System MUST delete message from queue after successful "send"
- **FR-010**: System MUST mark message as delivered in conversation history (conversationMessage table) with deliveredAt timestamp
- **FR-011**: System MUST record error message in queue if validation or sending fails
- **FR-012**: System MUST keep failed messages in queue with status="error" for operator review
- **FR-013**: Queue operations MUST enforce workspace isolation (workspaceId filter on all queries)
- **FR-014**: System MUST prevent duplicate messages (deduplication by customerId + content + timestamp within 1 minute)
- **FR-015**: System MUST handle cron job locking to prevent concurrent processing
- **FR-016**: Queue UI MUST support pagination for large queues (>100 messages)
- **FR-017**: Failed safety validation messages MUST be marked with error="Safety validation failed"

### Key Entities

- **WhatsAppQueue**: Represents a queued message awaiting send
  - Attributes: id, workspaceId, customerId, phoneNumber, messageContent, timestamp, status (pending/sent/error), errorMessage, deliveredAt
  - Relationships: Belongs to Workspace, Belongs to Customer

- **ConversationMessage** (existing): Updated to track delivery status
  - New Attribute: deliveredAt (timestamp when message delivered via WhatsApp)
  - Relationship: One message can have one delivery record

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Operators can view WhatsApp queue status in under 2 seconds from clicking "Queue" menu item
- **SC-002**: System processes pending messages with 3-second intervals consistently (±500ms tolerance)
- **SC-003**: 100% of successfully "sent" messages are deleted from queue within 3 seconds of processing
- **SC-004**: 100% of successfully "sent" messages are marked as delivered in conversation history with timestamp
- **SC-005**: Queue UI displays errors for 100% of failed messages with descriptive error messages
- **SC-006**: System handles queue of 1000+ messages without performance degradation (cron continues processing sequentially)
- **SC-007**: Zero duplicate messages sent (deduplication catches 100% of duplicates within 1-minute window)
- **SC-008**: Cron job locking prevents concurrent execution 100% of the time
- **SC-009**: Operators can identify and troubleshoot failed messages in under 1 minute using Queue UI

## Assumptions

- WhatsApp API integration is NOT implemented yet - using console.log("SEND MESSAGE WHATSAPP") as placeholder
- Cron job runs server-side using node-cron or similar Node.js scheduler
- Queue UI is admin-only feature (requires authentication)
- Messages in queue are workspace-isolated (multi-tenant architecture)
- "Send" operation validates fields and logs to console, returns success/failure
- Delivered status in conversation history uses existing conversationMessage table with new deliveredAt field
- Cron job processes messages in FIFO order (first in, first out)
- Failed messages remain in queue indefinitely until operator manually resolves or deletes them
- Queue UI auto-refreshes every 5 seconds to show real-time status
- Standard workspace isolation and security patterns apply (authMiddleware + validateWorkspaceOperation)
