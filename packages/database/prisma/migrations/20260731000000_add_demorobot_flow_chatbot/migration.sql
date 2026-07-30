-- demoRobot flow-builder chatbot: RobotModel/Flow/FlowNode/FlowEdge/Asset/FlowNodeAttachment.
--
-- Additive only — no existing table is touched. NOT related to the deprecated
-- F50 Visual Flow Builder (FlowNodeConfig), which stays untouched. See
-- apps/backend/custom-demorobot/docs/analisi.md for the full spec.
--
-- Flow.embedding is Float[] (not a pgvector column): cosine similarity for
-- retrieval is computed in application code over candidates already narrowed
-- by robotModelId, so no Postgres extension is required.

CREATE TABLE "robot_models" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "manufacturer" TEXT,
    "description" TEXT,
    "lookupRules" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robot_models_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "robot_models_workspaceId_slug_key" ON "robot_models"("workspaceId", "slug");
CREATE INDEX "robot_models_workspaceId_idx" ON "robot_models"("workspaceId");

CREATE TABLE "demorobot_flows" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "robotModelId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "retrievalDocument" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "compiledPrompt" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demorobot_flows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demorobot_flows_workspaceId_idx" ON "demorobot_flows"("workspaceId");
CREATE INDEX "demorobot_flows_robotModelId_idx" ON "demorobot_flows"("robotModelId");

CREATE TABLE "demorobot_flow_nodes" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fieldKey" TEXT,
    "fieldType" TEXT,
    "terminalType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demorobot_flow_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demorobot_flow_nodes_flowId_idx" ON "demorobot_flow_nodes"("flowId");

CREATE TABLE "demorobot_flow_edges" (
    "id" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT,
    "label" TEXT NOT NULL,
    "triggersEscalation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demorobot_flow_edges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demorobot_flow_edges_sourceNodeId_idx" ON "demorobot_flow_edges"("sourceNodeId");
CREATE INDEX "demorobot_flow_edges_targetNodeId_idx" ON "demorobot_flow_edges"("targetNodeId");

CREATE TABLE "demorobot_assets" (
    "id" TEXT NOT NULL,
    "robotModelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demorobot_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demorobot_assets_robotModelId_idx" ON "demorobot_assets"("robotModelId");

CREATE TABLE "demorobot_flow_node_attachments" (
    "nodeId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demorobot_flow_node_attachments_pkey" PRIMARY KEY ("nodeId","assetId")
);

CREATE INDEX "demorobot_flow_node_attachments_nodeId_idx" ON "demorobot_flow_node_attachments"("nodeId");
CREATE INDEX "demorobot_flow_node_attachments_assetId_idx" ON "demorobot_flow_node_attachments"("assetId");

ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demorobot_flows" ADD CONSTRAINT "demorobot_flows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demorobot_flows" ADD CONSTRAINT "demorobot_flows_robotModelId_fkey" FOREIGN KEY ("robotModelId") REFERENCES "robot_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demorobot_flow_nodes" ADD CONSTRAINT "demorobot_flow_nodes_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "demorobot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demorobot_flow_edges" ADD CONSTRAINT "demorobot_flow_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "demorobot_flow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demorobot_assets" ADD CONSTRAINT "demorobot_assets_robotModelId_fkey" FOREIGN KEY ("robotModelId") REFERENCES "robot_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demorobot_flow_node_attachments" ADD CONSTRAINT "demorobot_flow_node_attachments_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "demorobot_flow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demorobot_flow_node_attachments" ADD CONSTRAINT "demorobot_flow_node_attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "demorobot_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
