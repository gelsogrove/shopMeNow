# 008-subscription-gate

## Goal
Ensure a user has a valid, active subscription (or trial) BEFORE allowing them to create a WaAPI instance.

## Logic
- In `createWaapiInstance` (or the wizard flow), check `SubscriptionService.getSubscription(workspaceId)`.
- If inactive or expired, block creation with `403 Payment Required`.
- (Optional) If we pay per-instance, check specific quota. *User confirmed "included in subscription", so general active check is sufficient.*

## Edge Cases
- Subscription expires *while* instance is active. (Handled by `001-reconcile-status` or separate billing job, not in scope for creation gate).
- Trial users: Allowed.

## Acceptance Criteria
1. Active subscription → Allow creation.
2. No subscription / Expired → Block creation.
3. Returns clear error message to UI ("Subscription validation failed").
