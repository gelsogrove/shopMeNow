-- AlterTable: Add attachedFlowKey column to workspace_calling_functions
-- This links DELEGATE_TO_AGENT calling functions to FlowNodeConfigs (sub-LLMs in FLOW workspaces)
ALTER TABLE "workspace_calling_functions" ADD COLUMN "attachedFlowKey" TEXT;
