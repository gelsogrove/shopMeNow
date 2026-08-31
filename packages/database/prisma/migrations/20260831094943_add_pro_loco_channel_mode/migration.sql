-- Add PRO_LOCO to ChannelMode enum.
-- PRO_LOCO behaves exactly like FLOW everywhere in the codebase (routing,
-- templates, welcome message, calling functions) — it is a marker used to
-- gate tourism-office-only features inside the custom-demosappada module.
ALTER TYPE "ChannelMode" ADD VALUE 'PRO_LOCO';
