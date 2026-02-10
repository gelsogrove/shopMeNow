# WaAPI Implementation - Detailed Task Checklist

**Status**: Ready for implementation  
**Estimate**: 6-7 days full-time  
**Last Updated**: 2026-02-10

---

## 📋 TASK BREAKDOWN

### PHASE 1: SETUP & CONFIGURATION (2 hours)

#### Task 1.1: Environment Setup
- [ ] Sign up for WaAPI account at https://waapi.readme.io/
- [ ] Get API key from WaAPI dashboard
- [ ] Add to `.env` file:
  ```bash
  WAAPI_API_KEY=your_key_here
  WAAPI_BASE_URL=https://api.waapi.app/v1
  WAAPI_WEBHOOK_SECRET=generate_random_secret
  APP_WEBHOOK_BASE_URL=https://echatbot.ai
  WAAPI_QR_TTL_MINUTES=15
  ```
- [ ] Copy `.env` variables to staging/production servers
- [ ] Test API key with curl:
  ```bash
  curl -H "Authorization: Bearer $WAAPI_API_KEY" \
    https://api.waapi.app/v1/instances
  ```

#### Task 1.2: Database Schema
- [ ] Create migration file: `apps/backend/prisma/migrations/XXX_add_waapi_fields/migration.sql`
- [ ] Copy SQL from `IMPLEMENTATION_DETAILS.md` (section "Database Schema Changes")
- [ ] Run migration in local: `npx prisma migrate dev`
- [ ] Verify schema changes: `npx prisma studio`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Update TypeScript types if needed
- [ ] Commit migration file

---

### PHASE 2: BACKEND IMPLEMENTATION (2 days)

#### Task 2.1: WaAPI Client Service
**File**: `apps/backend/src/services/waapi-client.service.ts`

- [ ] Create file with class `WaapiClientService`
- [ ] Implement `createInstance(phoneNumber, displayName)` → returns instanceId
- [ ] Implement `setWebhook(instanceId, webhookUrl)` → configures webhook
- [ ] Implement `getQrCode(instanceId)` → returns base64 QR
- [ ] Implement `getInstanceStatus(instanceId)` → returns status object
- [ ] Implement `deleteInstance(instanceId)` → hard delete
- [ ] Implement `validateWebhookSignature(payload, signature)` → boolean
- [ ] Add axios interceptors for logging (mask token!)
- [ ] Add error handling with retry logic (3xx/5xx)
- [ ] Export service
- [ ] **Test**: Unit test all methods with mocked axios
  ```bash
  cd apps/backend
  npm run test:unit -- waapi-client.service.spec.ts
  ```

#### Task 2.2: Workspace Service - WaAPI Methods
**File**: `apps/backend/src/application/services/workspace.service.ts`

- [ ] Import `WaapiClientService` in constructor
- [ ] Add method `initializeWaapiInstance(workspaceId, userId, phoneNumber, displayName?)`
  - [ ] Add subscription validation (planType, creditBalance, status)
  - [ ] Call `waapiClient.createInstance()`
  - [ ] Call `waapiClient.setWebhook()`
  - [ ] Call `waapiClient.getQrCode()`
  - [ ] Update workspace in transaction with all WaAPI fields
  - [ ] Return workspace object
- [ ] Add method `disconnectWaapiInstance(workspaceId, userId)`
  - [ ] Verify workspace ownership
  - [ ] Call `waapiClient.deleteInstance()`
  - [ ] Clear WaAPI fields in database
  - [ ] Set channelStatus = false
- [ ] Add method `regenerateWaapiQr(workspaceId, userId)`
  - [ ] Verify ownership
  - [ ] Call `waapiClient.getQrCode()`
  - [ ] Update waapiQrCodeData + waapiQrGeneratedAt
  - [ ] Return QR code
- [ ] **Test**: Unit tests for all methods
  ```bash
  npm run test:unit -- workspace.service.spec.ts
  ```

