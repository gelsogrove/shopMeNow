# Analisi Architettura LLM - Widget vs WhatsApp

## ✅ DECISIONI FINALI (11 Gennaio 2026)

| # | Domanda | Decisione |
|---|---------|-----------|
| 1 | Coda | ✅ **UNIFICATA** (MessageQueue con campo `channel`) |
| 2 | Widget risposta | ✅ **POLLING** (ogni 500ms, max 30 tentativi = 15 sec) |
| 3 | Chat storico | ✅ **ISOLATE** (chat separate per canale, carrello/ordini condivisi) |

---

## 📊 STATO ATTUALE (PROBLEMA)

### Widget (OGGI - NO Security Check)
```
Widget → Backend (LLMRouterService) → Risposta DIRETTA
         ❌ Nessun Security Check
         ❌ Nessun passaggio Scheduler
```

### WhatsApp (OGGI - OK)
```
WhatsApp → Backend → CODA → Scheduler → Security Check → WhatsApp API
                            ✅ Security Check
                            ✅ Pattern detection
```

---

## 🎯 ARCHITETTURA FUTURA

### Flusso Unificato
```
┌─────────────────────────────────────────────────────────────┐
│              MESSAGGIO (Widget O WhatsApp)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│  1. LLMRouterService genera risposta                        │
│  2. Mette in MessageQueue con:                              │
│     - channel: "widget" o "whatsapp"                        │
│     - phoneNumber: (solo whatsapp)                          │
│     - visitorId: (solo widget)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SCHEDULER                               │
│  1. Prende messaggi (status: pending)                       │
│  2. ✅ SECURITY CHECK (uguale per tutti)                    │
│  3. Se channel="whatsapp":                                  │
│     → Invia a WhatsApp API                                  │
│     → status: "sent"                                        │
│  4. Se channel="widget":                                    │
│     → NON fa nulla, solo marca                              │
│     → status: "ready"                                       │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
    WhatsApp API                           Widget Polling
    (push al telefono)               (GET /widget/poll/:id)
```

---

## 📋 PIANO IMPLEMENTAZIONE

### FASE 1: Database Migration
```prisma
model WhatsAppQueue {  // O rinomina in MessageQueue
  ...
  channel     String    // "whatsapp" | "widget" - NUOVO!
  phoneNumber String?   // Nullable (NULL per widget)
  visitorId   String?   // NUOVO! (NULL per whatsapp)
  ...
}

model ChatSession {
  ...
  channel     String    @default("whatsapp") // NUOVO!
  ...
}
```

### FASE 2: Backend Changes
- Widget endpoint mette in coda con `channel: "widget"`
- Nuovo endpoint `GET /api/v1/widget/poll/:messageId`

### FASE 3: Scheduler Changes
- Logica delivery diversa per channel

### FASE 4: Widget Changes  
- Polling per risposte (500ms x 30 = 15 sec max)
- Typing indicator durante attesa

### FASE 5: Supporto Markdown Widget
- Bold, italic, link, immagini

---

## 🎯 PROSSIMI PASSI

Quando vuoi procedere, iniziamo dalla **FASE 1** (Database Migration).
