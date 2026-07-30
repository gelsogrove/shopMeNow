## Context

`custom-demowash` establishes the pattern this change follows: all conversational logic lives in a markdown prompt interpreted by the LLM at runtime — no state machine, no regex-based intent detection, no `currentNode` pointer. demowash's prompt is small enough (~30 cases, 6 locations) to be a single, fully-cached blob sent on every turn.

demoRobot breaks that assumption at scale: hundreds of diagnostic flows, growing over time, authored by a non-technical user through a visual graph editor rather than hand-written markdown. The graph is purely an authoring/UX concern — it is compiled at save time into prose the LLM reads; nothing in the runtime executes the graph node-by-node. This design covers: the React Flow editor (`apps/frontend`), the graph→prompt compiler, the two-step retrieval that selects which compiled flow enters the prompt each turn, and the data model tying it together.

Constraints already fixed by CLAUDE.md and the platform: every entity is `workspaceId`-scoped (§2); no hardcoded phrase/keyword detection for intent; OpenRouter only, never OpenAI directly; 3-layer security middleware on every protected endpoint; hot-reload dev servers, never manually restarted.

## Goals / Non-Goals

**Goals:**
- A non-technical user can build/edit a diagnostic flow (question → answers → child question, with attachments) entirely through a canvas UI, with zero markdown authored by hand.
- The compiler deterministically turns a validated graph into two artifacts: `compiledPrompt` (verbose, for the LLM to execute) and `retrievalDocument` (dense, for embedding only) — same `retrievalDocument` byte-for-byte always yields the same embedding.
- At runtime, exactly one flow is attached to a conversation at a time (`SessionState.activeFlowId`), selected via deterministic serial→model lookup followed by semantic search scoped to that model — never a classic LLM router call, never multiple flows stuffed into one prompt.
- Saving a flow is atomic: compile → validate → (if valid) immediately online and retrievable. No draft/published distinction, no preview stage.
- Attachments (PDF/image/video/link) are delivered to the customer only — never embedded, never LLM-readable knowledge content.

**Non-Goals:**
- Solving the real `serialNumber → RobotModel` lookup format (client data not yet available) — this design ships a pluggable interface with a minimal placeholder implementation, not the final lookup logic.
- A full RBAC model for who edits flows vs. manages shared assets vs. views analytics — only the platform's standard 3-layer auth/session/workspace middleware.
- Flow version history / rollback — only the lightweight per-session snapshot (`activeFlowPromptSnapshot`).
- Making the flow-builder a cross-client reusable product surface — the compiler/retrieval are written parametrized by `workspaceId`/`RobotModel` so reuse is possible later, but this change only activates it for demoRobot.
- Any ingestion/RAG over attachment content — excluded by principle, not deferred.

## Decisions

### 1. Graph is authoring UX, not an execution engine
The compiler is the only bridge between the graph and the runtime. At runtime the LLM reads `compiledPrompt` like any other prompt block and infers conversational position from `history` + `collectedData` — no `FlowNode` traversal in code. **Alternative rejected**: a deterministic flow-engine (XState-style) executing node-by-node — this is exactly the legacy Visual Flow Builder paradigm deprecated in CLAUDE.md §17 (F50), reintroducing a guard-layer this platform already abandoned.

### 2. Two separate compiler outputs, one compilation pass
`compileFlow(nodes, edges)` returns `compiledPrompt` and `retrievalDocument` as two views generated in the same pass — never two separate compilation steps. `retrievalDocument` is dense (title, symptoms, synonyms) and deliberately excludes operational instructions ("If NO → respond X"), which would dilute the embedding. Determinism target is `retrievalDocument` byte-for-byte, not "same graph": a graph edit that only moves node positions or regenerates an edge ID can leave `retrievalDocument` unchanged, so no embedding recompute is triggered.

### 3. Two-step retrieval, not a router LLM
Step 1 (deterministic): `serialNumber → RobotModel`, same class of fact-matching as demowash's `detectVenue` — never intent classification. Step 0 gates this: a `serialNumber` under 12 characters is treated as "not provided," not "not found" (`unknown_model`), avoiding wasted lookups on obviously malformed input. Step 2 (semantic): embedding search via `findRelevantFlows({ robotModelId, query, k })`, scoped to the model resolved in step 1. **Alternative rejected**: a single LLM call classifying "which problem is this" before the response call — explicitly the pattern demowash's own architecture abandoned (doubles cost/latency, no gain at this scale).

Only the single best-scoring candidate above threshold is attached to `SessionState.activeFlowId`; runners-up are logged for diagnostics only, never included in the prompt — keeps the LLM working from exactly one procedure per turn.

