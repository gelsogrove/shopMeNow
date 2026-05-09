# Agent test dialogues — `18-codigo-numerico.test.spec.ts`

Generated: 2026-05-09T22:53:01.231Z
Total: 3 | Pass: 3 | Fail: 0

## ✅ PASS — ES — Scenario 18.1: codice numerico → "No" → escalate sin confrontar → name → summary "solo numérico"

**Dialog:**

👤 **user:** Tengo un código: 23432023

🤖 **bot:**

```
¡Gracias! 👍 ¿Ves alguna letra delante de los números?
```

👤 **user:** No

🤖 **bot:**

```
Entendido, lo paso a revisión manual para ayudarte mejor. 🙏 ¿Cómo te llamas, por favor?
```

👤 **user:** Andrea

🤖 **bot:**

```
Vamos a revisar tu caso manualmente, Andrea, para poder ayudarte de la manera más adecuada. Por favor, espera un momento mientras lo hacemos.

Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

**👤 Human Support message**
Usuario Andrea en ubicación no identificada ha facilitado un código solo numérico (23432023) que no encaja con el formato esperado y requiere revisión manual.
```

---

## ✅ PASS — ES — Scenario 18.2: codice numerico → "SI" letras → bot rilancia chiedendo codice exacto

**Dialog:**

👤 **user:** Tengo un código: 23432023

🤖 **bot:**

```
¡Gracias! 👍 ¿Ves alguna letra delante de los números?
```

👤 **user:** SI

🤖 **bot:**

```
Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?
```

---

## ✅ PASS — ES — Scenario 18.3: codice numerico → "AS" (uppercase letras) → bot rilancia chiedendo codice exacto

**Dialog:**

👤 **user:** Tengo un código: 64646

🤖 **bot:**

```
¡Gracias! 👍 ¿Ves alguna letra delante de los números?
```

👤 **user:** AS

🤖 **bot:**

```
Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?
```

---
