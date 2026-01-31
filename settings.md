lk# 🔧 Settings Page - Architettura e Decisioni

**Data**: 30 Gennaio 2026  
**Status**: 🔄 IN PROGRESS (Decisioni in corso)

---

## 📋 Titolo
**Settings** (o Dashboard Configurazione?)

## 📝 Sottotitolo
"Personalizza il tuo chatbot e gestisci le impostazioni del canale"

## 🎯 Scopo
Centralizzare TUTTE le configurazioni del workspace in un'unica pagina modulare con:
- ✅ Performance (carica solo sezione selezionata)
- ✅ Intuitività (menu a tendina/tab per navigare)
- ✅ Bellezza grafica (design coerente con resto app)
- ✅ Logica semplice (no confusione tra sezioni)

---

## 🎨 Struttura Menu Principale

### ✅ DECISIONE FINALE: DROPDOWN (come profilo)

Menu a tendina che si apre dal Settings, esattamente come il profilo in alto a destra:
```
┌──────────────────────────────────┐
│ Settings                         │ ← Button che apre menu
├──────────────────────────────────┤
│ 1. AI Personality                │
│ 2. Channel Status / Business Cfg │
│ 3. Channels Configuration        │
│ 4. AI Configuration              │
│ 5. Security                      │
│ 6. Support                       │
└──────────────────────────────────┘
```

### 📋 Le 6 Sezioni:

### 📋 Le 6 Sezioni Finali:

#### 1️⃣ **AI Personality** 
Campo singolo, fuori dai menu dropdown (o in un tab dedicato)
- `botName` (input) - "Sofia", "Rosa", etc
- `botDescription` (textarea) - Bio del bot
- `toneOfVoice` (select) - Formale/Amichevole/Tech/Creativo

---

#### 2️⃣ **Channel Status / Business Configuration**
- `workspaceName` (input)
- `adminEmail` (email)
- `timezone` (select)
- `businessHours` (time picker)
- `businessType` (select) - Retail, Restaurant, etc
- `currency` (select)
- `logo` (image upload + crop)

---

#### 3️⃣ **Channels Configuration**
**Sottosezioni (tabs/accordion):**

**WhatsApp:**
- Phone number (display/edit)
- API Key (password, show/hide toggle)
- App Secret (password)
- Phone Number ID
- Verify Token
- Webhook URL (display + copy button)
- Channel enabled toggle

**Widget:**
- Widget title (input)
- Primary color (color picker)
- Language (select)
- Icon choice (visual grid selector)
- Embed code (readonly + copy button)
- Widget enabled toggle

**Grafica & Branding:**
- Primary color
- Secondary color
- Font family (select)
- Theme (light/dark toggle)
- Custom CSS (optional textarea)

---

#### 4️⃣ **AI Configuration**
- `promptCustom` (textarea large)
- `systemInstructions` (textarea)
- `supportedLanguages` (multi-select)
- **Variabili disponibili** (info box sotto con variabili diverse per ecommerce/widget)

---

#### 5️⃣ **E-Commerce Configuration** 
*(visible only if `workspace.sellsProductsAndServices === true`)*

- `taxRate` (number input + %) - Tassa/IVA
- `shippingCost` (currency input) - Costo spedizione default
- `shippingMethod` (select) - Flat/Weight-based/Free
- `defaultProductCategory` (select) - Categoria default per nuovi prodotti
- `paymentMethods` (multi-select) - Metodi pagamento supportati
- `returnPolicy` (textarea) - Politica reso
- `cancellationPolicy` (textarea) - Politica cancellazione
- `minOrderAmount` (currency input) - Ordine minimo
- `autoConfirmOrders` (toggle) - Conferma automatica ordini
- `orderNotificationEmail` (email) - Email notifiche ordini

---

#### 6️⃣ **Security**
- Team members list (table with edit/delete)
- Add team member button → modal
- Role assignment (Owner/Admin/Editor)
- 2FA enable/disable
- API keys list (with regenerate button)
- Session management (active sessions list, logout all)

