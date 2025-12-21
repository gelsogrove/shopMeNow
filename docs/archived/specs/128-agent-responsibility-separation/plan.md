# Implementation Plan: Agent Responsibility Separation

**Feature ID**: 128  
**Created**: 2025-11-17  
**Estimated Duration**: 3 days  
**Complexity**: High (Critical Architecture Refactoring)

---

## 🎯 Overview

This plan implements a complete refactoring of the LLM agent architecture to enforce strict separation of responsibilities per Constitution Principle XIII. The Router Agent will be stripped to pure orchestration + context interpretation, while new specialist agents (FAQ, Profile) handle domain-specific logic.

**Key Changes**:

1. Router Agent → Pure orchestration + context interpretation (2k tokens, temp 0.2)
2. FAQ Agent → Handles general questions (NEW)
3. Profile Agent → Manages subscriptions/preferences (NEW)
4. Product & Services Agent → Adds {{OFFERS}} variable
5. Universal Context Interpretation Pattern → Router builds explicit messages for all confirmations

---

## 🏗️ Architecture

### Current State (BEFORE)

```
Router Agent (8k tokens, temp 0.3):
├── {{OFFERS}} ❌ (should be in Product Agent)
├── {{FAQ}} ✅ (will move to FAQ Agent)
├── manageNotifications CF ❌ (will move to Profile Agent)
├── Routing logic ✅ (stays)
└── Conversation history ✅ (stays)
```

### Target State (AFTER)

```
Router Agent (2k tokens, temp 0.2):
├── Routing logic ✅
├── Context interpretation ✅ (NEW - builds explicit messages)
└── Conversation history ✅

FAQ Agent (3k tokens, temp 0.3) - NEW:
├── {{FAQ}}
└── Zero CF (text responses only)

Profile Agent (4k tokens, temp 0.5) - NEW:
├── {{isSubscribed}} (NEW DB field)
├── handlePushNotification(value) CF
└── Manages subscriptions/preferences

Product & Services Agent (existing, expanded):
├── {{PRODUCTS}}
├── {{SERVICES}}
├── {{CATEGORIES}}
└── {{OFFERS}} ✅ (MOVED from Router)

Cart Management Agent (existing)
Order Tracking Agent (existing)
Customer Support Agent (existing)
```

---

## 📋 Implementation Phases

### Phase 1: Constitution & Database Schema (Day 1, 4 hours)

**Goal**: Update constitution rules and prepare database for new fields

#### 1.1 Constitution Update

- **File**: `.specify/memory/constitution.md`
- **Changes**:
  - Add Principle XIV: "Router Context Interpretation Pattern"
  - Update Principle XIII: Add FAQ Agent, Profile Agent to matrix
  - Document universal confirmation pattern
  - Version bump: 2.0.0 → 2.1.0 (MINOR)

#### 1.2 Database Migration

- **File**: `backend/prisma/schema.prisma`
- **Changes**:
  - Add `isSubscribed Boolean @default(false)` to Customer model
  - Add `FAQ_AGENT` and `PROFILE_AGENT` to AgentType enum
- **Migration**: `npx prisma migrate dev --name add-profile-agent-fields`
- **Generate**: `npx prisma generate`

#### 1.3 Seed Data Update

- **File**: `backend/prisma/data/workspaceSettings.ts`
- **Changes**: Set existing customers `isSubscribed: false`

**Deliverables**:

- [ ] Constitution v2.1.0 with Principle XIV
- [ ] Migration applied successfully
- [ ] Seed updated with isSubscribed defaults

---

### Phase 2: FAQ Agent Creation (Day 1, 4 hours)

**Goal**: Create standalone FAQ Agent for general questions

#### 2.1 Update Prisma Schema (AgentType Enum)

- **File**: `backend/prisma/schema.prisma`
- **Add**:
  ```prisma
  enum AgentType {
    ROUTER
    PRODUCT_SEARCH
    CART_MANAGEMENT
    ORDER_TRACKING
    CUSTOMER_SUPPORT
    FAQ_AGENT        // ← NEW
    PROFILE_AGENT    // ← NEW (added here too for Phase 3)
  }
  ```
- **Migration**: `npx prisma migrate dev --name add-faq-profile-agent-types`
- **Generate**: `npx prisma generate`

#### 2.2 FAQ Agent Prompt

- **File**: `docs/prompts/faq-agent.md` (NEW)
- **Content**:

  ```markdown
  # FAQ Agent - eChatbot

  ## YOUR ROLE

  You answer general questions about the workspace using FAQ database.

  ## VARIABLES

  {{FAQ}} - All FAQ questions/answers from database
  {{nameUser}} - Customer name
  {{languageUser}} - Customer language

  ## CALLING FUNCTIONS

  NONE - You provide text responses only

  ## INSTRUCTIONS

  1. Check if customer question matches FAQ
  2. If match: Return FAQ answer (will be translated automatically)
  3. If no match: "I don't have specific info on that. Contact our support team!"
  4. Be concise, friendly, professional
  5. NEVER invent information not in {{FAQ}}

  ## EXAMPLES

  User: "What are your opening hours?"
  You: "We're open Monday-Friday 9AM-6PM, Saturday 10AM-4PM. Closed Sundays."

  User: "Do you ship internationally?"
  You: "Yes! We ship worldwide. Shipping costs vary by destination."

  User: "What's the refund policy?" (not in FAQ)
  You: "I don't have specific info on that. Contact our support team for refund policies!"
  ```

#### 2.3 FAQ Agent LLM Class

- **File**: `backend/src/application/agents/FAQAgentLLM.ts` (NEW)
- **Pattern**: Similar to `ProductSearchAgentLLM.ts`
- **Logic**:

  ```typescript
  export class FAQAgentLLM {
    constructor(private prisma: PrismaClient) {}

    async handleQuery(params: {
      workspaceId: string
      customerId: string
      query: string
    }): Promise<{ response: string; tokensUsed: number }> {
      // 1. Load FAQ Agent config from DB (type = FAQ_AGENT)
      const agentConfig = await this.prisma.agentConfig.findFirst({
        where: { workspaceId, type: "FAQ_AGENT", isActive: true },
      })

      // 2. Load customer data for variables
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      })

      // 3. Replace variables in prompt
      const processedPrompt = await this.promptProcessor.replaceAllVariables(
        agentConfig.systemPrompt,
        workspaceId,
        customerId,
        customer.language
      )

      // 4. Call OpenRouter (NO function calling - text only)
      const llmResponse = await this.callOpenRouter({
        systemPrompt: processedPrompt,
        userMessage: query,
        temperature: agentConfig.temperature,
        model: agentConfig.model,
      })

      // 5. Return response (will be translated by SafetyTranslationAgent)
      return {
        response: llmResponse.content,
        tokensUsed: llmResponse.usage.total_tokens,
      }
    }
  }
  ```

#### 2.4 Export FAQ Agent in Index

- **File**: `backend/src/application/agents/index.ts`
- **Add**:
  ```typescript
  export { FAQAgentLLM } from "./FAQAgentLLM"
  ```

#### 2.5 Router Delegation Logic

- **File**: `backend/src/config/agent-functions.ts`
- **Add**:
  ```typescript
  {
    name: "faqAgent",
    description: "Handles general questions using FAQ database. Use for: hours, contact info, policies, shipping, payment methods, etc.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer's FAQ question (can be short answer confirmation after context interpretation)"
        }
      },
      required: ["query"]
    }
  }
  ```

#### 2.6 LLM Router Service - Handle FAQ Delegation

- **File**: `backend/src/services/llm-router.service.ts`
- **Add** in function call handling:

  ```typescript
  case "faqAgent":
    const faqAgentLLM = new FAQAgentLLM(this.prisma)
    const faqResult = await faqAgentLLM.handleQuery({
      workspaceId,
      customerId,
      query: functionArgs.query
    })

    // Add to debug timeline
    debugSteps.push({
      type: "sub_agent",
      agent: "FAQ Agent",
      model: "gpt-4o-mini",
      temperature: 0.3,
      timestamp: new Date().toISOString(),
      tokenUsage: {
        promptTokens: 0, // FAQ Agent tracks internally
        completionTokens: 0,
        totalTokens: faqResult.tokensUsed
      },
      input: { query: functionArgs.query },
      output: { responseText: faqResult.response }
    })

    return faqResult.response
  ```

#### 2.7 Seed FAQ Agent Config

