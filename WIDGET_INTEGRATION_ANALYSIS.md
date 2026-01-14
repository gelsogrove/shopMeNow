# 🎯 WIDGET INTEGRATION ANALYSIS - Complete Guide

**Data**: 2025-01-10  
**Focus**: Widget visibility, menu filtering, prompt variables  
**Status**: Action Plan Ready

---

## 📋 INDICE

1. [Problema Principale](#problema-principale)
2. [Architettura Widget Attuale](#architettura-widget-attuale)
3. [Analisi Prompt Variables](#analisi-prompt-variables)
4. [Menu Filtering Strategy](#menu-filtering-strategy)
5. [Action Plan](#action-plan)

---

## PROBLEMA PRINCIPALE

### ❌ Situazione Attuale

Il widget **NON funziona come canale WhatsApp** perché:

1. **No Phone Number**
   - Widget non ha numero WhatsApp
   - Non può registrare utenti permanentemente
   - Dati persi al refresh del browser

2. **No User Registration**
   - Utente anonimo (visitor)
   - No persistent customer record
   - No order history

3. **Visibility Issue**
   - Widget visibile su TUTTI i canali
   - Dovrebbe essere visibile SOLO su canali informativi
   - Canali e-commerce dovrebbero usare SOLO WhatsApp

### ✅ Soluzione Proposta

**Widget = Canale Informativo**
- ✅ Visibile SOLO se `sellProductsAndServices = false`
- ✅ Focalizzato su FAQ e supporto
- ✅ No e-commerce (no cart, no orders)
- ✅ Utente anonimo (visitor tracking)
- ✅ Dati temporanei (24h session)

**E-commerce = WhatsApp Only**
- ✅ Visibile SOLO se `sellProductsAndServices = true`
- ✅ Numero WhatsApp obbligatorio
- ✅ Registrazione cliente permanente
- ✅ Carrello e ordini persistenti

---

## ARCHITETTURA WIDGET ATTUALE

### 📁 File Coinvolti

```
Frontend:
├── pages/WidgetPage.tsx              # Dashboard per embed code
├── pages/WidgetSettingsPage.tsx      # Settings widget
├── pages/WidgetEmbedPage.tsx         # Iframe per widget
└── components/ChatWidget.tsx         # Widget component

Backend:
├── routes/widget.routes.ts           # Widget API endpoints
├── controllers/widget.controller.ts  # Widget logic
└── services/widget.service.ts        # Widget service

Database:
├── Workspace.widgetLogoUrl           # Widget logo
├── Workspace.widgetTitle             # Widget title
├── Workspace.widgetLanguage          # Widget language
├── Workspace.widgetPrimaryColor      # Widget color
└── Workspace.widgetTextColor         # Widget text color
```

### 🔄 Flusso Widget Attuale

```
1. Merchant configura workspace
   ├── sellProductsAndServices = true/false
   ├── widgetLogoUrl
   ├── widgetTitle
   └── widgetLanguage

2. Merchant copia embed code
   └── <script src="/widget.js?workspaceId=..."></script>

3. Merchant incolla su website
   └── Widget appears in bottom-right

4. Visitor apre chat
   ├── Anonimo (no phone)
   ├── Sessione 24h
   └── Dati temporanei

5. Visitor invia messaggio
   ├── Backend riceve messaggio
   ├── LLM Router processa
   └── Risposta inviata
```

### ⚠️ Problemi Identificati

1. **No Channel Type Check**
   - Widget visibile su TUTTI i canali
   - Dovrebbe controllare `sellProductsAndServices`

2. **No Menu Filtering**
   - Sidebar mostra TUTTI i menu items
   - Dovrebbe filtrare in base a channel type

3. **Prompt Variables Incomplete**
   - Mancano variabili importanti nel prompt
   - No bot identity
   - No business info
   - No support escalation

4. **No Visitor Tracking**
   - Visitor ID non persistente
   - No analytics per visitor

---

## ANALISI PROMPT VARIABLES

### 📊 Variabili Attuali nel Prompt

```typescript
// ✅ PRESENTI
- customerName
- customerPhone
- customerEmail
- customerDiscount
- customerIsActive
- languageUser
- agentName
- agentPhone
- agentEmail
- companyName
- channelName
- workspaceUrl
- toneOfVoice
- hasHumanSupport
- hasSalesAgents
- sellProductsAndServices
- products
- categories
- services
- offers
- faqs

// ❌ MANCANTI (Critical for Widget)
- botIdentityResponse        // "Chi sei?" answer
- botName                    // Custom chatbot name
- businessType               // Sector (food, fashion, tech)
- address                    // Physical location
- customAiRules              // Custom LLM rules
- allowedExternalLinks       // Whitelist domains
- humanSupportInstructions   // How to escalate
- operatorContactMethod      // email | whatsapp
- operatorWhatsappNumber     // Support WhatsApp
- websiteUrl                 // Custom domain
- businessHours              // When available
- supportEmail               // Support contact
```

### 🔴 CRITICAL MISSING VARIABLES

#### 1. Bot Identity
```typescript
// MISSING: botIdentityResponse
// SHOULD BE IN PROMPT:
"When customer asks 'Who are you?', respond with:
{{botIdentityResponse}}"

// EXAMPLE:
"I'm Sofia, your AI assistant for BellItalia. 
I can help you with product information, FAQs, and support."
```

#### 2. Bot Name
```typescript
// MISSING: chatbotName (exists in DB but not in prompt)
// SHOULD BE IN PROMPT:
"Your name is: {{chatbotName}}"

// EXAMPLE:
"Your name is: Sofia"
```

#### 3. Business Information
```typescript
// MISSING: businessType, address, websiteUrl
// SHOULD BE IN PROMPT:
"Business Information:
- Type: {{businessType}}
- Address: {{address}}
- Website: {{websiteUrl}}"

// EXAMPLE:
"Business Information:
- Type: Food & Wine
- Address: Via Roma 123, Firenze
- Website: https://bellitalia.com"
```

#### 4. Support Escalation
```typescript
// MISSING: humanSupportInstructions, operatorContactMethod
// SHOULD BE IN PROMPT:
"When customer needs human support:
- Method: {{operatorContactMethod}}
- Instructions: {{humanSupportInstructions}}
- Contact: {{operatorWhatsappNumber}} or {{supportEmail}}"

// EXAMPLE:
"When customer needs human support:
- Method: whatsapp
- Instructions: Click the 'Talk to operator' button
- Contact: +39 123 456 7890"
```

#### 5. Allowed External Links
```typescript
// MISSING: allowedExternalLinks
// SHOULD BE IN PROMPT:
"You can link to these external domains:
{{allowedExternalLinks}}"

// EXAMPLE:
"You can link to these external domains:
- bellitalia.com
- instagram.com/bellitalia
- facebook.com/bellitalia"
```

#### 6. Custom AI Rules
```typescript
// PRESENT but not prioritized
// SHOULD BE FIRST in prompt:
"🔴 CUSTOM AI RULES (ABSOLUTE PRIORITY):
{{customAiRules}}"

// EXAMPLE:
"🔴 CUSTOM AI RULES (ABSOLUTE PRIORITY):
- Always mention our wine selection
- Promote the 'Chianti Collection' offer
- Never discuss competitors
- Always be friendly and use Italian expressions"
```

---

## MENU FILTERING STRATEGY

### 🎯 Current Sidebar Structure

```typescript
// apps/frontend/src/components/Sidebar.tsx (hypothetical)
const menuItems = [
  { label: 'Chat', path: '/chat', icon: 'MessageCircle' },
  { label: 'Products', path: '/products', icon: 'Package' },
  { label: 'Categories', path: '/categories', icon: 'Layers' },
  { label: 'Services', path: '/services', icon: 'Briefcase' },
  { label: 'Orders', path: '/admin/orders', icon: 'ShoppingCart' },
  { label: 'Customers', path: '/clients', icon: 'Users' },
  { label: 'Offers', path: '/offers', icon: 'Gift' },
  { label: 'Campaigns', path: '/campaigns', icon: 'Megaphone' },
  { label: 'FAQ', path: '/faq', icon: 'HelpCircle' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
]
```

### ❌ Problem: No Filtering

Tutti i menu items visibili per TUTTI i canali.

### ✅ Solution: Filter by `sellProductsAndServices`

```typescript
// E-COMMERCE CHANNEL (sellProductsAndServices = true)
const ecommerceMenuItems = [
  { label: 'Chat', path: '/chat' },
  { label: 'Products', path: '/products' },           // ✅ SHOW
  { label: 'Categories', path: '/categories' },       // ✅ SHOW
  { label: 'Services', path: '/services' },           // ✅ SHOW
  { label: 'Orders', path: '/admin/orders' },         // ✅ SHOW
  { label: 'Customers', path: '/clients' },           // ✅ SHOW
  { label: 'Offers', path: '/offers' },               // ✅ SHOW
  { label: 'Campaigns', path: '/campaigns' },         // ✅ SHOW
  { label: 'FAQ', path: '/faq' },                     // ✅ SHOW
  { label: 'Settings', path: '/settings' },           // ✅ SHOW
]

// INFORMATIONAL CHANNEL (sellProductsAndServices = false)
const informationalMenuItems = [
  { label: 'Chat', path: '/chat' },                   // ✅ SHOW
  { label: 'Products', path: '/products' },           // ❌ HIDE
  { label: 'Categories', path: '/categories' },       // ❌ HIDE
  { label: 'Services', path: '/services' },           // ❌ HIDE
  { label: 'Orders', path: '/admin/orders' },         // ❌ HIDE
  { label: 'Customers', path: '/clients' },           // ❌ HIDE
  { label: 'Offers', path: '/offers' },               // ❌ HIDE
  { label: 'Campaigns', path: '/campaigns' },         // ❌ HIDE
  { label: 'FAQ', path: '/faq' },                     // ✅ SHOW
  { label: 'Settings', path: '/settings' },           // ✅ SHOW
]
```

### 🔧 Implementation

```typescript
// apps/frontend/src/components/Sidebar.tsx

import { useWorkspace } from '@/hooks/use-workspace'

export function Sidebar() {
  const { workspace } = useWorkspace()
  
  // Filter menu items based on channel type
  const getMenuItems = () => {
    const baseItems = [
      { label: 'Chat', path: '/chat', icon: 'MessageCircle' },
      { label: 'Settings', path: '/settings', icon: 'Settings' },
    ]
    
    // E-commerce items (only if sellProductsAndServices = true)
    const ecommerceItems = [
      { label: 'Products', path: '/products', icon: 'Package' },
      { label: 'Categories', path: '/categories', icon: 'Layers' },
      { label: 'Services', path: '/services', icon: 'Briefcase' },
      { label: 'Orders', path: '/admin/orders', icon: 'ShoppingCart' },
      { label: 'Customers', path: '/clients', icon: 'Users' },
      { label: 'Offers', path: '/offers', icon: 'Gift' },
      { label: 'Campaigns', path: '/campaigns', icon: 'Megaphone' },
    ]
    
    // Informational items (always shown)
    const infoItems = [
      { label: 'FAQ', path: '/faq', icon: 'HelpCircle' },
    ]
    
    // Build menu based on channel type
    const items = [...baseItems]
    
    if (workspace?.sellProductsAndServices) {
      items.splice(1, 0, ...ecommerceItems) // Insert before Settings
    }
    
    items.splice(items.length - 1, 0, ...infoItems) // Insert before Settings
    
    return items
  }
  
  const menuItems = getMenuItems()
  
  return (
    <nav className="space-y-2">
      {menuItems.map(item => (
        <NavLink key={item.path} to={item.path}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
```

---

## WIDGET VISIBILITY STRATEGY

### 🎯 Widget Should Only Show on Informational Channels

```typescript
// apps/frontend/src/components/WidgetLoader.tsx

import { useWorkspace } from '@/hooks/use-workspace'

export function WidgetLoader() {
  const { workspace } = useWorkspace()
  
  // ✅ Show widget ONLY on informational channels
  if (workspace?.sellProductsAndServices === true) {
    return null // Hide widget on e-commerce channels
  }
  
  return (
    <ChatWidget
      workspaceId={workspace?.id}
      title={workspace?.widgetTitle}
      logoUrl={workspace?.widgetLogoUrl}
      primaryColor={workspace?.widgetPrimaryColor}
      language={workspace?.widgetLanguage}
    />
  )
}
```

### 🎯 Widget Embed Code Should Check Channel Type

```typescript
// apps/backend/src/routes/widget.routes.ts

router.get('/workspaces/:workspaceId/widget/embed-code', async (req, res) => {
  const { workspaceId } = req.params
  
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      sellProductsAndServices: true,
      widgetLogoUrl: true,
      widgetTitle: true,
      widgetLanguage: true,
      widgetPrimaryColor: true,
    },
  })
  
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' })
  }
  
  // ❌ BLOCK: Widget not available for e-commerce channels
  if (workspace.sellProductsAndServices === true) {
    return res.status(403).json({
      error: 'Widget is only available for informational channels',
      message: 'Use WhatsApp for e-commerce channels',
    })
  }
  
  // ✅ Generate embed code
  const embedCode = `
<script>
  window.eChatbotConfig = {
    workspaceId: '${workspace.id}',
    title: '${workspace.widgetTitle || workspace.name}',
    logoUrl: '${workspace.widgetLogoUrl || '/logo.png'}',
    primaryColor: '${workspace.widgetPrimaryColor || '#22c55e'}',
    language: '${workspace.widgetLanguage || 'it'}',
  };
  
  (function() {
    const script = document.createElement('script');
    script.src = 'https://echatbot.ai/widget.js';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>
  `.trim()
  
  res.json({ embedCode })
})
```

---

## ACTION PLAN

### 🔴 PRIORITY 1: Fix Prompt Variables (2-3 hours)

#### Task 1.1: Add Missing Variables to PromptVariableBuilder

```typescript
// apps/backend/src/application/services/prompt-variable-builder.service.ts

// ADD to PromptVariables interface:
interface PromptVariables {
  // ... existing variables ...
  
  // 🆕 MISSING VARIABLES
  botIdentityResponse: string        // "Who are you?" answer
  chatbotName: string                // Custom bot name
  businessType: string               // Sector (food, fashion, tech)
  address: string                    // Physical location
  customAiRules: string              // Custom LLM rules
  allowedExternalLinks: string       // Whitelist domains (newline-separated)
  humanSupportInstructions: string   // How to escalate
  operatorContactMethod: string      // email | whatsapp
  operatorWhatsappNumber: string     // Support WhatsApp
  websiteUrl: string                 // Custom domain
  supportEmail: string               // Support contact
}

// ADD to build() method:
static build(
  customer: CustomerInput | null,
  workspace: WorkspaceInput | null,
  dynamicContent?: DynamicContentInput,
  context?: ContextInput,
  options?: BuildOptions
): PromptVariables {
  const variables: PromptVariables = {
    // ... existing variables ...
    
    // 🆕 NEW VARIABLES
    botIdentityResponse: workspace?.botIdentityResponse || '',
    chatbotName: workspace?.chatbotName || 'Assistant',
    businessType: workspace?.businessType || 'general',
    address: workspace?.address || '',
    customAiRules: workspace?.customAiRules || '',
    allowedExternalLinks: workspace?.allowedExternalLinks?.join('\n') || '',
    humanSupportInstructions: workspace?.humanSupportInstructions || '',
    operatorContactMethod: workspace?.operatorContactMethod || 'email',
    operatorWhatsappNumber: workspace?.operatorWhatsappNumber || '',
    websiteUrl: workspace?.websiteUrl || workspace?.url || '',
    supportEmail: workspace?.notificationEmail || '',
  }
  
  return variables
}
```

#### Task 1.2: Update Router Agent Prompt Template

```markdown
# docs/prompts/router-agent.md

## Bot Identity
Your name is: **{{chatbotName}}**

When customer asks "Who are you?" or "Chi sei?", respond with:
{{botIdentityResponse}}

## Business Information
- **Company**: {{companyName}}
- **Type**: {{businessType}}
- **Address**: {{address}}
- **Website**: {{websiteUrl}}

## Support & Escalation
When customer needs human support:
- **Method**: {{operatorContactMethod}}
- **Instructions**: {{humanSupportInstructions}}
- **WhatsApp**: {{operatorWhatsappNumber}}
- **Email**: {{supportEmail}}

## Allowed External Links
You can link to these domains:
{{allowedExternalLinks}}

## Custom AI Rules (ABSOLUTE PRIORITY)
{{customAiRules}}

---
[rest of prompt...]
```

### 🟠 PRIORITY 2: Menu Filtering (1-2 hours)

#### Task 2.1: Create Menu Filter Hook

```typescript
// apps/frontend/src/hooks/use-menu-items.ts

import { useWorkspace } from './use-workspace'

export interface MenuItem {
  label: string
  path: string
  icon: string
  requiresEcommerce?: boolean
}

export function useMenuItems(): MenuItem[] {
  const { workspace } = useWorkspace()
  
  const allItems: MenuItem[] = [
    { label: 'Chat', path: '/chat', icon: 'MessageCircle' },
    { label: 'Products', path: '/products', icon: 'Package', requiresEcommerce: true },
    { label: 'Categories', path: '/categories', icon: 'Layers', requiresEcommerce: true },
    { label: 'Services', path: '/services', icon: 'Briefcase', requiresEcommerce: true },
    { label: 'Orders', path: '/admin/orders', icon: 'ShoppingCart', requiresEcommerce: true },
    { label: 'Customers', path: '/clients', icon: 'Users', requiresEcommerce: true },
    { label: 'Offers', path: '/offers', icon: 'Gift', requiresEcommerce: true },
    { label: 'Campaigns', path: '/campaigns', icon: 'Megaphone', requiresEcommerce: true },
    { label: 'FAQ', path: '/faq', icon: 'HelpCircle' },
    { label: 'Settings', path: '/settings', icon: 'Settings' },
  ]
  
  // Filter based on channel type
  return allItems.filter(item => {
    if (item.requiresEcommerce && !workspace?.sellProductsAndServices) {
      return false
    }
    return true
  })
}
```

#### Task 2.2: Update Sidebar Component

```typescript
// apps/frontend/src/components/Sidebar.tsx

import { useMenuItems } from '@/hooks/use-menu-items'

export function Sidebar() {
  const menuItems = useMenuItems()
  
  return (
    <nav className="space-y-2">
      {menuItems.map(item => (
        <NavLink key={item.path} to={item.path}>
          <Icon name={item.icon} className="w-4 h-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

### 🟡 PRIORITY 3: Widget Visibility (1 hour)

#### Task 3.1: Update WidgetLoader Component

```typescript
// apps/frontend/src/components/WidgetLoader.tsx

import { useWorkspace } from '@/hooks/use-workspace'
import { ChatWidget } from './ChatWidget'

export function WidgetLoader() {
  const { workspace } = useWorkspace()
  
  // ✅ Show widget ONLY on informational channels
  if (!workspace || workspace.sellProductsAndServices === true) {
    return null
  }
  
  return (
    <ChatWidget
      workspaceId={workspace.id}
      title={workspace.widgetTitle || workspace.name}
      logoUrl={workspace.widgetLogoUrl}
      primaryColor={workspace.widgetPrimaryColor}
      language={workspace.widgetLanguage}
    />
  )
}
```

#### Task 3.2: Update Widget Embed Code Endpoint

```typescript
// apps/backend/src/routes/widget.routes.ts

router.get('/workspaces/:workspaceId/widget/embed-code', async (req, res) => {
  const { workspaceId } = req.params
  
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      sellProductsAndServices: true,
      widgetLogoUrl: true,
      widgetTitle: true,
      widgetLanguage: true,
      widgetPrimaryColor: true,
    },
  })
  
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' })
  }
  
  // ❌ BLOCK: Widget not available for e-commerce channels
  if (workspace.sellProductsAndServices === true) {
    return res.status(403).json({
      error: 'Widget is only available for informational channels',
      message: 'Use WhatsApp for e-commerce channels',
    })
  }
  
  // ✅ Generate embed code
  const embedCode = `<script>
  window.eChatbotConfig = {
    workspaceId: '${workspace.id}',
    title: '${workspace.widgetTitle || workspace.name}',
    logoUrl: '${workspace.widgetLogoUrl || '/logo.png'}',
    primaryColor: '${workspace.widgetPrimaryColor || '#22c55e'}',
    language: '${workspace.widgetLanguage || 'it'}',
  };
  (function() {
    const script = document.createElement('script');
    script.src = 'https://echatbot.ai/widget.js';
    script.async = true;
    document.body.appendChild(script);
  })();
</script>`
  
  res.json({ embedCode })
})
```

### 🟢 PRIORITY 4: Widget Prompt Enhancement (2-3 hours)

#### Task 4.1: Update Widget Agent Prompt

```markdown
# docs/prompts/widget-agent.md

## Widget-Specific Instructions

You are {{chatbotName}}, an AI assistant for {{companyName}}.

### Your Identity
{{botIdentityResponse}}

### Business Context
- **Company**: {{companyName}}
- **Type**: {{businessType}}
- **Location**: {{address}}
- **Website**: {{websiteUrl}}

### Your Capabilities
- Answer FAQ questions
- Provide product/service information
- Escalate to human support when needed
- Respond in {{languageUser}}

### Support Escalation
When customer needs human support:
1. Acknowledge their request
2. Provide contact method: {{operatorContactMethod}}
3. If WhatsApp: "Contact us at {{operatorWhatsappNumber}}"
4. If Email: "Email us at {{supportEmail}}"
5. Instructions: {{humanSupportInstructions}}

### Allowed External Links
You can link to:
{{allowedExternalLinks}}

### Custom Rules (ABSOLUTE PRIORITY)
{{customAiRules}}

---
[rest of prompt...]
```

---

## 📊 SUMMARY TABLE

| Aspetto | Attuale | Proposto | Priorità |
|---------|---------|----------|----------|
| **Widget Visibility** | Sempre visibile | Solo canali informativi | 🔴 P1 |
| **Menu Filtering** | No filtering | Filtra per channel type | 🟠 P2 |
| **Bot Identity** | Mancante | Aggiunto al prompt | 🔴 P1 |
| **Bot Name** | In DB, non in prompt | Aggiunto al prompt | 🔴 P1 |
| **Business Info** | Parziale | Completo (type, address, website) | 🔴 P1 |
| **Support Escalation** | Mancante | Aggiunto al prompt | 🔴 P1 |
| **External Links** | Mancante | Aggiunto al prompt | 🟡 P3 |
| **Custom AI Rules** | Presente | Prioritizzato (ZERO SECTION) | 🔴 P1 |

---

## 🎯 EXPECTED OUTCOMES

### After Implementation

✅ **Widget Visibility**
- Widget appears ONLY on informational channels
- E-commerce channels use WhatsApp only
- Clear separation of concerns

✅ **Menu Filtering**
- E-commerce menu: Products, Orders, Customers, Offers, Campaigns
- Informational menu: FAQ, Support only
- No confusion for users

✅ **Prompt Enhancement**
- Bot identity clear ("I'm Sofia...")
- Business context provided
- Support escalation instructions
- Custom rules respected

✅ **User Experience**
- Informational channel users get FAQ + support
- E-commerce channel users get WhatsApp + orders
- No mixed signals

---

## 🚀 NEXT STEPS

1. **Implement Priority 1** (Prompt Variables) - 2-3 hours
2. **Implement Priority 2** (Menu Filtering) - 1-2 hours
3. **Implement Priority 3** (Widget Visibility) - 1 hour
4. **Implement Priority 4** (Prompt Enhancement) - 2-3 hours
5. **Test** - 2-3 hours
6. **Deploy** - 1 hour

**Total Effort**: ~10-12 hours (~1.5 working days)

---

**Fine Analisi** - Ready for implementation
