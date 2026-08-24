/**
 * Reads the tool manifest a code-based chatbot module declares.
 *
 * A `custom-<name>` module ships its built-in tools as data in
 * `tools.manifest.ts`. The backend seeds one `WorkspaceCallingFunction` row
 * per entry so the Settings → Custom Tools page can switch each tool on and
 * off and edit its description — the tools used to exist only as hardcoded
 * schemas in the module plus a hand-copied list in the frontend, which meant
 * the same seven tools were described in three places that could not agree.
 *
 * Loading strategy mirrors `CustomClientChatbotService.loadChatbotModule`:
 * same path-traversal guard, same folder-name conventions, same `tsImport`,
 * same per-process cache. The difference is that a MISSING manifest is normal
 * — six of the seven modules do not have one and must keep working — so this
 * resolves to `null` instead of throwing.
 */

import fs from "fs"
import path from "path"
import { pathToFileURL } from "url"
import logger from "../../utils/logger"

export interface ModuleToolManifestEntry {
  functionName: string
  description: string
  responseInstructions?: string
  parameters: Record<string, unknown>
  supersedes?: string[]
  impact?: string
}

type TsImportFn = (specifier: string, options: { parentURL: string }) => Promise<Record<string, unknown>>

/**
 * Cached per chatbotId for the life of the process: the manifest is a static
 * file, and this is called from the workspace-settings save path where a
 * `tsImport` per request would be pure waste.
 *
 * `null` is cached too — it is the answer for every module without a manifest,
 * and re-probing the filesystem for them on every save is the same waste.
 */
const manifestCache = new Map<string, Promise<ModuleToolManifestEntry[] | null>>()

/** Tool names must be callable by an LLM and match a dispatch branch in code. */
const FUNCTION_NAME_RE = /^[a-z][a-zA-Z0-9_]*$/

export async function loadModuleToolManifest(
  chatbotId: string | null | undefined
): Promise<ModuleToolManifestEntry[] | null> {
  if (!chatbotId?.trim()) return null

  const key = chatbotId.trim()
  const cached = manifestCache.get(key)
  if (cached) return cached

  const promise = importManifest(key)
  manifestCache.set(key, promise)
  return promise
}

/** Test seam: the cache would otherwise outlive a module's fixtures. */
export function clearModuleToolManifestCache(): void {
  manifestCache.clear()
}

async function importManifest(chatbotId: string): Promise<ModuleToolManifestEntry[] | null> {
  let manifestPath: string | null
  try {
    manifestPath = resolveManifestPath(chatbotId)
  } catch (error) {
    // An invalid chatbotId is a rejected input, not a missing file: it must be
    // visible rather than silently behaving like a module with no tools.
    logger.error("[ModuleToolManifest] invalid chatbotId", {
      chatbotId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  if (!manifestPath) return null

  try {
    const imported = await importFrom(manifestPath)

    const tools = imported?.MODULE_TOOLS
    if (!Array.isArray(tools)) {
      logger.error("[ModuleToolManifest] MODULE_TOOLS is not an array", { chatbotId, manifestPath })
      return null
    }

    return validate(tools, chatbotId)
  } catch (error) {
    logger.error("[ModuleToolManifest] failed to import manifest", {
      chatbotId,
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Load the manifest module, whichever way this process can.
 *
 * `tsImport` is the production path — the same one the chatbot module loader
 * uses — but it goes through a dynamic `import()`, which Jest refuses without
 * `--experimental-vm-modules`. Under the test runner the file is plain
 * TypeScript that ts-jest already transforms, so `require` reads it directly.
 *
 * Falling back rather than branching on NODE_ENV: what matters is whether
 * dynamic import works here, not which environment claims to be running.
 */
async function importFrom(manifestPath: string): Promise<Record<string, unknown>> {
  try {
    const { tsImport } = require("tsx/esm/api") as { tsImport: TsImportFn }
    return await tsImport(pathToFileURL(manifestPath).href, {
      parentURL: pathToFileURL(__filename).href,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/experimental-vm-modules|dynamic import/i.test(message)) throw error
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(manifestPath) as Record<string, unknown>
  }
}

/**
 * All-or-nothing: a malformed entry rejects the WHOLE manifest.
 *
 * A partial seed is the worst outcome available — the admin sees some tools in
 * the UI and not others, with nothing saying why, and the missing rows silently
 * remove capabilities from the chatbot (CLAUDE.md §1: missing data is an error,
 * never a quietly-filled default).
 */
function validate(tools: unknown[], chatbotId: string): ModuleToolManifestEntry[] | null {
  const seen = new Set<string>()
  const validated: ModuleToolManifestEntry[] = []

  for (const raw of tools) {
    if (!raw || typeof raw !== "object") {
      logger.error("[ModuleToolManifest] entry is not an object", { chatbotId })
      return null
    }
    const entry = raw as Partial<ModuleToolManifestEntry>

    const functionName = typeof entry.functionName === "string" ? entry.functionName.trim() : ""
    if (!FUNCTION_NAME_RE.test(functionName)) {
      logger.error("[ModuleToolManifest] invalid functionName", { chatbotId, functionName })
      return null
    }
    if (seen.has(functionName)) {
      // The row key is (workspaceId, functionName): a duplicate would make the
      // second upsert overwrite the first, seeding fewer tools than declared.
      logger.error("[ModuleToolManifest] duplicate functionName", { chatbotId, functionName })
      return null
    }
    seen.add(functionName)

    const description = typeof entry.description === "string" ? entry.description.trim() : ""
    if (!description) {
      logger.error("[ModuleToolManifest] empty description", { chatbotId, functionName })
      return null
    }

    if (!entry.parameters || typeof entry.parameters !== "object" || Array.isArray(entry.parameters)) {
      logger.error("[ModuleToolManifest] parameters must be a JSON schema object", {
        chatbotId,
        functionName,
      })
      return null
    }

    validated.push({
      functionName,
      description,
      responseInstructions:
        typeof entry.responseInstructions === "string" && entry.responseInstructions.trim()
          ? entry.responseInstructions.trim()
          : undefined,
      parameters: entry.parameters as Record<string, unknown>,
      supersedes: Array.isArray(entry.supersedes)
        ? entry.supersedes.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : undefined,
      impact: typeof entry.impact === "string" && entry.impact.trim() ? entry.impact.trim() : undefined,
    })
  }

  return validated
}

/**
 * Absolute path of the module's manifest, or `null` when it has none.
 *
 * Throws only on an invalid chatbotId — see the guard below.
 */
function resolveManifestPath(chatbotId: string): string | null {
  // Security: the chatbotId reaches here from a DB column, so a "../../" in it
  // would be a path traversal. Same guard as resolveCustomClientEntryPath.
  if (!/^[a-z0-9-]+$/.test(chatbotId)) {
    throw new Error(
      `Invalid chatbotId "${chatbotId}": only lowercase letters, digits and hyphens are allowed`
    )
  }

  // Same folder conventions as the chatbot module loader.
  const folderName = chatbotId.startsWith("cliente-")
    ? chatbotId.replace("cliente-", "custom-client-")
    : chatbotId.startsWith("custom-")
      ? chatbotId
      : `custom-${chatbotId}`

  const candidates = [
    path.resolve(process.cwd(), `${folderName}/tools.manifest.ts`),
    path.resolve(process.cwd(), `apps/backend/${folderName}/tools.manifest.ts`),
    path.resolve(__dirname, `../../../${folderName}/tools.manifest.ts`),
    path.resolve(__dirname, `../../../../${folderName}/tools.manifest.ts`),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}
