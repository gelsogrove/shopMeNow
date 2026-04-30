# Case 4 — He pagado y no se ha activado, y la central no ha devuelto el cambio

## SCENARIO

**Objetivo:** Detectar un posible error de selección de máquina.

**Cuándo aplica:** El cliente ha pagado, la máquina no se activa y la central no ha devuelto el cambio.

**Scenario 4.1 — Happy Path:** El bot recoge localización, tipo de máquina y número, y pregunta si la central devolvió el cambio. Ante la respuesta negativa, sugiere que se marcó mal el número y pide revisar el saldo en la central. El cliente confirma que la máquina ya ha arrancado.

**Scenario 4.2 — Escalación: máquina sigue sin activarse:** Igual que 4.1 hasta el suggerimiento de revisar el saldo. El cliente responde que sigue sin poder activarla. El bot pide el nombre y escala a soporte humano.

**Scenario 4.3 — Escalación: código de pantalla no documentado:** El cliente menciona en su primer mensaje un código de pantalla que el bot no reconoce. El bot no pregunta por el display (el cliente ya lo ha informado). Recoge localización, tipo y número de máquina, luego escala indicando el código desconocido.

## ACCEPTANCE CRITERIA

### Generales (todos los escenarios)

- El primer mensaje del bot contiene un saludo de bienvenida con tono cálido
- El bot recoge la localización (pueblo/calle) antes de proponer cualquier solución
- El bot pregunta el tipo de máquina (lavadora/secadora) y el número de la misma

### Scenario 4.1 — Happy Path

- El bot pregunta si la central ha devuelto el cambio
- Si la respuesta es "No", el bot sugiere que se marcó mal el número de máquina y pide revisar el saldo en la central
- El caso se cierra correctamente cuando el cliente confirma que la máquina ha arrancado
- El bot NO escala a operador

### Scenario 4.2 — Máquina sigue sin activarse

- El bot sugiere revisar el saldo en la central (igual que 4.1)
- Si el cliente indica que sigue sin poder activarla, el bot pide qué aparece en la pantalla de la central de pago y de la máquina antes de escalar (mensaje contiene "pantalla de la central de pago" y "pantalla de la máquina")
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje al operador incluye localización, tipo y número de máquina, y que la máquina sigue sin activarse

### Scenario 4.3 — Código no documentado

- El cliente menciona el código en su primer mensaje; el bot no lo solicita
- Tras recoger localización, tipo y número de máquina, el bot escala indicando el código desconocido
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje al operador incluye el código, la localización y el número de máquina

---

## CONVERSATION — Case 4 — Scenario 4.1 — Happy Path

**Usuario:** He pagado y no se ha activado
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Goya
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** La 4
**Bot:** ¿La central ha devuelto el cambio?

**Usuario:** No
**Bot:** Es posible que se haya marcado mal el número de máquina. Revisa, por favor, el saldo en la central y prueba otra vez con el número correcto. Dime si la máquina ya se ha activado.

**Usuario:** Sí, ahora ya se ha puesto en marcha
**Bot:** ✅ Perfecto. La máquina ha arrancado correctamente.

---

## CONVERSATION — Case 4 — Scenario 4.2 — Máquina sigue sin activarse (Escalación)

**Usuario:** He pagado y no se ha activado
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Goya
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** La 4
**Bot:** ¿La central ha devuelto el cambio?

**Usuario:** No
**Bot:** Es posible que se haya marcado mal el número de máquina. Revisa, por favor, el saldo en la central y prueba otra vez con el número correcto. Dime si la máquina ya se ha activado.

**Usuario:** Sigo sin poder activarla
**Bot:** ⚠️ Vamos a notificar al operador para revisar el caso. Pero antes dime qué te pone en la pantalla de la central de pago, y en la pantalla de la máquina, para que te dirija a la persona adecuada.

¿Como te llamas?

**Usuario:** María
**Bot:** Gracias María, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario María en Goya ha efectuado el pago por la lavadora número 4. El cliente seleccionó el programa pero La máquina sigue sin activarse tras revisar el saldo en la central.. sin información de pantalla.

---

## CONVERSATION — Case 4 — Scenario 4.3 — Código de pantalla no documentado (Escalación)

**Usuario:** He pagado y no se ha activado, aparece E5 en la pantalla
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Goya
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** La 4
**Bot:** ⚠️ El código E5 no está documentado. Tenemos que notificar al operador para que revise el caso.

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario Carlos en Goya ha efectuado el pago por la lavadora número 4. El cliente seleccionó el programa pero no se ha activado, aparece E5 en la pantalla. la pantalla muestra: E5.

## REPORT LLM

- No se detectaron criterios negativos.
