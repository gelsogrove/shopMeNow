# Execution Plan: Push Campaigns Reset & Phased Implementation

## Phase 0: Intelligent Cleanup & Reset
- [x] **Database Schema**:
    - [x] Remove `Campaign` (V1) model.
    - [x] Update `PushCampaign` with: `title`, `frequency`, `isActive`, `targetingType`, `tagId`, `message`, `nextRunAt`.
    - [x] Run `npx prisma migrate dev`.
- [x] **Backend Cleanup**:
    - [x] Delete `campaign.service.ts`, `campaign.controller.ts`, `campaign.routes.ts`.
    - [x] Delete `campaign-scheduler.service.ts` logic for V1.
- [x] **Frontend Cleanup**:
    - [x] Remove any references to the old `Campaign` model.

## Phase 1: Core Feature (Manual Targeting)
- [x] **Backend Implementation**:
    - [x] Update `PushCampaignService` for CRUD with new fields.
    - [x] Implement `nextRunAt` calculation logic for frequencies.
    - [x] Implement recipient fetching for `MANUAL` targeting (filter blocked/inactive).
    - [x] Implement `WhatsAppCampaignWorker` for processing scheduled campaigns (via `push-campaigns.job.ts`).
- [x] **Frontend Implementation**:
    - [x] Update `CampaignList` to show the new fields (Title, Frequency, Status).
    - [x] Refactor `CampaignSheet` for Phase 1:
        - Title & Message inputs.
        - Frequency dropdown (Once, Weekly, Monthly, 3 Months, 6 Months).
        - Status toggle (Active/Inactive).
        - Manual Recipient Selector: List of customers (filtered) with checkboxes.

## Phase 2: Dynamic Targeting (Tag-Based)
- [x] **Backend Update**:
    - [x] Add dynamic recipient fetching logic based on `tagId` (filter blocked/inactive).
- [x] **Frontend Update**:
    - [x] Update `CampaignSheet` to support "Target by Tag".
    - [x] Add Tag selection dropdown in the targeting step.

## Phase 3: Final Polish & Verification
- [ ] Ensure all UI strings are in English.
- [ ] Run `npm run lint` and `npm run typecheck` in both backend and frontend.
- [x] Write/Update unit tests for the scheduler and recipient logic.
