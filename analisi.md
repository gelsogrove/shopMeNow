# 📊 ANALISI WIDGET & PROMPT VARIABLES

**Data**: 2025-01-10  
**Scope**: Widget integration, menu filtering, prompt enhancement  
**Status**: Action Ready

---

## 🎯 OBIETTIVO

Integrare il widget come **canale informativo** (no e-commerce) con:
- ✅ Visibilità SOLO su canali informativi (`sellProductsAndServices = false`)
- ✅ Menu filtering basato su channel type
- ✅ Prompt variables complete (bot identity, business info, support escalation)
- ✅ Separazione netta: Widget = FAQ/Support, WhatsApp = E-commerce

---

## 🔴 PROBLEMA ATTUALE

### Widget Non Funziona Come WhatsApp

| Aspetto | WhatsApp | Widget | Problema |
|---------|----------|--------|----------|
| **Phone** | ✅ Numero fisso | ❌ No | No persistent ID |
| **Registration** | ✅ Permanente | ❌ Anonimo | Dati persi al refresh |
| **Session** | ✅ Persistente | ❌ 24h temp | No order history |
| **E-commerce** | ✅ Carrello, ordini | ❌ No | Non adatto |
| **FAQ/Support** | ⚠️ Possibile | ✅ Ideale | Perfetto per info |

### Soluzione: Separare i Canali

```
CANALE E-COMMERCE (sellProductsAndServices = true)
├── Visibilità: WhatsApp SOLO
├── Menu: Products, Orders, Customers, Offers, Campaigns
├── Widget: ❌ NASCOSTO
└── Funzionalità: Carrello, ordini, pagamenti

CANALE INFORMATIVO (sellProductsAndServices = false)
├── Visibilità: Widget SOLO
├── Menu: FAQ, Support SOLO
├── Widget: ✅ VISIBILE
└── Funzionalità: FAQ, escalation, info
```

---

## 📋 VARIABILI MANCANTI NEL PROMPT

### ❌ Attualmente Mancanti

```typescript
// MANCANTI nel PromptVariableBuilder:
- botIdentityResponse      // "Chi sei?" answer
- chatbotName              // Nome custom bot
- businessType             // Settore (food, fashion, tech)
- address                  // Indirizzo fisico
- customAiRules            // Regole custom LLM
- allowedExternalLinks     // Domini whitelist
- humanSupportInstructions // Come escalare
- operatorContactMethod    // email | whatsapp
- operatorWhatsappNumber   // WhatsApp support
- websiteUrl               // Dominio custom
- supportEmail             // Email support
```

### ✅ Dove Sono nel DB

```typescript
// Workspace model (schema.prisma)
Workspace {
  botIdentityResponse: String?           // ✅ Esiste
  chatbotName: String?                   // ✅ Esiste
  businessType: String?                  // ✅ Esiste
  address: String?                       // ✅ Esiste
  customAiRules: String?                 // ✅ Esiste
  allowedExternalLinks: String[]         // ✅ Esiste
  humanSupportInstructions: String?      // ✅ Esiste
  operatorContactMethod: String?         // ✅ Esiste
  operatorWhatsappNumber: String?        // ✅ Esiste
  websiteUrl: String?                    // ✅ Esiste
  notificationEmail: String?             // ✅ Esiste (supportEmail)
}
```

### 🔧 Cosa Fare

**File**: `apps/backend/src/application/services/prompt-variable-builder.service.ts`

```typescript
// AGGIUNGERE a PromptVariables interface:
interface PromptVariables {
  // ... existing ...
  botIdentityResponse: string
  chatbotName: string
  businessType: string
  address: string
  customAiRules: string
  allowedExternalLinks: string
  humanSupportInstructions: string
  operatorContactMethod: string
  operatorWhatsappNumber: string
  websiteUrl: string
  supportEmail: string
}

// AGGIUNGERE a build() method:
static build(...): PromptVariables {
  const variables: PromptVariables = {
    // ... existing ...
    botIdentityResponse: workspace?.botIdentityResponse || '',
    chatbotName: workspace?.chatbotName || 'Assistant',
    businessType: workspace?.businessType || '',
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

---

## 🎨 MENU FILTERING

### Attuale: Nessun Filtering

```typescript
// Tutti vedono TUTTI i menu items
const menuItems = [
  'Chat', 'Products', 'Categories', 'Services', 'Orders',
  'Customers', 'Offers', 'Campaigns', 'FAQ', 'Settings'
]
```

### Proposto: Filtrare per Channel Type

```typescript
// E-COMMERCE (sellProductsAndServices = true)
const ecommerceMenu = [
  'Chat',
  'Products',        // ✅ SHOW
  'Categories',      // ✅ SHOW
  'Services',        // ✅ SHOW
  'Orders',          // ✅ SHOW
  'Customers',       // ✅ SHOW
  'Offers',          // ✅ SHOW
  'Campaigns',       // ✅ SHOW
  'FAQ',             // ✅ SHOW
  'Settings'
]

// INFORMATIONAL (sellProductsAndServices = false)
const informationalMenu = [
  'Chat',
  'FAQ',             // ✅ SHOW
  'Settings'
]
```

### 🔧 Cosa Fare

**File**: `apps/frontend/src/hooks/use-menu-items.ts` (NEW)

```typescript
import { useWorkspace } from './use-workspace'

