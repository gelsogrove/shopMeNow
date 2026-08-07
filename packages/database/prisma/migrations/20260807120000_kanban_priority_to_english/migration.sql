-- Playground kanban: priority labels move from Italian to English.
--
-- The board is now shared by every Flow workspace (demowash, demorobot, …) and
-- surfaced in an English-only UI (CLAUDE.md rule 15), so the stored values stop
-- being Italian. Existing rows are translated in place; the column default
-- follows.

UPDATE "playground_todos" SET "priority" = 'HIGH'   WHERE "priority" = 'Alto';
UPDATE "playground_todos" SET "priority" = 'MEDIUM' WHERE "priority" = 'Medio';
UPDATE "playground_todos" SET "priority" = 'LOW'    WHERE "priority" = 'Basso';

ALTER TABLE "playground_todos" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
