# 199 - Add Channel Wizard

## Overview

Implementazione di un wizard multi-step per la creazione di nuovi canali WhatsApp Business. Il wizard guida l'utente attraverso la configurazione completa del canale con un'interfaccia moderna e intuitiva.

## UI/UX

### Layout
- **Popup modale**: 1200px larghezza, altezza auto (max 90vh)
- **Sidebar sinistra** (340px): Lista step con navigazione cliccabile
  - Step completati: cliccabili per tornare indietro
  - Step corrente: evidenziato
  - Step futuri: disabilitati (non cliccabili)
- **Area destra**: Contenuto dello step corrente
- **Branding WhatsApp**: Sidebar verde (#25D366) con logo WhatsApp

### Navigazione
- Pulsanti "Back" e "Next" in fondo
- Click diretto sui tab della sidebar per step già visitati
- Pulsante X per chiudere

## Steps del Wizard

### Step 1: Channel Details
- **WhatsApp Number** (required): Numero telefono del canale
- **Business Name** (required): Nome identificativo del canale
- **Admin Email** (required): Email amministratore
- **Website URL** (optional): Sito web aziendale

### Step 2: E-commerce
Domanda: "Sell products/services on WhatsApp?"

Opzioni (checkbox multiple):
- ☑️ **Products**: Vendita prodotti fisici/digitali
- ☑️ **Services**: Vendita servizi
- ☐ **Support only**: Solo supporto clienti (no vendita)

Se "Support only" selezionato → disabilita Products e Services

### Step 3: Sales Team (Condizionale)
**Visibile solo se**: sellsProducts OR sellsServices

Domanda: "Do you have sales agents?"
- **Yes**: Enable agent assignment
- **No**: No sales team management

### Step 4: Human Support
Domanda: "Can customers request to speak with a human?"
- **Yes**: Customers can request human support
- **No**: Bot only, no human handoff

### Step 5: Contact Method (Condizionale)
**Visibile solo se**: hasHumanSupport = true

Domanda: "How should customers contact an operator?"
- **Email**: Operator will be notified via email
- **WhatsApp**: Direct WhatsApp contact

Se hasSalesAgents = true → Mostra info: "Requests will be forwarded to the assigned sales agent's contact (email or WhatsApp)"

Se hasSalesAgents = false AND operatorContactMethod = 'whatsapp' → Mostra campo per inserire numero WhatsApp operatore

### Step 6: Tone of Voice
Opzioni (selezione singola):
- 😊 **Friendly**: Warm, approachable, uses emojis (DEFAULT)
- 💼 **Professional**: Polite, business-like, clear
- 🎩 **Formal**: Respectful, traditional, courteous
- ✌️ **Casual**: Relaxed, conversational, fun

Preview dinamico del tono selezionato

### Step 7: Bot Identity
Campo testo per la risposta del bot quando il cliente chiede "Chi sei?"

Placeholder suggerito con esempio personalizzato

### Step 8: FAQs
Lista di 4 FAQ di default:
1. "How is my privacy protected?"
2. "What are the delivery times?"
3. "How can I repeat a previous order?"
4. "What payment methods do you accept?"

Funzionalità:
- Modifica domanda e risposta per ogni FAQ
- Elimina FAQ esistenti
- Aggiungi nuove FAQ
- Tip: "You can edit these FAQs anytime in the Settings page"

## Dati del Form

```typescript
interface WizardFormData {
  // Step 1: Channel Details
  whatsappNumber: string
  alias: string
  email: string
  website: string
  
  // Step 2: E-commerce
  sellsProducts: boolean
  sellsServices: boolean
  
  // Step 3: Sales Agents
  hasSalesAgents: boolean
  
  // Step 4: Human Support
  hasHumanSupport: boolean
  humanSupportInstructions: string
  operatorContactMethod: 'email' | 'whatsapp'
  operatorWhatsappNumber: string
  
  // Step 5: Tone of Voice
  toneOfVoice: 'formal' | 'friendly' | 'professional' | 'casual'
  
  // Step 6: Bot Identity
  botIdentityResponse: string
  
  // Step 7: FAQs
  faqs: Array<{ question: string; answer: string }>
}
```

## Valori Default

```typescript
const initialWizardData: WizardFormData = {
  whatsappNumber: "",
  alias: "",
  email: "", // Pre-filled with logged user email
  website: "",
  sellsProducts: true,
  sellsServices: true,
  hasSalesAgents: false,
  hasHumanSupport: true,
  humanSupportInstructions: "",
  operatorContactMethod: 'email',
  operatorWhatsappNumber: "",
  toneOfVoice: 'friendly',
  botIdentityResponse: "",
  faqs: [
    { question: "How is my privacy protected?", answer: "" },
    { question: "What are the delivery times?", answer: "" },
    { question: "How can I repeat a previous order?", answer: "" },
    { question: "What payment methods do you accept?", answer: "" },
  ],
}
```

## Logica Condizionale degli Step

```typescript
const getVisibleSteps = () => {
  return WIZARD_STEPS.filter(step => {
    // Step 3 (Sales Team): visible only if selling products OR services
    if (step.id === 3) {
      return wizardData.sellsProducts || wizardData.sellsServices
    }
    // Step 5 (Contact Method): visible only if human support enabled
    if (step.id === 5) {
      return wizardData.hasHumanSupport
    }
    return true
  })
}
```

## File Modificati

- `apps/frontend/src/pages/WorkspaceSelectionPage.tsx`
  - Aggiunto wizard multi-step
  - Interfaccia WizardFormData
  - Logica navigazione condizionale
  - UI responsive con sidebar

## Dipendenze

- Lucide React icons: Smartphone, Store, Users, Headphones, Mail, MessageSquare, Bot, HelpCircle, Trash2, Plus, Check, ChevronRight, ChevronLeft, X, Briefcase
- shadcn/ui: Button, Input, Label, Textarea, Sheet components

## Note Implementative

1. **Workspace Isolation**: Il canale creato sarà associato al workspace corrente
2. **Validazione**: Campi required validati prima di procedere
3. **Accessibilità**: Tab cliccabili per navigazione rapida
4. **Responsive**: Layout adattivo per diverse dimensioni schermo

## TODO Backend

- [ ] API per salvare configurazione wizard
- [ ] Mapping dati wizard → tabelle database (workspace, agentConfig, etc.)
- [ ] Validazione server-side dei dati

## Changelog

### 2024-12-09
- Creato wizard 8 step con navigazione condizionale
- Rimosso campo Logo (non necessario in fase di creazione)
- Rimosso step Availability Hours (configurabile dopo in Settings)
- Rimosso step Welcome Message (ridondante con Bot Identity)
- Aggiunta navigazione cliccabile sui tab sidebar
- Aggiunto supporto per Products + Services nel step E-commerce
- Split Human Support in 2 step (YES/NO + Contact Method)
- Rimossa scrollbar interna FAQs