export function useMenuItems() {
  const { workspace } = useWorkspace()
  
  const allItems = [
    { label: 'Chat', path: '/chat', requiresEcommerce: false },
    { label: 'Products', path: '/products', requiresEcommerce: true },
    { label: 'Categories', path: '/categories', requiresEcommerce: true },
    { label: 'Services', path: '/services', requiresEcommerce: true },
    { label: 'Orders', path: '/admin/orders', requiresEcommerce: true },
    { label: 'Customers', path: '/clients', requiresEcommerce: true },
    { label: 'Offers', path: '/offers', requiresEcommerce: true },
    { label: 'Campaigns', path: '/campaigns', requiresEcommerce: true },
    { label: 'FAQ', path: '/faq', requiresEcommerce: false },
    { label: 'Settings', path: '/settings', requiresEcommerce: false },
  ]
  
  return allItems.filter(item => {
    if (item.requiresEcommerce && !workspace?.sellProductsAndServices) {
      return false
    }
    return true
  })
}
```

**File**: `apps/frontend/src/components/Sidebar.tsx` (UPDATE)

```typescript
import { useMenuItems } from '@/hooks/use-menu-items'

export function Sidebar() {
  const menuItems = useMenuItems()
  
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

## 🎯 WIDGET VISIBILITY

### Attuale: Sempre Visibile

```typescript
// Widget appare su TUTTI i canali
export function WidgetLoader() {
  return <ChatWidget /> // ❌ Sempre
}
```

### Proposto: Solo Canali Informativi

```typescript
// Widget appare SOLO se sellProductsAndServices = false
export function WidgetLoader() {
  const { workspace } = useWorkspace()
  
  if (workspace?.sellProductsAndServices === true) {
    return null // ❌ Nascondi su e-commerce
  }
  
  return <ChatWidget /> // ✅ Mostra su informational
}
```

### 🔧 Cosa Fare

**File**: `apps/frontend/src/components/WidgetLoader.tsx` (UPDATE)

```typescript
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

**File**: `apps/backend/src/routes/widget.routes.ts` (UPDATE)

```typescript
router.get('/workspaces/:workspaceId/widget/embed-code', async (req, res) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.workspaceId },
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
  
  // ❌ BLOCK: Widget not for e-commerce
  if (workspace.sellProductsAndServices === true) {
    return res.status(403).json({
      error: 'Widget only for informational channels',
      message: 'Use WhatsApp for e-commerce',
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

---

## 📝 PROMPT ENHANCEMENT

### Attuale: Incompleto

```markdown
# Router Agent Prompt
You are an AI assistant for {{companyName}}.
Help customers with products, orders, and support.
```

### Proposto: Completo

```markdown
# Router Agent Prompt

## Bot Identity
Your name is: **{{chatbotName}}**

When asked "Who are you?", respond with:
{{botIdentityResponse}}

## Business Context
- **Company**: {{companyName}}
- **Type**: {{businessType}}
- **Address**: {{address}}
- **Website**: {{websiteUrl}}

## Your Capabilities
- Answer FAQ questions
- Provide information
- Escalate to support
- Respond in {{languageUser}}

## Support Escalation
When customer needs help:
- **Method**: {{operatorContactMethod}}
- **WhatsApp**: {{operatorWhatsappNumber}}
- **Email**: {{supportEmail}}
- **Instructions**: {{humanSupportInstructions}}

## Allowed External Links
{{allowedExternalLinks}}

## Custom Rules (PRIORITY)
{{customAiRules}}

---
[rest of prompt...]
```

### 🔧 Cosa Fare

**File**: `docs/prompts/router-agent.md` (UPDATE)

Aggiungere le nuove variabili nel template.

---

## 📊 SUMMARY

| Task | File | Tipo | Effort |
|------|------|------|--------|
| Add prompt variables | `prompt-variable-builder.service.ts` | Backend | 30min |
| Update prompt template | `docs/prompts/router-agent.md` | Docs | 20min |
| Create menu hook | `use-menu-items.ts` | Frontend | 20min |
| Update sidebar | `Sidebar.tsx` | Frontend | 15min |
| Update widget loader | `WidgetLoader.tsx` | Frontend | 15min |
| Update widget endpoint | `widget.routes.ts` | Backend | 20min |
| **TOTAL** | | | **2 hours** |

---

## 🚀 IMPLEMENTATION ORDER

1. **Backend - Prompt Variables** (30min)
   - Add missing variables to PromptVariableBuilder
   - Update build() method

2. **Backend - Widget Endpoint** (20min)
   - Add channel type check
   - Block e-commerce channels

3. **Frontend - Menu Hook** (20min)
   - Create use-menu-items.ts
   - Filter by requiresEcommerce

4. **Frontend - Sidebar** (15min)
   - Use new hook
   - Remove hardcoded items

5. **Frontend - Widget Loader** (15min)
   - Check sellProductsAndServices
   - Hide on e-commerce

6. **Docs - Prompt Template** (20min)
   - Add new variables
   - Update examples

---

## ✅ EXPECTED RESULTS

### Before
- ❌ Widget visibile su tutti i canali
- ❌ Menu items non filtrati
- ❌ Prompt variables incomplete
- ❌ Bot identity non nel prompt

### After
- ✅ Widget SOLO su canali informativi
- ✅ Menu items filtrati per channel type
- ✅ Prompt variables complete
- ✅ Bot identity, business info, support escalation nel prompt

---

**Fine Analisi** - Ready for implementation
