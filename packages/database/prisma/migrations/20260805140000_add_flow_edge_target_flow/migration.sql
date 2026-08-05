-- An answer can hand the conversation over to a DIFFERENT flow instead of a
-- node in the same one. Mutually exclusive with targetNodeId; the runtime
-- attaches the target flow from its root and keeps collectedData.
-- SET NULL on delete: removing a flow must not cascade-delete the edges of
-- other flows that pointed at it — the compiler surfaces the dangling answer
-- instead.
ALTER TABLE "demorobot_flow_edges" ADD COLUMN IF NOT EXISTS "targetFlowId" TEXT;

CREATE INDEX IF NOT EXISTS "demorobot_flow_edges_targetFlowId_idx" ON "demorobot_flow_edges"("targetFlowId");

ALTER TABLE "demorobot_flow_edges"
  ADD CONSTRAINT "demorobot_flow_edges_targetFlowId_fkey"
  FOREIGN KEY ("targetFlowId") REFERENCES "demorobot_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
