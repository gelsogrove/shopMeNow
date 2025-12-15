# Feature 185 - Subscription & Billing System

## Implementation Checklist

### Phase 1: Database & Core Backend (Priority P0)

#### Database Schema
- [ ] **DB-001**: Create migration for `BillingPlan` table (or extend Workspace)
  - Fields: plan_type, credit_balance, trial_ends_at, plan_started_at, next_billing_date
- [ ] **DB-002**: Create migration for `BillingTransaction` table
  - Fields: workspace_id, type, amount, balance_after, description, reference_id
- [ ] **DB-003**: Create migration for `PlanConfiguration` table
  - Fields: plan_type, max_channels, max_products, max_customers, costs
- [ ] **DB-004**: Run `npx prisma generate`
- [ ] **DB-005**: Update seed with default plan configurations and trial data

#### Backend Services
- [ ] **BE-001**: Create `BillingService` in application/services/
  - Methods: getWorkspaceBilling, deductCredit, rechargeCredit, checkCreditSufficient
- [ ] **BE-002**: Create `BillingRepository` in repositories/
  - Methods: findByWorkspaceId, createTransaction, getTransactionHistory, updateBalance
- [ ] **BE-003**: Create `checkCredit` middleware
  - Block operation if credit < required amount
  - Return 402 Payment Required with clear message
- [ ] **BE-004**: Create `checkPlanLimits` middleware
  - Block if workspace exceeds plan limits (products/customers/channels)
- [ ] **BE-005**: Create `checkTrialValid` middleware
  - Block if trial expired and no paid plan

#### Backend Controllers & Routes
- [ ] **BE-006**: Create `BillingController`
  - getBillingInfo, getTransactions, recharge, upgradePlan
- [ ] **BE-007**: Create billing routes with proper middleware stack
  - GET /workspaces/:id/billing
  - GET /workspaces/:id/billing/transactions
  - POST /workspaces/:id/billing/recharge
  - POST /workspaces/:id/billing/upgrade
- [ ] **BE-008**: Create public endpoint GET /billing/plans
- [ ] **BE-009**: Update Swagger documentation

#### Credit Deduction Integration
- [ ] **BE-010**: Integrate credit deduction in WhatsApp message sending
  - Deduct €0.10 per message sent
- [ ] **BE-011**: Integrate credit deduction in order creation
  - Deduct €1.00 per order
- [ ] **BE-012**: Integrate credit deduction in push notification sending
  - Deduct €1.00 per push

---

### Phase 2: Frontend Core (Priority P0)

#### Context & Hooks
- [ ] **FE-001**: Create `BillingContext` provider
  - State: creditBalance, planType, limits, loading
- [ ] **FE-002**: Create `useBilling` hook
  - Access billing state from context
- [ ] **FE-003**: Create `billingApi` service
  - API calls for all billing endpoints

#### Header Credit Display
- [ ] **FE-004**: Create `CreditDisplay` component for Header
  - Show credit balance with € symbol
  - Show warning icon if < €5
  - Show plan badge (Trial/Basic/Premium/Enterprise)
- [ ] **FE-005**: Integrate `CreditDisplay` into Header.tsx
- [ ] **FE-006**: Add trial countdown for FREE_TRIAL users

#### Profile Page Updates
- [ ] **FE-007**: Add "Il Tuo Piano" section to ProfilePage
  - Plan name, price, next billing date
  - Credit balance with Recharge button
  - Usage progress bars (products/clients/channels)
  - Upgrade CTA button

---

### Phase 3: Billing Page (Priority P1)

#### New Billing Page
- [ ] **FE-008**: Create `BillingPage.tsx`
- [ ] **FE-009**: Create `RechargeModal` component
  - Preset amounts: €10, €25, €50, €100
  - Custom amount input
  - Confirm button (simulated payment)
- [ ] **FE-010**: Create `TransactionHistory` component
  - Paginated table with filters
  - Type icons (message, order, push, recharge, fee)
  - Color coding (red for deductions, green for credits)
- [ ] **FE-011**: Create `PlanComparison` component
  - Show all plans side by side
  - Highlight current plan
  - Upgrade buttons
- [ ] **FE-012**: Create `UpgradeModal` component
  - Confirm upgrade with price difference
- [ ] **FE-013**: Add "Download Invoice" placeholder link
- [ ] **FE-014**: Add route for /billing in App.tsx
- [ ] **FE-015**: Add Billing to sidebar navigation

---

### Phase 4: Limits Enforcement (Priority P0)

#### Backend Enforcement
- [ ] **LIM-001**: Add checkPlanLimits to product creation endpoint
- [ ] **LIM-002**: Add checkPlanLimits to customer creation endpoint
- [ ] **LIM-003**: Add checkPlanLimits to workspace (channel) creation endpoint
- [ ] **LIM-004**: Add checkCredit to WhatsApp send endpoint
- [ ] **LIM-005**: Add checkCredit to order creation endpoint

#### Frontend Enforcement
- [ ] **FE-016**: Show limit warnings when approaching limits (90%)
- [ ] **FE-017**: Show limit reached message with upgrade CTA
- [ ] **FE-018**: Show "Credit insufficient" message with recharge CTA
- [ ] **FE-019**: Block trial expired users with plan selection screen

---

### Phase 5: Notifications (Priority P1)

- [ ] **NOT-001**: Email notification for low balance (< €5)
- [ ] **NOT-002**: Email notification for trial ending (3 days before)
- [ ] **NOT-003**: Email notification for trial expired
- [ ] **NOT-004**: In-app alert for low balance
- [ ] **NOT-005**: In-app alert for approaching limits

---

### Phase 6: Testing (Priority P0)

#### Unit Tests
- [ ] **TEST-001**: BillingService.deductCredit - various scenarios
- [ ] **TEST-002**: BillingService.checkCreditSufficient
- [ ] **TEST-003**: BillingService.rechargeCredit
- [ ] **TEST-004**: checkCredit middleware - block/allow scenarios
- [ ] **TEST-005**: checkPlanLimits middleware - all limit types
- [ ] **TEST-006**: checkTrialValid middleware

#### Integration Tests
- [ ] **TEST-007**: Full recharge flow API test
- [ ] **TEST-008**: Full upgrade flow API test
- [ ] **TEST-009**: Credit deduction on message send
- [ ] **TEST-010**: Credit deduction on order create
- [ ] **TEST-011**: Workspace isolation - billing data separated

#### Security Tests
- [ ] **TEST-012**: Admin cannot recharge (Owner only)
- [ ] **TEST-013**: Admin cannot upgrade plan (Owner only)
- [ ] **TEST-014**: Workspace isolation in billing transactions
- [ ] **TEST-015**: Rate limiting on recharge endpoint

---

### Phase 7: Cron Jobs (Priority P2)

- [ ] **CRON-001**: Daily check for expired trials
- [ ] **CRON-002**: Monthly fee deduction job
- [ ] **CRON-003**: Daily low balance notification check

---

## Notes

- All prices/limits come from database, not hardcoded
- WebSocket for real-time credit updates (if infrastructure exists)
- Workspace isolation mandatory on all billing queries
- Owner-only for recharge/upgrade, Admin can view only

---

## Definition of Done

1. ✅ All database migrations applied and seeded
2. ✅ All API endpoints working with Swagger docs
3. ✅ Frontend displays real-time credit and limits
4. ✅ Credit deduction working on all operations
5. ✅ Plan limits enforced (blocks when exceeded)
6. ✅ Unit tests passing (>80% coverage on billing)
7. ✅ Integration tests passing
8. ✅ Security tests passing (workspace isolation)
9. ✅ No hardcoded values - all from database
