# 009 - Subscription Gate

## Middleware
Located in `entry-gate.middleware.ts`.

## Responsibilities
1. **Status Check**: Verify `subscriptionStatus` is ACTIVE (or TRIALING).
2. **Quota Check**: Verify `current_usage < monthly_limit`.
3. **Feature Gating**: Ensure `enableWhatsapp` is true for the plan.

## Enforcement
- Use Redis or DB Atomic increment for usage counting.
- Block BEFORE calling provider API to save costs.
- Return `403 Forbidden` with reason code.
