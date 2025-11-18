# Prompt Variables Reference

**Last Updated**: 2025-11-18  
**Maintainer**: Andrea Gelso  
**Related**: `backend/src/services/prompt-processor.service.ts`

## Overview

This document describes all available variables that can be used in agent prompts. Variables are replaced at runtime with actual customer data, workspace configuration, or dynamic content **BEFORE** sending the prompt to OpenRouter.

**Replacement Location**: `PromptProcessorService.replaceCustomerVariables()` and `PromptProcessorService.preProcessPrompt()`

## Variable Categories

### 👤 Customer Data Variables

Variables related to customer information (from `customers` table):

| Variable           | Type   | Description                    | Example Output        | Source                   |
| ------------------ | ------ | ------------------------------ | --------------------- | ------------------------ |
| `{{nameUser}}`     | String | Customer's name                | `"Mario Rossi"`       | `customers.nome`         |
| `{{email}}`        | String | Customer's email address       | `"mario@example.com"` | `customers.email`        |
| `{{phone}}`        | String | Customer's phone number        | `"+39 123 456 7890"`  | `customers.phone`        |
| `{{telefono}}`     | String | Alias for `{{phone}}`          | `"+39 123 456 7890"`  | `customers.phone`        |
| `{{nome}}`         | String | Alias for `{{nameUser}}`       | `"Mario Rossi"`       | `customers.nome`         |
| `{{discountUser}}` | Number | Customer's discount percentage | `"15"`                | `customers.discountUser` |
| `{{languageUser}}` | String | Customer's language preference | `"ITALIANO"`          | `customers.languageUser` |

**Fallbacks**:

- `{{nameUser}}` / `{{nome}}` → `"Cliente"` if missing
- `{{email}}` / `{{phone}}` → `""` (empty string) if missing
- `{{discountUser}}` → `"0"` if missing
- `{{languageUser}}` → `"ITALIANO"` if missing

---

### 🏢 Workspace Variables

Variables related to workspace configuration:

| Variable            | Type   | Description                 | Example Output               | Source                  |
| ------------------- | ------ | --------------------------- | ---------------------------- | ----------------------- |
| `{{companyName}}`   | String | Company/workspace name      | `"L'Altra Italia"`           | `workspace.companyName` |
| `{{workspaceId}}`   | String | Workspace unique ID         | `"cm9hjgq9v00014qk8..."`     | `workspace.id`          |
| `{{workspaceName}}` | String | Alias for `{{companyName}}` | `"L'Altra Italia"`           | `workspace.companyName` |
| `{{URL}}`           | String | Workspace public URL        | `"https://shop.example.com"` | `workspace.url`         |

**Fallbacks**:

- `{{companyName}}` / `{{workspaceName}}` → `"L'Altra Italia"` if missing

---

### 👨‍💼 Sales Agent Variables

Variables related to assigned sales agent (from `salesAgents` table):

| Variable         | Type   | Description                 | Example Output          | Source              |
| ---------------- | ------ | --------------------------- | ----------------------- | ------------------- |
| `{{agentName}}`  | String | Sales agent's full name     | `"Giovanni Bianchi"`    | `salesAgents.nome`  |
| `{{agentPhone}}` | String | Sales agent's phone number  | `"+39 987 654 3210"`    | `salesAgents.phone` |
| `{{agentEmail}}` | String | Sales agent's email address | `"giovanni@shopme.com"` | `salesAgents.email` |

**Fallbacks**:

- `{{agentName}}` → `"Non assegnato"` if missing
- `{{agentPhone}}` / `{{agentEmail}}` → `"N/A"` if missing

---

### 📦 Order Variables

Variables related to customer's order history:

| Variable            | Type     | Description                 | Example Output      | Source                      |
| ------------------- | -------- | --------------------------- | ------------------- | --------------------------- |
| `{{lastordercode}}` | String   | Most recent order code      | `"ORD-2025-001234"` | `orders.code` (latest)      |
| `{{LAST_ORDER}}`    | Markdown | Complete last order summary | See below           | Database query + formatting |

**`{{LAST_ORDER}}` Format**:

```markdown
📦 ULTIMO ORDINE CONSEGNATO:

- Codice: ORD-2025-001234
- Data: 15/11/2025
- Totale: €45.50

PRODOTTI:

1. Pasta di Gragnano IGP (€8.50 x 2) = €17.00
2. Olio EVO Toscano (€12.00 x 1) = €12.00
```

