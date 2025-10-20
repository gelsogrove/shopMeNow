# 🧹 Piano Pulizia Prompt - Database Unificato

**Data**: 20 Ottobre 2025  
**Obiettivo**: UN SOLO POSTO per leggere/scrivere prompt in modo sicuro  
**Priorità**: 🚨 CRITICA

---

## 📊 Situazione Attuale (PROBLEMA)

### Duplicazione Prompt - 2 tabelle:

1. **`Prompts`** (vecchia/legacy)
   - Campi: `content`, `model`, `temperature`, `max_tokens`
   - Relation: `Message.promptId` → `Prompts.id`
   - **NON usata dal sistema LLM**
   - Creata dal seed ma MAI letta

2. **`agent_configs`** (attuale/corretta)
   - Campi: `prompt`, `model`, `temperature`, `maxTokens`
   - **USATA dal sistema LLM** (`getAgentConfig()`)
   - Update script scrive qui
   - È la fonte di verità REALE

### Problemi:

- ❌ Confusione: quale tabella è quella giusta?
- ❌ Seed scrive in entrambe (spreco risorse)
- ❌ Possibili inconsistenze tra le due
- ❌ Foreign key inutilizzata (`Message.promptId`)

---

## ✅ SOLUZIONE: `agent_configs` come MASTER

### Perché `agent_configs`?

1. ✅ Già usata dal sistema LLM (`message.repository.ts:2605`)
2. ✅ Update script già configurato
3. ✅ Naming coerente (`agent_configs` snake_case)
4. ✅ Schema più pulito e semplice

### Perché NON `Prompts`?

1. ❌ Nome non descrit tivo (troppo generico)
2. ❌ Campi legacy non necessari (`isRouter`, `department`, `top_p`, `top_k`)
3. ❌ PascalCase invece di snake_case
4. ❌ Mai letta dal codice attuale

---

## 🔧 Azioni da Eseguire

### Step 1: Rimuovere `promptId` da Message

**File**: `backend/prisma/schema.prisma`

```prisma
model Message {
  // ... altri campi ...
  
  // ❌ RIMUOVERE QUESTI:
  promptId    String?
  prompt      Prompts? @relation(fields: [promptId], references: [id])
  
  // ✅ MANTENERE:
  chatSession ChatSession @relation(fields: [chatSessionId], references: [id])
}
```

**Migration**:
```bash
npx prisma migrate dev --name remove_message_promptid
```

### Step 2: Rimuovere tabella `Prompts`

**File**: `backend/prisma/schema.prisma`

```prisma
// ❌ RIMUOVERE COMPLETAMENTE:
model Prompts {
  id          String    @id @default(uuid())
  name        String
  content     String
  // ... tutto il resto
}
```

**E nel Workspace model**:
```prisma
model Workspace {
  // ❌ RIMUOVERE:
  prompts     Prompts[]
  
  // ✅ MANTENERE:
  agentConfigs AgentConfig[]
}
```

**Migration**:
```bash
npx prisma migrate dev --name drop_prompts_table
```

### Step 3: Aggiornare seed.ts

**File**: `backend/prisma/seed.ts`

Rimuovere COMPLETAMENTE la creazione di Prompts (linee ~352-363):

```typescript
// ❌ RIMUOVERE QUESTO BLOCCO:
await prisma.prompts.create({
  data: {
    workspaceId: workspace.id,
    name: "SofiA - Main Agent Prompt",
    content: agentPrompt,
    isActive: true,
    model: "openai/gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 1000,
  },
})
console.log("✅ Prompt created in Prompts table")
```

✅ MANTENERE SOLO:
```typescript
await prisma.agentConfig.create({
  data: {
    workspaceId: workspace.id,
    model: "anthropic/claude-3.5-haiku",
    temperature: 0.7,
    maxTokens: 1000,
    prompt: agentPrompt,  // ← Campo corretto
    isActive: true,
  },
})
console.log("✅ Agent configuration created")
```

