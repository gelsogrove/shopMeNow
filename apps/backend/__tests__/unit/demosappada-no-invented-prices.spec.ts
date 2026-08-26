/**
 * demosappada — no price reaches the guest for an accommodation
 *
 * WHAT: formatCatalogue renders the accommodation list WITHOUT the DB's
 * `price` column, and no "prezzo indicativo" copy exists anywhere in the
 * module's source.
 *
 * WHY (Andrea, live, 2026-08-27: "NON METTERE PREZZO INDICATIVO! QUI STAI
 * INVENTANDO"): the catalogue's price fed "prezzo indicativo da €70" into
 * every accommodation list. Nobody keeps those rates fresh, so a stale number
 * reads as invented — the same reasoning that kept the availability count out
 * of CatalogueEntry (2026-08-22). With the price out of the catalogue block it
 * is also out of approvedContent, so an invented rate is now STRIPPED by
 * content-guards instead of approved by it. The structure quotes its own
 * price when the guest calls.
 *
 * Asserted against the SOURCE (CLAUDE.md §1A: lock hardcoded copy out with a
 * test that greps the source): formatCatalogue is module-internal, and
 * exporting it purely to test a rendering detail would widen the public
 * surface (§13). Same pattern as demosappada-tools-from-db.spec.ts.
 */
import fs from "fs"
import path from "path"

const MODULE_DIR = path.join(__dirname, "..", "..", "custom-demosappada")

const sourceFiles = fs
  .readdirSync(MODULE_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ name: f, code: fs.readFileSync(path.join(MODULE_DIR, f), "utf-8") }))

/** Comments removed — copy described in prose (docs, bug notes) is fine. */
const strip = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("demosappada accommodation prices come from the structure, never from us", () => {
  it('renders the catalogue without the price — "prezzo indicativo" never returns to code', () => {
    for (const { name, code } of sourceFiles) {
      expect({ file: name, hasPriceCopy: strip(code).includes("prezzo indicativo") }).toEqual({
        file: name,
        hasPriceCopy: false,
      })
    }
  })

  it("formatCatalogue does not read e.price at all", () => {
    // Not just the wording: the VALUE must stay out of the block, because the
    // block feeds approvedContent and whatever is in there survives the
    // price guard in content-guards.ts.
    const agent = sourceFiles.find((f) => f.name === "agent.ts")
    const body = strip(agent!.code).match(/function formatCatalogue\([\s\S]*?\n}/)?.[0]

    expect(body).toBeDefined()
    expect(body).not.toContain(".price")
  })
})