---

#### 7️⃣ **Support**
- Support webhook URL (input + test button)
- Support email (input)
- Escalation trigger (select - credits threshold, waiting time, etc)
- Ticket system integration (future)
- Support hours (time picker)

---

## ✅ DECISIONI FINALI

✅ **Menu Navigation** → **DROPDOWN** (come profilo)  
✅ **Grafica/Branding** → **Channels Configuration**  
✅ **Widget Embed Code** → **Channels Configuration**  
✅ **E-Commerce Config** → **SEZIONE SEPARATA** (se `sellsProductsAndServices === true`)  
❌ **PayPal** → Non attualmente nel sistema  
✅ **Variabili custom** → **AI Configuration** (box sotto textarea - diverse per ecommerce/widget)  
✅ **Orari di lavoro/Timezone** → **Business Configuration**  

---

### 4️⃣ AI Configuration

**Campi:**
- `promptCustom` (textarea grande)
- `systemInstructions` (textarea)
- `supportedLanguages` (multi-select)

**Variabili Disponibili** (box informativo sotto textarea):
```
⚠️ VARIABILI DIVERSE PER CANALE:

TUTTI:
- {{chatbotName}}
- {{businessName}}
- {{supportEmail}}

WHATSAPP + ECOMMERCE:
- {{products}}
- {{offers}}
- {{services}}
- {{categories}}

WIDGET ONLY:
- {{faqContent}}
- {{businessHours}}

CUSTOMIZE TUA AZIENDA:
- {{customVar1}}, {{customVar2}}...
```

---

## 🎨 STRATEGIA REDESIGN

**Obiettivo**: Mantenere logica funzionante + migliore grafica + Help per ogni campo

### 📐 Layout Proposto (per ogni sezione)

```
┌──────────────────────────────────────────────────────┐
│ Settings                          ▼ Dropdown Menu    │
└──────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  SEZIONE SELEZIONATA (es. "AI Personality")            │
│  ═══════════════════════════════════════               │
│                                                         │
│  Campo 1: Bot Name                                     │
│  ┌──────────────────────┐  ┌─────────────────────────┐│
│  │ [Sofia]              │  │ ? Help: Nome del tuo    ││
│  └──────────────────────┘  │   chatbot. I clienti lo││
│                            │   vedranno. Min 3 char.││
│                            └─────────────────────────┘│
│                                                         │
│  Campo 2: Bot Description                              │
│  ┌──────────────────────┐  ┌─────────────────────────┐│
│  │ [textarea...]        │  │ ? Help: Breve biografia││
│  │ [...]                │  │   del bot. Es: "Sono   ││
│  └──────────────────────┘  │   Sofia, l'assistente" ││
│                            └─────────────────────────┘│
│                                                         │
│  [SAVE]  [CANCEL]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 🎯 Componenti Chiave

**1. Dropdown Menu (Responsive)**
```typescript
<SettingsDropdown>
  ├─ AI Personality
  ├─ Channel Status / Business Configuration
  ├─ Channels Configuration
  ├─ AI Configuration
  ├─ E-Commerce Configuration (conditional)
  ├─ Security
  └─ Support
</SettingsDropdown>
```

**2. Form Wrapper (Riusabile)**
```typescript
<SettingsForm section={activeSection}>
  ├─ Titolo sezione + descrizione breve
  ├─ Campo 1
  │  ├─ Input/Select/Textarea
  │  └─ Help Tooltip/Sidebar
  ├─ Campo 2
  │  ├─ Input/Select/Textarea
  │  └─ Help Tooltip/Sidebar
  └─ Actions (Save, Cancel, Reset)
</SettingsForm>
```

**3. Help System**
```
OPZIONE A: Inline Help (accanto al campo)
┌─────────────┐  ┌──────────────────┐
│ Input field │  │ ? Help text here │
└─────────────┘  └──────────────────┘

