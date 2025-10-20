# 🔍 ShopME - Cleanup & Audit Prompt

**Scopo:** Prompt riutilizzabile per eseguire audit completo e pulizia del progetto  
**Frequenza:** Eseguire ogni 2-4 settimane o prima di release importanti  
**Ultima esecuzione:** 20 Ottobre 2025  
**Branch suggerito:** Creare branch dedicato (es: `cleanup-YYYYMMDD`)

---

## 🚀 PROMPT PER COPILOT

Copia e incolla questo prompt a Copilot quando vuoi eseguire l'audit:

```
Esegui un audit completo del progetto ShopME seguendo il TODO.md in root.

FASE 1 - ANALISI (NON-INVASIVO):
1. Conta console.log in backend e frontend
2. Identifica file >800 righe che dovrebbero essere splittati
3. Cerca metodi duplicati tra controllers/services
4. Analizza coverage test attuali
5. Identifica campi DB potenzialmente non usati
6. Trova script temporanei o obsoleti
7. Verifica bundle size frontend
8. Audit chiamate API duplicate nel frontend

FASE 2 - REPORT:
Crea un report in docs/memory-bank/06-REPORTS/CLEANUP-REPORT-[DATA].md con:
- Metriche attuali vs target
- Lista prioritizzata di interventi
- Stima impatto per ogni intervento (basso/medio/alto rischio)
- Raccomandazioni specifiche

FASE 3 - PROPOSTA:
Proponi un piano d'azione step-by-step con:
- Ordine di esecuzione (dal più safe al più rischioso)
- Test da eseguire dopo ogni step
- Punti di rollback

REGOLE CRITICHE:
- NON modificare codice senza esplicita approvazione
- NON toccare .env senza backup
- NON modificare test esistenti
- NON toccare PDF in backend/prisma/temp/
- SEMPRE verificare che workspaceId sia usato nelle query
- USA come contesto: codice, documentazione, seed, memory bank, PRD
```

---

## 📊 CHECKLIST AUDIT

### Backend Security

- [ ] Tutti gli endpoint protetti hanno `authMiddleware` + `workspaceValidationMiddleware`
- [ ] Tutte le query Prisma filtrano per `workspaceId`
- [ ] Endpoint pubblici hanno rate limiting
- [ ] SecureToken validation corretta

### Backend Code Quality

- [ ] Nessun `console.log` (solo `logger.*`)
- [ ] Nessun file controller/service >1000 righe
- [ ] Nessun metodo duplicato tra services
- [ ] Coverage test >80% su services critici
- [ ] Nessuno script temporaneo in /scripts

### Backend Database

- [ ] Tutti i campi dello schema sono usati
- [ ] Indici appropriati su query frequenti
- [ ] Nessuna tabella obsoleta
- [ ] Performance query <100ms

### Frontend Security

- [ ] Tutte le chiamate API autenticate
- [ ] Input utente sanitizzato (DOMPurify)
- [ ] Route protette con guards
- [ ] Token gestito centralmente

### Frontend Code Quality

- [ ] Nessun `console.log` (o solo in dev mode)
- [ ] Nessun file page/component >600 righe
- [ ] Nessuna chiamata API duplicata
- [ ] Componenti riutilizzabili per pattern comuni
- [ ] SessionStorage gestito centralmente

### Frontend Performance

- [ ] Bundle size <1MB (gzipped)
- [ ] Lazy loading route non critiche
- [ ] React Query con caching appropriato
- [ ] Immagini ottimizzate

### Pricing & Billing

- [ ] Prezzi SEMPRE da database (no hardcoded)
- [ ] Calcoli pricing centralizzati
- [ ] Frontend solo formatta, non calcola
- [ ] Un solo punto di modifica prezzi

### Documentation

- [ ] README.md aggiornato
- [ ] API endpoints documentati (Swagger)
- [ ] Memory bank organizzato
- [ ] JSDoc su metodi pubblici

---

## 🎯 METRICHE TARGET

```yaml
Backend:
  console_log: 0
  files_over_1000_lines: 0
  test_coverage: ">80%"
  avg_query_time: "<100ms"

Frontend:
  console_log: 0
  files_over_600_lines: 0
  bundle_size_gzipped: "<1MB"
  test_coverage: ">70%"

Database:
  unused_fields: 0
  missing_indexes: 0
  unused_tables: 0

Performance:
  api_response_p95: "<200ms"
  page_load_time: "<2s"
  llm_response_time: "<5s"
```

