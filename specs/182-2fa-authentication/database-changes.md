# Database Changes: Multi-Provider 2FA Authentication System

**Feature**: 182-2fa-authentication  
**Date**: November 21, 2025

## Migration Required

### 1. Extend `User` Table (2FA + OAuth + Security)

Add new fields to existing `users` table for 2FA + OAuth support + Profile Pictures:

**SECURITY ENHANCEMENTS**:
- `passwordHash` nullable for social-only users
- `recoveryCodes` array for 2FA backup (hashed with bcrypt)
- Email uniqueness enforced (prevent duplicate registrations)
- Indexes for faster auth lookups and rate limiting

```prisma
model User {
  // ... existing fields ...
  twoFactorEnabled   Boolean   @default(false)     // NEW: Flag to track if 2FA is active
  twoFactorEnabledAt DateTime?                     // NEW: When 2FA was activated
  recoveryCodes      String[]  @default([])        // NEW: 10 hashed recovery codes (bcrypt)
  authProvider       String    @default("email")   // NEW: Primary auth method (email/google/facebook/apple/multi)
  profilePicture     String?                       // NEW: URL to profile picture (OAuth URL or NULL for default avatar)
  linkedProviders    Json?     @default("[]")      // NEW: Array of linked OAuth providers with timestamps
  // passwordHash is NULLABLE for social-only users (SECURITY: social users may not have password)
}
```

**Migration SQL**:
```sql
-- SECURITY: Add 2FA tracking fields
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN two_factor_enabled_at TIMESTAMP;
ALTER TABLE users ADD COLUMN recovery_codes TEXT[] DEFAULT ARRAY[]::TEXT[]; -- Hashed codes only!

-- Add OAuth fields
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'email' NOT NULL;
ALTER TABLE users ADD COLUMN profile_picture TEXT; -- NULL = use default avatar
ALTER TABLE users ADD COLUMN linked_providers JSONB DEFAULT '[]'::JSONB;

-- SECURITY: Make passwordHash nullable (social-only users don't have password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- PERFORMANCE: Create indexes for faster lookups
CREATE INDEX idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = true;
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_profile_picture ON users(profile_picture) WHERE profile_picture IS NOT NULL;

-- SECURITY: Enforce email uniqueness (case-insensitive)
CREATE UNIQUE INDEX idx_users_email_unique ON users(LOWER(email));
```

### 2. Create `AuthenticationAttempt` Table (Security Audit Log)

**PURPOSE**: Track ALL authentication attempts for security monitoring, rate limiting, and brute force detection.

**SECURITY FEATURES**:
- Tracks failed login attempts per email/IP (rate limiting)
- Detects brute force attacks (5 failures in 15 min → account lock)
- Logs OAuth attempts for audit trail
- Stores IP + User-Agent for forensics
- Supports all attempt types including OAuth providers

New table for security monitoring (supports OAuth attempts):

```prisma
model AuthenticationAttempt {
  id            String   @id @default(cuid())
  email         String   // Email attempted (not userId to catch failed attempts)
  attemptType   String   // "registration", "login", "2fa", "password_reset", "oauth-google", "oauth-facebook", "oauth-apple"
  success       Boolean
  failureReason String?  // Error message if failed
  ipAddress     String?  @db.VarChar(45)  // IPv4 or IPv6 for rate limiting
  userAgent     String?  @db.Text         // Browser fingerprinting
  metadata      Json?    // Additional context (e.g., OAuth provider response)
  timestamp     DateTime @default(now())

  @@index([email, timestamp])       // Rate limit by email
  @@index([ipAddress, timestamp])   // Rate limit by IP
  @@index([attemptType, success])   // Fast failed attempt queries
  @@index([timestamp])              // Cleanup old logs
  @@map("authentication_attempts")
}
```

