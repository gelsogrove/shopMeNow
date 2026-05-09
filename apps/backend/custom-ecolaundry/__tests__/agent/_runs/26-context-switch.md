# Agent test dialogues — `26-context-switch.test.spec.ts`

Generated: 2026-05-09T22:33:29.832Z
Total: 2 | Pass: 2 | Fail: 0

## ✅ PASS — ES — context switch: dopo Goya+5 fa FAQ "qué horarios" → bot risponde con orari

**Dialog:**

👤 **user:** La lavadora no funciona

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías decirme, por favor, qué número tiene la lavadora?
```

👤 **user:** 5

🤖 **bot:**

```
Cuéntame, por favor, ¿qué aparece exactamente en la pantalla?
```

👤 **user:** Por cierto, ¿qué horario tenéis?

🤖 **bot:**

```
El horario general de atención al público es de 8:00 a 22:00, todos los días del año. ⏰
```

---

## ✅ PASS — ES — sticky facts dopo FAQ: location/machineType/machineNumber non si perdono

**Dialog:**

👤 **user:** La lavadora no funciona

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías decirme, por favor, qué número tiene la lavadora?
```

👤 **user:** 5

🤖 **bot:**

```
Cuéntame, por favor, ¿qué aparece exactamente en la pantalla?
```

👤 **user:** Por cierto, ¿qué horario tenéis?

🤖 **bot:**

```
El horario general de atención al público es de 8:00 a 22:00, todos los días del año. ⏰
```

---
