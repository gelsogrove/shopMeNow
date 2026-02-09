# Technical Specification: Unified Push Campaigns (Reset & Clean)

## 1. Technical Context
- **Language**: TypeScript
- **Framework**: Node.js/Express (Backend), React/TypeScript (Frontend)
- **Database**: PostgreSQL with Prisma ORM
- **Key Models**: `PushCampaign`, `PushCampaignRecipient`, `Tag`, `Customer`

## 2. Reset & Cleanup Approach
The existing `Campaign` (V1) model and logic are confusing and orphaned. We will perform an "intelligent cleanup" by:
1.  **Removing V1**: Delete the `Campaign` model from `schema.prisma`.
2.  **Deleting V1 Code**: Remove `campaign.service.ts`, `campaign.controller.ts`, and `campaign-scheduler.service.ts` (V1 part).
3.  **Refactoring V2**: Re-purpose `PushCampaign` as the single source of truth for all campaigns.

## 3. Implementation Approach

### Data Model Changes (`schema.prisma`)
- **Remove**: `model Campaign` and its related types.
- **Update `PushCampaign`**:
  - `title`: String (Campaign name for identification).
  - `frequency`: Enum (`ONCE`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMI_ANNUALLY`).
  - `isActive`: Boolean (Status toggle).
  - `targetingType`: Enum (`MANUAL`, `TAG`).
  - `tagId`: String (Optional, for dynamic tag-based targeting).
  - `message`: String (Supports variables like `{{userName}}`, `{{companyName}}`).
  - `nextRunAt`: DateTime (When the next burst should occur).

### Backend Logic
- **`PushCampaignService`**:
  - Handle CRUD for campaigns.
  - Logic to calculate `nextRunAt` based on `frequency`.
  - Logic to fetch recipients:
    - `MANUAL`: Fetch from `PushCampaignRecipient` table (filtered by `isBlocked: false` and `chatbotActive: true`).
    - `TAG`: Dynamically fetch `Customer` records with the specified `tagId` (filtered by `isBlocked: false` and `chatbotActive: true`).
- **Scheduler**:
  - A single worker that picks up `active` campaigns where `nextRunAt <= now()`.
  - Sends via WhatsApp.
  - Updates `nextRunAt` for recurring campaigns or marks `ONCE` campaigns as completed.

### Frontend UI/UX (Clean English UI)
- **Campaign List**: Modern English list showing title, frequency, status, and last run.
- **Campaign Edit (Slide Panel)**:
  - **Step 1: General Info**: Title, Message (with variable hints), Frequency dropdown, Active toggle.
  - **Step 2: Targeting**:
    - Toggle between "Manual Selection" and "Target by Tag".
    - **Manual**: Searchable list of valid customers (not blocked, chatbot active) with checkboxes.
    - **Tag**: Dropdown of available tags.

## 4. Source Code Structure Changes
- **Backend**:
  - `apps/backend/src/application/services/push-campaign.service.ts` (Major refactor)
  - `apps/backend/src/interfaces/http/controllers/push-campaign.controller.ts` (Major refactor)
  - `apps/backend/src/services/whatsapp-campaign-worker.ts` (New worker)
- **Frontend**:
  - `apps/frontend/src/pages/campaigns/index.tsx` (Clean list view)
  - `apps/frontend/src/components/shared/CampaignSheet.tsx` (New multi-step or tabbed edit form)

## 5. Verification Approach
- **Prisma**: Run `npx prisma migrate dev` after schema changes.
- **Unit Tests**:
  - Test `nextRunAt` calculation for all frequencies.
  - Test dynamic recipient fetching for tags.
  - Test manual recipient fetching with exclusion of blocked/inactive users.
- **Lint & Typecheck**: `npm run lint` and `npm run typecheck` in both apps.
