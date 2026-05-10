# Agent test dialogues — `cross/07-router-cold-start.test.spec.ts`

Generated: 2026-05-10T15:02:22.135Z
Total: 5 | Pass: 5 | Fail: 0

## ✅ PASS — cold-start — pure FAQ "qué horarios" → answer with hours (no troubleshooting question)

**Dialog:**

👤 **user:** ¿Qué horarios tenéis?

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Abierto los 365 días del año, incluidos festivos. Horario: de 8:00h a 22:00h. Último ciclo de lavado: 21:00h. No necesitas reservar, simplemente ven cuando quieras.
```

---

## ✅ PASS — cold-start — mixed "hola, ¿a qué hora abrís?" → resolves FAQ in same turn

**Dialog:**

👤 **user:** hola, ¿a qué hora abrís?

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Abierto los 365 días del año, incluidos festivos. Horario: de 8:00h a 22:00h. Último ciclo de lavado: 21:00h. No necesitas reservar, simplemente ven cuando quieras.
```

---

## ✅ PASS — cold-start — mixed "hola, quiero una factura" → starts invoice flow on T1

**Dialog:**

👤 **user:** hola, quiero una factura

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Claro, te ayudo con la factura. ¿En qué lavandería estuviste?
```

---

## ✅ PASS — cold-start — IT input "ciao non funziona" → bot replies in ES (tenant lock)

**Dialog:**

👤 **user:** ciao, la lavatrice non funziona

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

---

## ✅ PASS — cold-start — bare "ok" → bot does NOT escalate prematurely

**Dialog:**

👤 **user:** ok

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Cuéntame, ¿en qué te ayudo? 🙂
```

---
