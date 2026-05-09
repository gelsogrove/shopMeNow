# Agent test dialogues — `cross/06-multi-fact-extraction.test.spec.ts`

Generated: 2026-05-09T21:20:28.340Z
Total: 6 | Pass: 4 | Fail: 2

## ✅ PASS — ES — "En Pineda me ha cobrado 10€" → escalation diretta (location estratta)

**Dialog:**

👤 **user:** En Pineda me ha cobrado 10 €.

🤖 **bot:**

```
Entendido, lo paso a revisión manual para ayudarte mejor. 🙏 ¿Cómo te llamas, por favor?
```

---

## ✅ PASS — ES — "Sto usando una lavatrice a Goya" → bot chiede solo il numero

**Dialog:**

👤 **user:** Sto usando una lavatrice a Goya

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿Qué número de lavadora estás usando?
```

---

## ❌ FAIL — ES — "En Goya lavadora 3 PUSH PROG" → bot dà istruzione (tutti i fatti estratti)

**Failure reason:**
```
expected reply to mention NONE of: donde, lavanderia, lavadora o secadora, numero de la lavadora
Found: lavanderia
Reply: 👋 Hola, soy el asistente virtual de la lavandería. Pulsa un botón de programa para iniciar el lavado.

Programas:
- **60º** (muy caliente) → ropa muy sucia, blanca o de trabajo
- **40º** (templado) → ropa normal (algodón, color)
- **30º** (suave) → ropa delicada o sintética
- **Frío** → prendas muy delicadas (lana, seda, etc.)

Elige uno y púlsalo en la máquina.

Después dime si la lavadora ha arrancado.
```

**Dialog:**

👤 **user:** En Goya lavadora 3 PUSH PROG

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Pulsa un botón de programa para iniciar el lavado.

Programas:
- **60º** (muy caliente) → ropa muy sucia, blanca o de trabajo
- **40º** (templado) → ropa normal (algodón, color)
- **30º** (suave) → ropa delicada o sintética
- **Frío** → prendas muy delicadas (lana, seda, etc.)

Elige uno y púlsalo en la máquina.

Después dime si la lavadora ha arrancado.
```

---

## ✅ PASS — ES — "Estoy en Goya con la lavadora 5" → bot chiede solo il display

**Dialog:**

👤 **user:** Estoy en Goya con la lavadora 5

🤖 **bot:**

```
Perfecto. ¿Qué aparece exactamente en la pantalla de la lavadora?
```

---

## ❌ FAIL — ES — "Lavadora 3 Goya" → bot chiede solo display (ordine libero)

**Failure reason:**
```
expected reply to mention all of: pantalla
Missing: pantalla
Reply: 👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

**Dialog:**

👤 **user:** Lavadora 3 Goya

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

---

## ✅ PASS — ES — "Estoy en Mataró con la lavadora 5" → bot disambigua tra Goya/Alemanya

**Dialog:**

👤 **user:** Estoy en Mataró con la lavadora 5

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. En Mataró tenemos dos lavanderías: C/ Francisco de Goya 117 y C/ Alemanya 17. ¿Podrías indicarme en cuál estás?
```

---