#### Task 2.3: Webhook Controller
**File**: `apps/backend/src/interfaces/http/controllers/waapi-webhook.controller.ts`

- [ ] Create class `WaapiWebhookController`
- [ ] Import `WaapiClientService` for signature validation
- [ ] Define interface `WaapiWebhookPayload`
- [ ] Implement method `handleWebhook(req, res)`
  - [ ] Extract instanceId from params
  - [ ] Extract payload from body
  - [ ] Validate signature if header present
  - [ ] Find workspace by waapiInstanceId
  - [ ] Reject if workspace not found (404)
  - [ ] Call `processWebhookEvent(workspaceId, payload)`
  - [ ] Return 200 success
- [ ] Implement private method `processWebhookEvent(workspaceId, payload)`
  - [ ] Switch on payload.event
  - [ ] Case 'qr': update waapiQrCodeData, status='pending'
  - [ ] Case 'authenticated': update status='authenticated', store phone
  - [ ] Case 'ready': update status='ready', channelStatus=true
  - [ ] Case 'disconnected': update status='disconnected', channelStatus=false
  - [ ] Case 'auth_failure': update status='failed'
  - [ ] Make idempotent (use waapiLastSyncAt)
- [ ] **Test**: Unit tests for all webhook events
  ```bash
  npm run test:unit -- waapi-webhook.controller.spec.ts
  ```

#### Task 2.4: Workspace Controller - WaAPI Endpoints
**File**: `apps/backend/src/interfaces/http/controllers/workspace.controller.ts`

- [ ] Add method `initializeWaapiInstance(req, res)` bound to service
- [ ] Add method `disconnectWaapiInstance(req, res)` bound to service
- [ ] Add method `regenerateWaapiQr(req, res)` bound to service
- [ ] Add JSDoc Swagger comments for all methods
- [ ] Handle errors with try-catch, return proper status codes
- [ ] **Test**: Integration tests for endpoints
  ```bash
  npm run test:integration -- workspace.controller.spec.ts
  ```

#### Task 2.5: API Routes
**File**: `apps/backend/src/interfaces/http/routes/waapi.routes.ts`

- [ ] Create file with Express Router
- [ ] Import controllers
- [ ] Import middleware (auth, session, workspace validation)
- [ ] Create rate limiter for webhook (10 req/min per instance)
- [ ] Define routes:
  - [ ] `POST /api/workspaces/:workspaceId/waapi/initialize` (protected)
  - [ ] `POST /api/workspaces/:workspaceId/waapi/disconnect` (protected)
  - [ ] `POST /api/workspaces/:workspaceId/waapi/regenerate-qr` (protected)
  - [ ] `POST /api/waapi/webhook/:instanceId` (public, rate limited)
- [ ] Add Swagger comments to routes
- [ ] Export router

**File**: `apps/backend/src/interfaces/http/routes/index.ts`

- [ ] Import `waapiRoutes`
- [ ] Register: `router.use('/api', waapiRoutes)`

#### Task 2.6: Swagger Documentation
- [ ] Run `npm run build` to regenerate swagger.json
- [ ] Verify endpoints appear in Swagger UI: http://localhost:3001/api-docs
- [ ] Test each endpoint in Swagger UI
- [ ] Verify request/response schemas

#### Task 2.7: Backend Testing
- [ ] **Unit Tests**:
  - [ ] WaapiClientService: 100% coverage (all methods)
  - [ ] WorkspaceService: WaAPI methods (initialize, disconnect, regenerateQr)
  - [ ] WebhookController: All event types (qr, authenticated, ready, etc.)
- [ ] **Integration Tests**:
  - [ ] POST /workspaces/:id/waapi/initialize (success, missing phone, insufficient credits)
  - [ ] POST /workspaces/:id/waapi/disconnect (success, not found)
  - [ ] POST /workspaces/:id/waapi/regenerate-qr (success, already ready)
  - [ ] POST /waapi/webhook/:instanceId (all event types)
