# Agent test dialogues — `03-mataro.test.spec.ts`

Generated: 2026-05-09T21:20:28.336Z
Total: 2 | Pass: 2 | Fail: 0

## ✅ PASS — ES — customer dice "Mataró" al turn 2 → bot disambigua tra Goya e Alemanya

**Dialog:**

👤 **user:** hola no me funciona la lavadora

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Mataró

🤖 **bot:**

```
En Mataró tenemos dos lavanderías: C/ Francisco de Goya 117 y C/ Alemanya 17. ¿Podrías indicarme en cuál estás?
```

---

## ✅ PASS — ES — customer dice "Goya" al turn 2 → bot NON chiede la calle, va su numero

**Dialog:**

👤 **user:** hola no me funciona la lavadora

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Podrías decirme, por favor, qué número tiene la lavadora?
```

---
