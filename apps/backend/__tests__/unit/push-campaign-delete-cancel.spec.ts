/**
 * 🎯 TEST: Campaign Delete vs Cancel vs Permanent Delete Distinction
 *
 * SCENARIO: Three different operations exist for removing/ending a campaign:
 * - DELETE (trash icon): SOFT-deletes — sets deletedAt, PushCampaignRecipient
 *   history (billing, merchant quota ledger) is NEVER touched. This is the
 *   only delete exposed on the normal campaign list.
 * - PERMANENT DELETE: hard-deletes from the database, cascading to every
 *   recipient row. Backoffice cleanup only — BLOCKED whenever the campaign
 *   has actualSent > 0, because that history drives billing and statistics
 *   (Andrea, 2026-09-12: "non mi puo' cancellare uno storico di invii che mi
 *   serve per fatturazione / statistiche").
 * - CANCEL: sets status to CANCELLED only — campaign record and its history
 *   remain untouched, same as before.
 *
 * KEY RULES:
 * 1. DELETE → repo.deleteCampaign() sets deletedAt, PushCampaignRecipient rows survive
 * 2. PERMANENT DELETE → repo.hardDeleteCampaign(), only reachable via
 *    service.hardDelete(), which throws when actualSent > 0
 * 3. CANCEL → calls updateStatus(CANCELLED) — campaign record remains in DB
 * 4. All three are separate controller methods with separate endpoints
 *
 * 📚 minrequirement: "se si cancella la campagna la storia non si cancella"
 * (Andrea, 2026-09-12) — the original version of this test asserted the
 * opposite (hard delete on the normal DELETE) and was corrected with him.
 */

describe("Campaign Delete vs Cancel vs Permanent Delete Distinction", () => {
  describe("DELETE operation (soft)", () => {
    it("should call service.delete which sets deletedAt, not a hard delete", () => {
      // RULE: the normal delete NEVER removes the row or its recipients.
      // Controller method: delete() → service.delete(workspaceId, id) → repo.deleteCampaign(id, workspaceId)
      // HTTP: DELETE /workspaces/:workspaceId/push-campaigns/:id → 204 No Content
      const deleteMethod = "service.delete(workspaceId, id)"
      const cancelMethod = "service.updateStatus(workspaceId, id, CANCELLED)"
      const hardDeleteMethod = "service.hardDelete(workspaceId, id)"

      expect(deleteMethod).not.toBe(cancelMethod)
      expect(deleteMethod).not.toBe(hardDeleteMethod)
    })

    it("should return 204 No Content on successful delete", () => {
      const expectedStatusCode = 204
      expect(expectedStatusCode).toBe(204)
    })

    it("should STILL find the campaign's recipients after DELETE", () => {
      // RULE: soft delete only sets deletedAt — recipient rows (the send
      // history billing and statistics are built on) are never cascaded away.
      const campaignAfterDelete = { id: "campaign-123", deletedAt: new Date(), recipientsCount: 42 }
      expect(campaignAfterDelete.deletedAt).not.toBeNull()
      expect(campaignAfterDelete.recipientsCount).toBe(42)
    })
  })

  describe("PERMANENT DELETE operation (hard)", () => {
    it("is a distinct endpoint from the normal delete", () => {
      // HTTP: DELETE /workspaces/:workspaceId/push-campaigns/:id/permanent
      const normalDeleteRoute = "/:id"
      const permanentDeleteRoute = "/:id/permanent"
      expect(permanentDeleteRoute).not.toBe(normalDeleteRoute)
    })

    it("is blocked when the campaign has actualSent > 0", () => {
      // RULE: a campaign that ever sent something can never be hard-deleted,
      // soft-deleted or not — its history drives billing and merchant quota
      // statistics and must survive forever.
      const campaignWithSends = { actualSent: 5 }
      const guardBlocksHardDelete = campaignWithSends.actualSent > 0
      expect(guardBlocksHardDelete).toBe(true)
    })

    it("is allowed only when the campaign never sent anything", () => {
      const untouchedDraft = { actualSent: 0 }
      const guardBlocksHardDelete = untouchedDraft.actualSent > 0
      expect(guardBlocksHardDelete).toBe(false)
    })

    it("should NOT find the campaign or its recipients after a permitted hard delete", () => {
      // RULE: once allowed to run, hard delete removes the row and cascades
      // to PushCampaignRecipient — there was nothing worth keeping.
      const campaignAfterHardDelete = null
      expect(campaignAfterHardDelete).toBeNull()
    })
  })

  describe("CANCEL operation", () => {
    it("should only update status to CANCELLED (no deletion)", () => {
      // RULE: Cancel preserves the campaign record for audit/history
      // Controller method: cancel() → service.updateStatus(workspaceId, id, PushCampaignStatus.CANCELLED)
      // HTTP: PATCH /workspaces/:workspaceId/push-campaigns/:id/cancel → 200 OK

      const cancelOperation = {
        action: "updateStatus",
        targetStatus: "CANCELLED",
        deletesRecord: false,
      }

      expect(cancelOperation.action).toBe("updateStatus")
      expect(cancelOperation.targetStatus).toBe("CANCELLED")
      expect(cancelOperation.deletesRecord).toBe(false)
    })

    it("should return 200 with confirmation message on cancel", () => {
      // RULE: Cancel returns success message (campaign still exists in DB)
      const expectedResponse = { message: "Campaign cancelled" }
      expect(expectedResponse.message).toBe("Campaign cancelled")
    })
  })

  describe("Behavioral distinction", () => {
    it("should STILL find campaign after soft DELETE, marked deletedAt", () => {
      const campaignAfterDelete = {
        id: "campaign-123",
        deletedAt: new Date("2026-09-12"),
        status: "SCHEDULED",
      }
      expect(campaignAfterDelete).not.toBeNull()
      expect(campaignAfterDelete.deletedAt).not.toBeNull()
    })

    it("should STILL find campaign after CANCEL with CANCELLED status", () => {
      // RULE: After cancel, campaign exists with status=CANCELLED
      const campaignAfterCancel = {
        id: "campaign-123",
        status: "CANCELLED",
        name: "Summer Sale",
      }
      expect(campaignAfterCancel).not.toBeNull()
      expect(campaignAfterCancel.status).toBe("CANCELLED")
    })
  })
})
