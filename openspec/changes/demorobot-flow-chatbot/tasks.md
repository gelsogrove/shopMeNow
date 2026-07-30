## 1. Data model

- [ ] 1.1 Add Prisma models `RobotModel`, `Flow`, `FlowNode`, `FlowEdge`, `Asset`, `FlowNodeAttachment` with `workspaceId`/`robotModelId` scoping per design.md Decision 9
- [ ] 1.2 Add `pgvector` embedding column on `Flow` (or equivalent vector column) for retrieval
- [ ] 1.3 Generate and run Prisma migration (additive only, no changes to existing tables)
- [ ] 1.4 Run `prisma generate` and verify generated types compile

## 2. Flow compiler

- [ ] 2.1 Implement `compileFlow(nodes, edges)` returning `{ compiledPrompt, retrievalDocument, hash, assets, validationReport, warnings }` per specs/flow-compiler
- [ ] 2.2 Implement graph validation: single root, no unintended cycles (except `terminalType: LOOP`), every path reaches a terminal, attachment ownership check
- [ ] 2.3 Implement deterministic topological compilation to `compiledPrompt` (byte-for-byte stable given the same graph)
- [ ] 2.4 Implement `retrievalDocument` generation as a sub-product of the same pass (title/symptoms/synonyms only, excludes operational instructions)
- [ ] 2.5 Implement `terminalType → allowedTools` mapping (ESCALATE → remember+escalate_to_operator; SELF_SERVICE/END → remember)
- [ ] 2.6 Implement size guardrails (nodes/flow, attachments/node, `compiledPrompt` char ceiling) emitting non-blocking `warnings` and a hard validation error past a harder threshold
- [ ] 2.7 Unit tests: snapshot tests for `compileFlow` against fixture graphs (determinism, validation failures, warnings, escalation edge flag)

## 3. Embedding & retrieval

- [ ] 3.1 Implement `EmbeddingProvider` interface and OpenRouter-backed implementation (`POST /api/v1/embeddings`)
- [ ] 3.2 Implement embedding recompute trigger: only when `retrievalDocument` changes, not on every graph save
- [ ] 3.3 Implement `findRelevantFlows({ robotModelId, query, k })` similarity query scoped to `robotModelId OR robotModelId IS NULL`
- [ ] 3.4 Implement serial number step-0 validation (≥12 chars, else treated as absent, not `unknown_model`)
- [ ] 3.5 Implement pluggable `serialNumber → RobotModel` lookup interface (`RobotModel.lookupRules`) with a minimal placeholder matcher — mark explicitly as TBD pending real client data
- [ ] 3.6 Implement single-best-match attachment logic (`SessionState.activeFlowId`), logging runner-up candidates without including them in the prompt
- [ ] 3.7 Implement retrieval trigger gating: only on empty `activeFlowId` or LLM-signaled mismatch, never on every turn
- [ ] 3.8 Implement no-serial-number fallback path (try generic flow first, request serial only if insufficient)
- [ ] 3.9 Implement `RetrievalEvent` structured logging (conversationId, query, candidates, selectedFlowId)
- [ ] 3.10 Implement graceful degradation: embedding/retrieval timeout → fallback to generic flow, no blocked turn
- [ ] 3.11 Unit tests: retrieval step-0/step-1/step-2 branching, single-best-match selection, degradation fallback, serial-number-absent path

## 4. demoRobot chatbot runtime module