- **File**: `backend/prisma/data/defaultAgents.ts`
- **Add**:
  ```typescript
  {
    name: "FAQ Agent",
    type: "FAQ_AGENT",
    temperature: 0.3,
    maxTokens: 2048,
    model: "openai/gpt-4o-mini",
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/faq-agent.md"),
      "utf-8"
    ),
    availableFunctions: [], // No CF
    isActive: true,
    order: 2 // After Router (order: 1)
  }
  ```

#### 2.8 Frontend - Agent List UI Update

- **File**: `frontend/src/pages/Agents.tsx`
- **Changes**:
  - Add FAQ_AGENT to agent type filter
  - Display FAQ Agent with custom icon (HelpCircle from lucide-react)
  - Show "No Functions" badge for FAQ Agent (since it has zero CF)

**Deliverables**:

- [ ] Prisma schema updated (AgentType enum)
- [ ] FAQ Agent prompt file created
- [ ] FAQAgentLLM class implemented
- [ ] FAQ Agent exported in agents/index.ts
- [ ] Router delegation function added
- [ ] LLM Router handles faqAgent() calls
- [ ] FAQ Agent seeded in database
- [ ] Frontend shows FAQ Agent in list
- [ ] Timeline tracks FAQ Agent calls

---

### Phase 3: Profile Agent Creation (Day 1-2, 8 hours)

**Goal**: Create Profile Agent for subscriptions and preferences management with full security

#### 3.1 Profile Agent Prompt

- **File**: `docs/prompts/profile-agent.md` (NEW)
- **Content**:

  ```markdown
  # Profile Agent - eChatbot

  ## YOUR ROLE

  You manage customer profile, subscriptions, and preferences.

  ## CUSTOMER INFO

  - Name: {{nameUser}}
  - Email: {{email}}
  - Subscribed to notifications: {{isSubscribed}} (yes/no)

  ## CALLING FUNCTIONS

  ### handlePushNotification(value)

  **When**: Customer explicitly confirms subscription/unsubscription request
  **Parameters**: { value: boolean } (true = subscribe, false = unsubscribe)

  **MANDATORY FLOW**:

  1. Customer asks to subscribe/unsubscribe (Router sends explicit message)
  2. Check {{isSubscribed}} current status
  3. If already in desired state: Inform customer ("You're already subscribed!")
  4. If valid state change: Ask explicit confirmation
  5. Wait for Router to send confirmation (Router interprets "SI"/"NO" from user)
  6. Router sends: "L'utente conferma che vuole [attivare/disattivare] le notifiche"
  7. You detect confirmation keyword in message → Call handlePushNotification(value)
  8. Show success message

  ## PROFILE LINK

  For email/address/personal data changes: Provide [LINK_PROFILE_WITH_TOKEN]
  (System will replace with actual secure link)

  ## EXAMPLES

  Example 1: Subscribe (not subscribed)
  Router: "Voglio ricevere offerte"
  You: "Great! Do you want to subscribe to promotional notifications? 📬"
  Router: "L'utente conferma che vuole attivare le notifiche promozionali"
  You: [CALL handlePushNotification(true)]
  You: "✅ Subscription activated! You'll receive our offers and promotions."

  Example 2: Subscribe (already subscribed)
  Router: "Voglio ricevere offerte"
  You: "You're already subscribed to our notifications! 📬 You'll receive all our offers."

  Example 3: Unsubscribe
  Router: "Non voglio più ricevere messaggi"
  You: "Do you want to unsubscribe from promotional notifications? 📭"
  Router: "L'utente conferma che vuole disattivare le notifiche promozionali"
  You: [CALL handlePushNotification(false)]
  You: "✅ Unsubscription confirmed. You won't receive promotional messages anymore. To manage other preferences: [LINK_PROFILE_WITH_TOKEN]"

  Example 4: Email change request
  Router: "Voglio cambiare la mia email"
  You: "To modify your email address, access your profile page: [LINK_PROFILE_WITH_TOKEN]"

  ## RULES

  - NEVER call handlePushNotification without confirmation message from Router
  - ALWAYS check {{isSubscribed}} before asking confirmation
  - ALWAYS provide [LINK_PROFILE_WITH_TOKEN] after unsubscription
  - Be friendly, professional, concise
  ```

#### 3.2 Implement handlePushNotification Calling Function

- **File**: `backend/src/domain/calling-functions/HandlePushNotification.ts` (NEW)
- **Pattern**: Follow existing CF pattern (e.g., `ManageNotifications.ts`)
- **Logic**:

  ```typescript
  import { PrismaClient } from "@prisma/client"
  import logger from "../../utils/logger"

  export interface HandlePushNotificationRequest {
    customerId: string
    workspaceId: string
    value: boolean // true = subscribe, false = unsubscribe
  }

  export interface HandlePushNotificationResult {
    success: boolean
    isSubscribed: boolean
    message: string
    error?: string
  }

  export async function HandlePushNotification(
    request: HandlePushNotificationRequest
  ): Promise<HandlePushNotificationResult> {
    const prisma = new PrismaClient()

    try {
      logger.info("🔔 HandlePushNotification called with:", {
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        value: request.value,
      })

      // Security: Validate customer belongs to workspace
      const customer = await prisma.customer.findFirst({
        where: {
          id: request.customerId,
          workspaceId: request.workspaceId,
        },
      })

      if (!customer) {
        return {
          success: false,
          isSubscribed: false,
          message: "Customer not found or doesn't belong to workspace",
          error: "CUSTOMER_NOT_FOUND",
        }
      }

      // Update subscription status
      await prisma.customer.update({
        where: { id: request.customerId },
        data: { isSubscribed: request.value },
      })

      logger.info("✅ Subscription updated:", {
        customerId: request.customerId,
        newStatus: request.value,
      })

      return {
        success: true,
        isSubscribed: request.value,
        message: request.value
          ? "Subscription activated successfully"
          : "Subscription deactivated successfully",
      }
    } catch (error) {
      logger.error("❌ HandlePushNotification error:", error)
      return {
        success: false,
        isSubscribed: false,
        message: "Failed to update subscription status",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    } finally {
      await prisma.$disconnect()
    }
  }
  ```

#### 3.3 Register CF in CallingFunctionsService

- **File**: `backend/src/services/calling-functions.service.ts`
- **Add**:

  ```typescript
  public async handlePushNotification(request: {
    customerId: string
    workspaceId: string
    value: boolean
  }): Promise<any> {
    try {
      logger.info("🔔 CallingFunctionsService: handlePushNotification called")

      const { HandlePushNotification } = require("../domain/calling-functions/HandlePushNotification")

      const result = await HandlePushNotification({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
        value: request.value
      })

      logger.info("✅ HandlePushNotification result:", result)
      return result
    } catch (error) {
      logger.error("❌ Error in handlePushNotification:", error)
      throw error
    }
  }
  ```

#### 3.4 Add to Agent Functions Config

- **File**: `backend/src/config/agent-functions.ts`
- **Add** in Profile Agent functions array:
  ```typescript
  {
    name: "handlePushNotification",
    description: "Subscribe or unsubscribe customer from push notifications. ONLY call after explicit user confirmation.",
    parameters: {
      type: "object",
      properties: {
        value: {
          type: "boolean",
          description: "true = subscribe, false = unsubscribe"
        }
      },
      required: ["value"]
    }
  }
  ```

#### 3.5 Profile Agent LLM Class