### 4. Retrieval runs only to (re-)attach, not every turn
Short/ambiguous replies ("yes", "3") carry too little semantic signal for reliable retrieval and would risk losing an already-correct attachment mid-flow. Retrieval fires only when `activeFlowId` is empty, or the LLM semantically recognizes (from the graph of the conversation, not a code trigger) that the attached flow no longer matches — in which case it closes `activeFlowId` and triggers a fresh retrieval. No deterministic keyword trigger for "topic changed" (would violate CLAUDE.md §14).

### 5. `TerminalType` as a single enum, not independent booleans
`null | SELF_SERVICE | ESCALATE | END | LOOP` replaces what could have been two independent booleans (`isTerminal`/`triggersEscalation`), which would permit meaningless combinations. Escalation on a specific intermediate answer (not just a terminal node) is modeled separately on `FlowEdge.triggersEscalation`, since it's the chosen answer — not the node — that determines the escalation.

### 6. Terminal-node tool access as `allowedTools: string[]`, not a hardcoded switch
Derived from `terminalType` (`ESCALATE → ['remember','escalate_to_operator']`, `SELF_SERVICE/END → ['remember']`) so a future new tool (`request_photo`, `create_ticket`) is a mapping entry, not a rewrite of compiler logic.

### 7. Attachments are delivery material, never knowledge base
`Asset.summary` is pure routing metadata ("this PDF explains the wifi reset") — it tells the LLM *when* to offer a file, never *what* to answer with. No indexing, no chunking, no embedding of attachment content. This is a hard boundary, not a v1-scope cut.

### 8. Single-stage save (no draft/publish/preview)
One "Save" action: compile → validate → if valid, immediately online and retrievable; if invalid, the save is rejected and the `Flow` keeps its last valid saved content — no persisted invalid intermediate state. Removes the need for a separate publish workflow or per-Flow/per-RobotModel publish granularity question, since nothing is ever "published" as a distinct step from saving. Concurrent edits use last-write-wins for v1 (declared explicitly, not left implicit) — `Flow.hash` is available if optimistic-lock conflict detection is added later.

### 9. Ownership: workspace-scoped, generic flow modeled as `robotModelId: null`
No separate `GlobalFlow` table — the workspace-generic fallback flow (§6 of `analisi.md`) is just a `Flow` row with `robotModelId: null`, so retrieval naturally becomes `WHERE robotModelId = X OR robotModelId IS NULL` against the same table. `Asset` inherits ownership from `RobotModel`; no cross-workspace sharing in v1.

### 10. Compiler and retrieval as components, not chatbot-module-internal code
Both are designed parametrized by `workspaceId`/`RobotModel` so a second client adopting this paradigm doesn't require a rewrite — even though demoRobot is the only real consumer today. Exact package boundary (shared package vs. living inside `custom-demorobot` for v1) is left to implementation, not architecturally significant either way.

### 11. Embedding via OpenRouter, abstracted behind `EmbeddingProvider`
OpenRouter exposes `POST /api/v1/embeddings` (OpenAI-compatible), proxying multiple embedding models under the same API key already used for chat completions — no second provider integration, satisfies CLAUDE.md's OpenRouter-only rule. `interface EmbeddingProvider { embed(text: string): Promise<number[]> }` decouples the caller from the concrete model, which is configured in `settings.json`. Vector stored as a column on `Flow` (e.g. `pgvector`), not an external vector store, consistent with existing stack.

