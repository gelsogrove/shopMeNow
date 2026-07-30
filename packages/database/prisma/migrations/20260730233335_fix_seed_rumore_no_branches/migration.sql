-- Fix "Rumore strano" seed flow: add the missing "No" branches.
--
-- The original seed (20260731010000_seed_demorobot_dev_data) only wired the
-- "Sì" path for each check (robot on? -> wifi connected? -> cut scheduling
-- on?), leaving a dead end for "No" answers. Per analisi.md §6, a failed
-- check should route to a self-service sub-flow, not a dead end.
--
-- Adds 3 new self-service terminal nodes + 3 new "No" edges, and updates
-- Flow.compiledPrompt/retrievalDocument/hash to the real compileFlow()
-- output for the corrected graph (byte-for-byte, not hand-written) —
-- keeping the compiler's determinism contract intact.
--
-- Idempotent (ON CONFLICT DO NOTHING / guarded UPDATE) and scoped to the
-- DemoRobotica workspace via the flow id already used by the original seed.

DO $$
BEGIN
  -- No-op if the original seed's flow row doesn't exist (e.g. re-run against
  -- a DB where the seed migration hasn't landed yet, or was rolled back).
  IF NOT EXISTS (SELECT 1 FROM "demorobot_flows" WHERE id = 'cm_seed_flow_rumore') THEN
    RAISE NOTICE 'cm_seed_flow_rumore not found — skipping fix migration.';
    RETURN;
  END IF;

  INSERT INTO "demorobot_flow_nodes" (id, "flowId", question, "positionX", "positionY", "fieldKey", "fieldType", "terminalType", "createdAt", "updatedAt") VALUES
    ('rs_n5', 'cm_seed_flow_rumore', 'Accendi il robot premendo il pulsante di accensione e riprova.', 0, 200, NULL, NULL, 'SELF_SERVICE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rs_n6', 'cm_seed_flow_rumore', 'Verifica che il robot sia connesso al wifi dalle impostazioni dell''app e riprova.', 280, 200, NULL, NULL, 'SELF_SERVICE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rs_n7', 'cm_seed_flow_rumore', 'Attiva il cut scheduling dalle impostazioni dell''app e riprova.', 560, 200, NULL, NULL, 'SELF_SERVICE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO "demorobot_flow_edges" (id, "sourceNodeId", "targetNodeId", label, "triggersEscalation", "createdAt") VALUES
    ('rs_e1_no', 'rs_n1', 'rs_n5', 'No', false, CURRENT_TIMESTAMP),
    ('rs_e2_no', 'rs_n2', 'rs_n6', 'No', false, CURRENT_TIMESTAMP),
    ('rs_e3_no', 'rs_n3', 'rs_n7', 'No', false, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO NOTHING;

  UPDATE "demorobot_flows"
  SET "compiledPrompt" = '## FLOW: Rumore strano

### Q: Il robot è acceso?
- If "Sì" → continue to: "Il wifi è connesso?"
- If "No" → continue to: "Accendi il robot premendo il pulsante di accensione e riprova."

### Q: Il wifi è connesso?
(collect as: wifiConnected, type: boolean)
- If "Sì" → continue to: "Il cut scheduling è attivo?"
- If "No" → continue to: "Verifica che il robot sia connesso al wifi dalle impostazioni dell''app e riprova."

### Q: Il cut scheduling è attivo?
(collect as: cutSchedulingActive, type: boolean)
- If "Sì" → continue to: "Tutti i check sono OK ma il rumore persiste. Serve un tecnico."
- If "No" → continue to: "Attiva il cut scheduling dalle impostazioni dell''app e riprova."

### Q: Tutti i check sono OK ma il rumore persiste. Serve un tecnico.
(terminal: ESCALATE, allowed tools: remember, escalate_to_operator)

### Q: Attiva il cut scheduling dalle impostazioni dell''app e riprova.
(terminal: SELF_SERVICE, allowed tools: remember)

### Q: Verifica che il robot sia connesso al wifi dalle impostazioni dell''app e riprova.
(terminal: SELF_SERVICE, allowed tools: remember)

### Q: Accendi il robot premendo il pulsante di accensione e riprova.
(terminal: SELF_SERVICE, allowed tools: remember)
',
      "retrievalDocument" = 'Rumore strano
vibra, cigola, ronzio
Il robot è acceso?
Il wifi è connesso?
Il cut scheduling è attivo?
Tutti i check sono OK ma il rumore persiste. Serve un tecnico.
Attiva il cut scheduling dalle impostazioni dell''app e riprova.
Verifica che il robot sia connesso al wifi dalle impostazioni dell''app e riprova.
Accendi il robot premendo il pulsante di accensione e riprova.',
      hash = '6725891c7c02d0a1982005fc33f1f158c2ce3ab8ccad72c396a931ff4fec8bf6',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = 'cm_seed_flow_rumore';
END $$;