- **File**: `backend/src/application/agents/ProfileAgentLLM.ts` (NEW)
- **Logic**:

  ```typescript
  import { PrismaClient } from "@prisma/client"
  import { PromptProcessorService } from "../../services/prompt-processor.service"
  import logger from "../../utils/logger"

  export class ProfileAgentLLM {
    private promptProcessor: PromptProcessorService

    constructor(private prisma: PrismaClient) {
      this.promptProcessor = new PromptProcessorService()
    }

    async handleQuery(params: {
      workspaceId: string
      customerId: string
      query: string
    }): Promise<{
      response: string
      tokensUsed: number
      functionCalls?: any[]
    }> {
      // 1. Load Profile Agent config
      const agentConfig = await this.prisma.agentConfig.findFirst({
        where: {
          workspaceId: params.workspaceId,
          type: "PROFILE_AGENT",
          isActive: true,
        },
      })

      if (!agentConfig) {
        throw new Error("Profile Agent not configured for workspace")
      }

      // 2. Load customer data
      const customer = await this.prisma.customer.findUnique({
        where: { id: params.customerId },
        select: {
          name: true,
          email: true,
          isSubscribed: true,
          language: true,
        },
      })

      // 3. Replace variables (including {{isSubscribed}})
      const processedPrompt = await this.promptProcessor.replaceAllVariables(
        agentConfig.systemPrompt,
        params.workspaceId,
        params.customerId,
        customer.language
      )

      // 4. Call OpenRouter with function calling support
      const llmResponse = await this.callOpenRouterWithFunctions({
        systemPrompt: processedPrompt,
        userMessage: params.query,
        temperature: agentConfig.temperature,
        model: agentConfig.model,
        availableFunctions: ["handlePushNotification"], // Profile Agent CF
      })

      // 5. Handle function calls if present
      if (llmResponse.functionCall) {
        const functionResult = await this.executeFunctionCall(
          llmResponse.functionCall,
          params.workspaceId,
          params.customerId
        )

        // Return function result + final response
        return {
          response: functionResult.message,
          tokensUsed: llmResponse.usage.total_tokens,
          functionCalls: [llmResponse.functionCall],
        }
      }

      // 6. Return text response (no CF called)
      return {
        response: llmResponse.content,
        tokensUsed: llmResponse.usage.total_tokens,
      }
    }

    private async executeFunctionCall(
      functionCall: any,
      workspaceId: string,
      customerId: string
    ): Promise<any> {
      if (functionCall.name === "handlePushNotification") {
        const {
          CallingFunctionsService,
        } = require("../../services/calling-functions.service")
        const cfService = new CallingFunctionsService(this.prisma)

        return await cfService.handlePushNotification({
          customerId,
          workspaceId,
          value: functionCall.arguments.value,
        })
      }

      throw new Error(`Unknown function: ${functionCall.name}`)
    }
  }
  ```

#### 3.6 Export Profile Agent in Index

- **File**: `backend/src/application/agents/index.ts`
- **Add**:
  ```typescript
  export { ProfileAgentLLM } from "./ProfileAgentLLM"
  ```

#### 3.7 Router Delegation to Profile Agent

- **File**: `backend/src/config/agent-functions.ts`
- **Add**:
  ```typescript
  {
    name: "profileAgent",
    description: "Manages customer profile, subscriptions, and preferences. Use for: subscribe/unsubscribe, email changes, address updates, notification settings.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer's profile/subscription request (context-interpreted message from Router)"
        }
      },
      required: ["query"]
    }
  }
  ```

#### 3.8 LLM Router Service - Handle Profile Delegation

- **File**: `backend/src/services/llm-router.service.ts`
- **Add** in function call handling:

  ```typescript
  case "profileAgent":
    const profileAgentLLM = new ProfileAgentLLM(this.prisma)
    const profileResult = await profileAgentLLM.handleQuery({
      workspaceId,
      customerId,
      query: functionArgs.query
    })

    // Add to debug timeline
    debugSteps.push({
      type: "sub_agent",
      agent: "Profile Agent",
      model: "gpt-4o-mini",
      temperature: 0.5,
      timestamp: new Date().toISOString(),
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: profileResult.tokensUsed
      },
      input: { query: functionArgs.query },
      output: {
        responseText: profileResult.response,
        functionCalls: profileResult.functionCalls
      }
    })

    // If Profile Agent called handlePushNotification, log that too
    if (profileResult.functionCalls?.length > 0) {
      debugSteps.push({
        type: "function_call",
        functionName: "handlePushNotification",
        functionArguments: profileResult.functionCalls[0].arguments,
        timestamp: new Date().toISOString()
      })
    }

    return profileResult.response
  ```

#### 3.9 Add {{isSubscribed}} Variable Replacement

- **File**: `backend/src/services/prompt-processor.service.ts`
- **Add** in `replaceCustomerVariables()` method:
  ```typescript
  // Replace {{isSubscribed}}
  if (customer?.isSubscribed !== undefined) {
    prompt = prompt.replace(
      /\{\{isSubscribed\}\}/g,
      customer.isSubscribed ? "yes" : "no"
    )
  } else {
    // Default to "no" if field doesn't exist
    prompt = prompt.replace(/\{\{isSubscribed\}\}/g, "no")
  }
  ```

#### 3.10 Seed Profile Agent Config

- **File**: `backend/prisma/data/defaultAgents.ts`
- **Add**:
  ```typescript
  {
    name: "Profile Agent",
    type: "PROFILE_AGENT",
    temperature: 0.5,
    maxTokens: 2048,
    model: "openai/gpt-4o-mini",
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/profile-agent.md"),
      "utf-8"
    ),
    availableFunctions: ["handlePushNotification"],
    isActive: true,
    order: 3 // After Router (1) and FAQ (2)
  }
  ```

#### 3.11 Security - Profile Agent Endpoint (if needed)

- **File**: `backend/src/interfaces/http/routes/profile-agent.routes.ts` (NEW - if exposing API)
- **Security**: 3-layer middleware (authMiddleware + sessionValidationMiddleware + validateWorkspaceOperation)
- **Note**: Profile Agent is called INTERNALLY by Router, not directly from API. Security handled by Router's middleware.

#### 3.12 Frontend - Agent List UI Update

- **File**: `frontend/src/pages/Agents.tsx`
- **Changes**:
  - Add PROFILE_AGENT to agent type filter
  - Display Profile Agent with custom icon (UserCircle from lucide-react)
  - Show "1 Function" badge (handlePushNotification)
  - Display {{isSubscribed}} in variables list

**Deliverables**:

- [ ] Profile Agent prompt file created
- [ ] handlePushNotification CF implemented
- [ ] CF registered in CallingFunctionsService
- [ ] CF added to agent-functions.config.ts
- [ ] ProfileAgentLLM class created
- [ ] Profile Agent exported in agents/index.ts
- [ ] Router delegation to profileAgent() added
- [ ] LLM Router handles profileAgent() calls
- [ ] {{isSubscribed}} variable replacement implemented
- [ ] Profile Agent seeded in database
- [ ] Frontend shows Profile Agent in list
- [ ] Timeline tracks Profile Agent + CF calls
- [ ] Security validated (workspace isolation)

---

### Phase 4: Router Agent Refactoring (Day 2, 8 hours)

**Goal**: Strip Router to pure orchestration + context interpretation (CRITICAL PHASE!)

#### 4.1 Create New Router Prompt with Context Interpretation

