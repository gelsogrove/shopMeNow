# Case 21 — En Alemanya se han añadido monedas a la secadora y no se han sumado minutos

## SCENARIO

**Scenario 21.1 — Escalation:** El cliente está en Alemanya, usa secadora y reporta que ha añadido dinero/monedas pero los minutos no se han sumado en el contador. El chatbot confirma la localización y escala sin pedir manipulaciones adicionales.

## ACCEPTANCE CRITERIA

### Generales

- El bot confirma que el cliente está en Alemanya.
- El bot reconoce que se trata de una incidencia técnica del local que requiere revisión.
- El bot escala sin pedir al cliente repetir la acción.

### Scenario 21.1 — Escalation

- El bot pregunta: "¿Estás en la lavandería Alemanya?"
- El cliente confirma.
- El bot escala mencionando que la incidencia necesita revisión.
- Mensaje contiene `revisión`, `ayudarte de la manera más adecuada`.

## CONVERSATION — Case 21 — Scenario 21.1 — Alemanya Dryer Coins Not Added

**Usuario:** He puesto más dinero en la secadora y no suma minutos.
**Bot:** Gracias. ¿Estás en la lavandería Alemanya?

**Usuario:** Sí.
**Bot:** De acuerdo. Esa incidencia necesita revisión para poder comprobarla correctamente. ¿Cómo te llamas?

**Usuario:** Raúl.
**Bot:** Gracias Raúl. Un operador se encargará de tu caso a la mayor brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes?

**👤 Human Support message**
Usuario Raúl en Alemanya reporta incidencia: añadió dinero a secadora pero minutos no se sumaron. Incidencia técnica del local. Requiere revisión.

## REPORT LLM

- No se detectaron criterios negativos.
