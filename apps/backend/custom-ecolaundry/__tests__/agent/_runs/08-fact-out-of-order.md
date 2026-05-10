# Agent test dialogues — `cross/08-fact-out-of-order.test.spec.ts`

Generated: 2026-05-10T18:49:49.594Z
Total: 4 | Pass: 4 | Fail: 0

## ✅ PASS — PATTERN A — display first ("me sale AL001") → bot asks LOCATION on T2

**Dialog:**

👤 **user:** hola, qué tal

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo? 🙂
```

👤 **user:** me sale AL001

🤖 **bot:**

```
¿En qué lavandería estás ahora mismo?
```

---

## ✅ PASS — PATTERN B — type first ("la lavadora no funciona") → bot asks LOCATION

**Dialog:**

👤 **user:** hola

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo? 🙂
```

👤 **user:** una lavadora

🤖 **bot:**

```
¿En qué lavandería estás ahora mismo?
```

---

## ✅ PASS — PATTERN D — all facts in one go, no location → bot asks LOCATION

**Dialog:**

👤 **user:** hola

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo? 🙂
```

👤 **user:** lavadora 5 PUSH PROG

🤖 **bot:**

```
¿En qué lavandería estás ahora mismo?
```

---

## ✅ PASS — CONTROL — location given → bot proceeds (no re-ask of location)

**Dialog:**

👤 **user:** la lavadora no funciona

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías decirme, por favor, qué **número** tiene la lavadora?
```

---
