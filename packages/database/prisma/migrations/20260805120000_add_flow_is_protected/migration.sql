-- Marks a flow as editable but not deletable from the flow builder — e.g.
-- the shared Human operator flow every escalation path converges on.
-- deleteFlow must refuse when this is true. Defaults false: existing flows
-- stay deletable exactly as before.
ALTER TABLE "demorobot_flows" ADD COLUMN IF NOT EXISTS "isProtected" BOOLEAN NOT NULL DEFAULT false;
