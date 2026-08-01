# DemoRobot — conversation flow analysis

Customer care service for robot lawn mowers ([am-robots.com](https://am-robots.com/it/)).
Reference document to agree on **before** writing prompts and SQL. Settled with Andrea on 2026-08-01.

---

## 1. Decisions taken

| Item | Value |
|---|---|
| Agent name | **Sofia** — warm and competent, informal, short sentences |
| Default language | **it** (customer-facing) |
| Active languages | it, en, es, fr, de |
| Website | https://am-robots.com/it/ |
| Escalation | outside FAQ/flow · explicit request · safety or physical damage · serial wrong after **3** attempts · **frustration / abusive language** |
| Out of scope | Calendar Booking |

> **Note on languages.** The app UI is English (project rule 15). The customer-facing default
> language is Italian. These are two different things and must not be confused: `defaultLanguage`
> drives the chatbot's replies to customers, not the backoffice.

---

## 2. The flow

### Two modes (key point)

Without **serial + problem** the bot cannot troubleshoot. This is not a detail — it separates
two different conversation modes.

| | BASIC MODE | DIAGNOSTIC MODE |
|---|---|---|
| Requires | nothing | serial ✅ + problem ✅ |
| Can do | answer generic FAQs (models, boundary wire, contacts) | run diagnostic flows |
| Cannot do | run flows, open a case | — |

The bot **must not stall** when the serial is missing: it keeps answering generic questions.
But for a specific technical problem the serial is required, otherwise it escalates.

```
message 1
   │
   ├─ detect language (from the text, NOT from keywords)  → state.language
   ├─ welcome message                                      → always on the first turn
   └─ extract everything already said: serial? problem? date? → save_fact
        │
        ├─ generic question (no serial needed)
        │     └─ BASIC MODE → answer from FAQ, do not ask for the serial
        │
        └─ technical problem
              ├─ serial missing   → ask for it (max 3 attempts)
              ├─ problem missing  → ask for it
              └─ everything known → DIAGNOSTIC MODE
                      │
              match the problem
                      │
         ┌────────────┼────────────┐
         │            │            │
       FAQ hit    FLOW hit     no match
         │            │            │
       answer    run the flow  escalate_to_operator
```

⚠️ Not asking the serial from someone asking a generic question ("how many models do you have?")
matters just as much as not re-asking it from someone who already gave it.

### The golden rule (Andrea's requirement 5)

> «if the user writes "hi, I have a problem with my robot, yesterday it stopped working"
> and gives the serial number, we must not ask for the serial number»

The bot asks **only for what is missing**. If the first message already contains serial +
problem + date, it goes straight to matching. This is NOT implemented with phrase parsing
(forbidden by Iron Rule 6): the LLM extracts the entities and calls `save_fact`; the code only
checks which state slots are still empty.

---

## 3. Serial number — the deterministic part

Specification provided by the customer:

> The serial number is always 19 digits and starts with HK. For models 2026 it starts with HKA
> and for 2025 models it is HKX- like this `HKX3EB100JD25070076` or this `HKA4OB100LQ26050197`
> — users mainly make mistakes in typing 0 where it should be O but it is fine we can easily check that.

### What the examples actually show

- `HKX3EB100JD25070076` → 19 characters ✓
- `HKA4OB100LQ26050197` → 19 characters ✓
- **They are alphanumeric, not "digits"**: the customer says "19 digits" but the examples contain
  letters. Validation must check **length 19**, not "all digits".
- Prefix `HKA` = 2026, `HKX` = 2025. Both start with `HK`.

### ⚠️ The 0/O ambiguity is not one-directional

The customer says users type `0` instead of `O`. But `HKA4OB100LQ26050197` contains **both**:
an `O` at position 5 and a `0` inside `100`.

So we **cannot** normalise in a single direction (neither all `O`→`0` nor the reverse). With only
two examples it is impossible to deduce which positions are letters and which are digits.

**→ OPEN QUESTION FOR THE CUSTOMER** (see §6). Until answered, validation stays tolerant: accept
19 characters with the `HK` prefix, and when 0/O is ambiguous try both variants against the DB
instead of rejecting.

### Validation — where it lives

Tool `validate_serial` (Iron Rule 2: *the tool refuses, the LLM corrects*). The prompt must
**not** contain the regex.

```
1. strip spaces, dashes, lowercase → uppercase
2. length === 19             otherwise → invalid_length
3. prefix HKA | HKX          otherwise → invalid_prefix
4. DB lookup
   ├─ found        → ok, store in state.serialNumber
   └─ not found    → generate 0↔O variants and retry
        ├─ exactly one variant matches → accept, tell the user
        └─ none / ambiguous            → not_found
5. on the 3rd consecutive failure → escalate_to_operator
```

The attempt counter lives in state (`serialAttempts`), not in the prompt.

---

## 4. Variables

No hardcoded values in prompts — everything from the DB (project rule 1).

| Variable | Source | Used in |
|---|---|---|
| `{{chatbotName}}` | `Workspace.chatbotName` = "Sofia" | welcome, main prompt |
| `{{companyName}}` | `Workspace.name` = "AmRobots" | welcome, main prompt |
| `{{websiteUrl}}` | `Workspace.websiteUrl` | main prompt |
| `{{welcomeMessage}}` | `Workspace.welcomeMessage` | first turn |
| `{{escalationTrigger}}` | `Workspace.escalationTrigger` | welcome |
| `{{humanSupportInstructions}}` | `Workspace.humanSupportInstructions` | main prompt |
| `{{defaultLanguage}}` | `Workspace.defaultLanguage` = "it" | main prompt |
| `{{termsAndConditions}}` | `Workspace.termsAndConditions` | welcome |
| `{{wipMessage}}` | `Workspace.wipMessage` | channel inactive |

**Welcome example** (no hand-written values):

```
Welcome! I'm {{chatbotName}}, your digital assistant.
I can help you discover {{companyName}}.
```

⚠️ Project constraint 11: FAQs and flows must **not** be injected as a `{{faqs}}` / `{{flows}}`
variable carrying the whole catalogue — 50k+ tokens. They are retrieved via tool using
`similarityThreshold: 0.7` and `topK: 3` (already in `settings.json`), injecting only the
relevant hits.

---

## 4b. Terms & Conditions

Link in the welcome message, no blocking acceptance: the user can write straight away.

```
... {{termsAndConditions}}
```

Source: `Workspace.termsAndConditions` (column already exists). If empty, the line disappears
from the welcome instead of leaving a broken link.

---

## 4c. Maintenance Message (channel inactive)

When `Workspace.channelStatus` is **not** active, the bot does **not** enter the flow: it replies
with `{{wipMessage}}` only and ends the turn. No diagnosis, no serial collection.

Source: `Workspace.wipMessage` (column already exists).

---

## 4d. Flow node attachments

Each node may carry images or PDFs (e.g. a diagram showing where the blades are, a battery
replacement manual). When the reached node has attachments, the bot **communicates the download
link** together with the answer.

- The link is **always** given when present, not only when the user asks
- If the node has no attachment, never invent a link (project rule 1: no fake fallbacks)

✅ **The infrastructure already exists** (verified 2026-08-01):

```
FlowNode.attachments → FlowNodeAttachment (nodeId + assetId) → Asset
                       table: demorobot_flow_node_attachments
```

No migration needed. When the flow reaches a node, read `node.attachments`, resolve the URL of
the linked `Asset`, and surface it with the node's answer.

---

## 4e. Escalation on frustration

**The LLM judges the tone** — no swear-word list in the code (Iron Rule 6). Works across all 5
languages with no maintenance.

The code stays responsible only for **objective** counters:

| Signal | Decided by |
|---|---|
| Hostile tone, swearing, insults | **LLM** → `escalate_to_operator` |
| 3 consecutive invalid serials | **code** (`serialAttempts`) |
| Safety / physical damage | **LLM** |
| Explicit request for a human | **LLM** |

⚠️ Note: the `frustrationTriggers` column exists in the DB but is **not read by any service**
(verified 2026-08-01) — it stays unused and is not the source of this logic.

---

## 4f. Out of scope

**Calendar Booking**: not needed (Andrea, 2026-08-01). `Workspace.enableCalendarBooking` stays
`false`; no booking tool, no slots, no reminders. If an on-site technical visit is ever needed,
we reopen the topic.

---

## 5. Prompt loading — how demowash really works

Andrea asked whether this is "like demowash, which loads the prompt based on the question".
**Demowash does not do that**, and the distinction matters. From its own code
([agent.ts:1350-1353](../../custom-demowash/agent.ts)):

> *"Assembled **at boot**... Concatenated in a **fixed, deterministic order** so the resulting
> blob is **byte-identical across boots → cache hit always**."*

Demowash concatenates **all** `.md` files once at startup into a single immutable prompt. It
picks nothing at runtime. The reason is **prompt caching**: a byte-identical prompt is cached by
the API and costs a fraction. Swapping sections per question would produce a new prompt every
time → cache miss → higher cost and worse latency.

What varies per question is not the prompt, it is which **tools** the LLM decides to call.

### What this means for demorobot

| What | Where | When |
|---|---|---|
| Base instructions, tone, rules, flow logic | `prompts/common.md` | boot, fixed → cached |
| Workspace variables (`{{chatbotName}}`, `{{companyName}}`…) | DB → resolved into the prompt | boot |
| **FAQs and flows** | **DB, injected via tool** | runtime, only the relevant ones |

FAQs and flows are editable from the app and change without a redeploy, so they cannot live in
the static prompt. A retrieval tool fetches them (`similarityThreshold: 0.7`, `topK: 3`).

---

## 6. To do

1. **Flow analysis** ← this document
2. **Main prompt** with the variables above
3. **SQL** on the demorobot workspace (welcome, agent, languages, escalation, tone)
4. **`validate_serial`** + `serialAttempts` in state, with tests (Iron Rule 5)
5. **Flow prompt** — critical, handled separately
6. Prompt assembly at boot, demowash pattern

### Note on `settings.json`

Andrea asked that the app's Save write into `settings.json`. **That is not workable**: the Heroku
dyno filesystem is ephemeral (lost on every restart) and not multi-tenant. `settings.json` stays
the module's technical config (model, temperature, audio voices), versioned in the repo; the
operator-editable values live in the **DB**, which is also what the chatbot reads at runtime.

---

## 7. Open questions for the customer

1. **0/O**: which positions of the serial are letters and which are digits? A mask
   (e.g. `HK[A|X] + 1 digit + 2 letters + …`) would remove the guesswork.
2. Are there serials from models **before 2025** (a prefix other than HKA/HKX)?
3. Should the serial be checked against an existing product database, or is format validation
   enough?
4. Is there an official **error code list** for STORM? The `ERROR 001` flow Andrea built suggests
   yes — that list would drive the flow structure.
