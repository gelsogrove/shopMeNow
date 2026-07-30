## ADDED Requirements

### Requirement: RobotModel and Flow navigation hierarchy
The system SHALL present a two-level navigation in the workspace settings area: a list of `RobotModel` records, and within each model a list of its `Flow` records, before entering the graph canvas. The system SHALL NOT present a single flat list of all Flows across all models.

#### Scenario: Browsing to a flow
- **WHEN** a workspace user opens the flow-builder settings section
- **THEN** the system shows the list of `RobotModel` records for that workspace, and selecting one shows the list of `Flow` records belonging to that model

#### Scenario: Creating a new flow
- **WHEN** a user clicks "Create new" from a RobotModel's Flow list
- **THEN** the system creates an empty `Flow` and opens the graph canvas for it

### Requirement: Graph canvas node and answer authoring
The system SHALL provide a graph canvas where a non-technical user can create question nodes, define answers on a node, and have each answer connect to a distinct child node, without writing markdown or code.

#### Scenario: Adding an answer creates a linked child node
- **WHEN** a user adds a new answer to a node from the side panel and provides its label
- **THEN** the system creates a `FlowEdge` from the current node, automatically creates a new empty `FlowNode` positioned near the parent, and connects the edge's target to that new node in a single action, so the edge is never left unconnected

#### Scenario: Reconnecting an answer to an existing node
- **WHEN** a user drags an edge endpoint on the canvas from an auto-created node to an already-existing node
- **THEN** the system updates that `FlowEdge`'s target to the existing node

#### Scenario: Editing node content via side panel
- **WHEN** a user selects a node on the canvas
- **THEN** the system opens a side panel where the user can edit the question text, field key/type, answers, attachments, and terminal type, while the canvas remains visible

### Requirement: Attachments on flow nodes
The system SHALL allow a user to attach documents, images, videos, or links to any flow node, reusing an existing `Asset` from the same `RobotModel` when available instead of re-uploading.

#### Scenario: Attaching an existing asset
- **WHEN** a user opens the attachment picker on a node and the `RobotModel` already has an uploaded asset of the needed type
- **THEN** the system offers that asset from a library instead of requiring a new upload

#### Scenario: Attaching a new asset
- **WHEN** a user uploads a new file to a node with no matching existing asset
- **THEN** the system creates a new `Asset` scoped to that node's `RobotModel` and links it to the node

### Requirement: Terminal node configuration
The system SHALL let a user mark a node as terminal with exactly one of a fixed set of terminal types, and SHALL let a user mark a specific answer (edge) as immediately triggering escalation regardless of whether the node itself is terminal.

#### Scenario: Marking a node as escalating terminal
- **WHEN** a user sets a node's terminal type to escalate
- **THEN** the system records that the flow compiler must emit an escalation instruction when that node is reached

#### Scenario: Marking a single answer as escalating
- **WHEN** a user flags one specific answer (edge) on an otherwise non-terminal node as triggering escalation
- **THEN** the system records this on that `FlowEdge` only, leaving the node's other answers to continue the flow normally

### Requirement: Workspace isolation of flow authoring
The system SHALL scope every `RobotModel`, `Flow`, `FlowNode`, `FlowEdge`, and `Asset` a user can view or edit to that user's own workspace.

#### Scenario: User cannot see another workspace's models
- **WHEN** a user with access to workspace A opens the flow-builder section
- **THEN** the system shows only `RobotModel` records where `workspaceId` matches workspace A, never records belonging to any other workspace
