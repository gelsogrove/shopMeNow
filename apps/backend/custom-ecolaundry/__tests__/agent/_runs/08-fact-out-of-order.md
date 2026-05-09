# Agent test dialogues — `cross/08-fact-out-of-order.test.spec.ts`

Generated: 2026-05-09T21:20:28.340Z
Total: 4 | Pass: 0 | Fail: 4

## ❌ FAIL — PATTERN A — display first ("me sale AL001") → bot asks LOCATION on T2

**Failure reason:**
```
expected a question asking for the laundry location.
Reply: ¿En qué lavandería estás ahora mismo?
```

**Dialog:**

👤 **user:** hola, qué tal

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** me sale AL001

🤖 **bot:**

```
¿En qué lavandería estás ahora mismo?
```

---

## ❌ FAIL — PATTERN B — type first ("la lavadora no funciona") → bot asks LOCATION

**Failure reason:**
```
expected a question asking for the laundry location.
Reply: ¿En qué lavandería estás ahora mismo?
```

**Dialog:**

👤 **user:** hola

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo?
```

👤 **user:** una lavadora

🤖 **bot:**

```
¿En qué lavandería estás ahora mismo?
```

---

## ❌ FAIL — PATTERN D — all facts in one go, no location → bot asks LOCATION

**Failure reason:**
```
expected a question asking for the laundry location.
Reply: ¿En qué lavandería estás ahora mismo?
```

**Dialog:**

👤 **user:** hola

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo?
```

👤 **user:** lavadora 5 PUSH PROG

🤖 **bot:**

```
¿En qué lavandería estás ahora mismo?
```

---

## ❌ FAIL — CONTROL — location given → bot proceeds (no re-ask of location)

**Failure reason:**
```
expected a question asking for the laundry location.
Reply: 👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

**Dialog:**

👤 **user:** la lavadora no funciona

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

---
