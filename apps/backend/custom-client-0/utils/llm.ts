// LLM client layer: OpenRouter API integration + language detection.
// This module is the ONLY place that calls external LLM APIs.

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type { LlmRequest } from './types.js'
import type { SupportedLanguage, Settings, Runtime } from './runtime.js'
import { detectLanguageHeuristic } from './intent.js'
import { fetchLlmJson } from './llm-fetch.js'

// Load .env from the demo directory (if present)
try {
  const __envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
  process.loadEnvFile(__envFile)
} catch {
  // Optional — env vars may already be set in the shell
}

/**
 * Default OpenRouter model id when neither `Runtime.settings.model` nor the
 * `LLM_MODEL` environment variable provides one. Resolution order at runtime:
 *   1. explicit `runtime.settings.model` (json/settings.json) — per-tenant
 *   2. process.env.LLM_MODEL — per-deployment override
 *   3. this constant — last-resort fallback
 *
 * Use `resolveModel(runtime?)` to pick the right one; do NOT read this const
 * directly from feature code.
 */
export const DEFAULT_MODEL = 'openai/gpt-4o-mini'

export function resolveModel(runtime?: { settings?: { model?: string } }): string {
  return runtime?.settings?.model || process.env.LLM_MODEL || DEFAULT_MODEL
}

const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
export const API_KEY = process.env.OPENROUTER_API_KEY || ''

// ── JSON extraction helper ────────────────────────────────────────────────────

export function extractJson<T>(value: string, fallback: T): T {
  const trimmed = value.trim()
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] || trimmed
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return fallback
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return fallback
  }
}

// ── Core LLM call ─────────────────────────────────────────────────────────────

export async function callModel(params: LlmRequest): Promise<string> {
  return callOpenRouter(params)
}

export async function callOpenRouter(params: LlmRequest): Promise<string> {
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY missing in environment')
  }

  const data = await fetchLlmJson<{
    choices?: { message?: { content?: string } }[]
  }>(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'Cliente-0',
    },
    body: JSON.stringify({
      model: params.model || resolveModel(),
      messages: [
        ...(params.systemPrompt ? [{ role: 'system', content: params.systemPrompt }] : []),
        { role: 'user', content: params.userPrompt },
      ],
      temperature: params.temperature ?? 0.1,
      max_tokens: params.maxTokens ?? 300,
      ...(params.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  return data.choices?.[0]?.message?.content?.trim() || ''
}

// ── Language resolution ───────────────────────────────────────────────────────

export function resolveLanguage(detected: SupportedLanguage, settings: Settings): SupportedLanguage {
  if (settings.enabledLanguages.includes(detected)) return detected
  return settings.defaultLanguage
}

export async function detectLanguage(runtime: Runtime, message: string): Promise<SupportedLanguage> {
  const heuristic = detectLanguageHeuristic(message)
  if (heuristic) {
    return heuristic
  }

  const result = await callModel({
    systemPrompt: runtime.prompts.language,
    userPrompt: `Customer message:\n${message}`,
    json: true,
    maxTokens: 30,
  })
  const parsed = extractJson<{ language?: 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr' }>(result, { language: 'en' })
  return parsed.language || 'en'
}