**Migration SQL**:
```sql
-- SECURITY: Create authentication attempts audit table
CREATE TABLE authentication_attempts (
  id VARCHAR(30) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,  -- Track even if user doesn't exist (prevent email enumeration)
  attempt_type VARCHAR(30) NOT NULL CHECK (attempt_type IN ('registration', 'login', '2fa', 'password_reset', 'oauth-google', 'oauth-facebook', 'oauth-apple')),
  success BOOLEAN NOT NULL,
  failure_reason TEXT,  -- 'invalid_password' | 'invalid_2fa' | 'account_locked' | 'rate_limited' | etc.
  ip_address VARCHAR(45),  -- SECURITY: For rate limiting by IP
  user_agent TEXT,         -- SECURITY: Browser fingerprinting
  metadata JSONB,          -- Additional context (OAuth response, etc.)
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- SECURITY: Create indexes for rate limiting and brute force detection
CREATE INDEX idx_auth_attempts_email_timestamp ON authentication_attempts(email, timestamp);
CREATE INDEX idx_auth_attempts_ip_timestamp ON authentication_attempts(ip_address, timestamp);
CREATE INDEX idx_auth_attempts_type_success ON authentication_attempts(attempt_type, success);
CREATE INDEX idx_auth_attempts_timestamp ON authentication_attempts(timestamp);

-- SECURITY: Add index for fast failed attempt queries (brute force detection)
CREATE INDEX idx_auth_attempts_failed ON authentication_attempts(success) WHERE success = FALSE;
```

### 3. Create `OAuthToken` Table (Optional - for Provider API Access)

**NOTE**: Only needed if you want to store OAuth tokens for future API calls to providers.

```prisma
model OAuthToken {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     String   // "google", "facebook", "apple"
  accessToken  String   @db.Text  // Encrypted
  refreshToken String?  @db.Text  // Encrypted, nullable
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([userId, provider])
  @@index([userId])
  @@index([expiresAt])
  @@map("oauth_tokens")
}
```

**Migration SQL (OPTIONAL)**:
```sql
-- Create OAuth tokens table (if storing tokens for provider API calls)
CREATE TABLE oauth_tokens (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(30) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create unique constraint (one token per user per provider)
CREATE UNIQUE INDEX idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
```

### 4. Extend `UserWorkspace` Table (Future Invite Feature)

**NOTE**: These fields are for future "invite friends to workspace" feature - NOT required for 2FA.

```prisma
model UserWorkspace {
  // ... existing fields ...
  invitedBy   String?   // NEW: userId of person who invited (null = owner)
  invitedAt   DateTime? // NEW: When invitation was sent
  status      String    @default("ACTIVE") // NEW: PENDING, ACTIVE, REVOKED
  permissions Json?     // NEW: Custom permissions override
}
```

**Migration SQL (OPTIONAL - for future feature)**:
```sql
-- Add invite tracking fields (for future workspace invite feature)
ALTER TABLE user_workspace ADD COLUMN invited_by VARCHAR(30);
ALTER TABLE user_workspace ADD COLUMN invited_at TIMESTAMP;
ALTER TABLE user_workspace ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE user_workspace ADD COLUMN permissions JSONB;

-- Add foreign key for invitedBy
ALTER TABLE user_workspace ADD CONSTRAINT fk_user_workspace_invited_by 
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for pending invitations
CREATE INDEX idx_user_workspace_status ON user_workspace(status) WHERE status = 'PENDING';
```

## Existing Tables - No Changes Required

### `AdminSession` (reuse for session management)
Already perfect for 2FA authentication flow:
- ✅ sessionId (unique)
- ✅ userId
- ✅ workspaceId (can be null until user selects workspace)
- ✅ createdAt, expiresAt, lastActivityAt
- ✅ isActive
- ✅ ipAddress, userAgent

### `User` (existing fields already present)
- ✅ email (unique - used as username)
- ✅ passwordHash
- ✅ firstName, lastName
- ✅ twoFactorSecret (already exists!)
- ✅ gdprAccepted (DateTime)
- ✅ role, status

## Summary

**Required Migrations**:
1. ✅ Extend User table (6 new fields: 2FA + OAuth support)
2. ✅ Create AuthenticationAttempt table (audit log with OAuth tracking)
3. ⏳ Create OAuthToken table (OPTIONAL - only if storing provider tokens)
4. ⏳ Extend UserWorkspace table (OPTIONAL - for future invite feature)

**No Changes Needed**:
- AdminSession (perfect as-is for sessionID management)
- User core fields (email, firstName, lastName already present)
- Workspace table
- GdprContent table

**Total New Tables**: 1 required (AuthenticationAttempt) + 1 optional (OAuthToken)  
**Total Modified Tables**: 1 required (User) + 1 optional (UserWorkspace)

**Key OAuth Fields**:
- `passwordHash` now NULLABLE (social-only users don't have password)
- `authProvider` tracks primary login method
- `profilePicture` stores OAuth provider photo URL
- `linkedProviders` JSON array tracks multiple linked OAuth accounts