- [ ] **Security Tests**:
  - [ ] Subscription validation blocks trial expired
  - [ ] Subscription validation blocks insufficient credits
  - [ ] Webhook rejects invalid signature
  - [ ] Webhook rejects unknown instance
- [ ] Run full test suite:
  ```bash
  npm run test:unit
  npm run test:integration
  npm run test:security
  npm run test:coverage
  ```
- [ ] Verify coverage >80% for WaAPI modules

---

### PHASE 3: FRONTEND IMPLEMENTATION (1.5 days)

#### Task 3.1: API Service Methods
**File**: `apps/frontend/src/services/api.ts` (or create `waapiApi.ts`)

- [ ] Add method `initializeWaapiInstance(workspaceId, data)`
- [ ] Add method `disconnectWaapiInstance(workspaceId)`
- [ ] Add method `regenerateWaapiQr(workspaceId)`
- [ ] Add method `getWorkspace(workspaceId)` (if not exists)
- [ ] Export methods

#### Task 3.2: WaAPI Onboarding Component
**File**: `apps/frontend/src/components/WaapiOnboarding.tsx`

- [ ] Create component with props `{ onComplete: () => void }`
- [ ] Add state: phoneNumber, displayName, isInitializing, qrCodeData, status, isRegenerating
- [ ] Add form with fields:
  - [ ] Phone number input (placeholder: "+393331234567")
  - [ ] Display name input (optional)
  - [ ] Submit button → "Generate QR Code"
- [ ] Implement form validation:
  - [ ] Phone must start with '+'
  - [ ] Phone must be valid E.164 format
- [ ] Implement `handleInitialize()`:
  - [ ] Call `api.initializeWaapiInstance()`
  - [ ] Set qrCodeData from response
  - [ ] Set status from response
  - [ ] Show success toast
- [ ] Add QR code display:
  - [ ] `<img src={qrCodeData} alt="WhatsApp QR" className="w-64 h-64" />`
  - [ ] "Regenerate QR" button → calls `handleRegenerateQr()`
- [ ] Implement status polling:
  - [ ] useEffect when status = 'pending' or 'authenticated'
  - [ ] Poll every 3 seconds: `await api.getWorkspace(workspaceId)`
  - [ ] Update status from workspace.waapiInstanceStatus
  - [ ] If status = 'ready' → call onComplete() + show success toast
- [ ] Add status messages:
  - [ ] 'pending': "Waiting for scan. Open WhatsApp..."
  - [ ] 'authenticated': "Authenticated. Connecting..." (loading spinner)
  - [ ] 'ready': "Connected!" (success)
  - [ ] 'disconnected': "Disconnected. Please reconnect."
  - [ ] 'failed': "Authentication failed. Please try again."
- [ ] Add loading states for all async operations
- [ ] Add error handling with toast notifications
- [ ] **Test**: Manual test in browser with mock backend

#### Task 3.3: WaAPI Settings Component
**File**: `apps/frontend/src/components/WaapiSettings.tsx`

- [ ] Create component (no props)
- [ ] Import `useWorkspace()` hook
- [ ] Add state: showDisconnectModal, confirmText, isDisconnecting
- [ ] Check if workspace uses WaAPI: `currentWorkspace?.whatsappProvider === 'waapi'`
- [ ] Display current status:
  - [ ] Status badge: status capitalized (Pending/Ready/Disconnected)
  - [ ] Phone number: `currentWorkspace?.waapiPhoneNumber`
- [ ] Add "Disconnect WhatsApp" button (red, destructive)
- [ ] Implement disconnect modal:
  - [ ] Dialog component (shadcn/ui)
  - [ ] Title: "Critical Action: Disconnect WhatsApp" (red, warning icon)
  - [ ] Body: Alert with warnings (irreversible, must create new instance)
  - [ ] Input field: "Type CONFIRM to continue"
  - [ ] Confirm button: disabled until confirmText === 'CONFIRM'
  - [ ] Cancel button: closes modal, resets confirmText
