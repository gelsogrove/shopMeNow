/**
 * Resolves the workspace's Human Support flow id BY PROPERTY, never by a
 * pinned id: CONTRACT.md rule 13 defines that flow as the protected one in
 * the flow builder (`Flow.isProtected`), so the property IS the identity —
 * it survives the flow being recreated and needs no hand-maintained config.
 *
 * Why this exists (Andrea 2026-08-17, seen live): `humanSupportFlowId` lived
 * ONLY in the module's local settings.json, which production never reads —
 * the DB settings builder didn't emit it, so `technicalFlowStillDue` was
 * always false live: the Human Support flow was never forced, the combined
 * check became model-improvised prose, and the customer's name was asked
 * BEFORE the technical checks (rule 11 wants it last). The CLI never caught
 * it because its local settings.json did carry the id — a host/module config
 * gap, closed by making host AND CLI resolve through this one function.
 */
export interface FlowLookupClient {
  flow: {
    findFirst(args: {
      where: { workspaceId: string; isProtected: boolean; isActive: boolean }
      select: { id: true }
    }): Promise<{ id: string } | null>
  }
}

export async function resolveHumanSupportFlowId(
  db: FlowLookupClient,
  workspaceId: string
): Promise<string | null> {
  try {
    const flow = await db.flow.findFirst({
      where: { workspaceId, isProtected: true, isActive: true },
      select: { id: true },
    })
    return flow?.id ?? null
  } catch {
    // Fail toward "no flow": the escalate gate then skips the technical flow
    // rather than ordering an attach that would refuse.
    return null
  }
}
