## ADDED Requirements

### Requirement: Serial number format pre-check
Before attempting a model lookup, the system SHALL treat a `serialNumber` shorter than 12 characters as not provided, rather than attempting a lookup against it.

#### Scenario: Serial number too short
- **WHEN** the customer-provided serial number has fewer than 12 characters
- **THEN** the system treats it as absent and does not attempt a `RobotModel` lookup or classify it as `unknown_model`

### Requirement: Two-step flow resolution
The system SHALL resolve which `Flow` to attach to a conversation in two steps: a deterministic `serialNumber → RobotModel` lookup, followed by a semantic embedding search for `Flow` records scoped to the resolved `RobotModel` (plus workspace-generic flows).

#### Scenario: Model resolved, flow found
- **WHEN** a valid serial number resolves to a `RobotModel` and a semantic search over that model's flows returns a candidate above the similarity threshold
- **THEN** the system attaches that flow's id to `SessionState.activeFlowId`

#### Scenario: Model lookup fails
- **WHEN** the serial number does not resolve to any known `RobotModel`
- **THEN** the system does not attach a flow and records the failure reason as `unknown_model`

#### Scenario: Model resolved, no matching flow
- **WHEN** a `RobotModel` is resolved but no candidate flow scores above the similarity threshold
- **THEN** the system does not attach a flow and records the failure reason as `no_matching_flow`

### Requirement: Single best-match attachment
When semantic search returns multiple candidates, the system SHALL attach only the single highest-scoring flow above threshold to the session. Lower-ranked candidates SHALL be recorded for diagnostics only and SHALL NOT be included in the prompt.

#### Scenario: Multiple candidates returned
- **WHEN** semantic search returns three candidate flows with similarity scores above threshold
- **THEN** the system attaches only the top-scoring flow to `SessionState.activeFlowId` and logs all three candidates in the retrieval event

### Requirement: Retrieval runs only to attach or re-attach, not every turn
The system SHALL trigger retrieval only when no flow is currently attached, or when the LLM semantically determines mid-conversation that the attached flow no longer matches the customer's problem. The system SHALL NOT use deterministic keyword matching to trigger a re-retrieval.

#### Scenario: Ongoing flow, short reply
- **WHEN** a flow is already attached and the customer sends a short reply such as "yes" or a number
- **THEN** the system does not trigger a new retrieval

#### Scenario: LLM recognizes mismatch mid-flow
- **WHEN** the LLM determines from the customer's answers that the attached flow does not match their actual problem
- **THEN** the system closes the current `activeFlowId` and triggers a fresh retrieval on the actual problem

### Requirement: No serial number does not block the conversation
The system SHALL NOT require a serial number before attempting retrieval. When no serial number is available, the system SHALL attempt retrieval against the workspace-generic flow before requesting the serial number.

#### Scenario: Customer has no serial number handy
- **WHEN** a customer describes a problem without providing a serial number
- **THEN** the system attempts retrieval against the generic workspace flow, and only requests the serial number if that is insufficient to proceed

### Requirement: Retrieval diagnostic logging
The system SHALL emit a structured retrieval event for every retrieval execution, including the conversation id, query, resolved model (if any), all top-K candidates with similarity scores, and the selected flow id (if any).

#### Scenario: Retrieval event recorded on every attempt
- **WHEN** retrieval executes, regardless of whether a flow is ultimately attached
- **THEN** the system records a retrieval event containing the candidates considered and the outcome

### Requirement: Graceful degradation on retrieval failures
When the embedding provider or the retrieval query times out or is unavailable, the system SHALL fall back to the workspace-generic flow rather than blocking the conversation turn or surfacing a raw error to the customer.

#### Scenario: Embedding provider unavailable
- **WHEN** the embedding provider does not respond within the retry window
- **THEN** the system falls back to the generic flow for that turn instead of failing the turn

### Requirement: Attachments are never used as retrieval or reasoning content
The system SHALL NOT index, embed, or otherwise use the content of a `FlowNode`'s attached `Asset` as knowledge the LLM reasons over. An `Asset`'s `summary` field SHALL be used only as routing metadata to decide when to offer the file to the customer.

#### Scenario: Attachment content is excluded from retrieval
- **WHEN** a `Flow` has nodes with attached PDF or video assets
- **THEN** neither the compiler nor the retrieval layer includes the attachment's file content in `retrievalDocument`, `compiledPrompt` embedding input, or any LLM-reasoned context
