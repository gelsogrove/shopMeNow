# Case 16 — La máquina muestra ALM, ALN o un código de alarma similar

## SCENARIO

**Scenario 16.1 — Escalation:** El cliente reporta que la máquina muestra un código de alarma genérico (ALM, ALN, ALN A, ALN N o similar). El chatbot reconoce que se trata de una alarma de máquina y escala sin pedir más manipulaciones al cliente.

## ACCEPTANCE CRITERIA

- El bot recoge la localización antes de escalar.
- El bot reconoce el código como alarma de máquina.
- El bot NO pide al cliente reintentar ni manipular la máquina.
- Tono tranquilo y profesional.

## CONVERSATION — Case 16 — Scenario 16.1 — ALN/ALM Generic Alarm

**Usuario:** La secadora pone ALN.
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** Alemanya.
**Bot:** Entendido. Ese mensaje indica que la máquina ha detectado una incidencia y tenemos que revisarlo. ¿Cómo te llamas?

**Usuario:** Pere.
**Bot:** Gracias Pere. Un operador se encargará de tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica?

**👤 Human Support message**
Usuario Pere en Alemanya reporta código de alarma ALN en secadora. Requiere revisión técnica de la máquina.

## REPORT LLM

- No se detectaron criterios negativos.
