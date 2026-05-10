# Agent test dialogues — `04-flujo-general.test.spec.ts`

Generated: 2026-05-10T15:02:22.127Z
Total: 6 | Pass: 6 | Fail: 0

## ✅ PASS — ES — paso 1 identificar el local: T1 → bot chiede dove (lavanderia, donde)

**Dialog:**

👤 **user:** hola, no funciona la máquina

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

---

## ✅ PASS — ES — paso 2 identificar tipo: T2 location data → bot chiede SOLO il tipo

**Dialog:**

👤 **user:** hola, no funciona la máquina

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías indicarme, por favor, si es una lavadora o una secadora?
```

---

## ✅ PASS — ES — paso 3 dato crítico (numero): T3 solo tipo data → bot chiede solo numero

**Dialog:**

👤 **user:** hola, no funciona la máquina

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías indicarme, por favor, si es una lavadora o una secadora?
```

👤 **user:** lavadora

🤖 **bot:**

```
¿Podrías decirme, por favor, qué **número** tiene la lavadora?
```

---

## ✅ PASS — ES — paso 3b dato crítico (display): T4 numero dato → bot chiede pantalla

**Dialog:**

👤 **user:** hola, no funciona la máquina

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías indicarme, por favor, si es una lavadora o una secadora?
```

👤 **user:** lavadora

🤖 **bot:**

```
¿Podrías decirme, por favor, qué **número** tiene la lavadora?
```

👤 **user:** 5

🤖 **bot:**

```
Cuéntame, por favor, ¿qué aparece exactamente en la pantalla?
```

👤 **user:** sí

🤖 **bot:**

```
No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?
```

---

## ✅ PASS — ES — paso 4+5 instrucción + loopback: SEL → bot da istruzione e chiede se funziona

**Dialog:**

👤 **user:** hola, no funciona la máquina

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías indicarme, por favor, si es una lavadora o una secadora?
```

👤 **user:** lavadora

🤖 **bot:**

```
¿Podrías decirme, por favor, qué **número** tiene la lavadora?
```

👤 **user:** 5

🤖 **bot:**

```
Cuéntame, por favor, ¿qué aparece exactamente en la pantalla?
```

👤 **user:** sí

🤖 **bot:**

```
No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?
```

👤 **user:** SEL

🤖 **bot:**

```
Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago.

Después dime si la lavadora ha arrancado.
```

---

## ✅ PASS — ES — paso 6 escalar: ERROR (codice non doc) → bot escala con revisar

**Dialog:**

👤 **user:** hola, no funciona la máquina

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías indicarme, por favor, si es una lavadora o una secadora?
```

👤 **user:** lavadora

🤖 **bot:**

```
¿Podrías decirme, por favor, qué **número** tiene la lavadora?
```

👤 **user:** 5

🤖 **bot:**

```
Cuéntame, por favor, ¿qué aparece exactamente en la pantalla?
```

👤 **user:** sí

🤖 **bot:**

```
No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?
```

👤 **user:** ERROR

🤖 **bot:**

```
El código ERROR requiere revisión manual. Pasaremos tu caso a revisión para ayudarte de la mejor manera posible. 🙏 ¿Cómo te llamas, por favor?
```

---
