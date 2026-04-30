# Case 13 — Escalado por código de alarma o incoherencia

## SCENARIO

**Objetivo:** Escalar el caso a soporte humano sin confrontar al cliente cuando aparece un código de alarma genérico (ALN, ALM no documentado, 001 standalone) o el relato es incoherente.

**Cuándo aplica:** El cliente reporta un código tipo ALN, ALM (distinto de AL001 que tiene su propio flujo en case 5), 001 u otro código no documentado. El bot NO intenta resolver técnicamente: reconoce que es una incidencia interna que requiere revisión manual y escala el caso pidiendo el nombre del cliente. La escalación es directa, sin pasar por troubleshooting.

**Scenario 13.1 — Escalación directa:** El cliente reporta un código de alarma. El bot reconoce la incidencia, pide el nombre y escala con el mensaje de cierre estándar.

## ACCEPTANCE CRITERIA

### Scenario 13.1 — Escalación directa

- El bot pide el nombre del cliente con la frase "¿Cómo te llamas?"
- El primer mensaje del bot contiene la palabra "operador"

---

## CONVERSATION — Case 13 — Scenario 13.1 — Escalación directa por código de alarma

**Usuario:** He pagado y ahora sale ALN.
**Bot:** Gracias por avisarnos. La máquina ha detectado una incidencia interna que necesitamos revisar manualmente. ⚠️ Voy a derivar tu caso a un operador. ¿Cómo te llamas?

**Usuario:** Sofía
**Bot:** Gracias Sofía, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario Sofía en ubicación no identificada ha reportado un problema técnico por la lavadora número número desconocido. El cliente seleccionó el programa pero Alarm/incoherence: He pagado y ahora sale ALN.. sin información de pantalla.

## REPORT LLM

- No se detectaron criterios negativos.
