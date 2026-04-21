# RESET SESSION — FINAL DESCRIPTION (client-0)

## PURPOSE

Reset the current session when the conversation context is no longer valid.

This allows the system to restart cleanly from the Router.

---

## WHEN TO USE

You MUST call `resetSession()` in the following cases:

### 1. 🔄 Wrong machine selected

* The user changes machine type (lavadora ↔ secadora)
* The user changes machine number
* The user indicates the machine is different

Examples:

* “no, es una secadora”
* “me equivoqué de máquina”
* “no es la 42, es la 35”

---

### 2. 🧹 User wants to start over

* The user explicitly asks to restart

Examples:

* “empezar de nuevo”
* “reset”
* “otra vez”
* “let’s start again”

---

### 3. ⚠️ Contradiction in context

* Information conflicts with current session
* Machine type does not match previous context

---

## WHAT THIS FUNCTION DOES

When called, it MUST:

* clear `flowKey`
* clear `flowNumber`
* clear `flowState`
* clear `gatherState`

---

## AFTER RESET

After calling `resetSession()`:

* The conversation MUST restart from the Router
* Previous machine and flow context MUST be ignored
* The next message should be treated as a new session

---

## 🚫 DO NOT USE

Do NOT call `resetSession()` if:

* You can continue the current flow
* You are still gathering missing information
* The user has not changed machine or context

---

## 💬 USER MESSAGE RULE

After reset:

* Inform the user briefly
* Keep it simple

Example:
“No problem, empezamos de nuevo 😊”

---

## ❗ FINAL RULE

If the current context is wrong or inconsistent:

→ RESET immediately

Never continue with a broken context.
