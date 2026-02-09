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
- [ ] **Backend Implementation**:
    - [ ] Update `PushCampaignService` for CRUD with new fields.
    - [ ] Implement `nextRunAt` calculation logic for frequencies.
    - [ ] Implement recipient fetching for `MANUAL` targeting (filter blocked/inactive).
    - [ ] Implement `WhatsAppCampaignWorker` for processing scheduled campaigns.
- [ ] **Frontend Implementation**:
    - [ ] Update `CampaignList` to show the new fields (Title, Frequency, Status).
    - [ ] Refactor `CampaignSheet` for Phase 1:
        - Title & Message inputs.
        - Frequency dropdown (Once, Weekly, Monthly, 3 Months, 6 Months).
        - Status toggle (Active/Inactive).
        - Manual Recipient Selector: List of customers (filtered) with checkboxes.

## Phase 2: Dynamic Targeting (Tag-Based)
- [ ] **Backend Update**:
    - [ ] Add dynamic recipient fetching logic based on `tagId` (filter blocked/inactive).
- [ ] **Frontend Update**:
    - [ ] Update `CampaignSheet` to support "Target by Tag".
    - [ ] Add Tag selection dropdown in the targeting step.

## Phase 3: Final Polish & Verification
- [ ] Ensure all UI strings are in English.
- [ ] Run `npm run lint` and `npm run typecheck` in both backend and frontend.
- [ ] Write unit tests for the scheduler and recipient logic.
