## ADDED Requirements

### Requirement: Per-turn prompt composition
The system SHALL compose the prompt sent to the LLM each turn from three parts: a fixed common prompt (general behavior, welcome/legal notice, emergency rules, generic fallback flow), the current session state (collected data), and the currently attached flow's compiled snapshot, if any.

#### Scenario: Turn with an attached flow
- **WHEN** a conversation has a flow attached in `SessionState.activeFlowId`
- **THEN** the prompt sent to the LLM includes the fixed common prompt, the session's collected data, and that flow's `activeFlowPromptSnapshot`

#### Scenario: Turn with no attached flow
- **WHEN** a conversation has no flow attached yet
- **THEN** the prompt sent to the LLM includes the fixed common prompt and session state, without a flow-specific block

### Requirement: Session state has no execution pointer
The system SHALL infer conversational progress from the LLM reading `compiledPrompt`, `history`, and `collectedData` each turn. The system SHALL NOT persist a `currentNode` or `pendingQuestion` pointer in session state.

#### Scenario: Customer answers out of order
- **WHEN** a customer volunteers information that answers a later question in the flow before it is asked
- **THEN** the LLM skips the already-answered question based on context, with no code-level state transition required

### Requirement: Flow snapshot isolates in-flight conversations from edits
The system SHALL freeze the compiled flow content into `SessionState.activeFlowPromptSnapshot` at the moment a flow is attached. A subsequent edit to that `Flow` SHALL NOT alter the prompt used by conversations already in progress on the previous version.

#### Scenario: Flow edited mid-conversation
- **WHEN** a user edits and re-saves a `Flow` while a customer conversation already has that flow attached
- **THEN** the in-progress conversation continues using its frozen snapshot, and only new conversations retrieving the flow use the updated version

#### Scenario: fieldKey renamed mid-conversation
- **WHEN** a `FlowNode.fieldKey` is renamed after a conversation has already collected data under the old key
- **THEN** the in-progress session's `collectedData` under the old key remains valid and is not migrated or broken

### Requirement: Emergency handling overrides any active flow
The system SHALL recognize emergency situations semantically (never via a hardcoded keyword list) and, when detected, override any currently attached flow and immediately trigger escalation with reason `emergency`.

#### Scenario: Emergency detected during a flow
- **WHEN** the customer describes an emergency situation while a diagnostic flow is attached
- **THEN** the system ignores the attached flow's next step, calls `escalate_to_operator` with reason `emergency`, and ends the turn

### Requirement: Escalation reason classification
The system SHALL classify every escalation with one of a fixed set of reasons: exhausted diagnostic checks with no self-service resolution, `unknown_model`, `no_matching_flow`, or `emergency`.

#### Scenario: Diagnostic flow exhausted
- **WHEN** a customer completes all diagnostic checks in an attached flow and none resolve the issue
- **THEN** the system escalates with the flow-exhausted reason, using the LLM-constructed summary of facts gathered along the path

### Requirement: Multilingual response with sticky language
The system SHALL respond in the customer's language, inferred and preserved across turns via the same sticky-language trailer mechanism used by `custom-demowash`, extended to include Danish. Attached documents SHALL NOT be automatically translated.

#### Scenario: Conversation continues in detected language
- **WHEN** a customer writes in Spanish
- **THEN** the system responds in Spanish and continues doing so on subsequent turns without re-detecting language each time

### Requirement: Graceful degradation on runtime failures
The system SHALL NOT surface a raw technical error to the customer. When the LLM provider is unavailable, or when a technical (non "not-found") error occurs during serial number lookup, the system SHALL degrade to an existing fallback path rather than crash the turn.

#### Scenario: LLM provider timeout
- **WHEN** the OpenRouter LLM call times out or is unavailable
- **THEN** the system returns an `llm_unavailable` error in the output without crashing, consistent with existing `custom-demowash` behavior

#### Scenario: Lookup technical failure distinct from unknown model
- **WHEN** the serial number lookup fails due to a technical error rather than the serial simply not matching any model
- **THEN** the system does not classify this as `unknown_model` and instead falls back toward the generic flow