- [ ] Implement `handleDisconnect()`:
  - [ ] Validate confirmText === 'CONFIRM'
  - [ ] Call `api.disconnectWaapiInstance()`
  - [ ] Show success toast
  - [ ] Close modal
  - [ ] Refresh workspace
- [ ] Add "Reconnect WhatsApp" button if status = 'disconnected'
  - [ ] Navigate to onboarding page/component
- [ ] **Test**: Manual test in browser

#### Task 3.4: Page Integration
**File**: `apps/frontend/src/pages/ChannelSettingsPage.tsx` (or appropriate page)

- [ ] Import `WaapiOnboarding` component
- [ ] Import `WaapiSettings` component
- [ ] Add routing/navigation:
  - [ ] `/settings/whatsapp/onboarding` → WaapiOnboarding
  - [ ] `/settings/whatsapp` → WaapiSettings
- [ ] Add "Connect WhatsApp" button if no channel configured
- [ ] **Test**: Full navigation flow

#### Task 3.5: Frontend Testing
- [ ] **Component Tests**:
  - [ ] WaapiOnboarding: render, form submit, QR display, status polling
  - [ ] WaapiSettings: render, disconnect modal, confirm input
- [ ] **Integration Tests**:
  - [ ] Full onboarding flow with mocked API
  - [ ] Disconnect flow with confirmation
- [ ] **Manual QA**:
  - [ ] Test in Chrome, Firefox, Safari
  - [ ] Test on mobile (iOS, Android)
  - [ ] Test with real WaAPI QR scan
- [ ] Run tests:
  ```bash
  cd apps/frontend
  npm run test
  ```

---

### PHASE 4: SCHEDULER (2 hours)

#### Task 4.1: QR Cleanup Job
**File**: `apps/scheduler/src/jobs/waapi-qr-cleanup.job.ts`

- [ ] Create file with function `waapiQrCleanupJob()`
- [ ] Read TTL from env: `WAAPI_QR_TTL_MINUTES` (default 15)
- [ ] Calculate cutoff date: `new Date(Date.now() - TTL * 60 * 1000)`
- [ ] Query workspaces:
  - [ ] Where: waapiQrCodeData is not null
  - [ ] Where: waapiQrGeneratedAt < cutoffDate
  - [ ] Where: waapiInstanceStatus != 'ready'
- [ ] Update matching workspaces: set waapiQrCodeData = null
- [ ] Log count of cleared QR codes
- [ ] Handle errors with try-catch
- [ ] Export function

**File**: `apps/scheduler/src/jobs/index.ts`

- [ ] Export `waapiQrCleanupJob`

**File**: `apps/scheduler/src/index.ts`

- [ ] Import job
- [ ] Register cron: `cron.schedule('*/5 * * * *', waapiQrCleanupJob)` (every 5 minutes)
- [ ] Add error handling

#### Task 4.2: Scheduler Testing
- [ ] **Unit Test**: Test job logic with mocked Prisma
- [ ] **Manual Test**: 
  - [ ] Create workspace with QR code
  - [ ] Set waapiQrGeneratedAt to old timestamp
  - [ ] Run job manually
  - [ ] Verify QR is cleared
- [ ] Run test:
  ```bash
  cd apps/scheduler
  npm run test
  ```

---

### PHASE 5: TESTING & QA (1 day)

#### Task 5.1: Unit Tests
- [ ] Backend: WaapiClientService (100% coverage)
- [ ] Backend: WorkspaceService WaAPI methods
- [ ] Backend: WebhookController (all events)
- [ ] Frontend: WaapiOnboarding component
- [ ] Frontend: WaapiSettings component
- [ ] Scheduler: QR cleanup job
- [ ] Run full suite:
  ```bash
  # Backend
  cd apps/backend
  npm run test:unit
  npm run test:coverage
  
  # Frontend
  cd apps/frontend
  npm run test
  
  # Scheduler
  cd apps/scheduler
  npm run test
  ```
