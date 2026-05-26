// Standalone unit test (NO LLM) — llm-fetch.ts observability hook.
//
// Verifies that when LLM_DEBUG=1, fetchLlmJson emits a `llm.call` log line
// per successful OpenRouter request, carrying { caller, status, latencyMs,
// attempts }. When LLM_DEBUG is unset (default), NO log line is emitted —
// production and the test suite stay silent.
//
// Strategy: stub globalThis.fetch to short-circuit the network call and
// intercept process.stdout/stderr writes performed by the logger.
//
// Run with:
//   node --import tsx __tests__/unit/llm-fetch-observability.test.ts

import process from 'node:process'

import { fetchLlmJson, LlmFetchError, type LlmCaller } from '../../utils/llm-fetch.js'
import { extractCacheUsage } from '../../utils/llm-fetch-observability.js'

// ── Stdout capture ───────────────────────────────────────────────────────────

interface CapturedLine {
  stream: 'stdout' | 'stderr'
  raw: string
}

function captureStdio(): { lines: CapturedLine[]; restore: () => void } {
  const lines: CapturedLine[] = []
  const realOut = process.stdout.write.bind(process.stdout)
  const realErr = process.stderr.write.bind(process.stderr)
  process.stdout.write = ((chunk: string | Uint8Array) => {
    lines.push({ stream: 'stdout', raw: typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString() })
    return true
  }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array) => {
    lines.push({ stream: 'stderr', raw: typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString() })
    return true
  }) as typeof process.stderr.write
  return {
    lines,
    restore: () => {
      process.stdout.write = realOut
      process.stderr.write = realErr
    },
  }
}

// ── fetch stub ───────────────────────────────────────────────────────────────

type FetchStub = (status: number, body: unknown) => void

function stubFetch(): {
  setNextResponse: FetchStub
  restore: () => void
} {
  const realFetch = globalThis.fetch
  let next: { status: number; body: unknown } = { status: 200, body: { ok: true } }
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof globalThis.fetch
  return {
    setNextResponse: (status, body) => {
      next = { status, body }
    },
    restore: () => {
      globalThis.fetch = realFetch
    },
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseLogLines(lines: CapturedLine[]): Array<Record<string, unknown>> {
  const parsed: Array<Record<string, unknown>> = []
  for (const { raw } of lines) {
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // Logger formats:
      //  - JSON mode (LOG_FORMAT=json / NODE_ENV=production): `{"ts":...,"msg":...,...}`
      //  - Dev mode (default): `[LEVEL] msg {ctx-json}` (ctx may be absent)
      // Normalise both to a `{msg, ...ctx}` record for downstream filtering.
      if (trimmed.startsWith('{')) {
        try {
          parsed.push(JSON.parse(trimmed))
        } catch {
          // not parsable JSON — skip
        }
        continue
      }
      const dev = trimmed.match(/^\[(DEBUG|INFO|WARN|ERROR)\]\s+(\S.*?)(?:\s+(\{.*\}))?$/)
      if (dev) {
        const [, , msg, ctxJson] = dev
        let ctx: Record<string, unknown> = {}
        if (ctxJson) {
          try {
            ctx = JSON.parse(ctxJson)
          } catch {
            // malformed ctx — ignore
          }
        }
        parsed.push({ msg, ...ctx })
      }
    }
  }
  return parsed
}

function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })
}

interface Case {
  name: string
  run: () => Promise<void>
}

