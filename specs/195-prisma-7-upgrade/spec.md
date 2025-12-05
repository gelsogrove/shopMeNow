# 🚀 Spec 195: Upgrade to Prisma 7.1.0 - Performance & Speed

**Feature**: Complete migration from Prisma 6.19 to Prisma 7.1
**Objective**: Enable 3x faster queries, 90% smaller bundle sizes, and modern ESM architecture
**Priority**: High (Scalability optimization)
**Status**: In Development

---

## 📋 Executive Summary

Migrate the entire shopME stack from **Prisma 6.19.0** to **Prisma 7.1.0**. This major upgrade introduces:
- ESM-first Prisma Client (faster, lighter)
- Driver adapters architecture (explicit connection handling)
- New `prisma.config.ts` configuration system
- ~3x faster query execution
- ~90% smaller bundle sizes

**Impact**:
- ✅ Backend: `@prisma/client` v6.19.0 → v7.1.0
- ✅ Database Package: `prisma` CLI v6.5.0 → v7.1.0
- ✅ PostgreSQL: Add `@prisma/adapter-pg` v7.1.0
- ✅ Configuration: New `prisma.config.ts` file
- ✅ Schema: Generator change from `prisma-client-js` → `prisma-client`
- ✅ Client imports: Move from `@prisma/client` → `./generated/prisma/client`

---

## 🎯 Requirements

### Functional Requirements
1. **Update Prisma Packages**
   - [ ] Update `@prisma/client` to `^7.1.0` in `packages/database/package.json`
   - [ ] Update `prisma` CLI to `^7.1.0` in `packages/database/package.json`
   - [ ] Add `@prisma/adapter-pg` to `packages/database/package.json`

2. **Create Prisma Config File**
   - [ ] Create `packages/database/prisma.config.ts`
   - [ ] Define datasource configuration
   - [ ] Set schema path
   - [ ] Configure migration settings
   - [ ] Add seed configuration

3. **Update Schema Generator**
   - [ ] Change generator provider: `prisma-client-js` → `prisma-client`
   - [ ] Add output path: `../src/generated/prisma`
   - [ ] Remove datasource URL (moves to prisma.config.ts)

4. **Update Client Initialization**
   - [ ] Update `apps/backend/src/config/database.ts` to use driver adapter
   - [ ] Import `PrismaPg` from `@prisma/adapter-pg`
   - [ ] Initialize adapter with `DATABASE_URL`
   - [ ] Pass adapter to `new PrismaClient({ adapter })`

5. **Update All Imports**
   - [ ] Backend: Change all `@prisma/client` imports to `./generated/prisma/client`
   - [ ] Scheduler: Update PrismaClient imports
   - [ ] Backoffice (if applicable): Update any Prisma imports

6. **Environment Variables**
   - [ ] Ensure `.env` has `DATABASE_URL` configured
   - [ ] Update dotenv loading in scripts
   - [ ] No hardcoded env handling (explicit loading required in v7)

7. **Generate & Test**
   - [ ] Run `npm install` to fetch new packages
   - [ ] Run `npx prisma generate` to create v7 client structure
   - [ ] Verify `src/generated/prisma/client` directory exists
   - [ ] Run `npm run seed` to populate test data
   - [ ] Start backend dev server
   - [ ] Verify no TypeScript errors
   - [ ] Test API endpoints
   - [ ] Test scheduler jobs

### Non-Functional Requirements
- ✅ Maintain backward compatibility (no schema changes)
- ✅ Preserve all seed data
- ✅ Keep database schema intact
- ✅ All tests pass
- ✅ No breaking changes to API contracts

---

## 📊 Breaking Changes & Migration Guide

### Change 1: Package Updates
```bash
# Before (v6.19)
"@prisma/client": "^6.19.0"
"prisma": "^6.5.0"

# After (v7.1)
"@prisma/client": "^7.1.0"
"prisma": "^7.1.0"
"@prisma/adapter-pg": "^7.1.0"
```

### Change 2: Generator Configuration
```prisma
// Before (v6)
generator client {
  provider = "prisma-client-js"
}

// After (v7)
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

### Change 3: New Config File Required
```typescript
// NEW FILE: packages/database/prisma.config.ts
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "ts-node prisma/seed.ts",
  },
})
```

### Change 4: Client Initialization
```typescript
// Before (v6)
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

// After (v7)
import { PrismaClient } from "./generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })
```

### Change 5: Import Paths
```typescript
// Before (v6)
import { PrismaClient, Prisma } from "@prisma/client"

