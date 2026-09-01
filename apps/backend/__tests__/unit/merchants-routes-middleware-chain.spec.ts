/**
 * Merchants routes — the 3-layer security chain is not optional.
 *
 * WHAT: asserts, on the SOURCE of merchants.routes.ts, that the full
 * middleware chain (authMiddleware → sessionValidationMiddleware →
 * workspaceValidationMiddleware) is mounted, in that order, before any
 * endpoint. Same source-locking pattern the project uses for hardcoded-copy
 * bans (see demorobot-orchestration.spec.ts).
 *
 * WHY: 2026-09-01 security QA (Andrea: "sistema la sicurezza, è molto
 * importante" / "non possiamo permetterci che vengano fatte campagne da
 * hacker"). Merchants are the money surface of the push flow — quotas that
 * become invoices, creatives that become WhatsApp campaigns. The file had
 * auth + workspace but NOT session validation, unlike push-campaign.routes:
 * a stolen JWT alone was enough to reach merchant CRUD. A middleware silently
 * dropped in a refactor would reopen exactly that hole, so the chain is
 * locked here at the source level, where no request mocking can fake it.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(
  join(__dirname, "../../src/interfaces/http/routes/merchants.routes.ts"),
  "utf8"
)

describe("merchants.routes.ts — 3-layer middleware chain", () => {
  it("imports all three middlewares", () => {
    expect(source).toContain('import { authMiddleware }')
    expect(source).toContain('import { sessionValidationMiddleware }')
    expect(source).toContain('import { workspaceValidationMiddleware }')
  })

  it("mounts auth → session → workspace, in order, via router.use", () => {
    const auth = source.indexOf("router.use(authMiddleware)")
    const session = source.indexOf("router.use(sessionValidationMiddleware)")
    const workspace = source.indexOf("router.use(workspaceValidationMiddleware)")
    expect(auth).toBeGreaterThan(-1)
    expect(session).toBeGreaterThan(-1)
    expect(workspace).toBeGreaterThan(-1)
    expect(auth).toBeLessThan(session)
    expect(session).toBeLessThan(workspace)
  })

  it("mounts the chain before the first route handler", () => {
    const firstRoute = source.search(/router\.(get|post|put|delete)\(/)
    const workspace = source.indexOf("router.use(workspaceValidationMiddleware)")
    expect(firstRoute).toBeGreaterThan(-1)
    expect(workspace).toBeLessThan(firstRoute)
  })
})
