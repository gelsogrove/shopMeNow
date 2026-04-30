# Case 2 — La lavadora no funciona y aparece DOOR

## SCENARIO

**Scenario 2.1 — Happy Path:** El cliente reporta que la lavadora no arranca y el display indica DOOR. El chatbot pregunta si hay mucha ropa dentro. Si hay, sugiere vaciar un poco. Si no, pide abrir y cerrar con un ligero empujón hasta escuchar un clic. Tras este paso, el chatbot recoge localización y número de máquina. El cliente confirma que ahora funciona y el caso se resuelve sin escalación.

**Scenario 2.2 — Escalation Path:** El flujo es el mismo hasta el intento de resolver con la ropa/cierre de puerta. Si DOOR persiste tras repetir el paso, el chatbot pide localización y número de máquina, verifica nuevamente el código del display, y si sigue mostrando DOOR, pide el nombre del cliente y escala a soporte humano con resumen.

## ACCEPTANCE CRITERIA

### Generales (ambos escenarios)

- El primer mensaje contiene un saludo de bienvenida con tono cálido
- Todas las respuestas del bot deben estar en el mismo idioma del cliente (nunca en inglés ni en otro idioma)
- Si el problema es técnico de lavadora, solicita qué aparece en la pantalla antes de proponer pasos de solución
- Cuando el display es DOOR, después de recoger localización y número de máquina, el bot pregunta si hay mucha ropa dentro de la lavadora antes de proponer la solución técnica
- Si el cliente dice que SÍ hay mucha ropa, el bot recomienda vaciar un poco y reintentar
- Si el cliente dice que NO hay mucha ropa, el bot pide: "Ábrela y ciérrala con un ligero empujón hasta que escuches un clic"
- Cuando el cliente responde que DOOR persiste, el bot pide al cliente que escriba lo que ve en la pantalla con la frase: "Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes"

### Scenario 2.1 — Happy Path (DOOR resuelto con vaciar ropa)

- Cuando el cliente dice que SÍ hay mucha ropa, el bot recomienda vaciar un poco de ropa e intentar de nuevo
- El bot explica que un exceso de carga puede impedir que la puerta cierre correctamente
- Cuando el cliente confirma "Sí" (la lavadora arrancó), el bot cierra el caso con un mensaje positivo que contiene "perfecto" y "correctamente"
- En el Scenario 2.1 el bot NO debe escalar a operador

### Scenario 2.2 — Escalation Path (DOOR persiste)

- Si el cliente dice que NO hay mucha ropa y aplica la instrucción "Ábrela y ciérrala con un ligero empujón hasta que escuches un clic", el bot debe verificar nuevamente el display
- Si DOOR persiste tras repetir el paso, el bot pregunta al cliente con la frase exacta: "Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes"
- Cuando el cliente confirma que DOOR sigue, el bot anuncia escalación con un mensaje que contiene "operador" y menciona explícitamente "puerta" o "DOOR"
- Antes de escalar, el bot pregunta el nombre del cliente con la frase "¿Cómo te llamas?"
- Tras confirmar la escalación, el bot anuncia que un operador se encargará "en la máxima brevedad posible" y pregunta si acepta recibir una llamada telefónica
- El mensaje final al operador (Human Support message) resume nombre, localización, número de máquina y estado del display DOOR
- En el Scenario 2.2 el bot NO debe cerrar el caso como resuelto

---

## CONVERSATION — Case 2 — Scenario 2.1 — DOOR (Happy Path)

**Usuario:** La lavadora no arranca
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** DOOR
**Bot:** ¿En qué pueblo está la lavandería autoservicio?

**Usuario:** Hortes
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2
**Bot:** ¿Has puesto mucha ropa dentro de la lavadora?

**Usuario:** Sí, bastante
**Bot:** Te recomiendo que vacíes un poco de ropa e intentes de nuevo. A veces, un exceso de carga impide que la puerta cierre correctamente.

**Usuario:** Sí
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## CONVERSATION — Case 2 — Scenario 2.2 — DOOR (Escalation Path)

**Usuario:** La lavadora no arranca
**Bot:** ¡Hola! Soy el asistente virtual de la lavandería, estoy aquí para ayudarte. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** DOOR
**Bot:** ¿En qué pueblo está la lavandería autoservicio?

**Usuario:** Hortes
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2
**Bot:** ¿Has puesto mucha ropa dentro de la lavadora?

**Usuario:** NO
**Bot:** Ábrela y ciérrala con un ligero empujón hasta que escuches un clic. Después de intentarlo, házmelo saber si funciona.

**Usuario:** DOOR
**Bot:** Una vez que hayas hecho eso, házmelo saber si la máquina ha comenzado a funcionar.

**Usuario:** DOOR
**Bot:** Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

¿Como te llamas?

**Usuario:** Carlos
**Bot:** Gracias Carlos, Un operador humano se encargará de tu caso en la máxima brevedad posible. ¿Aceptas recibir una llamada telefónica por uno de nuestros agentes para que pueda ayudarte ahora?

**👤 Human Support message**
Usuario Carlos en Hortes ha reportado un problema técnico por la lavadora número 2. El cliente seleccionó el programa pero La lavadora no arranca. la pantalla muestra: DOOR.

## REPORT LLM

- No se detectaron criterios negativos.