- **File**: `docs/prompts/router-agent-CLEAN.md` (NEW - will replace router-agent-REFACTORED.md)
- **Target Size**: < 2.5k tokens (currently router-agent-REFACTORED.md is ~8k tokens)
- **Content Structure**:

  ```markdown
  # Router Agent - eChatbot (PURE ORCHESTRATION)

  ## YOUR ROLE

  You are the orchestration layer. You decide which specialist agent handles each request.
  You also interpret short user responses (SI, NO, numbers) into explicit messages.

  ## CUSTOMER INFO

  - Name: {{nameUser}}
  - Discount: {{discountUser}}%
  - Language: {{languageUser}}
  - Company: {{companyName}}

  ## CONVERSATION HISTORY

  You have access to last 10 minutes of conversation with THIS customer.
  Use it to understand context for short responses.

  ## 🧠 CONTEXT INTERPRETATION (CRITICAL!)

  **RULE**: When user sends SHORT responses, interpret context and build EXPLICIT messages.

  ### Short Response Patterns:

  - "SI", "yes", "ok", "sì", "sim", "yeah" → Affirmative confirmation
  - "NO", "no", "nope" → Negative rejection
  - "1", "2", "3", "primo", "secondo" → Number selection from list
  - "grazie", "thanks", "thx" → Generic thank you (no delegation)

  ### Context Interpretation Process:

  1. **Detect** short response from user
  2. **Read** last assistant message in conversation history
  3. **Extract** context: Which agent? What action? What product/order?
  4. **Build** explicit message combining context + user response
  5. **Delegate** to SAME specialist agent with complete message

  ### Examples:

  **Cart Confirmation:**
  History: Product Agent asked "Vuoi aggiungere Burrata 250g al carrello?"
  User: "SI"
  You extract: Product = Burrata (LATT-042), Action = add to cart
  You delegate: cartManagementAgent("L'utente conferma che vuole aggiungere il prodotto LATT-042 (Burrata 250g) al carrello")

  **Profile Confirmation:**
  History: Profile Agent asked "Vuoi disattivare le notifiche?"
  User: "SI"
  You extract: Action = disable notifications
  You delegate: profileAgent("L'utente conferma che vuole disattivare le notifiche promozionali")

  **Number Selection:**
  History: Product Agent showed "1. Parmigiano, 2. Grana, 3. Pecorino"
  User: "2"
  You extract: Selection = number 2 (Grana Padano)
  You delegate: productServicesAgent("L'utente ha scelto il numero 2 dalla lista precedente: Grana Padano DOP")

  **Negative Response:**
  History: Cart Agent asked "Vuoi aggiungere 2kg?"
  User: "NO"
  You extract: Rejection of cart addition
  You delegate: cartManagementAgent("L'utente NON vuole aggiungere il prodotto al carrello")

  ### ANTI-PATTERNS (FORBIDDEN!):

  ❌ WRONG: profileAgent("SI")
  ✅ RIGHT: profileAgent("L'utente conferma che vuole disattivare le notifiche")

  ❌ WRONG: cartManagementAgent("ok")
  ✅ RIGHT: cartManagementAgent("L'utente conferma che vuole aggiungere LATT-042 al carrello")

  ## SPECIALIST AGENTS (Delegation Functions)

  ### faqAgent(query)

  **When**: General questions (hours, contact, policies, shipping, payment)
  **Triggers**: "what are hours?", "how to contact?", "refund policy?"
  **Example**: faqAgent("What are your opening hours?")

  ### profileAgent(query)

  **When**: Subscriptions, preferences, profile modifications
  **Triggers**: "subscribe", "unsubscribe", "change email", "modify address"
  **Example**: profileAgent("L'utente conferma che vuole disattivare le notifiche")

  ### productServicesAgent(query)

  **When**: Product/service search, offers, categories, certifications
  **Triggers**: "do you have burrata?", "halal products?", "show offers"
  **Example**: productServicesAgent("Avete prodotti DOP?")

  ### cartManagementAgent(query)

  **When**: Cart operations (add, remove, view, clear)
  **Triggers**: "add to cart", "remove product", "show cart", "clear cart"
  **Example**: cartManagementAgent("L'utente conferma che vuole aggiungere LATT-042")

  ### orderTrackingAgent(query)

  **When**: Order status, tracking, history
  **Triggers**: "where is my order?", "track ORD-123", "order history"
  **Example**: orderTrackingAgent("Dov'è il mio ordine ORD-12345?")

  ### customerSupportAgent(query)

  **When**: Complex support, complaints, refunds
  **Triggers**: "I have a problem", "refund request", "complaint"
  **Example**: customerSupportAgent("Ho un problema con il mio ordine")

  ## DECISION TREE

  1. **Check if short response** (SI/NO/number) → Interpret context → Delegate
  2. **Check if FAQ** → faqAgent
  3. **Check if profile/subscription** → profileAgent
  4. **Check if product/service search** → productServicesAgent
  5. **Check if cart operation** → cartManagementAgent
  6. **Check if order tracking** → orderTrackingAgent
  7. **Check if complex support** → customerSupportAgent
  8. **Generic greeting/thank you** → Direct text response

  ## RULES

  - NEVER send short responses to sub-agents (SI, NO, 2)
  - ALWAYS build explicit messages with full context
  - ONLY handle routing - NO business logic
  - Sub-agents are STATELESS - give them complete context
  - Be deterministic and precise (temperature 0.2)
  ```

#### 4.2 Validate Router Prompt Length

- **Script**: `backend/scripts/validate-prompt-length.ts` (NEW)
- **Purpose**: Ensure Router prompt is < 2.5k tokens
- **Logic**:

  ```typescript
  import fs from "fs"
  import path from "path"

  // Simple token estimation: ~4 characters per token
  function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  const routerPromptPath = path.join(
    __dirname,
    "../../docs/prompts/router-agent-CLEAN.md"
  )
  const routerPrompt = fs.readFileSync(routerPromptPath, "utf-8")
  const estimatedTokens = estimateTokens(routerPrompt)

  console.log(`Router Prompt Length: ${routerPrompt.length} characters`)
  console.log(`Estimated Tokens: ${estimatedTokens}`)
  console.log(`Target: < 2500 tokens`)

  if (estimatedTokens > 2500) {
    console.error(
      `❌ FAIL: Router prompt is too long (${estimatedTokens} tokens)`
    )
    process.exit(1)
  } else {
    console.log(
      `✅ PASS: Router prompt is within limits (${estimatedTokens} tokens)`
    )
  }
  ```

- **Add to package.json**:
  ```json
  "scripts": {
    "validate-prompt-length": "ts-node scripts/validate-prompt-length.ts"
  }
  ```

#### 4.3 Update Router in Seed

- **File**: `backend/prisma/data/defaultAgents.ts`
- **Changes**:
  ```typescript
  {
    name: "Router Agent",
    type: "ROUTER",
    temperature: 0.2, // ← CHANGED from 0.3 (more deterministic)
    maxTokens: 2048,
    model: "openai/gpt-4o-mini",
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/router-agent-CLEAN.md"),
      "utf-8"
    ),
    availableFunctions: [
      "faqAgent",           // ← NEW
      "profileAgent",       // ← NEW
      "productServicesAgent",
      "cartManagementAgent",
      "orderTrackingAgent",
      "customerSupportAgent"
      // ❌ REMOVED: "manageNotifications" (moved to Profile Agent)
    ],
    isActive: true,
    order: 1 // First agent
  }
  ```

#### 4.4 Remove {{OFFERS}} and {{FAQ}} from Router Variables

- **File**: `backend/src/services/prompt-processor.service.ts`
- **Verify**: Router prompt does NOT contain {{OFFERS}} or {{FAQ}}
- **Note**: These variables only in FAQ Agent ({{FAQ}}) and Product Agent ({{OFFERS}})

#### 4.5 Update Router Context Interpretation Logic (Optional Enhancement)

- **File**: `backend/src/services/llm-router.service.ts`
- **Add Helper Method** (optional - LLM already handles this in prompt):
  ```typescript
  private buildExplicitMessage(
    userMessage: string,
    conversationHistory: any[]
  ): string {
    // Optional: Pre-process context interpretation before sending to Router LLM
    // This can reduce Router LLM load, but prompt-based approach is cleaner
    // For now, Router LLM handles this via prompt instructions
    return userMessage
  }
  ```

#### 4.6 Frontend - Update Agent Configuration Page

- **File**: `frontend/src/pages/Agents.tsx`
- **Changes**:
  - Show Router Agent with updated temperature (0.2)
  - Display new delegation functions: faqAgent, profileAgent
  - Remove manageNotifications from Router functions list
  - Add visual indicator for "Pure Orchestration" role

#### 4.7 Test Router Prompt Length

- **Command**: `cd backend && npm run validate-prompt-length`
- **Expected**: ✅ PASS: Router prompt < 2500 tokens
- **If Fail**: Trim examples, remove redundancy, keep only essential instructions

**Deliverables**:

