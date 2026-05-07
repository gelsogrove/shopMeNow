// Test runner for agent acceptance tests.
//
// Usage:
//   node --import tsx __tests__/agent/run.ts                   # all tests
//   node --import tsx __tests__/agent/run.ts 01                # files matching "01"
//   node --import tsx __tests__/agent/run.ts welcome           # files matching "welcome"
//   node --import tsx __tests__/agent/run.ts 02,03,04          # comma-separated → match ANY
//
// Each spec file exports `tests: TestCase[]`. The runner discovers them all,
// runs them sequentially, and prints a coloured summary.

import path from 'node:path'
import process from 'node:process'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { runTest, type TestCase } from './_helpers.js'

const COLOR = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

interface DiscoveredFile {
  filename: string
  tests: TestCase[]
}

async function discover(filter: string | null): Promise<DiscoveredFile[]> {
  const here = path.dirname(fileURLToPath(import.meta.url))

  // Recursive scan: find .test.spec.ts in this dir and any subdirectory.
  // Subdirectories typically group tests by location (locations/alemanya/, etc.).
  async function walk(dir: string, prefix = ''): Promise<string[]> {
    const out: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const display = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        out.push(...(await walk(full, display)))
      } else if (entry.isFile() && entry.name.endsWith('.test.spec.ts')) {
        out.push(display)
      }
    }
    return out
  }

  const filterTokens = filter
    ? filter.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : []
  const files = (await walk(here))
    .filter(
      (f) =>
        filterTokens.length === 0 ||
        filterTokens.some((t) => f.toLowerCase().includes(t)),
    )
    .sort()

  const discovered: DiscoveredFile[] = []
  for (const filename of files) {
    const fullPath = path.join(here, filename)
    const mod = (await import(pathToFileURL(fullPath).href)) as { tests?: TestCase[] }
    if (!mod.tests || !Array.isArray(mod.tests)) {
      console.warn(`⚠️  ${filename}: no tests exported, skipping.`)
      continue
    }
    discovered.push({ filename, tests: mod.tests })
  }
  return discovered
}

async function main(): Promise<void> {
  const filter = process.argv[2] || null
  const files = await discover(filter)

  if (files.length === 0) {
    console.log('No test files found.')
    process.exit(0)
  }

  console.log(COLOR.bold(`\nAgent acceptance tests — ${files.length} file(s), ${files.reduce((s, f) => s + f.tests.length, 0)} test(s)\n`))

  let passed = 0
  let failed = 0
  const failures: Array<{ file: string; name: string; reason: string; dialog: Array<{ user: string; bot: string }> }> = []

  for (const { filename, tests } of files) {
    console.log(COLOR.bold(filename))
    for (const tc of tests) {
      process.stdout.write(`  ${COLOR.dim('•')} ${tc.name} ... `)
      const t0 = Date.now()
      const result = await runTest(tc)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      if (result.ok) {
        console.log(`${COLOR.green('✓')} ${COLOR.dim(`(${elapsed}s)`)}`)
        passed += 1
      } else {
        console.log(`${COLOR.red('✗')} ${COLOR.dim(`(${elapsed}s)`)}`)
        failed += 1
        failures.push({ file: filename, name: tc.name, reason: result.reason || 'unknown', dialog: result.dialog })
      }
    }
    console.log('')
  }

  if (failures.length > 0) {
    console.log(COLOR.bold('FAILURES'))
    console.log('')
    for (const f of failures) {
      console.log(COLOR.red(`✗ ${f.file} → ${f.name}`))
      console.log(COLOR.yellow(`  ${f.reason}`))
      if (f.dialog.length > 0) {
        console.log(COLOR.dim('  Dialog:'))
        for (const turn of f.dialog) {
          console.log(COLOR.dim(`    YOU: ${turn.user}`))
          console.log(COLOR.dim(`    BOT: ${turn.bot.replace(/\n/g, '\n         ')}`))
        }
      }
      console.log('')
    }
  }

  const total = passed + failed
  const status = failed === 0 ? COLOR.green(`✓ ALL PASS`) : COLOR.red(`✗ ${failed}/${total} FAILED`)
  console.log(`${status} — ${COLOR.green(`${passed} passed`)}${failed > 0 ? `, ${COLOR.red(`${failed} failed`)}` : ''}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