---

## 🔧 COMANDI UTILI

### Backend Analysis

```bash
cd backend

# Conta console.log
grep -r "console\." src --include="*.ts" | wc -l

# Test coverage
npm run test:coverage

# Trova file grandi
find src -name "*.ts" -exec wc -l {} \; | sort -rn | head -20

# Analizza indici DB
npx prisma studio
# Poi eseguire query con EXPLAIN ANALYZE
```

### Frontend Analysis

```bash
cd frontend

# Conta console.log
grep -r "console\." src --include="*.ts*" | wc -l

# Bundle size
npm run build
du -sh dist/

# Trova file grandi
find src -name "*.tsx" -exec wc -l {} \; | sort -rn | head -20

# Test coverage
npm run test:run -- --coverage
```

### Database Analysis

```sql
-- Query lente (se logging abilitato)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Indici non usati
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Tabelle più grandi
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 📋 TEMPLATE REPORT

Quando esegui l'audit, crea un report seguendo questo template:

```markdown
# Cleanup Report - [DATA]

## Executive Summary

- **Stato generale:** 🟢 Ottimo / 🟡 Buono / 🟠 Migliorabile / 🔴 Critico
- **Problemi critici:** X
- **Miglioramenti suggeriti:** Y
- **Tempo stimato intervento:** Z ore

## Metriche Attuali vs Target

| Metrica          | Attuale | Target | Status   |
| ---------------- | ------- | ------ | -------- |
| BE console.log   | XX      | 0      | 🔴/🟡/🟢 |
| FE console.log   | XX      | 0      | 🔴/🟡/🟢 |
| Test coverage BE | XX%     | >80%   | 🔴/🟡/🟢 |
| Test coverage FE | XX%     | >70%   | 🔴/🟡/🟢 |
| ...              |         |        |          |

## Problemi Identificati

### 🔴 Critici (Fix Immediate)

1. **[Descrizione]**
   - File: `path/to/file.ts`
   - Impatto: Alto
   - Soluzione: [...]

### 🟠 Importanti (Fix Entro Settimana)

[...]

### 🟡 Miglioramenti (Backlog)

[...]

## Piano d'Azione

### Step 1: [Nome Step]

- **Rischio:** Basso/Medio/Alto
- **Tempo:** Xh
- **Files coinvolti:** [...]
- **Test da eseguire:** [...]
- **Rollback plan:** [...]

[... altri steps ...]

## Raccomandazioni Tecniche

[Suggerimenti specifici per migliorare architettura, performance, ecc.]

## Note

[Altre osservazioni rilevanti]
```

---

## 🚨 ALERT & WARNINGS

**Prima di ogni modifica:**

1. ✅ Branch dedicato creato
2. ✅ Backup .env fatto (se necessario)
3. ✅ Test attuali passano tutti
4. ✅ Database backup recente disponibile

**Durante le modifiche:**

1. ⚠️ Un cambio alla volta
2. ⚠️ Test dopo ogni cambio
3. ⚠️ Commit frequenti con messaggi chiari
4. ⚠️ Mai modificare test esistenti senza approvazione

**Dopo le modifiche:**

1. ✅ `npm run test:unit` (backend)
2. ✅ `npm run test:security` (backend)
3. ✅ `npm test` (frontend)
4. ✅ Smoke test manuale (login, prodotti, ordini, chat)
5. ✅ Verifica performance (non peggiorata)

---

## 📚 Riferimenti

- **TODO principale:** `/TODO.md`
- **Copilot Instructions:** `/.github/copilot-instructions.md`
- **PRD:** `/docs/memory-bank/prd.md`
- **Architecture:** `/docs/memory-bank/03-ARCHITECTURE/`
- **Reports precedenti:** `/docs/memory-bank/06-REPORTS/`

---

## 🔄 Cronologia Audit

| Data       | Branch           | Eseguito da | Report         | Modifiche      |
| ---------- | ---------------- | ----------- | -------------- | -------------- |
| 2025-10-20 | 100-fatturazione | Copilot     | TODO.md creato | Setup iniziale |
| ...        | ...              | ...         | ...            | ...            |

---

**Usa questo prompt ogni volta che vuoi un check completo del progetto! 🚀**