- [ ] Router prompt created (router-agent-CLEAN.md)
- [ ] Router prompt size < 2.5k tokens
- [ ] Prompt length validation script created
- [ ] Router temperature updated to 0.2
- [ ] Router delegation functions updated (add faqAgent, profileAgent)
- [ ] {{OFFERS}} and {{FAQ}} removed from Router
- [ ] manageNotifications removed from Router
- [ ] Context interpretation logic documented in prompt
- [ ] Frontend shows updated Router configuration
- [ ] Validation script passes
- **Content**:

  ```markdown
  # Router Agent - eChatbot (PURE ORCHESTRATION)

  ## YOUR ROLE

  You are the orchestration layer. You decide which specialist agent handles each request.

  ## CUSTOMER INFO

  - Name: {{nameUser}}
  - Discount: {{discountUser}}%
  - Language: {{languageUser}}

  ## CONVERSATION HISTORY

  You have access to last 10 minutes of conversation with THIS customer.

  ## 🧠 CONTEXT INTERPRETATION (CRITICAL!)

  When user sends SHORT responses ("SI", "yes", "ok", "no", numbers):

  1. **Read Last Message**: Check conversation history
  2. **Extract Context**: Identify agent, action, product/order details
  3. **Build Explicit Message**: Combine context + user response
  4. **Delegate with Clarity**: Send complete message to specialist

  ### Confirmation Patterns:

  ✅ AFFIRMATIVE ("SI", "yes", "ok"):
  Pattern: "L'utente conferma che vuole [AZIONE] [DETTAGLI]"

  Examples:

  - Cart: "L'utente conferma che vuole aggiungere il prodotto LATT-042 (Burrata 250g) al carrello"
  - Profile: "L'utente conferma che vuole disattivare le notifiche promozionali"
  - Order: "L'utente conferma che vuole ricevere il link di tracking per ORD-12345"

  ❌ NEGATIVE ("NO", "no"):
  Pattern: "L'utente NON vuole [AZIONE] [DETTAGLI]"

  🔢 NUMBER ("1", "2", "3"):
  Pattern: "L'utente ha scelto il numero [N] dalla lista precedente: [NOME]"

  ### ANTI-PATTERNS (FORBIDDEN!):

  ❌ WRONG: profileAgent("SI")
  ✅ RIGHT: profileAgent("L'utente conferma che vuole disattivare le notifiche")

  ## SPECIALIST AGENTS

  ### faqAgent(query)

  **When**: General questions (hours, contact, policies, shipping, etc.)
  **Triggers**: "what are your hours?", "how to contact?", "shipping policy?"

  ### profileAgent(query)

  **When**: Subscriptions, preferences, profile modifications
  **Triggers**: "subscribe", "unsubscribe", "change email", "modify address"

  ### productServicesAgent(query)

  **When**: Product/service search, offers, categories
  **Triggers**: "do you have burrata?", "show offers", "what services?"

  ### cartManagementAgent(query)

  **When**: Cart operations (add, remove, view, clear)
  **Triggers**: "add to cart", "remove", "show cart", "clear cart"

  ### orderTrackingAgent(query)

  **When**: Order status, tracking, history
  **Triggers**: "where is my order?", "track ORD-123", "order history"

  ### customerSupportAgent(query)

  **When**: Complex support, complaints, refunds
  **Triggers**: "I have a problem", "refund request", "complaint"

  ## DECISION TREE

  1. Is it a FAQ question? → faqAgent
  2. Is it about subscription/profile? → profileAgent
  3. Is it product/service search? → productServicesAgent
  4. Is it cart operation? → cartManagementAgent
  5. Is it order tracking? → orderTrackingAgent
  6. Is it complex support? → customerSupportAgent
  7. Generic thank you/greeting? → Direct text response
  ```

#### 4.2 Update Router in Seed

- **File**: `backend/prisma/data/defaultAgents.ts`
- **Changes**:
  - Update Router systemPrompt to use `router-agent-CLEAN.md`
  - Set temperature to 0.2
  - Add delegation functions: `faqAgent`, `profileAgent`
  - Remove `manageNotifications` from availableFunctions

#### 4.3 Implement Agent Delegation Logic

- **File**: `backend/src/services/llm-router.service.ts`
- **Add**: Handle `faqAgent()` and `profileAgent()` function calls
- **Pattern**:

  ```typescript
  case "faqAgent":
    const faqAgentLLM = new FAQAgentLLM(this.prisma)
    const faqResponse = await faqAgentLLM.handleQuery({
      workspaceId,
      customerId,
      query: functionArgs.query
    })
    return faqResponse

  case "profileAgent":
    const profileAgentLLM = new ProfileAgentLLM(this.prisma)
    const profileResponse = await profileAgentLLM.handleQuery({
      workspaceId,
      customerId,
      query: functionArgs.query
    })
    return profileResponse
  ```

**Deliverables**:

- [ ] Router prompt stripped to 2k tokens
- [ ] Context interpretation logic in prompt
- [ ] Router delegates to FAQ/Profile agents
- [ ] Temperature set to 0.2

---

### Phase 5: Product & Services Agent Update (Day 2, 4 hours)

**Goal**: Add {{OFFERS}} variable to Product & Services Agent for correct responsibility isolation

#### 5.1 Update Product Agent Prompt

- **File**: `docs/prompts/product-services-search-agent.md`
- **Current State**: Has {{PRODUCTS}}, {{CATEGORIES}}, {{SERVICES}}
- **Add Section** (after existing variables):

  ```markdown
  ## ACTIVE OFFERS & PROMOTIONS

  {{OFFERS}}

  ### When to Show Offers:

  - User explicitly asks: "Cosa c'è in offerta?", "Show me deals", "Promozioni?"
  - User searches category WITH active offers: Show products + mention related offer
  - User asks about specific product WITH offer: Include offer in product description

  ### Offer Format:

  - Offer name (e.g., "Offerta Formaggi DOP")
  - Discount percentage (e.g., "15% di sconto")
  - Valid products/categories
  - Expiration date if applicable

  ### RULES:

  - NEVER invent offers not in {{OFFERS}} list
  - ONLY mention offers when RELEVANT to user query
  - If no offers active, don't mention promotions
  - Link offers to SPECIFIC products when possible
  ```

#### 5.2 Validate Variable Uniqueness (Principle XI)

- **Script**: `backend/scripts/validate-agent-prompts.ts` (UPDATE or CREATE)
- **Purpose**: Ensure {{OFFERS}} appears ONLY ONCE in Product Agent prompt
- **Logic**:

  ```typescript
  import fs from "fs"
  import path from "path"

  const largeVariables = ["PRODUCTS", "OFFERS", "SERVICES", "CATEGORIES", "FAQ"]
  const promptsDir = path.join(__dirname, "../../docs/prompts")
  const promptFiles = fs
    .readdirSync(promptsDir)
    .filter((f) => f.endsWith(".md"))

  for (const file of promptFiles) {
    const content = fs.readFileSync(path.join(promptsDir, file), "utf-8")

    for (const variable of largeVariables) {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g")
      const matches = content.match(regex) || []

      if (matches.length > 1) {
        console.error(
          `❌ FAIL: ${file} has ${matches.length} occurrences of {{${variable}}}`
        )
        process.exit(1)
      }

      if (matches.length === 1) {
        console.log(`✅ ${file}: {{${variable}}} appears once (CORRECT)`)
      }
    }
  }

  console.log("✅ All prompts passed variable uniqueness validation")
  ```

- **Add to package.json**:
  ```json
  "scripts": {
    "validate-prompts": "ts-node scripts/validate-agent-prompts.ts"
  }
  ```

#### 5.3 Verify {{OFFERS}} Replacement Logic

- **File**: `backend/src/services/prompt-processor.service.ts`
- **Method**: `replaceAllVariables()`
- **Check**: {{OFFERS}} replacement already exists
- **Expected Code**:

  ```typescript
  private async replaceOffers(
    prompt: string,
    workspaceId: string
  ): Promise<string> {
    const offers = await this.getActiveOffers(workspaceId)
    const offersText = offers.map(o =>
      `- ${o.name}: ${o.discount}% sconto su ${o.description}\n  Valido fino: ${o.validUntil || 'Sempre'}`
    ).join('\n')
    return prompt.replace(/\{\{OFFERS\}\}/g, offersText || "Nessuna offerta attiva al momento")
  }

  private async getActiveOffers(workspaceId: string) {
    return this.prisma.offer.findMany({
      where: {
        workspaceId,
        isActive: true,
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } }
        ]
      },
      orderBy: { discount: 'desc' } // Highest discount first
    })
  }
  ```

#### 5.4 Verify Offer Data Model (Database)

- **File**: `backend/prisma/schema.prisma`
- **Check**: `Offer` model exists with workspace isolation
- **Expected Schema**:

  ```prisma
  model Offer {
    id          String    @id @default(cuid())
    workspaceId String
    workspace   Workspace @relation(fields: [workspaceId], references: [id])

    name        String
    description String
    discount    Float     // Percentage (e.g., 15.0 for 15%)
    isActive    Boolean   @default(true)
    validUntil  DateTime? // null = always valid

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt

    @@index([workspaceId, isActive])
  }
  ```

#### 5.5 Remove {{OFFERS}} from Router Prompt

- **File**: `docs/prompts/router-agent-CLEAN.md` (created in Phase 4)
- **Verify**: NO {{OFFERS}} variable
- **Search for**: "OFFERS", "offerta", "offer", "promotion", "sconto"
- **Expected Result**: ZERO matches

#### 5.6 Update Timeline Tracking for Offers

