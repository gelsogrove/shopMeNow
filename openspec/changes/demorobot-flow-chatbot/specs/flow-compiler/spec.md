## ADDED Requirements

### Requirement: Graph compilation into dual artifacts
The system SHALL compile a validated graph (nodes + edges) into two separate outputs: a verbose `compiledPrompt` for LLM execution, and a dense `retrievalDocument` containing only title, symptoms, and synonyms for embedding, generated from the same compilation pass.

#### Scenario: Compiling a valid graph
- **WHEN** the compiler is given a graph with a single root node where every path reaches a terminal node
- **THEN** it returns a `compiledPrompt`, a `retrievalDocument`, a `hash`, the list of referenced `Asset`s, an empty `validationReport`, and any non-blocking `warnings`

#### Scenario: retrievalDocument excludes operational instructions
- **WHEN** the compiler generates `retrievalDocument` for a node
- **THEN** it includes the node's title/symptom/synonym text but excludes conditional operational instructions such as "If NO → respond X"

### Requirement: Deterministic compilation
Given the same graph input, the compiler SHALL always produce the same `compiledPrompt` byte-for-byte, and therefore the same `hash`. Given the same `retrievalDocument` byte-for-byte, the embedding SHALL be treated as unchanged regardless of unrelated graph changes (e.g. node position, regenerated edge IDs).

#### Scenario: Repeated compilation is stable
- **WHEN** the same graph is compiled twice
- **THEN** the resulting `compiledPrompt` and `hash` are identical both times

#### Scenario: Non-semantic graph edit does not trigger re-embedding
- **WHEN** a graph is edited such that only node canvas positions change and no node title/text/keyword content changes
- **THEN** the resulting `retrievalDocument` is unchanged and no new embedding is computed

### Requirement: Graph validation before save
The system SHALL validate that a graph has a single root node, contains no cycles other than nodes explicitly marked as loop terminals, every path reaches a terminal node, and every referenced attachment exists and belongs to the correct `RobotModel`. A `Flow` SHALL NOT become reachable by retrieval unless it passes validation.

#### Scenario: Valid graph is saved and goes online
- **WHEN** a user saves a graph that passes all validation checks
- **THEN** the system persists the compiled `Flow` and it becomes immediately reachable by retrieval

#### Scenario: Invalid graph save is rejected
- **WHEN** a user saves a graph that fails validation (e.g. a path with no terminal, or an attachment referencing another model's asset)
- **THEN** the system rejects the save, reports the validation errors, and the `Flow` retains its last previously valid saved content

#### Scenario: Non-blocking warning does not prevent save
- **WHEN** a graph has a non-blocking issue such as an unreachable node or a duplicate field key
- **THEN** the system saves the flow successfully and surfaces the issue as a warning, not a validation error

### Requirement: Terminal-type-driven tool access
The system SHALL derive the set of tools available to the LLM at a terminal node from that node's `terminalType`, rather than from a hardcoded per-node mapping in application logic.

#### Scenario: Escalate terminal exposes escalation tool
- **WHEN** the compiler processes a node with `terminalType: ESCALATE`
- **THEN** the emitted instruction allows the `escalate_to_operator` tool in addition to `remember`

#### Scenario: Self-service terminal has no side-effect tools
- **WHEN** the compiler processes a node with `terminalType: SELF_SERVICE` or `END`
- **THEN** the emitted instruction allows only the `remember` tool