// After (v7)
import { PrismaClient, Prisma } from "./generated/prisma/client"
```

---

## 🔄 Implementation Steps

### Phase 1: Package Updates
1. ✅ Update `packages/database/package.json` with new versions
2. ✅ Run `npm install` from monorepo root
3. ✅ Verify new packages are installed

### Phase 2: Configuration
1. ✅ Create `packages/database/prisma.config.ts`
2. ✅ Update `packages/database/prisma/schema.prisma` generator
3. ✅ Remove datasource.url from schema (moves to config file)

### Phase 3: Backend Updates
1. ✅ Update `apps/backend/src/config/database.ts`
2. ✅ Add adapter initialization
3. ✅ Update PrismaClient creation

### Phase 4: Import Updates
1. ✅ Update all backend imports: `@prisma/client` → `./generated/prisma/client`
2. ✅ Update scheduler imports
3. ✅ Update test files if they import PrismaClient

### Phase 5: Code Generation
1. ✅ Run `npx prisma generate`
2. ✅ Verify `src/generated/prisma/client` directory created
3. ✅ Check TypeScript compilation

### Phase 6: Testing
1. ✅ Run `npm run seed`
2. ✅ Start `npm run dev` (backend)
3. ✅ Verify database connection
4. ✅ Test API endpoints
5. ✅ Run test suite: `npm run test:unit`
6. ✅ Run integration tests

---

## 🧪 Test Cases

### Unit Tests (Jest)
```bash
# Test: Backend compilation with new imports
npm run test:unit

# Test: Database operations still work
npm run seed
```

### Integration Tests
```bash
# Start backend
npm run dev  # from apps/backend

# Test API endpoints respond correctly
curl http://localhost:3001/api/health

# Test database queries
curl http://localhost:3001/api/workspaces
```

### Manual Testing
1. Start backend: `npm run dev` (from `apps/backend`)
2. Check for TypeScript compilation errors
3. Verify database seed completes
4. Check logs for any migration warnings
5. Test creating/reading/updating records

---

## 📁 Files to Modify

### 1. Package Updates
- `packages/database/package.json` - Update versions, add adapter

### 2. Configuration
- `packages/database/prisma.config.ts` - NEW FILE
- `packages/database/prisma/schema.prisma` - Update generator, move datasource

### 3. Backend Code
- `apps/backend/src/config/database.ts` - Update client initialization
- `apps/backend/src/index.ts` - Update imports (if any)
- All service files using PrismaClient - Update imports

### 4. Scheduler
- `apps/scheduler/src/config/database.ts` - Update client initialization
- Any scheduler files using PrismaClient - Update imports

### 5. Generated Files (Auto-created)
- `packages/database/src/generated/prisma/client/index.d.ts` - AUTO
- `packages/database/src/generated/prisma/client/index.js` - AUTO

---

## 🔐 Security Considerations

- ✅ No hardcoded passwords in config
- ✅ DATABASE_URL loaded from environment
- ✅ Shadow database URL (for migrations) protected
- ✅ Adapter initialization happens at runtime
- ✅ No sensitive data in git-tracked files

---

## 📈 Performance Impact

### Expected Improvements
| Metric | v6.19 | v7.1 | Improvement |
|--------|-------|------|-------------|
| Query Speed | 1x | 3x | 🚀 3x faster |
| Bundle Size | 100% | ~10% | 📉 90% smaller |
| Startup Time | 1x | ~1.2x | ⚡ Slightly faster |
| Memory Usage | 1x | ~0.8x | 💾 Reduced |

### Monitoring Post-Migration
- Monitor query execution times in logs
- Check bundle size reduction
- Verify no performance regressions
- Monitor memory usage

---

## 🚀 Rollback Plan

If migration encounters critical issues:

```bash
# Revert branch
git checkout main
git branch -D 195-prisma-7-upgrade

# Restore original packages
git checkout HEAD -- packages/database/package.json
npm install

# Downgrade if needed
cd packages/database
npm install @prisma/client@^6.19.0 prisma@^6.5.0
```

---

## 📝 Notes & References

### Why Prisma 7.1?
- Released: Dec 2024 (v7.0.0), Dec 5 2024 (v7.1.0)
- Stable for production use
- Significant performance improvements
- Modern ESM architecture

### Known Limitations
- ❌ MongoDB NOT supported in v7 (stay on v6 if using MongoDB)
- ⚠️ Requires explicit adapter or accelerateUrl (no direct `new PrismaClient()`)
- ⚠️ Generated client now in `src/` instead of `node_modules/`

### Documentation
- [Prisma 7.0.0 Release Notes](https://github.com/prisma/prisma/releases/tag/7.0.0)
- [Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions)
- [Driver Adapters](https://www.prisma.io/docs/orm/overview/databases/postgres)

---

## ✅ Acceptance Criteria

- [ ] All packages updated to v7.1.0
- [ ] `prisma.config.ts` created and properly configured
- [ ] Schema generator updated
- [ ] All imports updated
- [ ] Client initialization uses adapter
- [ ] `npm run seed` completes successfully
- [ ] Backend starts without errors: `npm run dev`
- [ ] All TypeScript compilation passes
- [ ] Database queries work correctly
- [ ] Test suite passes: `npm run test:unit`
- [ ] No console errors or warnings
- [ ] Performance improvements verified

---

**Created**: December 5, 2025
**Author**: Andrea (via GitHub Copilot)
**Status**: Ready for Implementation
