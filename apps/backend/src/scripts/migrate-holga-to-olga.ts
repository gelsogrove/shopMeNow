// One-shot data migration: rename playground user HOLGA → OLGA.
//
// Background: the playground (Ecolaundry collaboration TODO/comments
// system) had two hardcoded users ANDREA + HOLGA. Andrea renamed HOLGA
// to OLGA. This script updates existing DB records:
//   - playground_todos.createdBy  'HOLGA' → 'OLGA'
//   - playground_comments.createdBy  'HOLGA' → 'OLGA'
//
// Idempotent: re-running has no effect (the WHERE clause finds nothing).
// Run with:
//   cd apps/backend && npx ts-node src/scripts/migrate-holga-to-olga.ts

import { prisma } from "@echatbot/database"

async function migrate() {
  console.log("🔄 Migrating HOLGA → OLGA in playground tables...")

  const todos = await prisma.playgroundTodo.updateMany({
    where: { createdBy: "HOLGA" },
    data: { createdBy: "OLGA" },
  })
  console.log(`✅ playground_todos: ${todos.count} record(s) updated`)

  const comments = await prisma.playgroundComment.updateMany({
    where: { createdBy: "HOLGA" },
    data: { createdBy: "OLGA" },
  })
  console.log(`✅ playground_comments: ${comments.count} record(s) updated`)

  const totalChanged = todos.count + comments.count
  if (totalChanged === 0) {
    console.log("ℹ️  No HOLGA records found — migration already applied or no data.")
  } else {
    console.log(`✅ Done — ${totalChanged} total record(s) migrated.`)
  }
}

migrate()
  .catch((err) => {
    console.error("❌ Migration failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
