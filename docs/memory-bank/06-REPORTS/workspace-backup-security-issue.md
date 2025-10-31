# 🚨 CRITICAL: Workspace Backup Security Issue

**Date**: 2025-10-30  
**Severity**: CRITICAL  
**Status**: ⚠️ DISABLED - Buttons removed until fix

---

## 🔴 Problem Identified

Andrea discovered that the Import/Export Database buttons have **TWO CRITICAL SECURITY ISSUES**:

### Issue 1: Script doesn't exist

- `npm run db:restore` points to `scripts/restore-database.ts`
- **File doesn't exist!** ❌

### Issue 2: NO Workspace Isolation ⚠️⚠️⚠️

Current `scripts/export-db-to-seed.ts`:

- Exports **ALL workspaces** data together
- **NO filtering by workspaceId**
- If workspace A imports backup → gets workspace B data! 🚨
- **VIOLATES multi-tenant security principle**

---

## 🛑 Immediate Action Taken

**Buttons DISABLED** in `/frontend/src/pages/AgentConfigurationPage.tsx`:

```tsx
<Button
  disabled={true}
  className="bg-gray-400 cursor-not-allowed"
  title="⚠️ DISABLED: Must implement workspace-specific backup first"
>
```

**Backend endpoints still exist** but should NOT be used until fixed.

---

## ✅ Required Solution

### **Workspace-Specific Backup System**

Each workspace must have its own isolated backup:

```
backend/prisma/backups/
├── {workspaceId_1}/
│   ├── backup-2025-10-30_160000/
│   │   ├── agents.json
│   │   ├── products.json
│   │   ├── categories.json
│   │   ├── customers.json
│   │   ├── orders.json
│   │   └── uploads/
│   └── backup-2025-10-30_120000/
└── {workspaceId_2}/
    └── backup-2025-10-30_150000/
```

### **New Scripts Needed**

1. **`scripts/export-workspace-backup.ts`**

   ```typescript
   // Usage: ts-node scripts/export-workspace-backup.ts <workspaceId>
   async function exportWorkspaceBackup(workspaceId: string) {
     // 1. Create backup directory with timestamp
     const backupDir = `prisma/backups/${workspaceId}/backup-${timestamp}`

     // 2. Export ONLY data for this workspace
     const products = await prisma.products.findMany({
       where: { workspaceId },
     })

     // 3. Save to JSON files
     // 4. Copy uploads for this workspace
   }
   ```

2. **`scripts/restore-workspace-backup.ts`**
   ```typescript
   // Usage: ts-node scripts/restore-workspace-backup.ts <workspaceId>
   async function restoreWorkspaceBackup(workspaceId: string) {
     // 1. Find latest backup for this workspace
     const backupDir = `prisma/backups/${workspaceId}/backup-latest`

     // 2. DELETE existing data for this workspace
     await prisma.products.deleteMany({ where: { workspaceId } })

     // 3. Import data from JSON
     // 4. Restore uploads
   }
   ```

### **Backend API Updates**

```typescript
// POST /workspaces/:workspaceId/database/export
router.post(
  "/workspaces/:workspaceId/database/export",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req, res) => {
    const workspaceId = req.params.workspaceId

    // Execute: ts-node scripts/export-workspace-backup.ts {workspaceId}
    execSync(`ts-node scripts/export-workspace-backup.ts ${workspaceId}`)
  }
)

// POST /workspaces/:workspaceId/database/import
router.post(
  "/workspaces/:workspaceId/database/import",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req, res) => {
    const workspaceId = req.params.workspaceId

    // Execute: ts-node scripts/restore-workspace-backup.ts {workspaceId}
    execSync(`ts-node scripts/restore-workspace-backup.ts ${workspaceId}`)
  }
)
```

---

## 📋 Implementation Checklist

- [ ] Create `scripts/export-workspace-backup.ts`
  - [ ] Accept workspaceId as argument
  - [ ] Filter ALL queries by workspaceId
  - [ ] Create timestamped backup directory
  - [ ] Export: agents, products, categories, customers, orders, etc.
  - [ ] Copy workspace-specific uploads
- [ ] Create `scripts/restore-workspace-backup.ts`
  - [ ] Accept workspaceId as argument
  - [ ] Find latest backup for workspace
  - [ ] Delete existing workspace data (transaction!)
  - [ ] Import from JSON files
  - [ ] Restore uploads
- [ ] Update `package.json` scripts
  ```json
  "db:export-workspace": "ts-node scripts/export-workspace-backup.ts",
  "db:restore-workspace": "ts-node scripts/restore-workspace-backup.ts"
  ```
- [ ] Update backend endpoints to pass workspaceId
- [ ] Re-enable frontend buttons
- [ ] Test with multiple workspaces
- [ ] Document in PRD

---

## 🔒 Security Requirements

1. ✅ **Workspace Isolation**: Each workspace has separate backup
2. ✅ **No Cross-Contamination**: Workspace A cannot restore workspace B data
3. ✅ **Admin Only**: Only ADMIN role can export/import
4. ✅ **Validation**: Verify workspaceId exists before operations
5. ✅ **Atomic Operations**: Use transactions for restore
6. ✅ **Logging**: Full audit trail of all backup operations

---

## 📝 Notes from Andrea

> "OCCHIO CHE LI DUMP LO DEVI SALVARE PER WORKSPACEID NON POSSOAMO IMPORTARE DATI DI UN ALTRO WORKSPACE IMPORTANTE!!!"

**Absolutely correct!** This is a fundamental multi-tenant security requirement. The current system would allow cross-workspace data leakage.

---

## 🎯 Next Steps

1. **Priority**: Implement workspace-specific backup scripts
2. **Testing**: Verify with 2+ workspaces
3. **Documentation**: Update PRD with backup architecture
4. **Enable**: Re-enable buttons once tested

---

**Last Updated**: 2025-10-30 by Andrea & Copilot