- **File**: `backend/src/domain/entities/ConversationMessage.ts`
- **Field**: `debugInfo` JSON column
- **Update**: Product Agent tracks {{OFFERS}} injection
  ```typescript
  // In LLMRouterService when calling Product Agent
  debugSteps.push({
    type: "sub_agent",
    agent: "Product & Services Agent",
    model: "gpt-4o-mini",
    temperature: 0.5,
    timestamp: new Date().toISOString(),
    variablesReplaced: {
      PRODUCTS: productsCount,
      CATEGORIES: categoriesCount,
      SERVICES: servicesCount,
      OFFERS: offersCount, // ← NEW: Track active offers injected
    },
    tokenEstimate: calculateTokens(fullPrompt),
    tokenUsage: {
      promptTokens: result.usage.prompt_tokens,
      completionTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
    },
  })
  ```

#### 5.7 Update Seed for Product Agent

- **File**: `backend/prisma/data/defaultAgents.ts`
- **Update**: Verify Product Agent loads updated prompt
  ```typescript
  {
    name: "Product & Services Agent",
    type: "PRODUCT_SEARCH",
    temperature: 0.5,
    maxTokens: 4096,
    model: "openai/gpt-4o-mini",
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/product-services-search-agent.md"),
      "utf-8"
    ), // ← Will auto-load updated prompt with {{OFFERS}}
    availableFunctions: [
      "searchProducts",
      "getCategoryDetails",
      "getProductCertifications"
    ],
    isActive: true,
    order: 3
  }
  ```

#### 5.8 Frontend - Verify Product Agent Display

- **File**: `frontend/src/pages/Agents.tsx`
- **Changes**: Show {{OFFERS}} in Product Agent variables list
- **UI Enhancement**:
  ```tsx
  {
    agent.agentType === "PRODUCT_SEARCH" && (
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-xs">
          {{ PRODUCTS }}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {{ CATEGORIES }}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {{ SERVICES }}
        </Badge>
        <Badge variant="success" className="text-xs">
          {{ OFFERS }}
        </Badge> {/* New */}
      </div>
    )
  }
  ```

#### 5.9 Unit Tests - Offers Variable

- **File**: `backend/__tests__/unit/prompt-processor-offers.test.ts` (NEW)
- **Test Cases**:

  ```typescript
  describe("PromptProcessorService - Offers Variable", () => {
    let processor: PromptProcessorService
    let prisma: PrismaClient

    beforeEach(async () => {
      processor = new PromptProcessorService(prisma)
      // Seed test workspace with offers
      await prisma.offer.create({
        data: {
          workspaceId: "test-workspace",
          name: "Offerta Formaggi DOP",
          description: "Formaggi certificati",
          discount: 15.0,
          isActive: true,
        },
      })
    })

    it("should replace {{OFFERS}} with active offers", async () => {
      const prompt = "Offerte disponibili: {{OFFERS}}"
      const result = await processor.replaceAllVariables(
        prompt,
        "test-workspace",
        { customerId: "test-customer" }
      )

      expect(result).toContain("Offerta Formaggi DOP")
      expect(result).toContain("15%")
    })

    it("should handle no active offers", async () => {
      await prisma.offer.updateMany({
        where: { workspaceId: "test-workspace" },
        data: { isActive: false },
      })

      const result = await processor.replaceAllVariables(
        "Offerte: {{OFFERS}}",
        "test-workspace",
        {}
      )

      expect(result).toContain("Nessuna offerta attiva")
    })

    it("should enforce single occurrence of {{OFFERS}}", () => {
      const badPrompt = "Offerte: {{OFFERS}} ... Vedi anche: {{OFFERS}}"

      expect(() => processor.validatePromptVariables(badPrompt)).toThrow(
        "Variable {{OFFERS}} can only appear once per prompt"
      )
    })

    it("should filter expired offers", async () => {
      await prisma.offer.create({
        data: {
          workspaceId: "test-workspace",
          name: "Offerta Scaduta",
          description: "Old offer",
          discount: 20.0,
          isActive: true,
          validUntil: new Date("2020-01-01"), // Expired
        },
      })

      const result = await processor.replaceAllVariables(
        "{{OFFERS}}",
        "test-workspace",
        {}
      )

      expect(result).not.toContain("Offerta Scaduta")
      expect(result).toContain("Offerta Formaggi DOP") // Still valid
    })
  })
  ```

#### 5.10 Integration Test - Product Agent with Offers

- **File**: `backend/__tests__/integration/product-agent-offers.test.ts` (NEW)
- **Test Flow**:

  ```typescript
  describe("Product Agent - Offers Integration", () => {
    it("should show offers when user asks for promotions", async () => {
      const response = await request(app).post("/api/whatsapp/webhook").send({
        workspaceId: "test-workspace",
        customerId: "test-customer",
        message: "Cosa c'è in offerta?",
      })

      expect(response.status).toBe(200)
      expect(response.body.message).toContain("Offerta Formaggi DOP")
      expect(response.body.message).toContain("15%")

      // Check Timeline tracking
      const messages = await prisma.conversationMessage.findMany({
        where: { customerId: "test-customer" },
        orderBy: { timestamp: "desc" },
      })

      const lastMessage = messages[0]
      expect(lastMessage.debugInfo).toHaveProperty("variablesReplaced.OFFERS")
      expect(lastMessage.debugInfo.variablesReplaced.OFFERS).toBeGreaterThan(0)
    })

    it("should link offers to product search", async () => {
      // Create product in offer category
      await prisma.product.create({
        data: {
          workspaceId: "test-workspace",
          name: "Parmigiano Reggiano DOP",
          category: "Formaggi",
          price: 12.5,
          isActive: true,
        },
      })

      const response = await request(app).post("/api/whatsapp/webhook").send({
        workspaceId: "test-workspace",
        customerId: "test-customer",
        message: "Avete del Parmigiano?",
      })

      expect(response.body.message).toContain("Parmigiano Reggiano DOP")
      expect(response.body.message).toContain("offerta") // Mentions related offer
    })
  })
  ```

#### 5.11 Prompt Length Validation

- **Update Script**: `backend/scripts/validate-prompt-length.ts`
- **Add Check for Product Agent**:

  ```typescript
  // Product Agent base prompt check
  const productPromptPath = path.join(
    __dirname,
    "../../docs/prompts/product-services-search-agent.md"
  )
  const productPromptBase = fs.readFileSync(productPromptPath, "utf-8")
  const baseTokens = estimateTokens(productPromptBase)

  console.log(`\n📦 Product & Services Agent:`)
  console.log(`   Base Prompt: ${baseTokens} tokens`)
  console.log(`   With Variables: ~50,000 tokens (estimated)`)
  console.log(`   Target: < 60,000 tokens`)

  if (baseTokens > 5000) {
    console.error(
      `❌ FAIL: Product Agent base prompt is too long (${baseTokens} tokens)`
    )
    console.error(`   Should be < 5,000 tokens before variable replacement`)
    process.exit(1)
  }
  ```

**Deliverables**:

- [ ] {{OFFERS}} section added to Product Agent prompt
- [ ] Variable uniqueness validated ({{OFFERS}} appears only once)
- [ ] Prompt processor handles {{OFFERS}} replacement correctly
- [ ] Active offers query is workspace-isolated and filters expired offers
- [ ] Router Agent has NO {{OFFERS}} references (verified)
- [ ] Timeline tracking includes {{OFFERS}} injection count
- [ ] Product Agent seed updated (auto-loads new prompt)
- [ ] Frontend displays {{OFFERS}} badge in Product Agent UI
- [ ] Unit tests for {{OFFERS}} replacement pass
- [ ] Integration tests for offer queries pass
- [ ] Prompt length validation updated and passing

---

### Phase 6: Agent LLM Classes (Day 2-3, 6 hours)

**Goal**: Create complete LLM classes for new agents following existing patterns

#### 6.1 FAQ Agent LLM Class