### Step 4: Verificare tutti i riferimenti

**Grep per verificare:**

```bash
# Verificare nessuno usa "Prompts"
grep -r "prisma.prompts" backend/src/

# Verificare tutti usano "agentConfig"
grep -r "prisma.agentConfig" backend/src/

# Verificare promptId non è usato
grep -r "promptId" backend/src/
```

**File da controllare**:
- ✅ `message.repository.ts` - Deve usare `getAgentConfig()` che legge da `agent_configs`
- ✅ `agent.service.ts` - Deve avere sicurezza admin su `agentConfig`
- ✅ `update-prompt.js` - Deve scrivere su `agentConfig.prompt`

---

## 🔒 Sicurezza Post-Cleanup

### Unica Fonte di Verità: `agent_configs`

**Lettura** (qualsiasi utente autenticato):
```typescript
const config = await prisma.agentConfig.findFirst({
  where: { workspaceId, isActive: true }
})
const prompt = config.prompt
```

**Scrittura** (SOLO admin):
```typescript
// Verifica ruolo ADMIN prima di permettere update
if (user.role !== 'ADMIN') {
  throw new Error('Only admin users can modify agent prompts')
}

await prisma.agentConfig.update({
  where: { id },
  data: { prompt: newPrompt }
})
```

### Log Audit Trail

Ogni modifica prompt deve loggare:
```typescript
logger.info(`✅ Admin ${userId} updated prompt for workspace ${workspaceId}`)
```

---

## 🧪 Test Post-Cleanup

### Test 1: Seed crea solo agent_configs
```bash
npm run seed
psql ... -c "SELECT COUNT(*) FROM agent_configs;"  # Deve essere > 0
psql ... -c "SELECT COUNT(*) FROM \"Prompts\";"    # Deve dare errore (table does not exist)
```

### Test 2: LLM legge correttamente
```bash
# Invia messaggio WhatsApp
# Verifica log: [BILLING] 💰 €0.15 message cost tracked
# Verifica risposta AI arriva
```

### Test 3: Update prompt funziona
```bash
npm run update-prompt
psql ... -c "SELECT prompt FROM agent_configs LIMIT 1;" | head -5
# Deve mostrare nuovo prompt da docs/prompt_agent.md
```

### Test 4: Sicurezza admin
- Admin aggiorna prompt → ✅ Succede
- User normale prova → ❌ Errore "Only admin users can modify agent prompts"

---

## 📝 Checklist Esecuzione

- [ ] **Backup database** prima di tutto
- [ ] Rimuovere `Message.promptId` e relation (migration 1)
- [ ] Rimuovere `model Prompts` dallo schema (migration 2)
- [ ] Rimuovere creazione `Prompts` dal seed
- [ ] Grep verificare nessuno usa `Prompts`
- [ ] Test seed: crea solo `agent_configs`
- [ ] Test LLM: risponde ai messaggi
- [ ] Test update-prompt: aggiorna correttamente
- [ ] Test sicurezza: solo admin può modificare
- [ ] Documentare: `agent_configs` = unica fonte verità

---

## 🎯 Risultato Finale

### Prima (CAOTICO):
```
Workspace
  ├─ Prompts[] (mai letta)
  └─ AgentConfig[] (usata dal sistema)

Message
  └─ promptId → Prompts (mai usata)
```

### Dopo (PULITO):
```
Workspace
  └─ AgentConfig[] (UNICA fonte)

Message
  └─ chatSession (no promptId)
```

### Flusso Unificato:
```
1. Seed → Crea agent_configs
2. LLM → Legge da agent_configs  
3. Update → Scrive su agent_configs (admin only)
4. Frontend → Legge da agent_configs
```

---

**IMPORTANTE**: Dopo il cleanup, `agent_configs` è l'UNICA fonte di verità per i prompt. Nessun'altra tabella deve contenere prompt.
