# Agent test dialogues — `cross/07-router-cold-start.test.spec.ts`

Generated: 2026-05-09T21:20:28.340Z
Total: 5 | Pass: 5 | Fail: 0

## ✅ PASS — cold-start — pure FAQ "qué horarios" → answer with hours (no troubleshooting question)

**Dialog:**

👤 **user:** ¿Qué horarios tenéis?

🤖 **bot:**

```
El horario general de atención al público es de 8:00 a 22:00, todos los días del año. ⏰
```

---

## ✅ PASS — cold-start — mixed "hola, ¿a qué hora abrís?" → resolves FAQ in same turn

**Dialog:**

👤 **user:** hola, ¿a qué hora abrís?

🤖 **bot:**

```
El horario general de atención al público es de 8:00 a 22:00, todos los días del año. ⏰
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
👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?
```

---