- **File**: `backend/src/application/agents/FAQAgentLLM.ts` (NEW)
- **Pattern**: Follow ProductSearchAgentLLM structure
- **Implementation**:

  ```typescript
  import { PrismaClient } from "@prisma/client"
  import logger from "../../utils/logger"
  import { PromptProcessorService } from "../../services/prompt-processor.service"
  import { OpenRouterService } from "../../services/openrouter.service"

  export class FAQAgentLLM {
    constructor(
      private prisma: PrismaClient,
      private promptProcessor: PromptProcessorService,
      private openRouter: OpenRouterService
    ) {}

    async handleQuery(params: {
      workspaceId: string
      customerId: string
      query: string
    }): Promise<{
      message: string
      tokensUsed: number
    }> {
      try {
        logger.info("📋 FAQ Agent: Processing query", {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          query: params.query,
        })

        // 1. Load FAQ Agent configuration from database
        const agentConfig = await this.prisma.agentConfig.findFirst({
          where: {
            workspaceId: params.workspaceId,
            agentType: "FAQ_AGENT",
            isActive: true,
          },
        })

        if (!agentConfig) {
          throw new Error("FAQ Agent configuration not found")
        }

        // 2. Replace variables in system prompt
        const systemPrompt = await this.promptProcessor.replaceAllVariables(
          agentConfig.systemPrompt,
          params.workspaceId,
          { customerId: params.customerId }
        )

        // 3. Call OpenRouter API
        const response = await this.openRouter.createChatCompletion({
          model: agentConfig.model,
          temperature: agentConfig.temperature,
          max_tokens: agentConfig.maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: params.query },
          ],
        })

        const assistantMessage =
          response.choices[0]?.message?.content ||
          "Non ho trovato informazioni su questo argomento."

        logger.info("✅ FAQ Agent: Response generated", {
          tokensUsed: response.usage.total_tokens,
        })

        return {
          message: assistantMessage,
          tokensUsed: response.usage.total_tokens,
        }
      } catch (error) {
        logger.error("❌ FAQ Agent: Error processing query", error)
        throw error
      }
    }
  }
  ```

#### 6.2 Profile Agent LLM Class

- **File**: `backend/src/application/agents/ProfileAgentLLM.ts` (NEW)
- **Logic**:
  ```typescript
  export class ProfileAgentLLM {
    async handleQuery(params: {
      workspaceId: string
      customerId: string
      query: string
    }): Promise<string> {
      // 1. Load Profile Agent config from DB
      // 2. Replace {{isSubscribed}}, {{nameUser}}, {{email}}
      // 3. Call OpenRouter with Profile prompt
      // 4. Handle handlePushNotification CF if called
      // 5. Return response with [LINK_PROFILE_WITH_TOKEN] if needed
    }
  }
  ```

**Deliverables**:

- [ ] FAQAgentLLM class created
- [ ] ProfileAgentLLM class created
- [ ] Both agents load prompts from DB
- [ ] Variable replacement working

---

### Phase 7: Testing (Day 3, 6 hours)

**Goal**: Comprehensive testing of new architecture

#### 7.1 Unit Tests

**Router Context Interpretation**:

- **File**: `backend/__tests__/unit/services/router-context-interpretation.spec.ts` (NEW)
- **Tests**:
  - [ ] Router builds explicit message for "SI" confirmation (Profile)
  - [ ] Router builds explicit message for "SI" confirmation (Cart)
  - [ ] Router builds explicit message for number selection (Product)
  - [ ] Router handles "NO" negation correctly
  - [ ] Router delegates to FAQ Agent for general questions

**FAQ Agent**:

- **File**: `backend/__tests__/unit/agents/faq-agent.spec.ts` (NEW)
- **Tests**:
  - [ ] FAQ Agent returns matching FAQ answer
  - [ ] FAQ Agent says "no info" when no match
  - [ ] FAQ Agent has zero calling functions

**Profile Agent**:

- **File**: `backend/__tests__/unit/agents/profile-agent.spec.ts` (NEW)
- **Tests**:
  - [ ] Profile Agent asks confirmation before subscription
  - [ ] Profile Agent shows "already subscribed" if {{isSubscribed}} = yes
  - [ ] Profile Agent calls handlePushNotification(true) on confirmation
  - [ ] Profile Agent provides [LINK_PROFILE_WITH_TOKEN] for email changes

**Variable Uniqueness**:

- **File**: `backend/__tests__/unit/services/validate-prompts.spec.ts`
- **Tests**:
  - [ ] {{OFFERS}} appears ONLY in Product Agent
  - [ ] Zero {{OFFERS}} in Router prompt
  - [ ] No duplicate large variables in same prompt

#### 7.2 Integration Tests

**Subscription Flow**:

- **File**: `backend/__tests__/integration/subscription-flow.integration.spec.ts` (NEW)
- **Flow**:
  ```typescript
  1. User: "Voglio ricevere offerte"
  2. Router → profileAgent("Voglio ricevere offerte")
  3. Profile Agent: "Vuoi attivare le notifiche?"
  4. User: "SI"
  5. Router → profileAgent("L'utente conferma che vuole attivare le notifiche")
  6. Profile Agent calls handlePushNotification(true)
  7. DB: Customer.isSubscribed = true
  8. Response: "✅ Notifiche attivate!"
  ```

**FAQ Flow**:

- **File**: `backend/__tests__/integration/faq-flow.integration.spec.ts` (NEW)
- **Flow**:
  ```typescript
  1. User: "What are your opening hours?"
  2. Router → faqAgent("What are your opening hours?")
  3. FAQ Agent returns matching FAQ answer
  4. Response translated to customer language
  ```

**Cart Confirmation Flow**:

- **File**: `backend/__tests__/integration/cart-confirmation.integration.spec.ts` (NEW)
- **Flow**:
  ```typescript
  1. User: "Avete burrata?"
  2. Router → productServicesAgent("Avete burrata?")
  3. Product Agent: "Sì! Burrata 250g €8.50. Vuoi aggiungerla?"
  4. User: "SI"
  5. Router → cartManagementAgent("L'utente conferma che vuole aggiungere LATT-042 al carrello")
  6. Cart Agent calls addProduct(LATT-042)
  7. Response: "✅ Burrata aggiunta! (ti ho inviato il link al carrello)"
  ```

#### 7.3 Manual WhatsApp Tests (FUTURE - Not Now)

- [ ] Test subscription flow via WhatsApp
- [ ] Test FAQ answers via WhatsApp
- [ ] Test cart confirmations via WhatsApp
- [ ] Test profile link delivery

**Deliverables**:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Zero {{OFFERS}} duplication validated
- [ ] Manual test scenarios documented

---

### Phase 8: Documentation & Deployment (Day 3, 2 hours)

**Goal**: Update documentation and deploy changes

#### 8.1 Update Documentation

- **Files**:
  - [ ] `docs/architecture/MULTI_AGENT_FLOW.md` - Add FAQ/Profile agents
  - [ ] `docs/architecture/CONTEXT_INTERPRETATION_PATTERN.md` (NEW)
  - [ ] `README.md` - Update agent list

#### 8.2 Seed Database

- **Command**: `cd backend && npm run seed`
- **Verify**:
  - [ ] Router Agent updated (temp 0.2, clean prompt)
  - [ ] FAQ Agent created
  - [ ] Profile Agent created
  - [ ] Product Agent has {{OFFERS}}

#### 8.3 Test in Production-Like Environment

- [ ] Run backend: `npm run dev`
- [ ] Test FAQ question
- [ ] Test subscription flow
- [ ] Test cart confirmation
- [ ] Check debug timeline shows all agents

**Deliverables**:

- [ ] Documentation updated
- [ ] Database seeded successfully
- [ ] Production-like tests pass
- [ ] Andrea approves architecture

---

## 🔍 Validation Checklist

Before marking as complete:

### Constitution Compliance

- [ ] Principle XIII updated with new agents
- [ ] Principle XIV created (Context Interpretation Pattern)
- [ ] Variable uniqueness enforced ({{OFFERS}} appears once)

### Router Agent

- [ ] Prompt size < 2.5k tokens
- [ ] Temperature = 0.2
- [ ] Zero {{OFFERS}}, zero {{FAQ}}
- [ ] Context interpretation logic present
- [ ] Delegates to faqAgent, profileAgent

### FAQ Agent

- [ ] Prompt created with {{FAQ}} variable
- [ ] Temperature = 0.3
- [ ] Zero calling functions
- [ ] Seeded in database
- [ ] Router delegates correctly

### Profile Agent

- [ ] Prompt created with {{isSubscribed}} variable
- [ ] handlePushNotification CF implemented
- [ ] Temperature = 0.5
- [ ] Seeded in database
- [ ] Confirmation flow works

### Product & Services Agent

- [ ] {{OFFERS}} variable added
- [ ] Zero {{OFFERS}} in other agents
- [ ] Offers shown contextually

### Database

- [ ] Customer.isSubscribed field exists
- [ ] AgentType enum has FAQ_AGENT, PROFILE_AGENT
- [ ] Migration applied successfully

### Tests

- [ ] Unit tests pass (Router, FAQ, Profile)
- [ ] Integration tests pass (subscription, FAQ, cart)
- [ ] Validation script passes (zero duplication)

### Timeline Integrity