- [ ] Verify coverage >80% for WaAPI modules

#### Task 5.2: Integration Tests
- [ ] Backend: POST /workspaces/:id/waapi/initialize
  - [ ] Success case
  - [ ] Missing phone number
  - [ ] Trial expired
  - [ ] Insufficient credits
  - [ ] Invalid phone format
- [ ] Backend: POST /workspaces/:id/waapi/disconnect
  - [ ] Success case
  - [ ] Not found
  - [ ] Access denied (wrong user)
- [ ] Backend: POST /workspaces/:id/waapi/regenerate-qr
  - [ ] Success case
  - [ ] Already ready (should fail)
- [ ] Backend: POST /waapi/webhook/:instanceId
  - [ ] QR event
  - [ ] Authenticated event
  - [ ] Ready event
  - [ ] Disconnected event
  - [ ] Auth failure event
  - [ ] Invalid signature
  - [ ] Unknown instance
- [ ] Run integration tests:
  ```bash
  cd apps/backend
  npm run test:integration
  ```

#### Task 5.3: Security Tests
- [ ] Subscription validation:
  - [ ] Block if trial expired
  - [ ] Block if subscription inactive
  - [ ] Block if credits < €5.00
- [ ] Webhook security:
  - [ ] Reject invalid signature
  - [ ] Reject unknown instance
  - [ ] Rate limiting works (>10 req/min blocked)
- [ ] IDOR prevention:
  - [ ] User cannot disconnect other user's instance
  - [ ] User cannot regenerate QR for other workspace
- [ ] Run security tests:
  ```bash
  cd apps/backend
  npm run test:security
  ```

#### Task 5.4: End-to-End Test
- [ ] **Setup**:
  - [ ] Create test user with active subscription + credits
  - [ ] Create test workspace
- [ ] **Flow**:
  1. [ ] Login as test user
  2. [ ] Navigate to "Connect WhatsApp"
  3. [ ] Enter phone number: "+393331234567"
  4. [ ] Click "Generate QR Code"
  5. [ ] Verify QR code appears
  6. [ ] Scan QR with real WhatsApp (or use WaAPI sandbox)
  7. [ ] Verify status updates: pending → authenticated → ready
  8. [ ] Verify success message appears
  9. [ ] Navigate to Settings → WhatsApp
  10. [ ] Verify status shows "Ready"
  11. [ ] Verify phone number displayed
  12. [ ] Click "Disconnect WhatsApp"
  13. [ ] Verify CRITICAL modal appears
  14. [ ] Type "CONFIRM"
  15. [ ] Click "Disconnect WhatsApp"
  16. [ ] Verify success message
  17. [ ] Verify status shows "Disconnected"
  18. [ ] Click "Reconnect WhatsApp"
  19. [ ] Verify new QR appears
  20. [ ] Repeat scan process
- [ ] **Document results**: Screenshot each step

#### Task 5.5: Manual QA Checklist
- [ ] **Browser Compatibility**:
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)
- [ ] **Mobile Compatibility**:
  - [ ] iOS Safari
  - [ ] Android Chrome
- [ ] **Responsive Design**:
  - [ ] Desktop (1920x1080)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667)
- [ ] **Accessibility**:
  - [ ] Keyboard navigation works
  - [ ] Screen reader friendly (labels present)
  - [ ] Form validation messages visible
- [ ] **Error Handling**:
  - [ ] Network error (simulate offline)
  - [ ] API error (mock 500 response)
  - [ ] Timeout (slow network)
  - [ ] Invalid phone number
  - [ ] Expired QR code
- [ ] **Loading States**:
  - [ ] Initialize instance (spinner visible)
  - [ ] Regenerate QR (spinner visible)
  - [ ] Disconnect (spinner visible)
  - [ ] Status polling (loading indicator)

---