OPZIONE B: Sidebar Help (destro)
┌──────────────────┐  ┌────────────────┐
│ Tutti i campi    │  │ Help per campo │
│ Input fields     │  │ selezionato    │
└──────────────────┘  └────────────────┘

OPZIONE C: Tooltip (hover)
┌──────────────────┐
│ Input field  [?] │  ← Hover mostra help
└──────────────────┘
```

---

## 🔄 Logica Implementazione

### Frontend Changes
```
PRIMA (attuale):
- Tutti i campi in una pagina
- Sidebar fisso
- Logica mista e confusa

DOPO (proposto):
- Dropdown menu (reusabile - come profilo)
- Form modularizzati per sezione
- Ogni sezione = componente separate
- Help system integrato
- Layout pulito e intuitivo
```

**Componenti da creare:**
```typescript
// Riusabile per tutte le sezioni
<SettingsDropdown />       // Menu a tendina
<SettingsForm />            // Form wrapper
<HelpTooltip />             // Help per campo
<SettingsField />           // Field wrapper (input + help)

// Specifici per sezione
<AIPersonalitySection />
<BusinessConfigSection />
<ChannelsConfigSection />
<AIConfigSection />
<ECommerceConfigSection /> // conditional
<SecuritySection />
<SupportSection />
```

---

### Backend Changes
```
PRIMA:
- Endpoint: PUT /api/workspaces/:workspaceId
- Accetta TUTTI i campi insieme

DOPO:
- Endpoint per sezione (modular, focused):
  - PUT /api/workspaces/:workspaceId/ai-personality
  - PUT /api/workspaces/:workspaceId/business-config
  - PUT /api/workspaces/:workspaceId/channels-config
  - PUT /api/workspaces/:workspaceId/ai-config
  - PUT /api/workspaces/:workspaceId/ecommerce-config
  - PUT /api/workspaces/:workspaceId/security
  - PUT /api/workspaces/:workspaceId/support
