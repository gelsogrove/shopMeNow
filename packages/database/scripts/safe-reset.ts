#!/usr/bin/env ts-node
/**
 * SAFE MIGRATE RESET WRAPPER
 *
 * This script wraps `prisma migrate reset` with production environment check.
 * It will BLOCK execution in production to prevent data loss.
 *
 * ⚠️  DESTRUCTIVE OPERATION - BLOCKED IN PRODUCTION
 *
 * Usage: npm run migrate:reset
 */

import { ensureNotProduction } from "./check-env-safety"
import { execSync } from "child_process"

// 🛡️ SAFETY CHECK: Block execution in production
ensureNotProduction("prisma migrate:reset")

console.log("🔄 Running prisma migrate reset --force...\n")

try {
  execSync("dotenv -e ../../.env -- prisma migrate reset --force", {
    stdio: "inherit",
    cwd: __dirname + "/..",
  })
  console.log("\n✅ Database reset completed successfully!")
} catch (error) {
  console.error("\n❌ Database reset failed!")
  process.exit(1)
}
