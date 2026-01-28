# 🧪 TEST PROMPT VARIABLES REPLACE

**Obiettivo**: Verificare che tutte le variabili definite vengano sostituite correttamente nei template.

---

## 📋 Variabili da Testare

### ✅ Implementate nel PromptVariableBuilder

```typescript
// CUSTOMER VARIABLES
customerName: ✅
customerPhone: ✅  
customerEmail: ✅
customerDiscount: ✅
customerIsActive: ✅
languageUser: ✅
pushNotificationsConsent: ✅

// SALES AGENT VARIABLES  
agentName: ✅
agentPhone: ✅
agentEmail: ✅

// WORKSPACE VARIABLES
companyName: ✅
botIdentityResponse: ✅
customAiRules: ✅
address: ✅
adminEmail: ✅
channelName: ✅
workspaceUrl: ✅
toneOfVoice: ✅
hasHumanSupport: ✅
humanSupportInstructions: ✅
hasSalesAgents: ✅
sellsProductsAndServices: ✅
allowedExternalLinks: ✅
chatbotName: ✅
businessType: ✅
operatorContactMethod: ✅
operatorWhatsappNumber: ✅
websiteUrl: ✅
supportEmail: ✅

// DYNAMIC CONTENT
products: ✅
categories: ✅
services: ✅
offers: ✅
faqs: ✅

// CONTEXT VARIABLES
lastOrderCode: ✅
cartContents: ✅
tokenDuration: ✅
channel: ✅
```

---

## 🧪 Test Script

```typescript
// test-prompt-variables.ts

import { PromptVariableBuilder } from '../src/application/services/prompt-variable-builder.service'
import { PromptVariables } from '../src/types/prompt-variables.types'

/**
 * Test template con TUTTE le variabili
 */
const TEST_TEMPLATE = `
# Test Template

## Customer Info
- Name: {{customerName}}
- Phone: {{customerPhone}}
- Email: {{customerEmail}}
- Discount: {{customerDiscount}}%
- Active: {{customerIsActive}}
- Language: {{languageUser}}
- Push Consent: {{pushNotificationsConsent}}

## Sales Agent
- Agent: {{agentName}}
- Phone: {{agentPhone}}
- Email: {{agentEmail}}

## Company Info
- Company: {{companyName}}
- Bot Identity: {{botIdentityResponse}}
- Custom Rules: {{customAiRules}}
- Address: {{address}}
- Admin Email: {{adminEmail}}
- Channel: {{channelName}}
- URL: {{workspaceUrl}}
- Tone: {{toneOfVoice}}
- Human Support: {{hasHumanSupport}}
- Support Instructions: {{humanSupportInstructions}}
- Sales Agents: {{hasSalesAgents}}
- E-commerce: {{sellsProductsAndServices}}
- External Links: {{allowedExternalLinks}}
- Bot Name: {{chatbotName}}
- Business Type: {{businessType}}
- Contact Method: {{operatorContactMethod}}
- Operator WhatsApp: {{operatorWhatsappNumber}}
- Website: {{websiteUrl}}
- Support Email: {{supportEmail}}

## Dynamic Content
- Products: {{products}}
- Categories: {{categories}}
- Services: {{services}}
- Offers: {{offers}}
- FAQs: {{faqs}}

