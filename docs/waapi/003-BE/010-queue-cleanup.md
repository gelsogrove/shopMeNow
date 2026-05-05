# 010-queue-cleanup

## Goal
Handle pending outbound messages when a user switches providers. If messages are queued for WaAPI but the user switches to Meta, those messages will fail (or need re-routing).

## Strategy
- Option A: **Fail**. Mark pending messages as `FAILED` with reason "Provider switched".
- Option B: **Re-route**. Attempt to send via new provider. *Risk: different template capability / formats.*

**Decision**: Option A (Fail) is safer and clearer.

## Flow
- Inside the "Switch Provider" transaction (BE task 004):
  - Find all `PENDING` items in `WhatsappChannelQueue` for this workspace.
  - Update status to `FAILED`.
  - Log reason.

## Acceptance Criteria
1. Switching provider clears/fails the pending queue.
2. No "zombie" messages try to send via deleted instance.
