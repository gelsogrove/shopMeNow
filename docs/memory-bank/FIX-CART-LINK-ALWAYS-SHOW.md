# FIX: Link Carrello SEMPRE Mostrato dopo addProduct e repeatOrder

**Data**: 17 Ottobre 2025  
**Issue**: L'LLM non mostrava il link del carrello dopo aggiunta prodotti

---

## 🐛 Problema Originale

Quando l'utente confermava l'aggiunta di un prodotto al carrello, l'LLM rispondeva:

```
✅ Ho aggiunto 1 x "Caffè Espresso Napoletano" al carrello!
```

**MANCAVA** il link del carrello, anche se la CF `addProduct()` ritornava correttamente `cartUrl`.

---

## 🔍 Root Cause

Il prompt in `docs/prompt_agent.md` non era **ESPLICITO** su:

1. Dove prendere il link (`cartUrl` dal risultato CF)
2. Come formattare la risposta con il link
3. Che il link è **OBBLIGATORIO** in ogni risposta dopo CF

L'LLM rispondeva genericamente senza includere il link perché il prompt diceva solo:

> "Mostra risultato e link carrello"

Ma non specificava **COME** farlo.

---

## ✅ Soluzione Implementata

### 1. Aggiornato `docs/prompt_agent.md`

**Sezione `addProduct()` - Aggiunto formato obbligatorio**:

```markdown
**⚠️ FORMATO RISPOSTA OBBLIGATORIO DOPO addProduct()**:
```

✅ Ho aggiunto {quantity} x {productName} al carrello!

🛒 Vedi il tuo carrello: {cartUrl}

⏰ Link valido per 60 minuti

```

**IMPORTANTE**: `cartUrl` viene dal risultato della CF `addProduct()` - **SEMPRE** includerlo nella risposta!
```

**Sezione `repeatOrder()` - Stesso formato**:

```markdown
**⚠️ FORMATO RISPOSTA OBBLIGATORIO DOPO repeatOrder()**:
```

✅ Ho ricreato il tuo ordine nel carrello con {totalItems} prodotti!

🛒 Vedi il tuo carrello: {cartUrl}

⏰ Link valido per 60 minuti

```

**IMPORTANTE**: `cartUrl` viene dal risultato della CF `repeatOrder()` - **SEMPRE** includerlo nella risposta!
```

### 2. Aggiornati TUTTI gli esempi

Ogni esempio ora mostra **esplicitamente**:

- Il risultato della CF con `cartUrl`
- La risposta formattata con il link
- L'emoji 🛒 per identificare visivamente il carrello

**Esempio**:

```
Tu: [CHIAMA addProduct({"productCode": "BUR-001", "quantity": 1})]
Risultato CF: {success: true, cartUrl: "https://shop.altrogusto.it/cart/abc123", ...}

Tu rispondi:
✅ Ho aggiunto 1 x Burrata di Bufala al carrello!

🛒 Vedi il tuo carrello: https://shop.altrogusto.it/cart/abc123

⏰ Link valido per 60 minuti
```

### 3. Aggiornato Memory Bank

Aggiunta regola in `.github/copilot-instructions.md`:

```markdown
**NO HARDCODED TRANSLATIONS**: Categories, offers, products SEMPRE in italiano (lingua base) dal database

- Methods like `getActiveCategories()` and `getActiveOffers()` return Italian text from DB
- Translation Layer (with LLM) handles final translation to customer's language
- NEVER create translation mappings (it/es/pt/en) - let LLM translate dynamically
```

### 4. Aggiornato Database

```bash
cd backend && node scripts/update-prompt.js
✅ Updated 1 agent config(s)
```

---

## 🎯 Risultato Atteso

### Prima (SBAGLIATO) ❌:

```
Utente: si confermp
Bot: ✅ Ho aggiunto 1 x "Caffè Espresso Napoletano" al carrello!
```

### Dopo (CORRETTO) ✅:

```
Utente: si confermp
Bot: ✅ Ho aggiunto 1 x "Caffè Espresso Napoletano" al carrello!

🛒 Vedi il tuo carrello: https://shop.altrogusto.it/cart/abc123

⏰ Link valido per 60 minuti
```

---

## 📋 Checklist Completata

- [x] Rimosso ~400 righe di traduzioni hardcoded in `getActiveCategories()`
- [x] Rimosso ~100 righe di traduzioni hardcoded in `getActiveOffers()`
- [x] Aggiornato prompt `addProduct()` con formato obbligatorio
- [x] Aggiornato prompt `repeatOrder()` con formato obbligatorio
- [x] Aggiornati TUTTI gli esempi con cartUrl esplicito
- [x] Aggiornato Memory Bank con regola anti-hardcode
- [x] Database aggiornato con nuovo prompt
- [x] File pronti per commit (NO push - Andrea fa commit manualmente)

---

## 🔄 Files Modificati

1. `backend/src/repositories/message.repository.ts` - Pulito metodi categorie/offerte
2. `backend/src/services/llm.service.ts` - Rimosso parametro `language`
3. `docs/prompt_agent.md` - Aggiunto formato obbligatorio per cartUrl
4. `.github/copilot-instructions.md` - Aggiunta regola anti-hardcode traduzioni
5. Database `agentConfig` - Prompt aggiornato automaticamente

---

## 🎓 Lezione Appresa

**Quando lavori con LLM**:

1. Sii **ESPLICITO** nei formati di output
2. Mostra **ESEMPI COMPLETI** con dati reali
3. Usa **EMOJI** e **FORMATTING** per chiarezza visiva
4. **RIPETI** la stessa istruzione in più punti se critica
5. **MAI hardcodare** - sempre dal database + LLM traduce

---

**Andrea, il fix è completo! Ora quando aggiungi un prodotto al carrello, l'LLM DEVE sempre mostrare il link.** 🎯
