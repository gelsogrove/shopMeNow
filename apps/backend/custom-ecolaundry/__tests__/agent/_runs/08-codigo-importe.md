# Agent test dialogues — `08-codigo-importe.test.spec.ts`

Generated: 2026-05-09T22:59:14.124Z
Total: 4 | Pass: 4 | Fail: 0

## ✅ PASS — ES — Scenario 8.1: happy path completo → SAU2904266 → name → pueblo → maquina → puerta → escalation

**Dialog:**

👤 **user:** Tengo un código y no sé cómo usarlo.

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?
```

👤 **user:** SAU2904266

🤖 **bot:**

```
¡Gracias! 👍 ¿Cuál es tu nombre?
```

👤 **user:** Andrea

🤖 **bot:**

```
¿En qué pueblo / lavandería quieres usarlo?
```

👤 **user:** Goya

🤖 **bot:**

```
¿Qué número de máquina deseas usar?
```

👤 **user:** 5

🤖 **bot:**

```
¿La tienes cargada y con la puerta cerrada?
```

👤 **user:** Sí

🤖 **bot:**

```
Dame un minuto, hacemos las comprobaciones correspondientes. Si el código es correcto, te activaremos la máquina.

**👤 Human Support message**
Usuario Andrea en Goya ha facilitado un código válido (SAU2904266: letras SAU, fecha 2026-04-29, importe a confirmar manualmente) en la máquina nº 5 (puerta cerrada). Requiere validación y activación remota.
```

---

## ✅ PASS — ES — Scenario 8.2: format invalid (1°) → retry → format invalid (2°) → escalate + name

**Dialog:**

👤 **user:** Tengo un código y no sé cómo usarlo.

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?
```

👤 **user:** AB12345

🤖 **bot:**

```
Ese código no encaja con el formato que esperamos (3 letras + fecha + importe, p. ej. SAU2904266). ¿Podrías comprobarlo y escribírmelo de nuevo, por favor?
```

👤 **user:** XYZ123

🤖 **bot:**

```
El código no encaja con el formato esperado, vamos a revisarlo manualmente. ¿Cómo te llamas, por favor?
```

---

## ✅ PASS — ES — Caso 8 edge: skip pueblo + numero se location e maquina già note dal contesto

**Dialog:**

👤 **user:** Estoy en Goya con la lavadora 5 y aparece PUSH PROG

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

👤 **user:** Tengo un código y no sé cómo usarlo.

🤖 **bot:**

```
Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?
```

👤 **user:** SAU2904266

🤖 **bot:**

```
¡Gracias! 👍 ¿Cuál es tu nombre?
```

👤 **user:** Andrea

🤖 **bot:**

```
¿La tienes cargada y con la puerta cerrada?
```

---

## ✅ PASS — ES — Bug D regression: typo "teng un codigo y no se como utilizarlo" → discount flow

**Dialog:**

👤 **user:** teng un codigo y no se como utilizarlo

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?
```

---