const cases: Case[] = [
  {
    name: 'LLM_DEBUG unset → no llm.call log emitted',
    run: async () => {
      const fetchStub = stubFetch()
      fetchStub.setNextResponse(200, { ok: true })
      const cap = captureStdio()
      try {
        await withEnv({ LLM_DEBUG: undefined }, async () => {
          await fetchLlmJson<{ ok: boolean }>('https://example.test/x', { method: 'POST' }, 'router')
        })
      } finally {
        cap.restore()
        fetchStub.restore()
      }
      const logs = parseLogLines(cap.lines)
      const llmCallLogs = logs.filter((l) => l.msg === 'llm.call' || l.msg === 'llm.call.failed')
      if (llmCallLogs.length !== 0) {
        throw new Error(`expected 0 llm.call logs, got ${llmCallLogs.length}: ${JSON.stringify(llmCallLogs)}`)
      }
    },
  },
  {
    name: 'LLM_DEBUG=1 + success → exactly one llm.call log with caller, status, latencyMs, attempts',
    run: async () => {
      const fetchStub = stubFetch()
      fetchStub.setNextResponse(200, { ok: true })
      const cap = captureStdio()
      try {
        await withEnv({ LLM_DEBUG: '1', LOG_FORMAT: 'json', LOG_LEVEL: 'info' }, async () => {
          await fetchLlmJson<{ ok: boolean }>('https://example.test/x', { method: 'POST' }, 'rephrase')
        })
      } finally {
        cap.restore()
        fetchStub.restore()
      }
      const logs = parseLogLines(cap.lines).filter((l) => l.msg === 'llm.call')
      if (logs.length !== 1) {
        throw new Error(`expected exactly 1 llm.call log, got ${logs.length}`)
      }
      const log = logs[0]
      if (log.caller !== 'rephrase') throw new Error(`caller mismatch: ${log.caller}`)
      if (log.status !== 200) throw new Error(`status mismatch: ${log.status}`)
      if (typeof log.latencyMs !== 'number') throw new Error('latencyMs missing/not number')
      if (log.attempts !== 1) throw new Error(`attempts mismatch: ${log.attempts}`)
    },
  },
  {
    name: 'LLM_DEBUG=1 + no caller → llm.call log records caller="unknown"',
    run: async () => {
      const fetchStub = stubFetch()
      fetchStub.setNextResponse(200, { ok: true })
      const cap = captureStdio()
      try {
        await withEnv({ LLM_DEBUG: '1', LOG_FORMAT: 'json', LOG_LEVEL: 'info' }, async () => {
          await fetchLlmJson<{ ok: boolean }>('https://example.test/x', { method: 'POST' })
        })
      } finally {
        cap.restore()
        fetchStub.restore()
      }
      const logs = parseLogLines(cap.lines).filter((l) => l.msg === 'llm.call')
      if (logs.length !== 1) throw new Error(`expected 1 log, got ${logs.length}`)
      if (logs[0].caller !== 'unknown') throw new Error(`caller should be 'unknown', got ${logs[0].caller}`)
    },
  },
  {
    name: 'LLM_DEBUG=1 + permanent failure (auth 401) → emits llm.call.failed once and rethrows',
    run: async () => {
      const fetchStub = stubFetch()
      fetchStub.setNextResponse(401, { error: 'bad key' })
      const cap = captureStdio()
      let thrown: unknown = null
      try {
        await withEnv({ LLM_DEBUG: '1', LOG_FORMAT: 'json', LOG_LEVEL: 'info' }, async () => {
          try {
            await fetchLlmJson<{ ok: boolean }>(
              'https://example.test/x',
              { method: 'POST' },
              'operator-briefing' as LlmCaller,
            )
          } catch (e) {
            thrown = e
          }
        })
      } finally {
        cap.restore()
        fetchStub.restore()
      }
      if (!(thrown instanceof LlmFetchError) || thrown.category !== 'auth') {
        throw new Error(`expected LlmFetchError(auth), got ${String(thrown)}`)
      }
      const failedLogs = parseLogLines(cap.lines).filter((l) => l.msg === 'llm.call.failed')
      if (failedLogs.length !== 1) {
        throw new Error(`expected 1 llm.call.failed log, got ${failedLogs.length}`)
      }
      if (failedLogs[0].caller !== 'operator-briefing') {
        throw new Error(`caller mismatch: ${failedLogs[0].caller}`)
      }
      if (failedLogs[0].category !== 'auth') {
        throw new Error(`category mismatch: ${failedLogs[0].category}`)
      }
    },
  },
  {
    name: 'extractCacheUsage: Anthropic shape → reads cache_read_input_tokens + cache_creation_input_tokens',
    run: async () => {
      const out = extractCacheUsage({
        usage: {
          input_tokens: 50,
          output_tokens: 12,
          cache_read_input_tokens: 4200,
          cache_creation_input_tokens: 0,
        },
      })
      if (out.cacheRead !== 4200) throw new Error(`cacheRead: ${out.cacheRead}`)
      if (out.cacheCreated !== 0) throw new Error(`cacheCreated: ${out.cacheCreated}`)
    },
  },
  {
    name: 'extractCacheUsage: OpenAI shape → reads prompt_tokens_details.cached_tokens as cacheRead',
    run: async () => {
      const out = extractCacheUsage({
        usage: {
          prompt_tokens: 5300,
          completion_tokens: 40,
          prompt_tokens_details: { cached_tokens: 5200 },
        },
      })
      if (out.cacheRead !== 5200) throw new Error(`cacheRead: ${out.cacheRead}`)
      if ('cacheCreated' in out) throw new Error('cacheCreated must be absent for OpenAI shape')
    },
  },
  {
    name: 'extractCacheUsage: no cache fields → returns empty object (signals provider does not surface cache)',
    run: async () => {
      const out = extractCacheUsage({
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      })
      if (Object.keys(out).length !== 0) {
        throw new Error(`expected empty object, got ${JSON.stringify(out)}`)
      }
    },
  },
  {
    name: 'extractCacheUsage: malformed payload (no usage / non-object) → returns empty object',
    run: async () => {
      if (Object.keys(extractCacheUsage(null)).length !== 0) throw new Error('null must yield {}')
      if (Object.keys(extractCacheUsage('string')).length !== 0) throw new Error('string must yield {}')
      if (Object.keys(extractCacheUsage({})).length !== 0) throw new Error('no usage must yield {}')
      if (Object.keys(extractCacheUsage({ usage: 'not-object' })).length !== 0) {
        throw new Error('usage non-object must yield {}')
      }
    },
  },
]

async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  const failures: Array<{ name: string; reason: string }> = []

  for (const c of cases) {
    try {
      await c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      failures.push({ name: c.name, reason })
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
