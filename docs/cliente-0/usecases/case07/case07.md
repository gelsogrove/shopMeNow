# Case 7 — He pagado pero no he podido usar el servicio

## SCENARIO

**Objetivo:** Comprobar si la central devolvió el cambio y reconducir al flujo correcto de uso de la máquina.

**Cuándo aplica:** El cliente ha pagado en la central pero no ha llegado a usar la máquina. El bot debe verificar primero si la central devolvió el cambio (lo que indica que el pago se completó correctamente) y, en caso afirmativo, guiar al cliente a través de la pantalla de la máquina para que pueda completar la operación. La mayoría de las veces el problema se resuelve simplemente pulsando el programa deseado tras el mensaje "PUSH PROG". Si tras el paso indicado la máquina no responde, se escala.

**Scenario 7.1 — Happy Path:** El cliente reporta que pagó pero no pudo usar la máquina. El bot pregunta lavandería, confirma devolución del cambio, pide leer la pantalla, identifica "PUSH PROG" y guía al cliente a pulsar el programa. El cliente confirma que ya funciona y el caso queda resuelto sin escalación.

**Scenario 7.2 — Escalación: máquina no responde tras el paso indicado:** El bot sigue el flujo estándar pero, tras pedir al cliente que pulse el programa, la máquina sigue sin responder. El bot pide el nombre y escala a soporte humano.

## ACCEPTANCE CRITERIA

### Generales

- El bot pregunta primero la lavandería antes de cualquier otra cosa
- El bot recoge tipo y número de máquina
- El bot NO escala de inmediato: intenta resolver con la guía de pantalla

### Scenario 7.1 — Happy Path

- Cuando el cliente indica "PUSH PROG", el bot le indica pulsar el programa
- El mensaje final confirma resolución con "perfecto"

### Scenario 7.2 — Escalación: máquina no responde

- Cuando el cliente indica que la máquina sigue sin responder, el bot escala
- Antes de escalar, el bot pregunta el nombre del cliente
- El mensaje de escalación contiene la palabra "operador"
- El mensaje de confirmación final contiene la palabra "desactivado"

---

## CONVERSATION — Case 7 — Scenario 7.1 — Pagado sin usar, resuelto vía pantalla (Happy Path)

**Usuario:** He pagado y no he podido usar la máquina.
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras? (indica la ciudad y la calle).

**Usuario:** Pineda
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 5
**Bot:** ¿La central ha devuelto el cambio?

**Usuario:** PUSH PROG
**Bot:** Presiona un botón de programa para iniciar el lavado.

Programas:
60º Molt calent -> ropa muy sucia, blanca o de trabajo
40º Calent -> ropa normal (algodón, color)
30º Temperat -> ropa delicada o sintética
Frío -> prendas muy delicadas (lana, seda, etc.)

Después de intentarlo, házmelo saber si funciona.

**Usuario:** Ahora sí
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Case 7 — Scenario 7.2 — Escalación: máquina no responde tras paso indicado

**Usuario:** He pagado y no he podido usar la máquina.
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras? Por favor, indícame la ciudad y la calle.

**Usuario:** Pineda
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 5
**Bot:** ¿La central ha devuelto el cambio?

**Usuario:** PUSH PROG
**Bot:** Presiona un botón de programa para iniciar el lavado.

Programas:
60º Molt calent -> ropa muy sucia, blanca o de trabajo
40º Calent -> ropa normal (algodón, color)
30º Temperat -> ropa delicada o sintética
Frío -> prendas muy delicadas (lana, seda, etc.)

Después de intentarlo, házmelo saber si funciona.

**Usuario:** no arranca
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** se ha bloqueado
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación.

¿Como te llamas?

**Usuario:** Luis
**Bot:** Gracias Luis, Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

**👤 Human Support message**
Usuario Luis en Pineda ha efectuado el pago por la lavadora número 5. El cliente seleccionó el programa pero se ha bloqueado. la pantalla muestra: PUSH.

## REPORT LLM

- No se detectaron criterios negativos.
