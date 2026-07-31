-- Renames RobotModel -> FlowCategory across the flow-builder domain.
-- Andrea: the flow-builder is a generic tool ("new flow", not "new robot") —
-- the data model must not carry domain-specific vocabulary (robot/manufacturer)
-- that only makes sense for the first customer (AmRobots). The next customer
-- (e.g. a laundry chain) must see the same generic "Category" concept.
--
-- Named "FlowCategory" (not "Category") to avoid colliding with the existing
-- unrelated e-commerce "Categories" model (product categories, table
-- "categories").
--
-- Drops "manufacturer" entirely (not renamed) — Andrea confirmed twice this
-- field should not exist at all, it's robot-domain-specific with no generic
-- equivalent.

-- 1. Rename the table itself
ALTER TABLE "robot_models" RENAME TO "flow_categories";

-- 2. Drop the robot-specific column
ALTER TABLE "flow_categories" DROP COLUMN "manufacturer";

-- 3. Rename the FK column on demorobot_flows (Flow.robotModelId -> flowCategoryId)
ALTER TABLE "demorobot_flows" RENAME COLUMN "robotModelId" TO "flowCategoryId";

-- 4. Rename the FK column on demorobot_assets (Asset.robotModelId -> flowCategoryId)
ALTER TABLE "demorobot_assets" RENAME COLUMN "robotModelId" TO "flowCategoryId";

-- 5. Rename indexes to match the new column/table names (cosmetic, but keeps
--    \d output readable — Postgres does not auto-rename index names on
--    ALTER TABLE ... RENAME COLUMN, only the underlying column reference).
ALTER INDEX IF EXISTS "robot_models_workspaceId_idx" RENAME TO "flow_categories_workspaceId_idx";
ALTER INDEX IF EXISTS "robot_models_workspaceId_slug_key" RENAME TO "flow_categories_workspaceId_slug_key";
ALTER INDEX IF EXISTS "demorobot_flows_robotModelId_idx" RENAME TO "demorobot_flows_flowCategoryId_idx";
ALTER INDEX IF EXISTS "demorobot_assets_robotModelId_idx" RENAME TO "demorobot_assets_flowCategoryId_idx";

-- 6. Rename PK/FK constraints to match (cosmetic, Prisma does not care about
--    constraint names, but keeps \d output honest for future readers).
ALTER TABLE "flow_categories" RENAME CONSTRAINT "robot_models_pkey" TO "flow_categories_pkey";
ALTER TABLE "flow_categories" RENAME CONSTRAINT "robot_models_workspaceId_fkey" TO "flow_categories_workspaceId_fkey";
ALTER TABLE "demorobot_flows" RENAME CONSTRAINT "demorobot_flows_robotModelId_fkey" TO "demorobot_flows_flowCategoryId_fkey";
ALTER TABLE "demorobot_assets" RENAME CONSTRAINT "demorobot_assets_robotModelId_fkey" TO "demorobot_assets_flowCategoryId_fkey";
