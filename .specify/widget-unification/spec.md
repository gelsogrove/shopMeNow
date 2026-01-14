# Widget & WhatsApp Unification - Specification

**Date**: January 11, 2026  
**Author**: Andrea (shopME)  
**Status**: APPROVED - Ready for Implementation  

---

## Executive Summary

Unify Widget and WhatsApp message processing under a **single message queue** with channel differentiation. This eliminates duplicate security logic and standardizes message handling across all communication channels.

**Current Problem**: 
- Widget bypasses security checks (direct response)
- WhatsApp goes through security (via queue)
- Code duplication across implementations

**Solution**: 
- Single MessageQueue for all channels
- Unified security validation (5 steps)
- Channel-specific delivery logic
- Backward compatible with existing WhatsApp flow

---

## Key Requirements (From analisiLLM.md)

### Database Changes
- Add `channel` field to MessageQueue ("widget" | "whatsapp")
- Add `visitorId` field (nullable) for anonymous widget users
- Add `phoneNumber` field (nullable) for WhatsApp tracking
- Add `isAnonymous` flag to ChatSession
- Add `expiresAt` for anonymous session expiry

### API Changes
- New endpoint: POST /api/v1/widget/chat/:workspaceId (send message)
- New endpoint: GET /api/v1/widget/poll/:messageId (receive response)
- New endpoint: POST /api/v1/widget/auth (authenticate with JWT)
- Rate limiting: 10 messages/minute per visitorId
- CORS: Allow widget from any domain

### Security Validation (5 Steps)
1. Rate limit check (credits > 0)
2. Content safety check (LLM evaluation)
3. Business rules check (hours, maintenance)
4. Channel-specific validation (format, blacklist)
5. Anti-spam pattern detection (frequency)

### Message Flow
- Widget: POST /api/v1/widget/chat → Backend → MessageQueue → Scheduler → poll
- WhatsApp: /webhook/whatsapp → Backend → MessageQueue → Scheduler → WhatsApp API (unchanged)

---

## Scope & Out of Scope

### IN SCOPE
- Database migration for widget support
- Widget API endpoints
- Unified message queue processing
- Scheduler integration
- Frontend polling mechanism
- Security validation (5 steps)
- Rate limiting
- Basic monitoring

### OUT OF SCOPE
- Widget styling/design (use existing components)
- Advanced analytics dashboard
- Integration with other channels (Telegram, SMS)
- AI-powered smart routing
- Historical message analytics

---

## Success Criteria

- [ ] Widget can send messages via API
- [ ] Widget receives responses via polling (< 15 seconds)
- [ ] WhatsApp unchanged and working
- [ ] Security checks apply to both channels
- [ ] Rate limiting enforced (10 msg/min)
- [ ] Database migration backward compatible
- [ ] Zero data loss during migration
- [ ] All tests passing
- [ ] Performance: API response < 500ms

---

## Constraints

- **Timeline**: 7 days (single developer)
- **Database**: PostgreSQL (existing)
- **No breaking changes**: WhatsApp API must remain identical
- **Backward compatibility**: Existing messages must still work
- **Test coverage**: All critical paths must be tested