### PHASE 6: DEPLOYMENT (0.5 day)

#### Task 6.1: Pre-Deployment Checklist
- [ ] All tests passing (unit, integration, security)
- [ ] Test coverage >80%
- [ ] No console.error or console.warn in production
- [ ] Environment variables set in staging/production
- [ ] Database migration tested in staging
- [ ] Swagger docs updated
- [ ] Code reviewed (PR approved)
- [ ] README updated (if needed)

#### Task 6.2: Deploy to Staging
- [ ] Run database migration:
  ```bash
  heroku run npx prisma migrate deploy --app echatbot-staging
  ```
- [ ] Deploy backend:
  ```bash
  git push heroku-staging main
  ```
- [ ] Deploy frontend:
  ```bash
  npm run build
  # Deploy to Vercel/Netlify/etc.
  ```
- [ ] Deploy scheduler:
  ```bash
  # If separate dyno/service
  heroku ps:scale scheduler=1 --app echatbot-staging
  ```
- [ ] Verify deployment:
  ```bash
  curl https://staging.echatbot.ai/api/health
  ```

#### Task 6.3: Smoke Test Staging
- [ ] Test onboarding flow with real QR scan
- [ ] Test disconnect flow
- [ ] Test reconnect flow
- [ ] Test webhook endpoint (send test payload)
- [ ] Verify Scheduler QR cleanup runs (check logs)
- [ ] Check database: verify WaAPI fields populated correctly

#### Task 6.4: Deploy to Production
- [ ] **CRITICAL**: Backup production database first!
  ```bash
  heroku pg:backups:capture --app echatbot-production
  ```
- [ ] Run database migration:
  ```bash
  heroku run npx prisma migrate deploy --app echatbot-production
  ```
- [ ] Deploy backend:
  ```bash
  git push heroku-production main
  ```
- [ ] Deploy frontend
- [ ] Deploy scheduler
- [ ] Verify deployment:
  ```bash
  curl https://echatbot.ai/api/health
  ```

#### Task 6.5: Post-Deployment Verification
- [ ] Smoke test production:
  - [ ] Login as test user
  - [ ] Create test workspace
  - [ ] Run full onboarding flow
  - [ ] Test disconnect
  - [ ] Test reconnect
- [ ] Monitor logs for errors:
  ```bash
  heroku logs --tail --app echatbot-production | grep -i error
  ```
- [ ] Monitor webhook endpoint:
  ```bash
  heroku logs --tail --app echatbot-production | grep "WaAPI-Webhook"
  ```
- [ ] Verify Scheduler running:
  ```bash
  heroku logs --tail --app echatbot-production | grep "WAAPI-QR-CLEANUP"
  ```

---

### PHASE 7: MONITORING & DOCUMENTATION (2 hours)

#### Task 7.1: Set Up Monitoring
- [ ] **Prometheus Metrics** (if using):
  - [ ] Add counter: `waapi_instance_created_total`
  - [ ] Add counter: `waapi_instance_deleted_total`
  - [ ] Add counter: `waapi_webhook_received_total{event}`
  - [ ] Add histogram: `waapi_qr_generation_duration`
  - [ ] Add gauge: `waapi_instance_status{status}`
- [ ] **Grafana Dashboard** (if using):
  - [ ] Create dashboard "WaAPI Monitoring"
  - [ ] Add graph: Instances created/deleted over time
  - [ ] Add graph: Webhook events by type
  - [ ] Add graph: QR generation duration
  - [ ] Add gauge: Current instances by status
- [ ] **Alerts**:
  - [ ] Alert: WaapiWebhookFailureRate > 5% in 5 minutes
  - [ ] Alert: WaapiQrCleanupJobFailed
  - [ ] Alert: WaapiInstanceCreationFailureRate > 10%
- [ ] **Error Tracking** (Sentry/Rollbar):
  - [ ] Verify WaAPI errors are captured
  - [ ] Create filter: tag="waapi"

