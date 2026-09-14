/**
 * Guard: every table written through raw SQL must exist in a migration.
 *
 * WHY THIS TEST EXISTS (Andrea, 2026-09-14)
 * invoice.service.ts → nextInvoiceSequence() has always issued
 * `INSERT INTO invoice_year_sequences ...` / `UPDATE invoice_year_sequences ...`,
 * but no migration ever created that table. Every ensureInvoiceNumber() call
 * therefore raised "relation does not exist" in production. Because the
 * month-end run numbers each invoice BEFORE charging it, and the per-owner
 * try/catch in runMonthEndBilling() swallowed the error, the entire billing
 * run produced zero invoices and zero PayPal charges — silently.
 *
 * The existing unit tests could not catch it: invoice.service.spec.ts mocks
 * $executeRaw/$queryRaw, and month-end-billing.service.spec.ts mocks
 * ensureInvoiceNumber outright, so the SQL text was never confronted with the
 * real schema. Integration tests are not allowed here (CLAUDE.md rule 7B), so
 * this check is STATIC: parse the table names out of the raw SQL in the
 * source, and assert each one is created by a migration.
 *
 * Tables reached through the Prisma client are NOT covered (and need no
 * cover): Prisma validates those against schema.prisma at generate time.
 * Only raw SQL bypasses that safety net — which is exactly the gap that bit.
 */

import * as fs from "fs"
import * as path from "path"

const REPO_ROOT = path.resolve(__dirname, "../../../..")
const BACKEND_SRC = path.resolve(__dirname, "../../src")
const MIGRATIONS_DIR = path.join(
  REPO_ROOT,
  "packages/database/prisma/migrations"
)

/** Recursively collect every .ts file under a directory. */
const collectTsFiles = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      out.push(...collectTsFiles(full))
    } else if (entry.name.endsWith(".ts")) {
      out.push(full)
    }
  }
  return out
}

/**
 * Extract table names targeted by raw SQL writes/reads in a source file.
 * Matches INSERT INTO / UPDATE / DELETE FROM / FROM <table>, with or without
 * double quotes, only inside $executeRaw / $queryRaw template literals.
 */
const extractRawSqlTables = (source: string): Set<string> => {
  const tables = new Set<string>()

  // Grab the contents of every $executeRaw`...` / $queryRaw`...` template.
  const rawBlocks = source.match(
    /\$(?:executeRaw|queryRaw)(?:<[^>]*>)?\s*`([\s\S]*?)`/g
  )
  if (!rawBlocks) return tables

  for (const block of rawBlocks) {
    // EXTRACT(YEAR FROM "createdAt") uses FROM with a COLUMN, not a table.
    // Strip those calls first so they are not mistaken for table references.
    const cleaned = block.replace(/EXTRACT\s*\([^)]*\)/gi, "")

    const statementPattern =
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi
    let match: RegExpExecArray | null
    while ((match = statementPattern.exec(cleaned)) !== null) {
      tables.add(match[1].toLowerCase())
    }
  }

  return tables
}

describe("Raw SQL tables have migrations", () => {
  // Concatenated SQL of every migration = the schema as it will exist in prod.
  const migrationSql = (() => {
    const dirs = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
    return dirs
      .map((d) => {
        const file = path.join(MIGRATIONS_DIR, d.name, "migration.sql")
        return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
      })
      .join("\n")
  })()

  /** True when some migration issues CREATE TABLE for this table. */
  const isCreatedByMigration = (table: string): boolean => {
    const pattern = new RegExp(
      `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?${table}"?`,
      "i"
    )
    return pattern.test(migrationSql)
  }

  it("has migrations on disk to check against", () => {
    // Sanity: a wrong MIGRATIONS_DIR would make every assertion below pass
    // vacuously, turning this guard into a no-op that hides the next bug.
    expect(migrationSql.length).toBeGreaterThan(0)
    expect(migrationSql).toMatch(/CREATE\s+TABLE/i)
  })

  it("creates invoice_year_sequences — the invoice numbering counter", () => {
    // The specific regression this file was written for: without this table
    // ensureInvoiceNumber() throws and the whole month-end billing run is a
    // silent no-op. Asserted by name so the failure message is unambiguous.
    expect(isCreatedByMigration("invoice_year_sequences")).toBe(true)
  })

  it("creates every table referenced by raw SQL in backend sources", () => {
    const offenders: string[] = []

    for (const file of collectTsFiles(BACKEND_SRC)) {
      const source = fs.readFileSync(file, "utf8")
      for (const table of extractRawSqlTables(source)) {
        // Postgres catalog/system tables are provided by the server itself.
        if (table.startsWith("pg_") || table === "information_schema") continue
        if (!isCreatedByMigration(table)) {
          offenders.push(`${path.relative(REPO_ROOT, file)} → "${table}"`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