- [ ] FAQ Agent calls logged in debugInfo
- [ ] Profile Agent calls logged in debugInfo
- [ ] Context interpretation visible in timeline
- [ ] Token counts accurate

---

## 🚨 Risks & Mitigation

### Risk 1: Router Context Misinterpretation

**Probability**: Medium  
**Impact**: High (wrong agent called, wrong action)  
**Mitigation**:

- Temperature 0.2 for deterministic routing
- Extensive unit tests for confirmation patterns
- Clear examples in Router prompt

### Risk 2: {{OFFERS}} Duplication Not Caught

**Probability**: Low  
**Impact**: Critical (100k+ token prompts)  
**Mitigation**:

- Automated validation script in CI/CD
- Pre-commit hook checks prompt files
- Manual review before deployment

### Risk 3: Profile Agent CF Not Called

**Probability**: Medium  
**Impact**: Medium (subscription not saved)  
**Mitigation**:

- Integration tests verify CF execution
- Debug timeline shows CF calls
- Fallback error message if CF fails

### Risk 4: Performance Degradation

**Probability**: Low  
**Impact**: Medium (extra LLM calls)  
**Mitigation**:

- FAQ Agent has low temperature (fast)
- Profile Agent only called for subscriptions
- Monitor latency metrics post-deployment

---

## 📊 Success Metrics

### Performance

- Router prompt size: **< 2.5k tokens** (target: 2k)
- FAQ Agent response time: **< 1.5s** (p95)
- Profile Agent subscription flow: **< 2s** total
- Zero latency regression vs baseline

### Quality

- Subscription confirmation accuracy: **100%** (no accidental subscriptions)
- FAQ match rate: **> 80%** (FAQ coverage)
- Context interpretation accuracy: **> 95%** (Router builds correct messages)
- Timeline integrity: **100%** (all agent calls logged)

### Token Efficiency

- Total system tokens: **-20% vs baseline** (remove duplication)
- Router tokens per request: **-60% vs baseline** (8k → 2k)
- {{OFFERS}} duplication: **0** (validation enforced)

---

### Phase 6: Agent LLM Classes (COMPLETED IN DETAIL - see Phase 2 and 3)

**NOTE**: FAQ and Profile Agent LLM classes already fully specified in Phases 2.7 and 3.6

---

### Phase 7: Comprehensive Testing (Day 3, 8 hours)

**Goal**: End-to-end testing with full coverage

#### 7.1 Unit Tests - Router Context Interpretation

**File**: `backend/__tests__/unit/router-context.spec.ts`  
**Tests**: SI/NO/number building, delegation correctness, history reading

#### 7.2 Unit Tests - New Agents

**Files**: `faq-agent.spec.ts`, `profile-agent.spec.ts`  
**Tests**: Config loading, variable replacement, CF handling, error cases

#### 7.3 Integration Tests - FAQ Flow

**File**: `backend/__tests__/integration/faq-flow.test.ts`  
**Flow**: User query → Router → FAQ Agent → Response → Timeline

#### 7.4 Integration Tests - Profile Flow

**File**: `backend/__tests__/integration/profile-flow.test.ts`  
**Flow**: Query → Confirmation → Context interpretation → CF execution → DB update

#### 7.5 Integration Tests - Context Interpretation

**File**: `backend/__tests__/integration/context-all-agents.test.ts`  
**Scenarios**: Cart (SI), Product (2), Order (NO), Profile (SI)

#### 7.6 Security Tests - Workspace Isolation

**File**: `backend/__tests__/security/agent-isolation.test.ts`  
**Tests**: FAQ/Profile enforce workspaceId, CF validates workspace

#### 7.7 Security Tests - 3-Layer Middleware

**File**: `backend/__tests__/security/agent-auth.test.ts`  
**Tests**: JWT + session + workspace validation on all agent endpoints

**Deliverables**: ✅ 20+ tests, ✅ Coverage >80%, ✅ All passing

---

### Phase 8: Documentation (Day 3-4, 4 hours)

**Goal**: Complete architecture documentation

#### 8.1 Agent Docs

**Files**: `docs/architecture/agents/FAQ_AGENT.md`, `PROFILE_AGENT.md`  
**Content**: Responsibilities, prompts, variables, CFs, examples

#### 8.2 Context Interpretation Pattern

**File**: `docs/architecture/CONTEXT_INTERPRETATION_PATTERN.md`  
**Content**: Universal pattern for all agents, examples

#### 8.3 Constitution Update

**File**: `.specify/memory/constitution.md`  
**Change**: Add Principle XIV (Context Interpretation v2.1.0)

#### 8.4 PRD Update

**File**: `docs/memory-bank/PRD.md`  
**Sections**: Agent architecture, FAQ/Profile agents, Router responsibilities

#### 8.5 README Updates

**Files**: `backend/README.md`, `docs/README.md`  
**Changes**: New agent list, context interpretation notes

**Deliverables**: ✅ 6 docs created/updated, ✅ Constitution v2.1.0

---

### Phase 9: Prompt Length Validation (Day 4, 3 hours)

**Goal**: Automated prompt size validation

#### 9.1 Validation Script

**File**: `backend/scripts/validate-prompt-length.ts`  
**Checks**: Router <2.5k, FAQ <3k, Profile <4k, Product <5k base/<60k with vars

#### 9.2 CI/CD Integration

**File**: `.github/workflows/test.yml`  
**Step**: `npm run validate-prompt-length` before deployment

#### 9.3 Pre-Commit Hook

**File**: `.husky/pre-commit`  
**Hook**: Validate prompts before commit

**Deliverables**: ✅ Auto-validation, ✅ CI/CD step, ✅ Pre-commit

---

### Phase 10: Security Audit (Day 4, 4 hours)

**Goal**: Comprehensive security review

#### 10.1 CF Security Tests

**File**: `backend/__tests__/security/cf-validation.test.ts`  
**Tests**: handlePushNotification requires confirmation, no direct calls

#### 10.2 Variable Injection Tests

**File**: `backend/__tests__/security/variable-injection.test.ts`  
**Tests**: {{isSubscribed}}, {{FAQ}} cannot be manipulated

#### 10.3 Security Checklist

- [ ] FAQ has zero CFs
- [ ] Profile CF requires confirmation
- [ ] Router no data leakage
- [ ] Timeline audit trail complete
- [ ] Workspace isolation enforced

**Deliverables**: ✅ Security tests pass, ✅ Checklist complete

---

### Phase 11: Code Quality Review (Day 4, 3 hours)

**Goal**: Zero technical debt

#### 11.1 Code Quality Checklist

- [ ] No duplicate code (DRY)
- [ ] No unused imports
- [ ] No commented code
- [ ] All files <500 lines
- [ ] Consistent naming
- [ ] Imports organized

#### 11.2 Clean Architecture

- [ ] Agent classes follow patterns
- [ ] Services use repositories
- [ ] Controllers are thin
- [ ] No business logic in routes

#### 11.3 TypeScript Best Practices

- [ ] Interfaces for DTOs
- [ ] No `any` types
- [ ] Enum usage correct

**Deliverables**: ✅ Quality checklist complete, ✅ Zero ESLint warnings

---

## 🔄 Rollback Plan

If critical issues arise post-deployment:

1. **Revert Router Prompt**:

   ```sql
   UPDATE agentConfig
   SET systemPrompt = '<old-router-prompt>', temperature = 0.3
   WHERE type = 'ROUTER';
   ```

2. **Disable New Agents**:

   ```sql
   UPDATE agentConfig
   SET isActive = false
   WHERE type IN ('FAQ_AGENT', 'PROFILE_AGENT');
   ```

3. **Restore {{OFFERS}} to Router**:

   - Re-add {{OFFERS}} to Router prompt
   - Remove from Product Agent

4. **Rollback Migration** (if needed):
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   ```

---

## 📝 Notes

- **NO WhatsApp testing yet**: All WhatsApp flows go to queue (future feature)
- **Temperature changes**: Router 0.2 (deterministic), FAQ 0.3 (precise), Profile 0.5 (conversational)
- **Context interpretation**: Universal pattern applies to ALL agents (Cart, Order, Product, Profile)
- **Link placeholders**: Profile Agent uses [LINK_PROFILE_WITH_TOKEN], replaced by system layer
- **Backward compatibility**: Old manageNotifications CF removed, functionality moved to Profile Agent

---

**Plan Status**: Ready for Implementation  
**Next Step**: Create detailed tasks breakdown  
**Approval**: Awaiting Andrea's confirmation 🚀