#### Task 7.2: Documentation
- [ ] **API Documentation**:
  - [ ] Verify Swagger docs are complete
  - [ ] Add examples for each endpoint
  - [ ] Add authentication section
- [ ] **User Guides**:
  - [ ] Create "How to Connect WhatsApp" guide (with screenshots)
  - [ ] Create "How to Disconnect/Reconnect WhatsApp" guide
  - [ ] Create FAQ: "Why QR code?", "What if QR expires?", etc.
  - [ ] Record video tutorial (2-3 minutes)
- [ ] **Admin Guides**:
  - [ ] Create "WaAPI Configuration" guide (environment setup)
  - [ ] Create "Troubleshooting WaAPI Issues" guide
  - [ ] Create "Monitoring WaAPI Health" guide
- [ ] **Developer Docs**:
  - [ ] Update README with WaAPI section
  - [ ] Document environment variables
  - [ ] Document database schema changes
  - [ ] Add architecture diagram (Mermaid or draw.io)

---

## 📊 PROGRESS TRACKING

Use this table to track completion:

| Phase | Tasks | Status | Assignee | Due Date |
|-------|-------|--------|----------|----------|
| 1. Setup | 2 tasks | ⏳ Not Started | TBD | TBD |
| 2. Backend | 7 tasks | ⏳ Not Started | TBD | TBD |
| 3. Frontend | 5 tasks | ⏳ Not Started | TBD | TBD |
| 4. Scheduler | 2 tasks | ⏳ Not Started | TBD | TBD |
| 5. Testing | 5 tasks | ⏳ Not Started | TBD | TBD |
| 6. Deployment | 5 tasks | ⏳ Not Started | TBD | TBD |
| 7. Monitoring | 2 tasks | ⏳ Not Started | TBD | TBD |

**Status**:
- ⏳ Not Started
- 🔄 In Progress
- ✅ Completed
- ❌ Blocked

---

## 🚨 BLOCKERS & RISKS

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WaAPI API changes | Medium | High | Version lock, monitor changelog |
| WaAPI downtime | Low | High | Fallback to Meta/UltraMsg |
| QR scan fraud | Low | Medium | Signature validation, rate limiting |
| Instance abuse | Medium | Medium | Rate limit, charge per instance |
| Webhook delays | Medium | Low | Polling fallback, timeout handling |

---

## 📞 SUPPORT CONTACTS

- **WaAPI Support**: support@waapi.app
- **WaAPI Docs**: https://waapi.readme.io/
- **WaAPI Status Page**: TBD
- **Internal Slack**: #waapi-integration

---

## ✅ DEFINITION OF DONE

A task is considered **DONE** when:

- [ ] Code written and committed to git
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests written and passing
- [ ] Code reviewed and approved (PR merged)
- [ ] Swagger docs updated
- [ ] Manual QA completed (no critical bugs)
- [ ] Deployed to staging and smoke tested
- [ ] Deployed to production (if Phase 6)
- [ ] Documentation updated (if user-facing)
- [ ] Monitoring/alerts configured (if Phase 7)

---

## 🎯 FINAL CHECKLIST (Before Go-Live)

Before releasing WaAPI feature to users:

- [ ] All phases completed (1-7)
- [ ] All tests passing (unit + integration + security)
- [ ] Test coverage >80%
- [ ] No critical bugs in production
- [ ] Smoke test passed in production
- [ ] Webhook endpoint verified working
- [ ] QR cleanup job running successfully
- [ ] Monitoring dashboard live
- [ ] Alerts configured and tested
- [ ] User documentation published
- [ ] Admin documentation published
- [ ] API documentation complete
- [ ] Video tutorial published (optional)
- [ ] Internal team trained on feature
- [ ] Support team informed (FAQ ready)
- [ ] Marketing material ready (if announcing)
- [ ] Rollback plan documented
- [ ] Post-launch monitoring plan ready

---

**READY TO START? Let's build this! 🚀**