### 12. React Flow implementation pattern: compact canvas node + side panel editing
Verified against official React Flow docs, not assumed. Canvas nodes show only title + answer count + attachment icon — no in-node forms. All editing (question text, `fieldKey`/`fieldType`, answers, attachments, `terminalType`) happens in a right-side panel (Radix `Sheet`, reusing the backoffice's existing Radix+Tailwind stack — no paid React Flow Pro template needed). Adding an answer from the panel is a single atomic action: create the `FlowEdge`, auto-create a new empty child `FlowNode` positioned relative to the parent, wire `FlowEdge.targetNodeId` immediately — edges never exist orphaned. Reconnecting to an already-existing node (e.g. converging branches) stays a manual canvas drag, using native React Flow reconnection.

Concrete API usage: multiple handles on one side of a node require explicit spacing (React Flow does not auto-layout them) — one `<Handle position={Position.Right} id={edge.id}>` per answer, `id` equal to the `FlowEdge.id`. `sourceHandle` on the React Flow edge *is* `FlowEdge.id` — no extra field needed. Programmatic node/edge creation from the panel uses `useReactFlow().addNodes()`/`addEdges()` with a fixed offset from the parent position (not `screenToFlowPosition`, which is only for real screen-coordinate drops). Panel field edits call `updateNodeData(nodeId, dataUpdate)` with debounce, not per-keystroke writes.

### 13. Session state has no execution pointer
`SessionState` carries `activeModelId`, `activeFlowId`, `activeFlowHash` (for log correlation against the currently published version), `activeFlowPromptSnapshot` (the actual text the LLM reasons over, frozen at attach time so a concurrent edit to the Flow never changes an in-flight conversation), and `collectedData: Record<string, JsonValue>` keyed by `FlowNode.fieldKey`. No `currentNode`/`pendingQuestion` — position is inferred by the LLM every turn from `compiledPrompt` + `history` + `collectedData`. This is a direct consequence of Decision 1: an explicit pointer would reintroduce the deterministic engine this design avoids.

### 14. Graceful degradation on external failures
Embedding provider or retrieval timeout → fall back to the generic flow rather than blocking the turn (same practical outcome as "no match → escalate"). LLM/OpenRouter timeout → inherited existing demowash behavior (`error: 'llm_unavailable'`, no crash). A technical lookup failure (not "not found") must not be conflated with `unknown_model` — same fallback-to-generic principle applies. No raw error ever reaches the customer; every failure path degrades toward the generic flow or an escalation.

## Risks / Trade-offs

- **[Risk] No prompt caching for the dynamic portion** → demowash caches its entire fixed blob (~99% hit rate); demoRobot's `Prompt fisso + Session + Flow compilato` has an always-variable third ingredient that cannot benefit from the same cache. **Mitigation**: accepted trade-off, direct consequence of scale (hundreds of growing flows vs. ~30 stable cases) — cost-per-turn with retrieval needs to be quantified once real usage data exists; not a blocker to shipping v1.
- **[Risk] serialNumber→RobotModel lookup is unresolved** → any implementation shipped now is a placeholder. **Mitigation**: ship behind a `lookupRules`-driven pluggable interface on `RobotModel` so swapping the real matching strategy later is a data/config change, not a code rewrite; document this explicitly as a known placeholder in the seed and in code comments at the integration point.
- **[Risk] Retrieval attaches the wrong-but-closest flow** → the LLM may follow a plausible-but-incorrect procedure for one or more turns before the mismatch surfaces. **Mitigation**: the LLM is instructed to semantically recognize a mismatch from the customer's answers mid-flow and trigger a fresh retrieval — inherently probabilistic, not fully preventable; monitored via `RetrievalEvent` analytics (best-score distribution, escalation-by-reason) to tune threshold/topK over time.
- **[Risk] Concurrent edits under a single-stage, always-online save** → unlike a draft/publish model where a conflict is absorbed before going live, a last-write-wins conflict here becomes visible to customers immediately. **Mitigation**: explicitly declared as last-write-wins for v1 rather than left ambiguous; `Flow.hash` is already in the data model if optimistic-lock detection becomes necessary later.
- **[Risk] No debug visibility today** → `ChatbotOutput.meta.debug` exists as a type but no custom module populates it, and the host doesn't expose it on playground/widget paths. This matters more for demoRobot than demowash, since the active flow changes turn-to-turn. **Mitigation**: `RetrievalEvent` structured logging is part of this change (not deferred), covering which flow attached and why, feeding both debug and analytics.
- **[Risk] Unbounded graph size** → nothing stops a user from building a 500-node flow today. **Mitigation**: compiler emits non-blocking warnings as flows approach declared guardrails (nodes/flow, attachments/node, `compiledPrompt` character ceiling) and hard-blocks only past a harder threshold; exact values are a tasks-level detail, not an open design question.

## Migration Plan

Net-new module and net-new tables — no migration of existing data, no changes to `custom-demowash` or other existing chatbots.

1. Prisma migration adding `RobotModel`, `Flow`, `FlowNode`, `FlowEdge`, `Asset`, `FlowNodeAttachment` (additive only).
2. Ship `custom-demorobot` module + compiler + retrieval behind the existing `Workspace.customChatbotId` resolution convention — inert for every workspace until a workspace is explicitly configured with `customChatbotId: "demorobot"`.
3. Ship the `apps/frontend` settings section + canvas route, visible only when the workspace's `customChatbotId` points at this module type.
4. Development seed (fixture `RobotModel` + three `Flow`s + generic fallback + sample assets) — used for testing only, never promoted to production data.
5. No rollback complexity beyond standard revert-the-deploy, since no existing behavior is modified — the module is additive and isolated.

## Open Questions

- Final `serialNumber → RobotModel` matching strategy (exact lookup vs. pattern/prefix vs. external API) — requires real data from the demoRobot client.
- Exact size guardrail values (nodes/flow, attachments/node, `compiledPrompt` character ceiling).
- Similarity threshold for "no match" — start conservative, tune against real usage.
- "Voluntary topic change" detection strategy — heuristic on message length/substance for v1; revisit if it produces too many false positives/negatives.
- Where compiler validation errors surface in the canvas UI (likely: highlighted on the offending `FlowNode.id`).
- Whether shared sub-flows (multiple parent nodes converging on the same procedure) are needed — not built preemptively, revisit only if a real duplication case emerges.
