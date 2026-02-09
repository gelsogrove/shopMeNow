# Technical Specification: Campaigns Unification & Cleanup

## 1. Technical Context
- **Language**: TypeScript
- **Framework**: Node.js/Express (Backend), React/TypeScript (Frontend)
- **Database**: PostgreSQL with Prisma ORM
- **Key Models**: `Campaign` (V1), `PushCampaign` (V2), `PushCampaignRecipient`

## 2. Current State Analysis
- **Campaign (V1)**: Handles recurring feedback/messages based on `frequency`. It has its own service, controller, and scheduler job. It is not currently accessible via the main dashboard UI.
- **PushCampaign (V2)**: Handles promotional/one-off or scheduled message bursts. It is status-driven (`DRAFT`, `SCHEDULED`, `RUNNING`, etc.) and integrated with the owner's billing ($1.00/msg). This is the system used by the `/campaigns` page.

## 3. Proposed Implementation Approach
The goal is to provide a unified campaign experience while respecting the $1.00/msg billing for promotional push campaigns.

### Options to discuss with Andrea:
1. **Unify under `PushCampaign`**: Add `frequency` to `PushCampaign` to support recurring sends, and migrate V1 data.
2. **Rename for Clarity**: Rename V1 to `RecurringAutomation` or similar to distinguish from `PushCampaign` (Promotional).
3. **Deprecate V1**: If recurring feedback is no longer needed or if it should be handled differently, remove V1 entirely.

### Implementation steps (assuming Unification/Cleanup):
- Modify `schema.prisma` to add `frequency` to `PushCampaign` (if unifying).
- Consolidate `CampaignService` and `PushCampaignService`.
- Update `apps/scheduler` to use a single worker for both types.
- Ensure all UI strings are in English (Mandatory Rule 15).
- Update `CampaignSheet.tsx` to handle both types (one-off vs recurring).

## 4. Source Code Structure Changes
- **Backend**:
  - `apps/backend/src/application/services/push-campaign.service.ts` (expanded)
  - `apps/backend/src/interfaces/http/controllers/push-campaign.controller.ts` (expanded)
  - Remove `campaign.service.ts` and `campaign.controller.ts` if unified.
- **Frontend**:
  - `apps/frontend/src/components/shared/CampaignSheet.tsx` (updated for recurring options)
  - `apps/frontend/src/pages/campaigns/index.tsx` (updated to show frequency if applicable)

## 5. Data Model / API Changes
- **Prisma**: Add `frequency` enum and field to `PushCampaign`.
- **API**: Update `POST /push-campaigns` to accept `frequency`.

## 6. Verification Approach
- **Unit Tests**: Add tests for recurring logic in `PushCampaignService`.
- **Integration Tests**: Verify scheduler correctly picks up both one-off and recurring campaigns.
- **Manual Verification**: Create a one-off and a recurring campaign in the dashboard and verify behavior.
- **Lint & Typecheck**: Run `npm run lint` and `npm run typecheck`.