**Fallbacks**:

- `{{lastordercode}}` → `"N/A"` if no orders
- `{{LAST_ORDER}}` → `"Nessun ordine consegnato disponibile"` if no delivered orders

---

### ⏰ Time Duration Variables

Variables for displaying secure link expiration times:

| Variable             | Type   | Description                         | Example Output             | Source                         |
| -------------------- | ------ | ----------------------------------- | -------------------------- | ------------------------------ |
| `{{TOKEN_DURATION}}` | String | Human-readable link validity period | `"1 hour"`, `"30 minutes"` | `process.env.TOKEN_EXPIRATION` |

**Format Conversion**:

- `"15m"` → `"15 minutes"`
- `"30m"` → `"30 minutes"`
- `"1h"` → `"1 hour"`
- `"2h"` → `"2 hours"`

**Language**: Output is in English. Safety Translation agent translates to customer's language.

**Fallback**: `"15 minutes"` if `TOKEN_EXPIRATION` is missing or invalid format

**Usage**: Use in any prompt mentioning secure links (orders, profile, checkout)

**⚠️ IMPORTANT**: Use `{{TOKEN_DURATION}}` (not `{{TOKEN_EXPIRATION}}` or `{{token_expiration}}`)

---

### 📋 Dynamic Content Variables (Large)

Variables that inject large amounts of data (catalogs, FAQs, etc.):

| Variable         | Type     | Description                | Token Count | Source                      |
| ---------------- | -------- | -------------------------- | ----------- | --------------------------- |
| `{{PRODUCTS}}`   | Markdown | Complete product catalog   | ~50k tokens | Database query + formatting |
| `{{CATEGORIES}}` | Markdown | Product categories list    | ~5k tokens  | Database query + formatting |
| `{{SERVICES}}`   | Markdown | Available services list    | ~3k tokens  | Database query + formatting |
| `{{OFFERS}}`     | Markdown | Active offers/promotions   | ~8k tokens  | Database query + formatting |
| `{{FAQ}}`        | Markdown | Frequently asked questions | ~2k tokens  | Database query + formatting |

**⚠️ CRITICAL CONSTRAINT** (Constitution v1.5.0 Principle III):

- Each large variable (`{{PRODUCTS}}`, `{{OFFERS}}`, `{{SERVICES}}`, `{{CATEGORIES}}`) can appear **AT MOST ONCE** per prompt
- Duplicate usage causes 100k+ token prompts → OpenRouter API failure
- Validation happens in `PromptProcessorService.validatePromptVariables()` before replacement

**Example Valid Usage**:

```markdown
Available products:
{{PRODUCTS}}

Current offers:
{{OFFERS}}
```

**Example INVALID Usage** (duplicate):

```markdown
Top products:
{{PRODUCTS}}

Also check:
{{PRODUCTS}} ❌ ERROR: Variable can only appear once
```

---

### 🔔 Push Notifications Variables

Variables related to push notification consent:

| Variable                         | Type     | Description                  | Example Output               | Source                                 |
| -------------------------------- | -------- | ---------------------------- | ---------------------------- | -------------------------------------- |
| `{{pushNotificationsConsent}}`   | Boolean  | Consent status (true/false)  | `"true"` or `"false"`        | `customers.pushNotificationsConsent`   |
| `{{pushNotificationsConsentAt}}` | ISO Date | Consent timestamp            | `"2025-11-18T10:30:00.000Z"` | `customers.pushNotificationsConsentAt` |
| `{{SUBSCRIBE_MESSAGE}}`          | String   | Push subscription invitation | See below                    | Conditional logic                      |

**`{{SUBSCRIBE_MESSAGE}}` Logic**:

- If `pushNotificationsConsent === true`: Returns `""` (empty string - user already subscribed)
- If `pushNotificationsConsent === false`: Returns invitation message

**Invitation Message**:

```
💡 Want to receive exclusive offers and updates via WhatsApp? Let me know!
```

**Fallbacks**:

- `{{pushNotificationsConsent}}` → `"false"` if missing
- `{{pushNotificationsConsentAt}}` → `"Mai modificato"` if null

---

### 🔀 Conditional Variables (Handlebars-like)

Template control structures for conditional content:

| Syntax                             | Description             | Example                                         |
| ---------------------------------- | ----------------------- | ----------------------------------------------- |
| `{{#if pushNotificationsConsent}}` | Start conditional block | Shows content only if consent is true           |
| `{{else}}`                         | Else clause             | Shows alternative content if condition is false |
| `{{/if}}`                          | End conditional block   | Closes the if statement                         |

