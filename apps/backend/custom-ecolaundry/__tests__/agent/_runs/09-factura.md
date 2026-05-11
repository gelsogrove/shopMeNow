# Agent test dialogues — `09-factura.test.spec.ts`

Generated: 2026-05-10T21:12:21.593Z
Total: 3 | Pass: 3 | Fail: 0

## ✅ PASS — ES — Scenario 9.1: happy path completo → 8 step + email valido al primo tentativo → summary

**Dialog:**

👤 **user:** Quiero una factura

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Claro, te ayudo con la factura. ¿En qué lavandería estuviste?
```

👤 **user:** Goya

🤖 **bot:**

```
Gracias. ¿Utilizaste lavadora o secadora?
```

👤 **user:** lavadora

🤖 **bot:**

```
Perfecto. ¿Me indicas la razón social?
```

👤 **user:** ACME SL

🤖 **bot:**

```
¿Y la dirección?
```

👤 **user:** Calle Mayor 1, Madrid

🤖 **bot:**

```
¿Cuál es tu CIF/NIF/NIE?
```

👤 **user:** B12345678

🤖 **bot:**

```
¿Qué día utilizaste el servicio? (puedes decirme "hoy", "ayer" o una fecha)
```

👤 **user:** ayer

🤖 **bot:**

```
¿A qué correo electrónico te enviamos la factura?
```

👤 **user:** ana@example.com

🤖 **bot:**

```
¿Quieres añadir alguna nota u observación para la factura? (Si no necesitas añadir nada, escribe "no".)
```

👤 **user:** no

🤖 **bot:**

```
Por último, ¿cuál es tu nombre?
```

👤 **user:** Andrea

🤖 **bot:**

```
Gracias Andrea, te enviaremos pronto la factura del 2026-05-09 a tu correo: ana@example.com. 📧

🔒 Tus datos (razón social, CIF/NIF, dirección, correo) se usan únicamente para emitir la factura y no se comparten con terceros.

**👤 Human Support message**
El domingo 10 de mayo a las 23:12, Usuario Andrea en Goya ha solicitado factura. Datos: razón social: ACME SL; dirección: Calle Mayor 1, Madrid; CIF/NIF: B12345678; fecha de uso: ayer (2026-05-09); máquina: lavadora; email: ana@example.com.
```

---

## ✅ PASS — ES — Scenario 9.2: email invalido al primo tentativo → re-ask → email valido al secondo

**Dialog:**

👤 **user:** Quiero una factura

🤖 **bot:**

```
👋 Hola, soy el asistente virtual de la lavandería. Claro, te ayudo con la factura. ¿En qué lavandería estuviste?
```

👤 **user:** Goya

🤖 **bot:**

```
Gracias. ¿Utilizaste lavadora o secadora?
```

👤 **user:** lavadora

🤖 **bot:**

```
Perfecto. ¿Me indicas la razón social?
```

👤 **user:** ACME SL

🤖 **bot:**

```
¿Y la dirección?
```

👤 **user:** Calle Mayor 1, Madrid

🤖 **bot:**

```
¿Cuál es tu CIF/NIF/NIE?
```

👤 **user:** B12345678

🤖 **bot:**

```
¿Qué día utilizaste el servicio? (puedes decirme "hoy", "ayer" o una fecha)
```

👤 **user:** ayer

🤖 **bot:**

```
¿A qué correo electrónico te enviamos la factura?
```

👤 **user:** ana

🤖 **bot:**

```
El correo no parece válido. ¿Puedes escribírmelo de nuevo, por favor?
```

👤 **user:** ana@example.com

🤖 **bot:**

```
¿Quieres añadir alguna nota u observación para la factura? (Si no necesitas añadir nada, escribe "no".)
```

👤 **user:** ninguna

🤖 **bot:**

```
Por último, ¿cuál es tu nombre?
```

👤 **user:** Andrea

🤖 **bot:**

```
Gracias Andrea, te enviaremos pronto la factura del 2026-05-09 a tu correo: ana@example.com. 📧

🔒 Tus datos (razón social, CIF/NIF, dirección, correo) se usan únicamente para emitir la factura y no se comparten con terceros.

**👤 Human Support message**
El domingo 10 de mayo a las 23:12, Usuario Andrea en Goya ha solicitado factura. Datos: razón social: ACME SL; dirección: Calle Mayor 1, Madrid; CIF/NIF: B12345678; fecha de uso: ayer (2026-05-09); máquina: lavadora; email: ana@example.com.
```

---

## ✅ PASS — ES — Caso 9 edge: skip lavandería + tipo se già noti da turni precedenti

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

👤 **user:** Necesito una factura

🤖 **bot:**

```
Perfecto. ¿Me indicas la razón social?
```

---
