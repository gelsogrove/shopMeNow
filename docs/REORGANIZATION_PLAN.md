# 📁 PIANO RIORGANIZZAZIONE DOCUMENTAZIONE

## File da Spostare/Rinominare

### 1. docs/ (root level) → Spostare in memory-bank/

#### File Temporanei/Report (→ memory-bank/06-REPORTS/)

- ✅ `CALLING_FUNCTIONS_COVERAGE_REPORT.md` → `memory-bank/06-REPORTS/calling-functions-coverage-report.md`
- ✅ `CALLING_FUNCTIONS_TECHNICAL_DOC.md` → `memory-bank/02-FEATURES/calling-functions/`
- ✅ `CLEANUP_SUMMARY_2025-10-17.md` → `memory-bank/06-REPORTS/cleanup-summary-2025-10-17.md`
- ✅ `CODE-REVIEW-2025-10-16.md` → `memory-bank/06-REPORTS/code-review-2025-10-16.md`

#### File Core (rimangono in docs/)

- ⚪ `prompt_agent.md` → RIMANE (usato da update-prompt script)
- ⚪ `prompt_spam.md` → RIMANE (usato per blacklist detection)

---

### 2. docs/memory-bank/ (root level) → Spostare in sottocartelle

#### SearchProduct Documentation (→ 02-FEATURES/search-product/)

- ✅ `IMPLEMENTATION_SUMMARY_SEARCHPRODUCT.md` → `02-FEATURES/search-product/implementation-summary.md`
- ✅ `SEARCHPRODUCT_CHECKLIST.md` → `02-FEATURES/search-product/checklist.md`
- ✅ `SEARCHPRODUCT_COMPLETE.md` → `02-FEATURES/search-product/complete-guide.md`
- ✅ `SEARCHPRODUCT_FINAL_REPORT.md` → `02-FEATURES/search-product/final-report.md`
- ✅ `SEARCHPRODUCT_INTEGRATION_MAP.md` → `02-FEATURES/search-product/integration-map.md`
- ✅ `SEARCHPRODUCT_QUICK_REFERENCE.md` → `02-FEATURES/search-product/quick-reference.md`

#### Issue/Implementation Summaries (→ 06-REPORTS/)

- ✅ `IMPLEMENTATION_SUMMARY_ISSUE_84.md` → `06-REPORTS/implementation-summary-issue-84.md`

#### Database (→ 03-ARCHITECTURE/)

- ✅ `DATABASE_MANAGEMENT.md` → `03-ARCHITECTURE/database-management.md`

#### Core Documentation (→ memory-bank root - rinominare lowercase)

- ✅ `prd.md` → `PRD.md` (MANTIENI UPPERCASE - è il documento principale)
- ✅ `prd.prompt.md` → `prd-prompt.md` (rinomina lowercase)
- ⚪ `readme.md` → RIMANE (index della cartella)

---

## Nuova Struttura Proposta

```
docs/
├── prompt_agent.md (CORE - usato da script)
├── prompt_spam.md (CORE - usato da blacklist)
│
└── memory-bank/
    ├── readme.md (index)
    ├── PRD.md (MAIN DOCUMENT - uppercase ok)
    ├── prd-prompt.md (lowercase)
    │
    ├── 01-SECURITY/
    │   ├── authentication/
    │   ├── session-management/
    │   ├── translation-security/
    │   ├── assessments/
    │   └── guides/
    │
    ├── 02-FEATURES/
    │   ├── calling-functions/
    │   │   └── calling-functions-technical-doc.md (NEW)
    │   └── search-product/
    │       ├── implementation-summary.md
    │       ├── checklist.md
    │       ├── complete-guide.md
    │       ├── final-report.md
    │       ├── integration-map.md
    │       └── quick-reference.md
    │
    ├── 03-ARCHITECTURE/
    │   ├── calling-functions-architecture.md
    │   ├── websocket-implementation.md
    │   ├── endpoints.md
    │   ├── llmservice-architecture-flow.md
    │   ├── style-guide.md
    │   └── database-management.md (NEW)
    │
    ├── 04-BEST-PRACTICES/
    │
    ├── 05-GUIDES/
    │
    └── 06-REPORTS/ (NEW)
        ├── calling-functions-coverage-report.md
        ├── cleanup-summary-2025-10-17.md
        ├── code-review-2025-10-16.md
        └── implementation-summary-issue-84.md
```

---

## Azioni da Eseguire

1. ✅ Creare cartella `06-REPORTS/`
2. ✅ Creare cartella `02-FEATURES/calling-functions/`
3. ✅ Creare cartella `02-FEATURES/search-product/`
4. ✅ Spostare file come da mappa sopra
5. ✅ Rinominare file in lowercase dove appropriato
6. ✅ Aggiornare README.md con nuova struttura

---

## Note

- **NON toccare**: `prompt_agent.md`, `prompt_spam.md` (usati da script)
- **Mantenere uppercase**: `PRD.md` (è il documento master)
- **Tutti gli altri file**: lowercase con dash separator
- **File MAIUSCOLI con data**: rinominare in lowercase (es. `CLEANUP_SUMMARY_2025-10-17.md` → `cleanup-summary-2025-10-17.md`)
