-- Playground kanban: record WHERE an author came from, not just their name.
--
-- The board now has two doors: a client reporting from the public demo page
-- (identified by their playground session) and staff working the cards inside
-- the app (identified by their JWT). Both write to the same board.
--
-- Comment deletion is authorised by author, and that check used to compare the
-- name alone. With two populations on one board, a customer who happens to be
-- called "Andrea" could delete a staff member called "Andrea"'s comments. The
-- origin makes the pair unambiguous.
--
-- Existing rows predate the public door, so they are all staff.

ALTER TABLE "playground_todos"
  ADD COLUMN "authorKind" TEXT NOT NULL DEFAULT 'STAFF';

ALTER TABLE "playground_comments"
  ADD COLUMN "authorKind" TEXT NOT NULL DEFAULT 'STAFF';