- [ ] 4.1 Scaffold `apps/backend/custom-demorobot/` following the `custom-<chatbotId>` convention (mirrors `custom-demowash` turn loop, PII redaction, tool handler injection)
- [ ] 4.2 Implement `PromptBuilder.build({ commonPrompt, sessionState, activeFlowSnapshot?, history })` composing the per-turn prompt
- [ ] 4.3 Implement `SessionState` shape: `activeModelId`, `activeFlowId`, `activeFlowHash`, `activeFlowPromptSnapshot`, `collectedData: Record<string, JsonValue>` — no `currentNode`/`pendingQuestion`
- [ ] 4.4 Extend `remember` tool handling to accept free key/value pairs matching the active flow's `fieldKey`s (merge semantics, not replace)
- [ ] 4.5 Implement emergency detection (semantic, prompt-driven) overriding any active flow and escalating with reason `emergency`
- [ ] 4.6 Implement escalation reason classification (checks-exhausted, `unknown_model`, `no_matching_flow`, `emergency`) wired to `escalate_to_operator`
- [ ] 4.7 Implement sticky-language handling reusing the `⟦LANG:xx⟧` trailer mechanism, `VALID_ISO` extended with `da`
- [ ] 4.8 Implement welcome message + privacy notice (first turn only, URL injected from `RUNTIME`, never hardcoded)
- [ ] 4.9 Populate `ChatbotOutput.meta.debug` with the retrieval event for the turn (closes the observability gap noted in design.md)
- [ ] 4.10 Wire graceful degradation for LLM timeout (`error: 'llm_unavailable'`) and lookup technical failures (fallback to generic, not `unknown_model`)
- [ ] 4.11 Unit tests: prompt composition, session state persistence across turns, emergency override, escalation reason selection, language stickiness

## 5. Flow graph editor (apps/frontend)

- [ ] 5.1 Add `@xyflow/react` dependency to `apps/frontend`
- [ ] 5.2 Add new settings section (following `SettingsPage.tsx`/`SettingsDropdown` pattern) visible only when `workspace.customChatbotId` targets this module type
- [ ] 5.3 Implement `RobotModel` list + CRUD (create/edit/delete)
- [ ] 5.4 Implement per-model `Flow` list + CRUD, opening the canvas on create/edit
- [ ] 5.5 Implement full-screen canvas route with compact custom `FlowNode` component (title + answer count + attachment icon only)
- [ ] 5.6 Implement multi-handle positioning per node (one `Handle` per answer, `id` = `FlowEdge.id`, explicit vertical spacing)
- [ ] 5.7 Implement side panel (Radix `Sheet`) for node editing: question text, `fieldKey`/`fieldType`, answers list, attachments, `terminalType`
- [ ] 5.8 Implement "add answer" atomic action: create `FlowEdge` + auto-create connected child `FlowNode` via `useReactFlow().addNodes/addEdges`
- [ ] 5.9 Implement `updateNodeData` debounced writes from panel field edits
- [ ] 5.10 Implement manual reconnect-to-existing-node via native drag, using `sourceHandle` = edge id
- [ ] 5.11 Implement attachment picker: reuse existing `RobotModel`-scoped `Asset` or upload new
- [ ] 5.12 Implement terminal type selector and per-edge escalation flag toggle
- [ ] 5.13 Wire single "Save" action: call compiler, on validation failure show errors on the offending `FlowNode`, on success persist and confirm online
- [ ] 5.14 Implement last-write-wins save behavior (no optimistic lock for v1, per design.md Decision 8)
- [ ] 5.15 Unit tests: settings section visibility gating, save success/failure UI states, answer-add atomic node/edge creation

## 6. API & security

- [ ] 6.1 Add CRUD endpoints for `RobotModel`/`Flow`/`FlowNode`/`FlowEdge`/`Asset` under the 3-layer middleware stack (authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation)
- [ ] 6.2 Ensure every repository query filters by `workspaceId` (and `robotModelId` where applicable)
- [ ] 6.3 Update `backend/src/swagger.yaml` for all new endpoints
- [ ] 6.4 Unit tests: workspace isolation (user from workspace A cannot read/write workspace B's RobotModel/Flow/Asset)

## 7. Development seed

- [ ] 7.1 Seed one test-workspace `RobotModel` ("RoboCut X200") with three `Flow`s covering: multi-check-to-escalation, pure self-service, single-answer mid-flow escalation
- [ ] 7.2 Seed the workspace-generic fallback `Flow` (`robotModelId: null`)
- [ ] 7.3 Seed sample `Asset`s (one document, one image) to exercise the delivery-only attachment path
- [ ] 7.4 Document in the seed script that this is dev/test fixture data only, not a real-customer import mechanism

## 8. Finalize

- [ ] 8.1 Run `npm run test:unit`, and only if it passes, run `npm run publish`. If tests fail, stop and do NOT deploy.