## Context
- Last Order: {{lastOrderCode}}
- Cart: {{cartContents}}
- Token Duration: {{tokenDuration}}
- Channel Type: {{channel}}
`

/**
 * Mock data per test
 */
const MOCK_CUSTOMER = {
  id: 'cust_123',
  name: 'Mario Rossi',
  email: 'mario@example.com',
  phone: '+39 123 456 7890',
  discount: 10,
  isActive: true,
  language: 'it',
  company: 'Acme Corp',
  push_notifications_consent: true,
  sales: {
    firstName: 'Giulia',
    lastName: 'Bianchi',
    phone: '+39 987 654 3210',
    email: 'giulia@example.com',
  },
}

const MOCK_WORKSPACE = {
  id: 'ws_123',
  name: 'BellItalia Shop',
  url: 'https://bellitalia.com',
  language: 'it',
  toneOfVoice: 'friendly',
  botIdentityResponse: 'Sono Sofia, assistente AI di BellItalia',
  hasHumanSupport: true,
  humanSupportInstructions: 'Contatta il supporto per problemi complessi',
  operatorContactMethod: 'whatsapp',
  operatorWhatsappNumber: '+39 123 456 7890',
  hasSalesAgents: true,
  notificationEmail: 'support@bellitalia.com',
  allowedExternalLinks: ['bellitalia.com', 'instagram.com/bellitalia'],
  sellsProductsAndServices: true,
  address: 'Via Roma 123, Firenze',
  customAiRules: 'Sempre menzionare la collezione Chianti',
  chatbotName: 'Sofia',
  businessType: 'food',
  websiteUrl: 'https://bellitalia.com',
}

const MOCK_DYNAMIC_CONTENT = {
  products: 'Chianti Classico - €25, Pecorino Romano - €15',
  categories: 'Vini, Formaggi, Salumi',
  services: 'Degustazione, Consulenza',
  offers: 'Sconto 20% su vini - fino al 31/12',
  faqs: 'Q: Spedite in tutta Italia? A: Sì, spediamo ovunque',
}

const MOCK_CONTEXT = {
  lastOrderCode: 'ORD-2024-001',
  cartContents: '2x Chianti Classico, 1x Pecorino Romano',
  channelName: 'WhatsApp BellItalia',
  channel: 'whatsapp',
}

/**
 * Test function
 */
function testPromptVariables() {
  console.log('🧪 Testing Prompt Variables Replace...\n')
  
  // 1. Build variables
  const variables = PromptVariableBuilder.build(
    MOCK_CUSTOMER,
    MOCK_WORKSPACE,
    MOCK_DYNAMIC_CONTENT,
    MOCK_CONTEXT,
    { skipValidation: false }
  )
  
  console.log('📦 Built variables:', Object.keys(variables).length)
  
  // 2. Simple replace function (simulate preProcessPrompt)
  function replaceVariables(template: string, vars: PromptVariables): string {
    let result = template
    
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = `{{${key}}}`
      const replacement = value?.toString() || ''
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement)
    }
    
    return result
  }
  
  // 3. Replace variables
  const processed = replaceVariables(TEST_TEMPLATE, variables)
  
  // 4. Check for unreplaced variables
  const unreplacedMatches = processed.match(/\{\{[^}]+\}\}/g)
  
  if (unreplacedMatches) {
    console.log('❌ UNREPLACED VARIABLES FOUND:')
    unreplacedMatches.forEach(match => {
      console.log(`   ${match}`)
    })
    console.log('\n📋 Missing variables in PromptVariableBuilder!')
  } else {
    console.log('✅ ALL VARIABLES REPLACED SUCCESSFULLY!')
  }
  
  // 5. Show sample output
  console.log('\n📄 SAMPLE OUTPUT:')
  console.log('─'.repeat(50))
  console.log(processed.substring(0, 500) + '...')
  console.log('─'.repeat(50))
  
  // 6. Variable summary
  console.log('\n📊 VARIABLE SUMMARY:')
  console.log(`   Total defined: ${Object.keys(variables).length}`)
  console.log(`   Unreplaced: ${unreplacedMatches?.length || 0}`)
  console.log(`   Success rate: ${((Object.keys(variables).length - (unreplacedMatches?.length || 0)) / Object.keys(variables).length * 100).toFixed(1)}%`)
  
  return {
    success: !unreplacedMatches,
    totalVariables: Object.keys(variables).length,
    unreplacedCount: unreplacedMatches?.length || 0,
    unreplacedVariables: unreplacedMatches || [],
    variables,
    processedTemplate: processed,
  }
}

// Run test
if (require.main === module) {
  testPromptVariables()
}

export { testPromptVariables, TEST_TEMPLATE, MOCK_CUSTOMER, MOCK_WORKSPACE }
```

---

## 🚀 Come Eseguire il Test

```bash
# Nel backend
cd apps/backend

# Crea il file test
# Copia il codice sopra in: src/__tests__/prompt-variables.test.ts

# Esegui il test
npm run test src/__tests__/prompt-variables.test.ts

# O esegui direttamente
npx ts-node src/__tests__/prompt-variables.test.ts
```

---

## 📊 Output Atteso

```
🧪 Testing Prompt Variables Replace...

📦 Built variables: 32
✅ ALL VARIABLES REPLACED SUCCESSFULLY!

📄 SAMPLE OUTPUT:
──────────────────────────────────────────────────
# Test Template

## Customer Info
- Name: Mario Rossi
- Phone: +39 123 456 7890
- Email: mario@example.com
- Discount: 10%
- Active: true
- Language: ITALIANO
...
──────────────────────────────────────────────────

📊 VARIABLE SUMMARY:
   Total defined: 32
   Unreplaced: 0
   Success rate: 100.0%
```

---

## ❌ Se Ci Sono Problemi

```
❌ UNREPLACED VARIABLES FOUND:
   {{someVariable}}
   {{anotherVariable}}

📋 Missing variables in PromptVariableBuilder!
```

**Soluzione**: Aggiungere le variabili mancanti al `build()` method.

---

Vuoi che creo questo test file? 🧪