```

**Vantaggi:**
- ✅ Ogni endpoint ha solo i campi rilevanti
- ✅ Validation specifico per sezione
- ✅ Error handling granulare
- ✅ Logica separata e testabile
- ✅ Facile da debuggare

---

## ✅ DECISIONI FINALI

### Q1: Help System → **B) SIDEBAR** (pannello destro)
```
┌──────────────────────┐  ┌────────────────────┐
│ Sezione Campi        │  │ Help per campo     │
│                      │  │ selezionato        │
│ [Campo 1]            │  │ (aggiorna quando   │
│ [Campo 2]            │  │  cambi focus)      │
│ [Campo 3]            │  │                    │
│ [SAVE] [CANCEL]      │  │                    │
└──────────────────────┘  └────────────────────┘
```

### Q2: Form Save → **A) SAVE PER SEZIONE**
- Ogni sezione ha bottone [SAVE] proprio
- Salva solo i campi di quella sezione
- Feedback: toast di successo/errore

### Q3: Grafica → **UGUALE A WorkspaceSelectionPage**
- Stessi colori (green, gray)
- Stesso spacing e typography
- Stesse card styles e shadows
- Stessi button styles
- Stessa animazione hover
- **Copiare stile da**: `/apps/frontend/src/pages/WorkspaceSelectionPage.tsx`

### Q4: Validations → **A) REAL-TIME**
- Errori mostrati mentre scrivi
- Verde checkmark quando OK
- Rosso X quando errore
- Messaggio di errore sotto il campo

---

## 🚀 PIANO IMPLEMENTAZIONE

### FASE 1: Setup FE Components (2-3 giorni)
```
Creazione componenti base:
├─ SettingsDropdown (menu a tendina)
├─ SettingsLayout (layout sidebar + main)
├─ SettingsForm (form wrapper base)
├─ SettingsField (field wrapper con help)
├─ HelpPanel (sidebar help)
└─ Stili (seguire WorkspaceSelectionPage)
```

### FASE 2: Sezioni FE (4-5 giorni)
```
Creare 7 sezioni separate:
├─ AIPersonalitySection
├─ BusinessConfigSection
├─ ChannelsConfigSection
├─ AIConfigSection
├─ ECommerceConfigSection (conditional)
├─ SecuritySection
└─ SupportSection
```

### FASE 3: Setup BE Endpoints (2-3 giorni)
```
Creare 7 endpoint modulari:
├─ PUT /api/workspaces/:id/ai-personality
├─ PUT /api/workspaces/:id/business-config
├─ PUT /api/workspaces/:id/channels-config
├─ PUT /api/workspaces/:id/ai-config
├─ PUT /api/workspaces/:id/ecommerce-config
├─ PUT /api/workspaces/:id/security
└─ PUT /api/workspaces/:id/support
```

### FASE 4: Validations & Tests (2-3 giorni)
```
Unit tests per:
├─ Field validation (real-time)
├─ Form submission
├─ Error handling
├─ API integration
└─ Conditional rendering (E-Commerce)
```

---

## 📝 Help Text per ogni Campo

*(Da aggiungere in HelpPanel - una volta che creiamo le sezioni)*

**AI Personality:**
- `botName`: "Nome che i clienti vedono. Minimo 3 caratteri."
- `botDescription`: "Breve presentazione del bot (es: 'Sono Sofia, l'assistente')"
- `toneOfVoice`: "Come il bot comunica: formale, amichevole, tecnico, creativo"

**Business Configuration:**
- `workspaceName`: "Nome del tuo workspace"
- `timezone`: "Fuso orario per orari di lavoro e report"
- `businessHours`: "Orari operativi del tuo business"
- `currency`: "Valuta per prezzi e transazioni"

*... (da completare per ogni campo)*

---

## 📊 Stato FINALE

| Componente | Status | Note |
|-----------|--------|------|
| Architettura | ✅ DONE | 7 sezioni + dropdown + sidebar help |
| Grafica | ✅ DONE | Come WorkspaceSelectionPage |
| Help System | ✅ DONE | Sidebar pannello destro |
| Save Strategy | ✅ DONE | Per sezione con bottone Save |
| Validations | ✅ DONE | Real-time |
| FE Components | ✅ IN PROGRESS | Start FASE 1 |
| BE Endpoints | ⏳ TODO | Start FASE 3 |
| Tests | ⏳ TODO | Start FASE 4 |

---

## ✅ DECISIONI FINALI - FASE 1 Ready

1. **Help Panel**: Mostra help del **PRIMO field di default** (es. "Personalità AI"). Quando clicca altro field → panel si aggiorna. ✓ User-friendly, non vuoto all'apertura.

2. **Real-time validation**: **onBlur + debounce 500ms** mentre digita:
   - Errori critici (email format) appaiono quasi subito
   - Errori semplici non disturbano mentre l'utente scrive
   - Feedback non troppo aggressivo

3. **E-Commerce toggle**: Nel **Business Config**. Durante wizard di creazione workspace chiedere "Vendi prodotti/servizi?" per pre-compilare.

4. **Caricamento dati**: **Una singola API call** che ritorna tutto il workspace. Carica in background, mostra UI + skeleton loading. Utente vede form pronto, dati si popolarano mentre legge.

5. **Unsaved changes**: **Smart compare**. Save button attivo finché **ALMENO 1 campo ≠ originale**. Se campo A viene modificato poi riportato al valore iniziale, ma campo B è ancora diverso → Save rimane attivo. Si disabilita SOLO quando TUTTI i campi ritornano ai valori iniziali.

---

## ✅ FASE 1 COMPLETATA - FE Base Components

### Componenti Creati:

1. **SettingsDropdown** (`src/components/settings/SettingsDropdown.tsx`)
   - Menu a tendina come il profile
   - Props: `sections`, `currentSection`, `onSectionChange`
   - Visivamente coerente con WorkspaceSelectionPage

2. **SettingsField** (`src/components/settings/SettingsField.tsx`)
   - Wrapper per ogni campo (input, select, textarea, etc)
   - Mostra label, errori, helpText
   - Props: `label`, `id`, `error`, `helpText`, `required`

3. **HelpPanel** (`src/components/settings/HelpPanel.tsx`)
   - Sidebar destra con help per il campo selezionato
   - Mostra: titolo, descrizione, esempi, suggerimenti
   - Styled grigio con yellow per tips

4. **SettingsLayout** (`src/components/settings/SettingsLayout.tsx`)
   - Layout 2-colonne: form (2/3) + help panel (1/3)
   - Responsive: mobile = 1 colonna
   - Help panel sticky (top: 1.5rem)

5. **SettingsForm** (`src/components/settings/SettingsForm.tsx`)
   - Form wrapper che gestisce state (values, errors, touched)
   - Smart dirty detection (rileva ≥1 campo ≠ originale)
   - Handlers: `handleChange`, `handleBlur`, `setFieldError`, `resetForm`, `submitForm`
   - Props: `initialValues`, `onSubmit`, `children` (render props)

6. **useDebounce hook** (`src/hooks/useDebounce.ts`)
   - Utility per debounce di funzioni (500ms di default)
   - Utile per validazione real-time

### Export index.ts:
Creato `src/components/settings/index.ts` per import clean

---

## ✅ FASE 2 COMPLETATA - 7 Section Components

### Componenti di Sezione Creati:

1. **AIPersonalitySection** - Nome, Bio, Tono di Voce del chatbot
2. **BusinessConfigSection** - Nome azienda, Email, Sito, Toggle E-Commerce e Supporto Umano
3. **ChannelsConfigSection** - WhatsApp, Widget, Colore, Stato canale
4. **AIConfigSection** - System Prompt, Max Tokens, Temperature
5. **EcommerceSection** - Descrizione catalogo, Prodotti per pagina, Prezzi, Ricerca, Spedizione (condizionale)
6. **SecuritySection** - Auto-blocco, Rate limit, IP whitelist, Crittografia, 2FA
7. **SupportSection** - Email, Telefono, Tempi risposta, Orari, FAQ

### Caratteristiche implementate:
✅ Ogni sezione ha field-specific help panel (titolo, descrizione, esempi, tips)
✅ Real-time validation con debounce 500ms
✅ Left border highlight quando field è selezionato
✅ Smart dirty detection
✅ Conditional rendering (es. IP whitelist solo se abilitato)
✅ Visual indicators (colore preview per widget color, character count per textarea)
✅ Warning/Info boxes in sezioni critiche (E-Commerce, Security)

### ✅ FASE 3 COMPLETATA - SettingsPage.tsx Refactored

**New SettingsPage architecture:**
- ✅ Dropdown menu per navigare tra 7 sezioni
- ✅ Integrato SettingsForm (state management + form logic)
- ✅ Integrato SettingsLayout (form + sidebar help)
- ✅ Per-section components (7 componenti specializzate)
- ✅ Real-time validation con custom VALIDATION_RULES
- ✅ Smart dirty detection (save attivo se ≥1 campo ≠ originale)
- ✅ Conditional rendering (E-Commerce section solo se enabled)
- ✅ Loading state con skeleton
- ✅ Permission check (isOwner/isSuperAdmin)

**File changes:**
- ✅ Backup created: `SettingsPage.tsx.bak` (original 1667 lines)
- ✅ New file: `SettingsPage.tsx` (388 lines - modular + clean)
- ✅ Build: ✓ built in 5.09s (success)

### Prossimi Step:
- ⏳ FASE 4: Backend endpoints (7 PUT modular per le sezioni)
- ⏳ FASE 5: Tests + validazione