**Example Usage**:

```markdown
{{#if pushNotificationsConsent}}
✅ You're subscribed to notifications!
{{else}}
💡 Subscribe to get exclusive offers!
{{/if}}
```

**Note**: These are NOT currently implemented in `PromptProcessorService`. They appear in grep results but may be part of future enhancement or alternative template system.

---

## Replacement Order

Variables are replaced in this sequence (see `PromptProcessorService.preProcessPrompt()`):

1. **Validation**: Check for duplicate large variables (`{{PRODUCTS}}`, `{{OFFERS}}`, etc.)
2. **Workspace URL**: Replace `{{URL}}` with workspace public URL
3. **Customer Data**: Replace all `{{nameUser}}`, `{{email}}`, `{{phone}}`, etc.
4. **Push Subscription**: Replace `{{SUBSCRIBE_MESSAGE}}` based on consent status
5. **Dynamic Content**: Replace `{{FAQ}}`, `{{PRODUCTS}}`, `{{CATEGORIES}}`, `{{SERVICES}}`, `{{OFFERS}}`
6. **Last Order**: Replace `{{LAST_ORDER}}` with formatted order summary

**All replacements happen BEFORE sending prompt to OpenRouter** ✅

---

## Adding New Variables

To add a new variable to the system:

1. **Add to `replaceCustomerVariables()` method** in `PromptProcessorService`:

   ```typescript
   .replace(/\{\{YOUR_VARIABLE\}\}/g, customerData.yourField || "default")
   ```

2. **Document in this file** with:

   - Variable name
   - Type and description
   - Example output
   - Source (database field or env var)
   - Fallback value

3. **Update TypeScript types** if needed:

   ```typescript
   customerData: {
     // ... existing fields
     yourField?: string  // Add new field
   }
   ```

4. **Add unit tests** in `prompt-processor.service.test.ts`:
   ```typescript
   it('should replace {{YOUR_VARIABLE}}', () => {
     const result = service.replaceCustomerVariables(
       "Hello {{YOUR_VARIABLE}}",
       { yourField: "TestValue", ... }
     )
     expect(result).toBe("Hello TestValue")
   })
   ```

---

## Common Mistakes to Avoid

❌ **Using wrong variable names**:

- Use `{{TOKEN_DURATION}}` NOT `{{TOKEN_EXPIRATION}}`
- Use `{{nameUser}}` NOT `{{name}}` or `{{customerName}}`

❌ **Duplicating large variables**:

```markdown
Products: {{PRODUCTS}}
Also: {{PRODUCTS}} ❌ Causes 100k+ token error
```

❌ **Typos in variable names**:

```markdown
{{nmae}} ❌ Won't be replaced (shows as {{nmae}} to customer)
{{nameUser}} ✅ Correct
```

❌ **Using variables not yet in database**:

```markdown
{{customerBirthday}} ❌ Field doesn't exist in customers table
```

---

## Testing Variables

### Manual Testing

1. Edit agent prompt in admin UI (`/agent` page)
2. Add variable: `"Ciao {{nameUser}}, il tuo sconto è {{discountUser}}%"`
3. Test via WhatsApp with real customer
4. Verify replacement happened: `"Ciao Mario Rossi, il tuo sconto è 15%"`

### Unit Testing

```bash
cd backend
npm run test:unit -- prompt-processor.service.test.ts
```

### Debugging

Enable debug mode to see prompt BEFORE and AFTER replacement:

```typescript
// In PromptProcessorService.preProcessPrompt()
logger.debug("PROMPT BEFORE:", promptContent)
logger.debug("PROMPT AFTER:", processedPrompt)
```

Or check debug logs: `backend/logs/prompt-debug-*.txt`

---

## Related Documentation

- **Implementation**: `backend/src/services/prompt-processor.service.ts`
- **Constitution**: `.specify/memory/constitution.md` Principle III (Variable Uniqueness)
- **Feature Spec**: `specs/124-customer-variables-replacement/spec.md`
- **Feature Spec**: `specs/175-token-expiration-variable/spec.md`
- **Multi-Agent Flow**: `docs/architecture/MULTI_AGENT_FLOW.md` Step 4.6

---

## Version History

| Version | Date       | Changes                                          |
| ------- | ---------- | ------------------------------------------------ |
| 1.0     | 2025-11-18 | Initial documentation with all current variables |
