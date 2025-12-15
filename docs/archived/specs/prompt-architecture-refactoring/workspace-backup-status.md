# Workspace Backup/Restore Status

**Date**: 2025-11-15  
**Investigation**: Task 0.1, 0.2

---

## 📦 Current Backup System

### Export Script: `export-db-to-seed.ts`

**Purpose**: Export database to TypeScript seed files

**What It Does**:

1. ✅ Exports all workspace data to `prisma/data/*.ts` files
2. ✅ Exports agent prompts to `docs/prompts/*.md` files
3. ✅ Backs up images to `prisma/uploads-backup/`
4. ✅ Creates backup of existing data files: `prisma/data-backup-YYYY-MM-DD/`

**Workspace Isolation**: ⚠️ PARTIAL

- Uses `workspaceId` to query database
- BUT: Exports to GENERIC folders (not workspace-specific):
  - `prisma/data/` (NOT `prisma/data/{workspaceId}/`)
  - `docs/prompts/` (NOT `docs/prompts/{workspaceId}/`)
  - `prisma/uploads-backup/` (NOT `prisma/uploads-backup/{workspaceId}/`)

**Conclusion**:

- ❌ Does NOT save to workspace-specific backup folders
- ✅ Works for single workspace
- ❌ Multi-workspace would overwrite files

---

## 🔧 Package.json Scripts

### Found Scripts:

```json
"db:backup": "ts-node scripts/backup-database.ts",
"db:restore": "ts-node scripts/restore-database.ts",
"db:backup-data": "cp -r prisma/data prisma/data-backup-$(date +%Y%m%d_%H%M%S) && echo '✅ Data backup created'"
```

### Investigation:

- ❌ `backup-database.ts` file NOT FOUND (script exists in package.json but file missing)
- ❌ `restore-database.ts` file NOT FOUND (script exists in package.json but file missing)
- ✅ `db:backup-data` uses simple copy (no workspace isolation)

**Status**: BROKEN - Scripts referenced but files don't exist

---

## 🚨 Issues Identified

### Issue 1: Missing Backup Scripts

**Problem**: `backup-database.ts` and `restore-database.ts` referenced in package.json but files don't exist

**Impact**:

- Running `npm run db:backup` will FAIL
- Running `npm run db:restore` will FAIL

**Solution**: Create these scripts in Phase 4 (Task 4.5)

---

### Issue 2: No Workspace Isolation in Export

**Problem**: `export-db-to-seed.ts` exports to generic folders, not workspace-specific

**User Requirement**:

> "deve salvare dentro una cartella di backup con workspaceID"

**Current Behavior**:

```
prisma/
  ├── data/               ❌ Generic (not workspace-specific)
  ├── uploads-backup/     ❌ Generic
  └── data-backup-DATE/   ❌ Generic (timestamp only, no workspaceId)
```

**Required Behavior**:

```
prisma/
  └── backups/
      └── {workspaceId}/
          ├── data/           ✅ Workspace-specific
          ├── uploads/        ✅ Workspace-specific
          └── prompts/        ✅ Workspace-specific
```

**Solution**:

- Option A: Modify `export-db-to-seed.ts` to use workspace folders
- Option B: Create new `export-workspace-backup.ts` script (cleaner)

**Recommendation**: Option B (create new scripts, keep export-db-to-seed.ts for general use)

---

## ✅ Decision: Create New Workspace Backup Scripts

### Scripts to Create (Phase 4, Task 4.5):

1. **`backend/scripts/export-workspace-backup.ts`**

   - Takes `workspaceId` as argument
   - Exports to `prisma/backups/{workspaceId}/`
   - Includes: data, prompts, uploads

2. **`backend/scripts/restore-workspace-backup.ts`**

   - Takes `workspaceId` as argument
   - Restores from `prisma/backups/{workspaceId}/`
   - Validates workspace isolation

3. **Update package.json**:
   ```json
   {
     "workspace:backup": "ts-node scripts/export-workspace-backup.ts",
     "workspace:restore": "ts-node scripts/restore-workspace-backup.ts"
   }
   ```

### Usage:

```bash
# Backup specific workspace
npm run workspace:backup cm9hjgq9v00014qk8fsdy4ujv

# Restore specific workspace
npm run workspace:restore cm9hjgq9v00014qk8fsdy4ujv
```

---

## 📊 Summary

| Requirement                | Current Status                                            | Action Needed                   |
| -------------------------- | --------------------------------------------------------- | ------------------------------- |
| Workspace-specific folders | ❌ NOT IMPLEMENTED                                        | Create new scripts              |
| Backup functionality       | ⚠️ PARTIAL (export-db-to-seed works for single workspace) | Add workspace:backup script     |
| Restore functionality      | ❌ BROKEN (restore-database.ts missing)                   | Create workspace:restore script |
| WorkspaceId isolation      | ❌ NOT ENFORCED                                           | Implement in new scripts        |

**Priority**: P0 (User explicitly requested this verification)

**Status**: ✅ INVESTIGATION COMPLETE - Scripts need creation in Phase 4
