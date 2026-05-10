# Ecolaundry Chatbot - Usecases

## Índice de casos

- [Caso 1 — La lavadora no funciona y aparece PUSH PROG](#caso-1--la-lavadora-no-funciona-y-aparece-push-prog)
  - [1.1 — PUSH PROG Happy Path](#11--push-prog-happy-path)
  - [1.2 — PUSH PROG Escalación: máquina no responde tras pulsar](#12--push-prog-escalación-máquina-no-responde-tras-pulsar)
- [Caso 2 — La lavadora no funciona y aparece DOOR](#caso-2--la-lavadora-no-funciona-y-aparece-door)
  - [2.1 — DOOR Happy Path](#21--door-happy-path)
  - [2.2 — DOOR Escalación: puerta bloqueada tras repetir el paso](#22--door-escalación-puerta-bloqueada-tras-repetir-el-paso)
- [Caso 3 — La lavadora no funciona y aparece SEL](#caso-3--la-lavadora-no-funciona-y-aparece-sel)
  - [3.1 — SEL Happy Path](#31--sel-happy-path)
  - [3.2 — SEL Escalación: error persiste tras repetir selección](#32--sel-escalación-error-persiste-tras-repetir-selección)
- [Caso 4 — He pagado y no se ha activado, y la central no ha devuelto el cambio](#caso-4--he-pagado-y-no-se-ha-activado-y-la-central-no-ha-devuelto-el-cambio)
  - [4.1 — No-change Happy Path](#41--no-change-happy-path)
  - [4.2 — No-change Escalación: cambio devuelto pero máquina no arranca](#42--no-change-escalación-cambio-devuelto-pero-máquina-no-arranca)
- [Caso 5 — Error AL001](#caso-5--error-al001)
  - [5.1 — AL001 Happy Path](#51--al001-happy-path)
  - [5.2 — AL001 Escalación: cliente no puede seguir instrucciones](#52--al001-escalación-cliente-no-puede-seguir-instrucciones)
  - [5.3 — AL001 Escalación: error persiste tras reinicio correcto](#53--al001-escalación-error-persiste-tras-reinicio-correcto)
- [Caso 6 — Me han cobrado dos veces](#caso-6--me-han-cobrado-dos-veces)
  - [6.1 — Doble cobro, servicio completado (Happy Path)](#61--doble-cobro-servicio-completado-happy-path)
  - [6.2 — Escalación: cliente muy molesto que exige atención humana](#62--escalación-cliente-muy-molesto-que-exige-atención-humana)
  - [6.3 — Escalación: relato inconsistente o importe no cuadra](#63--escalación-relato-inconsistente-o-importe-no-cuadra)
  - [6.4 — Doble cobro SIN haber usado el servicio](#64--doble-cobro-sin-haber-usado-el-servicio)
  - [6.5 — Validación de los 4 últimos dígitos de la tarjeta](#65--validación-de-los-4-últimos-dígitos-de-la-tarjeta)
- [Caso 7 — He pagado pero no he podido usar el servicio](#caso-7--he-pagado-pero-no-he-podido-usar-el-servicio)
  - [7.1 — Pagado sin usar, resuelto vía pantalla PUSH PROG (Happy Path)](#71--pagado-sin-usar-resuelto-vía-pantalla-push-prog-happy-path)
  - [7.2 — Pagado sin usar, máquina no responde tras paso indicado (Escalación)](#72--pagado-sin-usar-máquina-no-responde-tras-paso-indicado-escalación)
- [Caso 8 — Tengo un código de descuento](#caso-8--tengo-un-código-de-descuento)
  - [8.1 — Código: Happy Path (bot pide solo el código)](#81--código-happy-path-bot-pide-solo-el-código)
  - [8.2 — Código: Variante (misma respuesta canned)](#82--código-variante-misma-respuesta-canned)
- [Caso 9 — Quiero una factura](#caso-9--quiero-una-factura)
  - [9.1 — Factura Happy Path](#91--factura-happy-path)
  - [9.2 — Factura: email inválido → re-ask](#92--factura-email-inválido--re-ask)
- [Caso 10 — Cómo comprar la tarjeta de fidelización](#caso-10--cómo-comprar-la-tarjeta-de-fidelización)
- [Caso 11 — Cómo recargar la tarjeta de fidelización](#caso-11--cómo-recargar-la-tarjeta-de-fidelización)
- [Caso 12 — Horarios y precios](#caso-12--horarios-y-precios)
- [Caso 13 — Escalado por código de alarma o incoherencia](#caso-13--escalado-por-código-de-alarma-o-incoherencia)
- [Caso 14 — La lavadora muestra ALM DOOR](#caso-14--la-lavadora-muestra-alm-door)
- [Caso 15 — La máquina muestra 001](#caso-15--la-máquina-muestra-001)
- [Caso 16 — La máquina muestra ALM, ALN o un código de alarma similar](#caso-16--la-máquina-muestra-alm-aln-o-un-código-de-alarma-similar)
- [Caso 17 — El cliente no sabe qué aparece en pantalla](#caso-17--el-cliente-no-sabe-qué-aparece-en-pantalla)
- [Caso 18 — El cliente da un código solo numérico y dice que no hay letras](#caso-18--el-cliente-da-un-código-solo-numérico-y-dice-que-no-hay-letras)
- [Caso 19 — El cliente dice que el datáfono ha cobrado 10 € en Goya](#caso-19--el-cliente-dice-que-el-datáfono-ha-cobrado-10--en-goya)
- [Caso 20 — El cliente dice que el datáfono ha cobrado 10 € en Pineda](#caso-20--el-cliente-dice-que-el-datáfono-ha-cobrado-10--en-pineda)
- [Caso 21 — En Alemanya se han añadido monedas a la secadora y no se han sumado minutos](#caso-21--en-alemanya-se-han-añadido-monedas-a-la-secadora-y-no-se-han-sumado-minutos)
- [Caso 22 — En Pineda se han añadido monedas a la secadora y no se han sumado minutos](#caso-22--en-pineda-se-han-añadido-monedas-a-la-secadora-y-no-se-han-sumado-minutos)
- [Caso 23 — En Alemanya no se puede pagar con tarjeta](#caso-23--en-alemanya-no-se-puede-pagar-con-tarjeta)
- [Caso 24 — En Hortes no se puede pagar con tarjeta](#caso-24--en-hortes-no-se-puede-pagar-con-tarjeta)
- [Caso 25 — El cliente está muy enfadado](#caso-25--el-cliente-está-muy-enfadado)
- [Caso 26 — El cliente exige devolución inmediata](#caso-26--el-cliente-exige-devolución-inmediata)
- [Caso 27 — El cliente pide una compensación concreta](#caso-27--el-cliente-pide-una-compensación-concreta)
- [Caso 28 — Relato contradictorio en un doble cobro](#caso-28--relato-contradictorio-en-un-doble-cobro)
- [Caso 29 — El cliente menciona cámaras o revisión técnica](#caso-29--el-cliente-menciona-cámaras-o-revisión-técnica)
- [Caso 30 — Código no documentado en pantalla](#caso-30--código-no-documentado-en-pantalla)
- [Caso 31 — El cliente no indica local](#caso-31--el-cliente-no-indica-local)
- [Caso 32 — El cliente mezcla incidencia de máquina y pago](#caso-32--el-cliente-mezcla-incidencia-de-máquina-y-pago)

---


## Caso 1 — La lavadora no funciona y aparece PUSH PROG

**Objetivo:**  
Ayudar al cliente a iniciar el lavado cuando falta seleccionar el programa.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `PUSH PROG`.

**Trigger (frases típicas del cliente):**
- «La lavadora no funciona»
- «No me arranca la lavadora»
- «Me sale PUSH PROG en la pantalla»
- «No sé qué hacer, me pone PUSH PROG»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Reglas comunes a 1.1 y 1.2:**
- Orden de gather: lavandería → número de máquina → qué aparece en pantalla. **No pregunta «¿has pagado?»** porque cuando aparece PUSH PROG el pago ya se ha hecho.
- Cuando el cliente confirma **PUSH PROG**, el bot indica los 4 programas (60º, 40º, 30º, Frío) y cierra preguntando si la lavadora ha arrancado.
- Las dos ramas (funciona / no funciona) se detallan en 1.1 y 1.2 con sus propios criterios.

---

### 1.1 — PUSH PROG Happy Path

**Objetivo:** El cliente pulsa el programa y la lavadora arranca correctamente.

**Criterios de aceptación:**
- El bot pregunta primero la lavandería y luego el número de máquina (sin pedir confirmación de pago).
- El bot indica los 4 programas (60º, 40º, 30º, Frío) y cierra preguntando si la lavadora ha arrancado.
- Cuando el cliente confirma que funciona, el bot responde con un mensaje positivo (ej. "perfecto, incidencia resuelta").
- La incidencia queda marcada como resuelta y no se escala a un operador.

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo paso a paso. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa un botón de programa para iniciar el lavado.

Programas:
- **60º** (muy caliente) → ropa muy sucia, blanca o de trabajo
- **40º** (templado) → ropa normal (algodón, color)
- **30º** (suave) → ropa delicada o sintética
- **Frío** → prendas muy delicadas (lana, seda, etc.)

Elige uno y púlsalo en la máquina.

Después dime si la lavadora ha arrancado.

**Usuario:** Sí, ahora funciona  
**Bot:** Perfecto, incidencia resuelta. Si vuelve a pasar o aparece otro mensaje en pantalla, dímelo y te sigo ayudando.

---

### 1.2 — PUSH PROG Escalación: máquina no responde tras pulsar

**Objetivo:** El cliente pulsa el programa pero la máquina sigue sin
arrancar; el bot escala a soporte humano de manera uniforme con los
demás casos (Caso 5.2/5.3, Caso 7.2).

**Criterios de aceptación:**
- Tras la instrucción del programa, el cliente indica que la máquina no responde ("he pulsado pero no responde", "sigue sin arrancar").
- Antes de pasar el caso a un operador, el bot pide al cliente que confirme una vez más qué aparece exactamente en pantalla (para evitar escalar por una respuesta ambigua).
- Cuando el cliente confirma de nuevo "PUSH PROG", el bot anuncia que pasa el caso a un operador y pide el nombre del cliente.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.
- El resumen para el operador incluye: nombre del cliente, lavandería, número de máquina y código de pantalla "PUSH PROG" (literal del cliente).

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** De acuerdo. ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa un botón de programa para iniciar el lavado.

Programas:
- **60º** (muy caliente) → ropa muy sucia, blanca o de trabajo
- **40º** (templado) → ropa normal (algodón, color)
- **30º** (suave) → ropa delicada o sintética
- **Frío** → prendas muy delicadas (lana, seda, etc.)

Elige uno y púlsalo en la máquina.

Después dime si la lavadora ha arrancado.

**Usuario:** He pulsado pero no responde  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** PUSH PROG  
**Bot:** ⚠️ Si nada ha funcionado, vamos a notificar al **operador** para que revise el caso. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será **desactivado**.

**👤 Human Support message** *(al operador)*  
Usuario Andrea en Goya ha pagado pero la lavadora número 5 no responde tras pulsar el programa. Pantalla muestra PUSH PROG. Requiere revisión manual.

---

## Caso 2 — La lavadora no funciona y aparece DOOR

**Objetivo:**  
Ayudar al cliente a cerrar correctamente la puerta.

**Cuándo aplica:**  
El cliente indica que en pantalla aparece `DOOR`.

**Trigger (frases típicas del cliente):**
- «La lavadora no arranca»
- «Me sale DOOR»
- «No se cierra la puerta»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Reglas comunes a 2.1 y 2.2:**
- Orden de gather: lavandería → número de máquina → qué aparece en pantalla.
- Cuando el cliente confirma **DOOR**, el bot indica abrir y cerrar bien la puerta hasta oír un clic, comprobar que no haya prendas atrapadas, y cierra preguntando si la lavadora arranca.
- Las dos ramas (resuelto / escalación) se detallan en 2.1 y 2.2 con sus propios criterios.

---

### 2.1 — DOOR Happy Path

**Objetivo:** El cliente confirma que la lavadora arranca tras cerrar bien la puerta.

**Criterios de aceptación:**
- El bot pregunta la lavandería y el número de máquina antes de dar la indicación DOOR.
- El bot explica que la puerta no está bien cerrada y pide abrirla y cerrarla firmemente, comprobando que no haya prendas atrapadas.
- Tras la indicación, el bot pide al cliente que confirme si la lavadora ha arrancado.
- Cuando el cliente confirma que funciona, el bot cierra con un mensaje positivo (ej. "perfecto, la lavadora ha comenzado correctamente").
- El bot no pasa el caso a un operador en este escenario.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** 👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?

**Usuario:** Hortes  
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** DOOR  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala firmemente, comprobando que no haya ropa atascada. Dime si la lavadora ha arrancado.

**Usuario:** Sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 2.2 — DOOR Escalación: puerta bloqueada tras repetir el paso

**Objetivo:** El cliente cierra la puerta pero DOOR persiste. El bot re-pregunta el código y escala.

**Criterios de aceptación:**
- Si el código DOOR sigue apareciendo después de repetir el paso, el bot pide al cliente que vuelva a confirmar exactamente qué código aparece en pantalla.
- Cuando el cliente confirma de nuevo "DOOR", el bot anuncia que pasa el caso a un operador y pide el nombre del cliente.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.
- El resumen para el operador incluye el contexto de la puerta para que el operador sepa el problema desde el primer momento.
- El resumen al operador contiene nombre, localización, número de máquina y estado DOOR.
- El bot NO cierra el caso como resuelto en este escenario.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** 👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?

**Usuario:** Hortes  
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** DOOR  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala firmemente, comprobando que no haya ropa atascada. Dime si la lavadora ha arrancado.

**Usuario:** NO  
**Bot:** Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** DOOR  
**Bot:** ⚠️ La puerta sigue bloqueada incluso después de repetir los pasos. Tenemos que notificar al operador ahora para que revise la lavadora manualmente. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso.

👤 **Human Support:** Usuario Carlos en Hortes — pantalla DOOR tras repetir cierre, lavadora número 2. Requiere revisión manual del cierre de puerta.

---

## Caso 3 — La lavadora no funciona y aparece SEL

**Objetivo:**  
Ayudar al cliente cuando la máquina está pendiente de selección.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `SEL`.

**Trigger (frases típicas del cliente):**
- «He pagado pero la lavadora no empieza»
- «Me sale SEL»
- «La pantalla pone SEL»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Reglas comunes a 3.1 y 3.2:**
- Orden de gather: lavandería → número de máquina → qué aparece en pantalla.
- Cuando el cliente confirma **SEL**, el bot explica que la máquina está pendiente de selección y le pide comprobar que ha pulsado bien el número de la máquina en la central de pago.
- A diferencia del Caso 1 (PUSH PROG), aquí el bot **no** muestra los 4 programas: el problema es de selección, no de elección de programa.
- Las dos ramas (resuelto / escalación) se detallan en 3.1 y 3.2.

---

### 3.1 — SEL Happy Path

**Objetivo:** El cliente confirma que la máquina arranca tras seguir la instrucción.

**Criterios de aceptación:**
- El bot pregunta la lavandería y el número de máquina antes de dar la indicación SEL.
- El bot explica que la máquina está pendiente de selección y pide comprobar que se ha pulsado bien el número de la máquina en la central de pago.
- Cuando el cliente confirma que la máquina arranca, el bot cierra con un mensaje positivo (ej. "perfecto, la lavadora ha comenzado correctamente").

**Conversación:**

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 3  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago. Después dime si la lavadora ha arrancado.

**Usuario:** Ahora sí funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 3.2 — SEL Escalación: error persiste tras repetir selección

**Objetivo:** El cliente repite la selección pero la máquina sigue mostrando SEL. El bot pide el código exacto y escala.

**Criterios de aceptación:**
- Si el cliente indica que la máquina no arranca, el bot pide al cliente que vuelva a confirmar exactamente qué aparece en pantalla.
- Cuando el cliente confirma de nuevo "SEL", el bot anuncia que pasa el caso a un operador y pide el nombre del cliente.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.
- El resumen para el operador incluye: nombre del cliente, lavandería, número de máquina y código "SEL".

**Conversación:**

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 3  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina en la central de pago. Después dime si la lavadora ha arrancado.

**Usuario:** Aun no arranca  
**Bot:** Por favor, escribe solo lo que ves en la pantalla, los números y las letras tal y como aparecen en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** SEL  
**Bot:** ⚠️ La pantalla sigue mostrando SEL incluso después de repetir la selección. Tenemos que notificar al operador ahora para que revise la lavadora manualmente. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso.

👤 **Human Support:** Usuario Luis en Pineda — pantalla SEL tras repetir selección, lavadora número 3.

---

## Caso 4 — He pagado y no se ha activado, y la central no ha devuelto el cambio

**Objetivo:**  
Detectar un posible error de selección de máquina.

**Cuándo aplica:**  
El cliente ha pagado, la máquina no se activa y la central no ha devuelto el cambio.

**Trigger (frases típicas del cliente):**
- «He pagado y no se ha activado»
- «Pagué pero no arranca»
- «No me funciona después de pagar»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Reglas comunes a 4.1 y 4.2:**
- Orden de gather: lavandería → tipo de máquina → número de máquina → ¿la central ha devuelto el cambio? En este caso **no** se pregunta qué aparece en pantalla: la pregunta del cambio reemplaza la del display.
- Si el cliente responde **«No»** (la central no ha devuelto el cambio), el bot le explica que probablemente no se ha marcado bien el número de la máquina y le pide que mire si queda saldo en la central y pulse de nuevo el número correcto. Ver 4.1.
- Si el cliente responde **«Sí, pero la máquina sigue sin arrancar»**, el bot pasa el caso directamente a un operador (la central hizo su parte, no es un simple error de marcación). Ver 4.2.

---

### 4.1 — No-change Happy Path

**Objetivo:** Tras la guía sobre marcar el número correcto, la máquina arranca.

**Criterios de aceptación:**
- El bot pregunta la lavandería, el tipo de máquina y el número de máquina antes de preguntar por el cambio.
- Cuando el cliente dice que la central **no** ha devuelto el cambio, el bot le pide que revise el saldo en la central y vuelva a marcar el número correcto.
- Cuando el cliente confirma que la máquina ya ha arrancado, el bot cierra con un mensaje positivo (ej. "perfecto, ya estaría resuelto").
- La incidencia queda marcada como resuelta y no se pasa a un operador.

**Conversación:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** Perfecto. ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** De acuerdo. ¿La central te ha devuelto el cambio?

**Usuario:** No  
**Bot:** Es posible que no se haya marcado bien el número de la máquina. Mira si todavía aparece saldo en la central y pulsa correctamente el botón correspondiente.

**Usuario:** Sí, ahora ya se ha puesto en marcha  
**Bot:** Perfecto, ya estaría resuelto.

---

### 4.2 — No-change Escalación: cambio devuelto pero máquina no arranca

**Objetivo:** Si la central devolvió el cambio pero la máquina sigue sin
arrancar, el bot escala uniformemente con los demás casos.

**Criterios de aceptación:**
- Cuando el cliente confirma que la central **sí** ha devuelto el cambio (la central cobró correctamente) pero la máquina sigue sin arrancar, el bot pasa el caso directamente a un operador sin pedir más datos: no es un error de marcación, es una avería real.
- El bot anuncia que pasa el caso a un operador y pide el nombre del cliente.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.
- El resumen para el operador incluye: nombre del cliente, lavandería, número de máquina y tipo (lavadora/secadora).

**Conversación:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** ¿La central te ha devuelto el cambio?

**Usuario:** Sí, pero la máquina no arranca  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un **operador** humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será **desactivado**.

**👤 Human Support message** *(al operador)*  
Usuario Andrea en Goya ha pagado pero la lavadora número 4 no se ha activado tras corregir el número en la central. Requiere revisión manual.

---

## Caso 5 — Error AL001

**Objetivo:**  
Explicar el motivo del error y corregir la secuencia de uso.

**Cuándo aplica:**  
El cliente indica que aparece `AL001`.

**Trigger (frases típicas del cliente):**
- «Me sale AL001»
- «AL 001 en la pantalla»
- «Tengo alarma 001»
- «Alarm 001»
- «ALM 001»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Reglas comunes a 5.1, 5.2 y 5.3:**
- El bot reconoce el código aunque el cliente lo escriba de forma natural (ej. «AL001», «AL 001», «ALM 001», «alarm 001», «alarma 001»): todos llevan al mismo flujo.
- Orden de gather: lavandería → tipo de máquina → número de máquina.
- Una vez tiene los 3 datos, el bot le explica la **secuencia correcta de 6 pasos** (cargar la máquina, cerrar la puerta, ir a la central, pagar, seleccionar el número, recoger el cambio si toca, ir a la máquina, elegir el programa, y avisar si funciona).
- Las tres ramas (resuelto / no entiende los pasos / error persiste) se detallan en 5.1, 5.2 y 5.3.

**Desviación documentada respecto al Playbook PDF (Andrea, 2026-05-09):**
El Playbook §5.5 («Error AL001») describe únicamente *«Digues-me en quin local ets i què has fet just abans que apareguís»* como pregunta diagnóstica, sin detallar los 6 pasos. Nuestro flujo amplía esa respuesta con la secuencia educativa completa porque resulta más útil para clientes que no saben en qué punto del proceso fallaron. La regla del PDF *«Escalar si: el client no pot seguir les instruccions»* sigue cubierta por los Scenarios 5.2 y 5.3.

---

### 5.1 — AL001 Happy Path

**Objetivo:** Explicar el motivo del error y corregir la secuencia de uso. El cliente confirma que funciona.

**Criterios de aceptación:**
- El bot pregunta la lavandería, el tipo de máquina y el número antes de dar la instrucción.
- El bot explica los 6 pasos de la secuencia correcta (carga, cierre, pago, selección, programa, aviso).
- Cuando el cliente confirma que la máquina funciona, el bot cierra con un mensaje positivo (ej. "perfecto, la lavadora ha comenzado correctamente").

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3  
**Bot:** **AL001** significa un error de secuencia. Reinicia el proceso completo: 1. Paga. 2. Selecciona la máquina. 3. Pulsa el programa. 4. Cierra la puerta. 5. Avísame si funciona.

**Usuario:** Sí, ya funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 5.2 — AL001 Escalación: cliente no puede seguir instrucciones

**Objetivo:** El cliente no entiende cómo aplicar la secuencia. El bot escala.

**Criterios de aceptación:**
- Si el cliente indica que no entiende cómo seguir las instrucciones, el bot pasa el caso a un operador.
- Antes de cerrar, el bot pide el nombre del cliente.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3  
**Bot:** **AL001** significa un error de secuencia. [instrucciones de secuencia]

**Usuario:** No entiendo cómo hacerlo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario María en L'Escala — problema técnico lavadora número 3. Pantalla: AL001.

---

### 5.3 — AL001 Escalación: error persiste tras reinicio correcto

**Objetivo:** El cliente ha seguido la secuencia correctamente pero AL001 persiste. El bot confirma el código y escala.

**Criterios de aceptación:**
- Si el cliente dice que ha seguido los pasos pero el error sigue, el bot le pide que confirme una vez más exactamente qué aparece en pantalla.
- Cuando el cliente confirma de nuevo "AL001", el bot pasa el caso a un operador y pide el nombre del cliente.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 3  
**Bot:** **AL001** significa un error de secuencia. [instrucciones de secuencia]

**Usuario:** Lo he hecho bien pero sigue saliendo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** AL001  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Carlos en L'Escala — problema técnico lavadora número 3. Pantalla: AL001.

---

## Caso 6 — Me han cobrado dos veces

**Objetivo:**  
Recoger los datos mínimos para revisión y devolución, distinguiendo entre
"cobrado dos veces y servicio completado" (devolución del cargo extra) y
"cobrado dos veces sin haber usado el servicio" (devolución completa +
servicio no prestado).

**Cuándo aplica:**  
El cliente dice que ha habido doble cobro, independientemente de si ha
podido o no usar la máquina (lavadora/secadora).

**Criterios de aceptación:**
- El bot pregunta primero la **lavandería**, y a continuación si el cliente ha **podido lavar o secar** la ropa. Esa pregunta es el punto de bifurcación del caso:
  - Si el cliente responde **"Sí"** → el bot continúa pidiendo, en este orden, **tipo de máquina** (lavadora o secadora), **número de máquina**, **relato paso a paso** (sugiriendo si ha pasado la tarjeta varias veces por el datáfono), **últimos 4 dígitos de la tarjeta**, **captura del pago** y **nombre del cliente**. Cierra con un mensaje sobre el formulario de devolución, sin pasar el caso a un operador en vivo. Ver 6.1.
  - Si el cliente responde **"No"** → el bot escala inmediatamente al operador y pide el nombre del cliente. **No** pide tipo, número, relato ni dígitos: ese cliente está doblemente frustrado (cobro doble + servicio no prestado), no tiene sentido alargar el gather. El operador recoge los datos faltantes por teléfono. Ver 6.4.
- **Validación de los 4 dígitos** (solo en el flujo Sí): si el cliente escribe 3, 5 o más cifras, o algo que no contiene 4 dígitos exactos, el bot le pide que lo reescriba: **"Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?"**. Si tras un segundo intento sigue sin dar 4 dígitos exactos, el bot pasa el caso a un operador.
- **Escalera de 3 intentos para tipo y número de máquina**: si el cliente no entrega un tipo o un número reconocible, el bot reformula con una pista útil; tras dos intentos fallidos escala al operador.
- El resumen para el operador incluye: nombre del cliente, lavandería, tipo y número de máquina (si se han recogido), si ha podido o no usar el servicio, y el relato o respuesta del cliente.
- **Otras vías de escalación inmediata** (sin llegar a la pregunta "¿has podido?"):
  - Si el cliente está muy enfadado y exige hablar con un operador, el bot escala al instante (6.2).
  - Si el relato del cliente es contradictorio o incoherente, el bot escala (6.3).
- Variantes detalladas en 6.1, 6.2, 6.3, 6.4 y 6.5.

**Desviación documentada respecto al Playbook PDF (Andrea, 2026-05-09):**
El Playbook §5.3 («M'ha cobrat dues vegades») lista 5 preguntas: 1) local, 2) ¿has podido lavar/secar?, 3) relato paso a paso, 4) últimos 4 dígitos, 5) captura del pago. **El PDF NO pide tipo ni número de máquina.** Nuestro flow añade tipo+número en el ramo "Sí" porque facilita al operador identificar la máquina sin tener que preguntárselo por teléfono. La regla del PDF *«Escalar si: el client està molt molest»* sigue cubierta por el Scenario 6.2 (boundary signal `guardAngryCustomerExplicit`). La regla *«Escalar si: el relat és confús»* sigue cubierta por el Scenario 6.3.

**Trigger (frases típicas del cliente):**
- «Me habéis cobrado dos veces con la tarjeta»
- «Doble cobro»
- «Me cobraron dos veces»
- «Charged me twice» (multilingüe)

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

---

### 6.1 — Doble cobro, servicio completado (Happy Path)

**Objetivo:** El cliente aporta todos los datos; el caso queda preparado para revisión sin escalación en vivo.

**Criterios de aceptación:**
- El bot pregunta primero la lavandería y luego "¿has podido lavar o secar la ropa?".
- Cuando el cliente responde **"Sí"**, el bot continúa pidiendo (en este orden) **tipo de máquina**, **número de máquina**, **relato paso a paso** (sugiriendo si ha pasado la tarjeta varias veces por el datáfono), **últimos 4 dígitos de la tarjeta**, **captura del pago** y **nombre del cliente**.
- Si el cliente ya volunteado el tipo y/o el número en una sola frase ("sí, lavadora 5"), el bot no vuelve a preguntar lo que ya sabe y avanza directamente al siguiente paso.
- Para el tipo y para el número se aplica la **escalera de 3 intentos** (canónica → pista → escalación al operador).
- El bot pide los últimos 4 dígitos de la tarjeta. Si el cliente escribe 3, 5 o más cifras (o algo sin 4 dígitos exactos), el bot pide que los reescriba: "Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?". Tras un segundo intento inválido, el bot escala a un operador.
- El mensaje final, tras facilitar el nombre, confirma que se enviará el formulario de devolución.
- El mensaje final NO menciona "operador" ni "desactivado": no es una escalación a un humano en vivo, es un trámite de devolución.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿En qué lavandería te encuentras?

**Usuario:** Goya  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** Sí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** 5  
**Bot:** De acuerdo. ¿Podrías explicarme, por favor, paso a paso qué has hecho desde que has entrado? ¿Es posible que hayas pasado varias veces la tarjeta por el datáfono?

**Usuario:** He pagado, no iba y volví a pasar la tarjeta.  
**Bot:** ¡Gracias! Para revisarlo bien, ¿podrías indicarme los últimos 4 dígitos de la tarjeta?

**Usuario:** 4821  
**Bot:** ¡Perfecto! ¿Podrías enviarme una captura del pago? Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contáctanos y te ayudamos al momento. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Hemos recibido toda la información necesaria para tu caso. Vamos a revisar tu situación y te enviaremos un formulario de reembolso. Si necesitas algo más, aquí estoy para ayudarte.

---

### 6.2 — Escalación: cliente muy molesto que exige atención humana

**Objetivo:** El cliente indica que está muy enfadado y quiere hablar con una persona. El bot escala inmediatamente.

**Criterios de aceptación:**
- Si el cliente indica que está muy molesto y exige hablar con una persona, el bot pasa el caso a un operador inmediatamente.
- El bot pide el nombre del cliente antes de cerrar.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.
- El bot no sigue pidiendo datos de revisión (relato, dígitos, captura): el operador los pedirá si los necesita.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo.  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

👤 **Human Support:** Usuario María en ubicación no identificada ha reportado un doble cobro con tarjeta.

---

### 6.3 — Escalación: relato inconsistente o importe no cuadra

**Objetivo:** El relato del cliente tiene inconsistencias. El bot escala sin solicitar más datos.

**Criterios de aceptación:**
- El bot sigue el flujo estándar hasta llegar al relato.
- Cuando el relato es contradictorio o el cliente dice cosas como "no sé exactamente" o "el importe no me cuadra", el bot pasa el caso a un operador.
- El bot pide el nombre del cliente antes de cerrar.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso y que el chatbot se desactivará.
- El bot no sigue pidiendo dígitos de tarjeta ni captura: el operador necesita revisarlo manualmente.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry y estoy aquí para ayudarte. ¿En qué lavandería te encuentras?

**Usuario:** Goya  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** Sí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** 5  
**Bot:** De acuerdo. ¿Podrías explicarme paso a paso qué has hecho desde que has entrado?

**Usuario:** No sé exactamente, creo que me han cobrado tres o cuatro veces, el importe no me cuadra.  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador para revisarlo. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso.

👤 **Human Support:** Usuario Carlos en Goya (lavadora número 5) ha reportado un doble cobro con tarjeta.

---

### 6.4 — Doble cobro SIN haber usado el servicio

**Objetivo:** El cliente ha sido cobrado dos veces y NO ha podido usar la
máquina (la lavadora/secadora no ha arrancado, el cliente no ha
completado el ciclo). El bot escala inmediatamente tras saber que el
servicio no fue prestado, con un resumen que el operador puede usar
para gestionar tanto el reembolso como el servicio no prestado.

**Criterios de aceptación:**
- El bot pregunta primero la lavandería y, **a continuación**, "¿has podido lavar o secar la ropa?". **No** pregunta tipo ni número de máquina antes de esa pregunta.
- Cuando el cliente responde **"no"**, **"no he podido"** o **"nada"**, el bot NO sigue pidiendo tipo, número, relato, dígitos ni captura: pasa el caso a un operador inmediatamente y pide solo el nombre.
- El mensaje final, tras facilitar el nombre, indica que un operador humano se encargará del caso.
- El resumen para el operador incluye:
  - nombre del cliente,
  - lavandería,
  - **una indicación clara de que el cliente NO ha podido usar el servicio**,
  - la respuesta literal del cliente (ej. "no he podido"),
  - una nota de que el caso requiere reembolso y servicio no prestado.
- El resumen NO contiene tipo ni número de máquina (no se han pedido). El operador los recogerá por teléfono si los necesita.
- El resumen NO debe parecerse al de 6.1 (donde el cliente sí pudo usar el servicio): el operador tiene que entender la diferencia desde la primera línea.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** 👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?

**Usuario:** Goya  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** no, no he podido  
**Bot:** Vamos a revisar tu caso manualmente para poder ayudarte mejor. 🙏 ¿Cómo te llamas, por favor?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación.

👤 **Human Support:** Usuario Carlos en Goya reporta doble cobro PERO NO ha podido usar el servicio. Respuesta del cliente: "no he podido". Requiere reembolso y revisión del servicio no prestado.

---

### 6.5 — Validación de los 4 últimos dígitos de la tarjeta

**Objetivo:** El cliente ha llegado al paso "últimos 4 dígitos de la
tarjeta" pero escribe algo que no es un código válido (3 dígitos, 5+
dígitos, texto sin números, dos grupos de 4). El bot le pide que lo
reescriba; tras un segundo intento inválido, escala a un operador.

**Criterios de aceptación:**
- Tras pedir los 4 últimos dígitos, el bot acepta sólo respuestas que contienen exactamente 4 dígitos consecutivos no rodeados por más cifras. Ejemplos válidos: `4821`, `los últimos son 4821`, `4821, gracias`.
- Ejemplos NO válidos: `48215` (5 cifras), `482` (3 cifras), `1234 5678` (dos grupos = ambiguo), `no me acuerdo` (sin cifras).
- Sobre respuesta NO válida (1ª vez), el bot pide que lo reescriba: **"Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?"**.
- Sobre respuesta NO válida (2ª vez consecutiva), el bot pasa el caso a un operador y pide el nombre del cliente.
- Sobre respuesta válida, el bot continúa el flujo Caso 6.1 normalmente (captura del pago + cierre con formulario de devolución).
- El contador de intentos se reinicia cuando el cliente da una respuesta válida o cuando se reinicia la incidencia (`resetMachineFacts` en código).

**Conversación A — Recuperado al segundo intento:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** [flujo gather: lavandería → tipo → número → ¿podido lavar?] [...]

**Usuario:** Sí, he lavado  
**Bot:** [pide relato] [...]

**Usuario:** [relato]  
**Bot:** ¡Gracias! Para revisarlo bien, ¿podrías indicarme los últimos 4 dígitos de la tarjeta?

**Usuario:** 48215  
**Bot:** Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?

**Usuario:** 4821  
**Bot:** ¡Perfecto! ¿Podrías enviarme una captura del pago? [...continúa Caso 6.1...]

**Conversación B — Escalada tras 2 intentos inválidos:**

**Usuario:** [flujo hasta el paso 4 dígitos]  
**Bot:** ¡Gracias! [...] ¿podrías indicarme los últimos 4 dígitos de la tarjeta?

**Usuario:** 482  
**Bot:** Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?

**Usuario:** no me acuerdo  
**Bot:** Vamos a revisar tu caso manualmente para poder ayudarte mejor. 🙏 ¿Cómo te llamas, por favor?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 7 — He pagado pero no he podido usar el servicio

**Objetivo:**  
Comprobar si la central devolvió el cambio y reconducir al flujo correcto.

**Cuándo aplica:**  
El cliente pagó, pero no llegó a usar la máquina.

**Trigger (frases típicas del cliente):**
- «He pagado pero no he podido usar la máquina»
- «Pagué y no pude lavar»
- «No conseguí usar la lavadora aunque pagué»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Reglas comunes a 7.1 y 7.2:**
- Orden de gather (alineado al Playbook PDF §5.4, Andrea 2026-05-09): lavandería → tipo de máquina → número de máquina → **pantalla**. La pregunta sobre el cambio NO es un paso forzado del bot: si la pantalla muestra un código reconocido (PUSH PROG, SEL, DOOR, AL001, etc.), el flow display da la instrucción correspondiente y el cambio nunca se pregunta. Si la pantalla no se resuelve, el operador recoge el dato del cambio por teléfono.
- El bot reconoce el código aunque el cliente lo escriba de forma natural (ej. «PUSH PROG», «push prog», «push program»).
- Las dos ramas (resuelto vía pantalla / no responde tras instrucción) se detallan en 7.1 y 7.2.

---

### 7.1 — Pagado sin usar, resuelto vía pantalla PUSH PROG (Happy Path)

**Objetivo:** El cliente pagó pero no pudo usar la máquina. Tras recoger tipo y número, el bot pregunta directamente la pantalla; reconoce PUSH PROG y guía la selección de programa. El cliente confirma que la lavadora arranca.

**Criterios de aceptación:**
- El bot pregunta la lavandería, el tipo de máquina, el número y luego **la pantalla** (alineado al PDF §5.4).
- El bot reconoce el código (PUSH PROG / SEL / DOOR / AL001 / …) y le da la indicación correspondiente.
- Cuando el cliente confirma que la máquina ha arrancado, el bot cierra con un mensaje positivo (ej. "perfecto, la lavadora ha comenzado correctamente").

**Conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 5  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Presiona un botón de programa para iniciar el lavado. Programas: 60º Molt calent → ropa muy sucia; 40º Calent → ropa normal; 30º Temperat → ropa delicada; Frío → prendas muy delicadas. Después avísame si funciona.

**Usuario:** Ahora sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 7.2 — Pagado sin usar, máquina no responde tras paso indicado (Escalación)

**Objetivo:** El cliente pagó y la pantalla mostraba PUSH PROG, pero tras pulsar el programa la máquina no arranca. El bot re-pregunta el código, el cliente describe el bloqueo, y el bot escala.

**Criterios de aceptación:**
- El bot recoge localización, tipo, número y **pantalla** (alineado al PDF §5.4).
- Tras la instrucción, si la máquina no arranca el bot pide el código exacto de pantalla.
- El bot escala indicando el operador y pregunta el nombre.
- El mensaje de confirmación final contiene "desactivado".
- El resumen al operador contiene el nombre del cliente, la localización, el número de máquina y el código de pantalla.

**Conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** ¡Hola! ¿En qué lavandería autoservicio te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina (lavadora)?

**Usuario:** 5  
**Bot:** ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Presiona un botón de programa para iniciar el lavado. [programas] Después avísame.

**Usuario:** no arranca  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** se ha bloqueado  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso. El chatbot será desactivado.

👤 **Human Support:** Usuario Luis en Pineda ha efectuado el pago por la lavadora número 5. El cliente seleccionó el programa pero se ha bloqueado. La pantalla muestra: PUSH.

---

## Caso 8 — Tengo un código de descuento

**Objetivo:**  
Validar el formato del código del cliente y, si es correcto, recoger los
datos necesarios y derivar al operador para la activación remota de la
máquina.

**Cuándo aplica:**  
El cliente tiene un código de descuento (formato: 3 letras + fecha
DDMMYY + importe, ej. `SAU2904266`).

**Trigger (frases típicas del cliente):**
- «Tengo un código y no sé cómo usarlo»
- «Tengo un código de descuento»
- «Me han dado un código»
- Variantes con typos del verbo («teng un codigo», «tnego un código»)

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. Te ayudo. ¿Podrías indicarme, por favor, el código exacto tal como lo ves, incluyendo letras si las hay?»

(El bot **no** pregunta lavandería / tipo de máquina / pantalla en este turno — solo pide el código.)

**Reglas comunes a 8.1 y 8.2:**
- Validación del formato esperado: `^[A-Z]{3}\d{6}\d+$` → 3 letras + 6 dígitos fecha (DDMMYY) + importe.
- Códigos solo numéricos sin letras → cae a Caso 18 (incoherencia).
- Cuando el formato es válido: el bot recoge nombre → pueblo / lavandería → número de máquina → estado de la puerta, en ese orden.
- Cuando el formato **no encaja**: el bot pide al cliente que lo escriba de nuevo (retry), y solo tras un segundo intento inválido escala al operador. No escala al primer intento.
- Si la lavandería o el número de máquina ya están en el contexto, el bot omite esas preguntas.
- El operador valida el código y activa remotamente la máquina.
- Las dos variantes (formato válido / formato inválido tras retry) se detallan en 8.1 y 8.2.

**Desviación documentada respecto al Playbook PDF (Andrea, 2026-05-09):**
El Playbook §5.6 («Tinc un codi») modela un flujo *self-service*: el bot pregunta 1) código exacto, 2) a qué local, 3) **¿falta una pequeña parte para completar el importe o el código cubre un importe más alto?** — y resuelve diferenciado: si falta poco, el cliente añade el dinero faltante en la central de pagos sin operador; si el importe es superior, se escala para emitir un nuevo código. Nuestro flow es *handover-oriented*: validamos el formato (`^[A-Z]{3}\d{6}\d+$`), recogemos nombre + pueblo + número + puerta, y escalamos siempre al operador para activación remota. Razón: en producción el operador valida el código contra una base de datos privada y activa la máquina remotamente, así que la diagnosis "poco/mayor" del PDF no aplica. La regla del PDF *«si el codi sembla incomplet i només porta números, preguntar si també hi ha lletres davant»* sigue cubierta porque los códigos solo numéricos caen al Caso 18 (incoherencia).

---

### 8.1 — Código: Happy Path (bot pide solo el código)

**Objetivo:** El bot reconoce el intent del código y pide el código exacto sin mezclar otras preguntas.

**Criterios de aceptación:**
- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta.
- La respuesta menciona la palabra "código".
- El bot pide SOLO el código (no pregunta también por la lavandería en el mismo turno).
- El bot NO pregunta si es lavadora o secadora.
- El bot NO pregunta qué aparece en la pantalla.
- El bot NO escala a operador.

**Conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo.  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

---

### 8.2 — Código: Variante (misma respuesta canned)

**Objetivo:** Variante del mismo trigger, misma respuesta del bot.

**Criterios de aceptación:**
- El bot saluda como asistente virtual de Ecolaundry en la primera respuesta.
- La respuesta menciona la palabra "código".
- El bot NO pregunta si es lavadora o secadora.

**Conversación:**

**Usuario:** Tengo un código de descuento, ¿cómo lo uso?  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry, estoy aquí para ayudarte. Te ayudo con el código. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

---

## Caso 9 — Quiero una factura

**Objetivo:**  
Recoger interactivamente todos los datos necesarios para emitir la factura
y derivar el caso al operador con un resumen completo.

**Cuándo aplica:**  
El cliente pide factura.

**Trigger (frases típicas del cliente):**
- «Quiero una factura»
- «Necesito factura»
- «¿Me podéis dar factura?»
- «Factura por favor»

**Primera respuesta del bot:**  
«👋 Claro, te ayudo con la factura. 🙂 ¿En qué lavandería estuviste?»

(El bot **no** pregunta por la pantalla, número de máquina ni payment al iniciar el flujo: se va directo al gather de datos de facturación.)

**Reglas comunes a 9.1 y 9.2:**
- Gather order de 8 pasos: lavandería → tipo → razón social → dirección → CIF/NIF/NIE → fecha (acepta «hoy» / «ayer» → ISO) → email → nombre.
- Si location y/o tipo ya están en sticky state (turno anterior), el bot **omite** esos pasos y empieza directamente desde la razón social.
- Las fechas relativas («hoy», «ayer», «anteayer»…) se normalizan a ISO `YYYY-MM-DD`. Si el cliente escribe texto libre se conserva tal cual.
- El reply final tras el nombre confirma envío de la factura al email + se pasa al operador con resumen completo.
- Las dos variantes (happy / email retry) se detallan en 9.1 y 9.2.

**Desviación documentada respecto al Playbook PDF (Andrea, 2026-05-09):**
El Playbook §5.8 («Vull una factura») define un modelo **instructional**: el bot debe responder con un mensaje canned tipo *«Per obtenir la factura, cal enviar un correu a olga@alberwaz.net amb aquesta informació»* y listar los campos requeridos (razón social, email, lavandería, CIF/NIF, dirección, fecha, capacidad de máquina —rentadora 20 kg / 15 kg / 10 kg / secadora— y observaciones). El cliente luego envía el email y un humano genera la factura.
Nuestro flow es **conversacional**: el bot recoge los datos paso a paso (gather de 8 pasos) y pasa el resumen al operador para que emita la factura sin requerir copy-paste por email. Razones: (1) reducir campos olvidados o errores de captura, (2) integración directa con el backoffice del operador, (3) evitar fricción del cliente al manejar email.
**Diferencias residuales respecto al PDF que NO cubrimos hoy** (tracked, fix futuro si la AEAT/operador lo requiere):
- *Capacidad de máquina por kg (20/15/10)*: el PDF la pide para diferenciar la categoría fiscal; nuestro flow recoge solo «lavadora» genérica. Si el operador necesita el dato, lo pregunta por teléfono.
- *Observaciones* (campo libre): el PDF lo incluye, nuestro flow no. Cualquier nota especial el cliente la añade en otra interacción o el operador la pide manualmente.
La regla del PDF *«donar instruccions clares i tancades»* sigue cubierta: nuestro mensaje final tras el nombre confirma de forma cerrada el envío de la factura al email indicado.

---

### 9.1 — Factura Happy Path

**Objetivo:** Recogida completa de los 8 datos de facturación con email
válido al primer intento, cierre con el riepilogo + despedida personalizada.

**Criterios de aceptación:**
- El bot pregunta los 8 campos en orden: lavandería, tipo, razón social,
  dirección, CIF/NIF/NIE, fecha, email, nombre.
- Si la lavandería o el tipo de máquina ya están en sticky state, los
  steps 1-2 se saltan y se pregunta directamente la razón social.
- Sobre nombre dado → reply contiene el nombre del cliente, el email y
  la fecha (raw o ISO).
- El handover summary al operador contiene: razón social, dirección,
  CIF, fecha, email.

**Conversación:**

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. ¿En qué lavandería estuviste?

**Usuario:** Goya  
**Bot:** Gracias. ¿Utilizaste lavadora o secadora?

**Usuario:** Lavadora  
**Bot:** Perfecto. ¿Me indicas la razón social?

**Usuario:** ACME SL  
**Bot:** ¿Y la dirección?

**Usuario:** Calle Mayor 1, Madrid  
**Bot:** ¿Cuál es tu CIF/NIF/NIE?

**Usuario:** B12345678  
**Bot:** ¿Qué día utilizaste el servicio? (puedes decirme "hoy", "ayer" o una fecha)

**Usuario:** Ayer  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana@example.com  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-07 a tu correo: ana@example.com.

**👤 Human Support message** *(al operador)*  
Usuario Andrea ha solicitado factura. Datos: razón social ACME SL; dirección Calle Mayor 1, Madrid; CIF B12345678; fecha 2026-05-07; máquina lavadora; email ana@example.com.

---

### 9.2 — Factura: email inválido → re-ask

**Objetivo:** Si el cliente escribe un email mal formado, el bot vuelve a
pedirlo en el mismo step sin avanzar al nombre.

**Criterios de aceptación:**
- Sobre email mal formado → reply
  contiene "no parece válido" o equivalente y vuelve a pedir el correo.
- El bot NO avanza al step "nombre" hasta recibir un email aceptable.
- Sobre respuesta aceptable al segundo intento → continúa al nombre y luego
  al cierre canónico.

**Conversación:**

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. ¿En qué lavandería estuviste?

**Usuario:** Goya  
**Bot:** Gracias. ¿Utilizaste lavadora o secadora?

**Usuario:** Lavadora  
**Bot:** Perfecto. ¿Me indicas la razón social?

**Usuario:** ACME SL  
**Bot:** ¿Y la dirección?

**Usuario:** Calle Mayor 1, Madrid  
**Bot:** ¿Cuál es tu CIF/NIF/NIE?

**Usuario:** B12345678  
**Bot:** ¿Qué día utilizaste el servicio?

**Usuario:** Ayer  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana  
**Bot:** El correo no parece válido. ¿Puedes escribírmelo de nuevo, por favor?

**Usuario:** ana@example.com  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-07 a tu correo: ana@example.com.

---

## Caso 10 — Cómo comprar la tarjeta de fidelización

**Objetivo:**  
Explicar compra y limitación de uso de la tarjeta.

**Cuándo aplica:**  
El cliente quiere adquirir una tarjeta.

**Trigger (frases típicas del cliente):**
- «¿Cómo consigo la tarjeta?»
- «¿Cómo compro la tarjeta de fidelización?»
- «Quiero la tarjeta de descuento»

**Primera respuesta del bot:**  
«La tarjeta de fidelización se compra con 20 € en efectivo y solo funciona en la tienda donde se ha comprado. ¿En qué lavandería estás?»

(El bot **no** pregunta por la pantalla, número de máquina ni payment: es una FAQ.)

**Criterios de aceptación:**
- Respuesta canónica: precio (20 €) + restricción ("solo funciona en la tienda donde se ha comprado").
- Si el cliente da la location, el bot añade la instrucción específica del local (ej. en Goya: "segundo botón de la línea de la derecha en la central"), leída de `locations.json:faqOverrides`.
- No se inventan instrucciones para locales sin override; se escala si el cliente describe una central distinta.
- No se piden tipo de máquina, número, ni display: es una FAQ, no incidencia.

**Ejemplo de conversación:**

**Usuario:** ¿Cómo consigo la tarjeta de fidelización?  
**Bot:** La tarjeta de fidelización se compra con 20 € en efectivo y solo funciona en la tienda donde se ha comprado.

**Usuario:** Estoy en Goya.  
**Bot:** Perfecto. En Goya, en la central de botones, debes pulsar el segundo botón de la línea de la derecha.

**Usuario:** Entendido.  
**Bot:** Perfecto.

**Resultado esperado:**  
Consulta cerrada.

**Escalar si:**  
- el cliente describe una central distinta o una situación no documentada

---

## Caso 11 — Cómo recargar la tarjeta de fidelización

**Objetivo:**  
Explicar la recarga de forma simple.

**Cuándo aplica:**  
El cliente ya tiene tarjeta y quiere recargarla.

**Trigger (frases típicas del cliente):**
- «¿Cómo recargo la tarjeta?»
- «Cargar la tarjeta de fidelización»
- «No sé recargarla»

**Primera respuesta del bot:**  
«Introduce la tarjeta y sigue las instrucciones de la central. Si aparece algún mensaje extraño, dímelo y lo revisamos.»

(El bot **no** pregunta location ni máquina: la operación de recarga es estándar en todas las centrales.)

**Criterios de aceptación:**
- Respuesta canónica corta: "introduce la tarjeta y sigue las instrucciones de la central".
- Cierre proactivo: invita al cliente a reportar si aparece un mensaje extraño durante la recarga (sin escalar todavía).
- Diferencia clave con Caso 10: aquí no se pide location (la operación es estándar en todas las centrales).
- Escala si el cliente reporta error o que la central no responde.

**Ejemplo de conversación:**

**Usuario:** ¿Cómo recargo la tarjeta?  
**Bot:** Introduce la tarjeta y sigue las instrucciones de la central.

**Usuario:** Vale.  
**Bot:** Perfecto. Si al hacerlo aparece algún mensaje extraño, dímelo y lo revisamos.

**Resultado esperado:**  
Consulta cerrada.

**Escalar si:**  
- aparece un error no documentado
- la central no responde

---

## Caso 12 — Horarios y precios

**Objetivo:**  
Responder consultas generales sin inventar datos.

**Cuándo aplica:**  
El cliente pregunta por horarios o precios.

**Trigger (frases típicas del cliente):**
- «¿Cuál es el horario?»
- «¿A qué hora abrís?»
- «¿Hasta qué hora estáis abiertos?»
- «¿Cuánto cuesta lavar?» / «¿Qué precios tenéis?»

**Primera respuesta del bot:**  
- Para horarios: «El horario general de atención al público es de 8:00 a 22:00 cada día del año.»
- Para precios: «Tengo que revisarlo antes de confirmarte ese importe.»

(El bot **no** pregunta por la pantalla, máquina ni payment: es una FAQ.)

**Criterios de aceptación:**
- Horarios: respuesta por defecto 8:00-22:00. Excepción L'Escala: 7:00-23:00 (override leído de `locations.json:faqOverrides.openingHours`).
- Precios: respuesta canónica de "deflect" — el bot **no** inventa importes; redirige a "tengo que revisarlo antes de confirmártelo".
- Follow-up "¿y en L'Escala?" (después de un horario general) → respuesta con la excepción, sin re-pedir contexto.

**Ejemplo de conversación A — Horario general**

**Usuario:** ¿Cuál es el horario?  
**Bot:** El horario general de atención al público es de 8:00 a 22:00 cada día del año.

**Ejemplo de conversación B — Excepción de L’Escala**

**Usuario:** ¿Y en L’Escala?  
**Bot:** En L’Escala, las máquinas se pueden utilizar de 7:00 a 23:00.

**Ejemplo de conversación C — Precio no confirmado**

**Usuario:** ¿Cuánto cuesta esta máquina?  
**Bot:** Tengo que revisarlo antes de confirmarte ese importe.

**Resultado esperado:**  
Consulta informativa resuelta o derivada correctamente.

**Escalar si:**  
- el precio no está confirmado
- el cliente pide una excepción o una tarifa no documentada

---

## Caso 13 — Escalado por código de alarma o incoherencia

**Objetivo:**  
Escalar sin confrontar al cliente, recopilando los datos mínimos para el operador.

**Cuándo aplica:**  
Aparece `ALM`, `ALN`, `001`, un código no documentado, o hay incoherencias en el relato o en el importe.

**Trigger (frases típicas del cliente):**
- «Me sale ALN»
- «Sale un código raro»
- «No entiendo lo que pone»
- «He pagado y ahora sale [código]»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Criterios de aceptación:**
- Caso "paraguas" para alarmas/incoherencias genéricas. Más específicos: Caso 14 (ALM DOOR), Caso 15 (001), Caso 16 (ALM/ALN secadora), Caso 18 (numérico), Caso 30 (no documentado).
- Gather **completo** antes de escalar: location → tipo → número → display. Sin display el operador no puede triar.
- Reply de escalación contiene `revisión manual` + petición del nombre del cliente.
- El bot **nunca** confronta al cliente: tono "lo revisamos para ayudarte", no "tu información no cuadra".

**Ejemplo de conversación:**

**Usuario:** He pagado y ahora sale ALN.  
**Bot:** Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿Dónde está la lavandería?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** Perfecto. ¿Qué número de lavadora es?

**Usuario:** La 5.  
**Bot:** El código ALN requiere revisión manual. Pasaremos tu caso a revisión para ayudarte de la manera más adecuada. ¿Cómo te llamas?

**Usuario:** Andrea.  
**Bot:** Hemos pasado tu caso a revisión. Un operador se pondrá en contacto contigo para ayudarte. Gracias por tu paciencia, Andrea.

**Resultado esperado:**  
Caso escalado correctamente con los datos mínimos (local + tipo + número + display).

**Escalar si:**  
- siempre, en este tipo de códigos o incoherencias


 

## Caso 14 — La lavadora muestra ALM DOOR

**Objetivo:**  
Gestionar correctamente un problema de cierre o una posible prenda atrapada antes de escalar.

**Cuándo aplica:**  
El cliente indica que en pantalla aparece `ALM DOOR`.

**Trigger (frases típicas del cliente):**
- «Me sale ALM DOOR»
- «Aparece ALM/DOOR en la pantalla»
- «ALMDOOR»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Criterios de aceptación:**
- Diferencia clave con Caso 2 (DOOR simple): el bot intenta **una vez** la guía de "abrir + revisar prendas atrapadas + cerrar bien" antes de escalar.
- Si el cliente confirma que el mensaje desaparece → resolved.
- Si el cliente reporta que NO desaparece → escalación con resumen que incluye `ALM DOOR` (no un "DOOR" genérico).
- Reconocimiento robusto del código: acepta `ALM DOOR`, `ALM/DOOR`, `ALMDOOR` (normalizado por `extractDisplayState`).

**Ejemplo de conversación:**

**Usuario:** La lavadora no funciona y pone ALM DOOR.  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 6.  
**Bot:** De acuerdo. Ese mensaje puede indicar un problema de cierre o que hay alguna pieza atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien.

**Usuario:** Ya lo he hecho.  
**Bot:** Perfecto. Dime, por favor, si el mensaje ha desaparecido.

**Usuario:** No.  
**Bot:** Gracias. Vamos a pasar tu caso a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Escalado correcto si el mensaje no desaparece.

**Escalar si:**  
- el mensaje no desaparece
- el cliente no puede realizar la comprobación
- la puerta sigue bloqueada

---

## Caso 15 — La máquina muestra 001

**Objetivo:**  
Reconocer un caso que debe escalarse siempre.

**Cuándo aplica:**  
El cliente indica que aparece `001`.

**Trigger (frases típicas del cliente):**
- «Sale 001 en la pantalla»
- «Me pone 001»
- «Aparece el número 001»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Criterios de aceptación:**
- Reconocimiento de `001` puro (sin prefijo `AL`/`ALM`) → display token canónico `C001`.
- El bot da una **explicación educativa** ("ese mensaje aparece cuando se ha seleccionado el programa antes del pago") antes de escalar — sin pedir al cliente que repita pasos.
- Sólo necesita location antes de escalar (no display de nuevo, no número obligatorio).
- Diferencia clave con Caso 5 (AL001): este NO admite recovery — siempre se escala.

**Ejemplo de conversación:**

**Usuario:** En la pantalla sale 001.  
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** De acuerdo. Ese mensaje puede aparecer cuando el programa se ha seleccionado antes del pago y el estado no se ha reiniciado correctamente.

**Usuario:** ¿Qué hago?  
**Bot:** Vamos a revisarlo manualmente para ayudarte de la mejor manera posible.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre

---

## Caso 16 — La máquina muestra ALM, ALN o un código de alarma similar

**Objetivo:**  
Detectar una alarma de máquina y escalar sin hacer manipular más al cliente, recopilando los datos mínimos para el operador.

**Cuándo aplica:**  
El cliente indica `ALM`, `ALN`, `ALN A`, `ALN N` o un código de alarma similar.

**Trigger (frases típicas del cliente):**
- «La secadora pone ALN»
- «Me sale ALM»
- «ALN A»
- «Aparece un código de alarma»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Criterios de aceptación:**
- Reconocimiento robusto: `ALN`, `ALN A`, `ALN N` se normalizan al token correspondiente; familias `ALM/A`, `ALM/E`, `ALM/VAr` se normalizan también.
- Tras location + tipo + número, escalación inmediata: el bot **no** pide al cliente abrir/cerrar nada (a diferencia del Caso 14 ALM DOOR).
- Diferencia clave con Caso 13 (genérico): Caso 16 es específico de la familia ALM/ALN, normalmente sobre secadora.
- El resumen al operador incluye el código exacto (ALN, ALN A, etc.), location, tipo y número.

**Ejemplo de conversación:**

**Usuario:** La secadora pone ALN.  
**Bot:** Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿Dónde está la lavandería?

**Usuario:** Alemanya.  
**Bot:** Gracias. ¿Qué número de secadora es?

**Usuario:** La 4.  
**Bot:** El código ALN requiere revisión manual. Pasaremos tu caso a revisión para ayudarte de la manera más adecuada. ¿Cómo te llamas?

**Usuario:** Andrea.  
**Bot:** Hemos pasado tu caso a revisión. Un operador se pondrá en contacto contigo para ayudarte. Gracias por tu paciencia, Andrea.

**Resultado esperado:**  
Caso escalado correctamente con los datos mínimos (local + tipo + número + display).

**Escalar si:**  
- siempre

---

## Caso 17 — El cliente no sabe qué aparece en pantalla

**Objetivo:**  
Escalar cuando no se puede obtener el estado de pantalla.

**Cuándo aplica:**  
El cliente no sabe leer el display o no ve bien la pantalla.

**Trigger (frases típicas del cliente):**
- «No sé qué pone»
- «No veo la pantalla»
- «Está en blanco»
- «No puedo leer el display»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Criterios de aceptación:**
- Trigger: el cliente dice "no sé qué pone", "no veo la pantalla", "está en blanco" o equivalente.
- Gather mínimo: location + tipo de máquina (sin display, sin número obligatorio).
- Tras gather → escalación inmediata. El resumen al operador indica explícitamente la falta de información de pantalla ("display no legible / cliente no puede leerlo").
- **No** se pide foto al cliente (feature no soportada hoy). Cuando se habilite, este caso pasará por un paso intermedio.

**Nota de implementación:** la subida de fotos NO está soportada hoy. Sin
información del display el bot no puede dar instrucciones recuperables, así
que escala directamente tras location + tipo. Si en el futuro se habilita
el upload de fotos, este caso pasará por un paso intermedio de petición.

**Ejemplo de conversación:**

**Usuario:** La máquina no va, pero no sé qué pone.  
**Bot:** Tranquilo, lo revisamos juntos. ¿En qué lavandería estás?

**Usuario:** Hortes.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** De acuerdo. Vamos a revisarlo manualmente para poder ayudarte. ¿Cómo te llamas?

**Usuario:** Andrea.  
**Bot:** Pasamos tu caso a revisión. Un operador se pondrá en contacto contigo, gracias por la paciencia, Andrea.

**Resultado esperado:**  
Caso escalado tras recoger location + tipo de máquina, sin paso de foto.

**Escalar si:**  
- siempre, cuando el cliente no puede leer la pantalla

---

## Caso 18 — El cliente da un código solo numérico y dice que no hay letras

**Objetivo:**  
Detectar una incoherencia sin confrontar al cliente.

**Cuándo aplica:**  
El cliente facilita un código compuesto solo por números y afirma que no tiene letras delante.

**Trigger (frases típicas del cliente):**
- «Tengo un código: 12345»
- «Código 23432023»
- «Mi código es 999888»

**Primera respuesta del bot:**  
«Gracias. ¿Ves alguna letra delante de los números?»

(El bot **no** pregunta lavandería ni máquina al inicio: primero verifica si hay letras antes de continuar.)

**Criterios de aceptación:**
- Trigger: input que matche `^\d{3,}$` (3+ dígitos puros, sin letras).
- Step 1: el bot pregunta explícitamente "¿ves alguna letra delante?" (`numericCodeAskLetters`).
- Step 2 — respuesta "Sí" → reset al flujo Caso 8 (pide código completo con letras).
- Step 2 — respuesta "No" → escalación inmediata; el resumen al operador indica `código solo numérico (XXXX) requiere revisión` — **NO** "código no documentado" (que es Caso 30).
- El bot **no** dice "te equivocas" ni similar — sólo "necesitamos revisarlo manualmente".

**Ejemplo de conversación:**

**Usuario:** Tengo un código: 23432023.  
**Bot:** Gracias. ¿Ves alguna letra delante de los números?

**Usuario:** No.  
**Bot:** De acuerdo. Hay una información que necesitamos revisar manualmente antes de continuar.

**Usuario:** ¿Por qué?  
**Bot:** Para comprobarlo bien y ayudarte correctamente, vamos a pasarlo a revisión.

**Resultado esperado:**  
Caso escalado sin confrontación.

**Escalar si:**  
- siempre en este caso

---

## Caso 19 — El cliente dice que el datáfono ha cobrado 10 € en Goya

**Objetivo:**  
Detectar una incoherencia de importe sin acusar al cliente.

**Cuándo aplica:**  
El cliente está en Goya y afirma que el datáfono ha cobrado 10 €.

**Trigger (frases típicas del cliente):**
- «El datáfono me ha cobrado 10 €»
- «Estoy en Goya y me cobraron 10 euros»
- «Goya: datáfono me ha sacado 10 euros»

**Primera respuesta del bot:**  
«Gracias por indicarlo. Vamos a revisarlo contigo. ¿Has podido usar el servicio?»

**Criterios de aceptación:**
- Trigger: input mencionar `datáfono` + cifra atípica + location Goya. Detector en `nluPatterns.topicPayment` + `location-gated-mismatch`.
- Set state: `nonTroubleshootingIncident="datafono-wrong-amount"`. El gather de máquina queda **deshabilitado** (no se piden tipo/número).
- El bot pregunta sólo "¿has podido usar el servicio?" como dato adicional para el operador.
- Resumen al operador: `Goya + datáfono + importe incoherente`. **No** se acusa al cliente ni se discute la cifra.

**Ejemplo de conversación:**

**Usuario:** Estoy en Goya y el datáfono me ha cobrado 10 €.  
**Bot:** Gracias por indicarlo. Vamos a revisarlo contigo. ¿Has podido usar el servicio?

**Usuario:** No.  
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos revisarla manualmente.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado por importe incoherente.

**Escalar si:**  
- siempre en este caso

---

## Caso 20 — El cliente dice que el datáfono ha cobrado 10 € en Pineda

**Objetivo:**  
Detectar una incoherencia de importe sin confrontar.

**Cuándo aplica:**  
El cliente está en Pineda y afirma que el datáfono ha cobrado 10 €.

**Trigger (frases típicas del cliente):**
- «En Pineda me ha cobrado 10 €»
- «Pineda datáfono 10 euros»
- «Estoy en Pineda y han cobrado 10»

**Primera respuesta del bot:**  
«Gracias. Vamos a revisarlo. ¿Has podido lavar o secar la ropa?»

**Criterios de aceptación:**
- Mismo flujo del Caso 19, pero con location = Pineda. Misma escalación, mismo `nonTroubleshootingIncident="datafono-wrong-amount"`.
- Mismatch detector (`location-gated-mismatch`) confirma que esta incidencia se reconoce **sólo** en Goya y Pineda; en otras localizaciones el bot indica "no tenemos registrado en <local>" antes de escalar.
- Resumen al operador: `Pineda + datáfono + importe incoherente`.

**Ejemplo de conversación:**

**Usuario:** En Pineda me ha cobrado 10 €.  
**Bot:** Gracias. Vamos a revisarlo. ¿Has podido lavar o secar la ropa?

**Usuario:** No.  
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos comprobarla manualmente.

**Usuario:** Vale.  
**Bot:** Lo pasaremos a revisión para poder ayudarte correctamente.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 21 — En Alemanya se han añadido monedas a la secadora y no se han sumado minutos

**Objetivo:**  
Identificar una incidencia habitual del local y escalarla correctamente.

**Cuándo aplica:**  
El cliente está en Alemanya, usa secadora y dice que ha añadido tiempo pero no se han sumado minutos.

**Trigger (frases típicas del cliente):**
- «He puesto más dinero en la secadora y no suma minutos»
- «He añadido monedas y no se ha sumado tiempo»
- «Estoy en Alemanya y la secadora no añade minutos»

**Primera respuesta del bot:**  
«Gracias. ¿Estás en la lavandería Alemanya?»

**Criterios de aceptación:**
- Trigger: `topicDryerMinutes` + location Alemanya + machineType=dryer.
- Set state: `nonTroubleshootingIncident="dryer-minutes-not-credited"`. El bot **no** entra al gather de display.
- El bot **confirma** la location ("¿estás en la lavandería Alemanya?") antes de escalar — esta incidencia se reconoce sólo en Alemanya y Pineda.
- Resumen al operador: `Alemanya + secadora + monedas no sumadas`.

**Ejemplo de conversación:**

**Usuario:** He puesto más dinero en la secadora y no suma minutos.  
**Bot:** Gracias. ¿Estás en la lavandería Alemanya?

**Usuario:** Sí.  
**Bot:** De acuerdo. Esa incidencia necesita revisión para poder comprobarla correctamente.

**Usuario:** ¿No se puede arreglar ahora?  
**Bot:** Vamos a pasarlo a revisión para ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 22 — En Pineda se han añadido monedas a la secadora y no se han sumado minutos

**Objetivo:**  
Identificar una incidencia habitual del local y escalar.

**Cuándo aplica:**  
El cliente está en Pineda y los minutos añadidos no se reflejan.

**Trigger (frases típicas del cliente):**
- «He añadido tiempo a la secadora y no lo ha sumado»
- «Estoy en Pineda y los minutos no se han añadido»
- «Pineda secadora monedas no suman»

**Primera respuesta del bot:**  
«Gracias. ¿Estás en Pineda?»

**Criterios de aceptación:**
- Mismo flujo del Caso 21, location = Pineda. Misma `nonTroubleshootingIncident="dryer-minutes-not-credited"`.
- En otras localizaciones (Goya, Hortes, L'Escala) el bot indica explícitamente "no tenemos registrado en <local>" antes de escalar (mismatch detector).
- Resumen al operador: `Pineda + secadora + monedas no sumadas`.

**Ejemplo de conversación:**

**Usuario:** He añadido tiempo a la secadora y no lo ha sumado.  
**Bot:** Gracias. ¿Estás en Pineda?

**Usuario:** Sí.  
**Bot:** De acuerdo. Vamos a revisarlo manualmente para ayudarte correctamente.

**Usuario:** Vale.  
**Bot:** Gracias. Pasaremos tu caso a revisión.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 23 — En Alemanya no se puede pagar con tarjeta

**Objetivo:**  
Reconocer una incidencia operativa del local y derivarla.

**Cuándo aplica:**  
El cliente indica que está en Alemanya y no puede pagar con tarjeta.

**Trigger (frases típicas del cliente):**
- «No puedo pagar con tarjeta»
- «El datáfono no funciona»
- «No me acepta la tarjeta en Alemanya»

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

**Criterios de aceptación:**
- Trigger: `topicCardFail` + location Alemanya. Set `nonTroubleshootingIncident="card-payment"`.
- Mensaje de escalación menciona "soporte técnico" (la incidencia no es de máquina sino del datáfono del local).
- En otras localizaciones que NO sean Alemanya/Hortes (Goya, Pineda, L'Escala) → mismatch: el bot dice "no tenemos registrado en <local>".
- Resumen al operador: `Alemanya + tarjeta + no se puede pagar`.

**Ejemplo de conversación:**

**Usuario:** No puedo pagar con tarjeta.  
**Bot:** Te ayudo. ¿En qué lavandería estás?

**Usuario:** Alemanya.  
**Bot:** Gracias. Vamos a revisarlo manualmente porque esa incidencia puede requerir soporte técnico.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión para poder ayudarte.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 24 — En Hortes no se puede pagar con tarjeta

**Objetivo:**  
Reconocer una incidencia operativa del local y derivarla.

**Cuándo aplica:**  
El cliente indica que está en Hortes y no puede pagar con tarjeta.

**Trigger (frases típicas del cliente):**
- «La tarjeta no funciona para pagar»
- «Estoy en Hortes y no puedo pagar con tarjeta»
- «Hortes datáfono no acepta tarjeta»

**Primera respuesta del bot:**  
«Gracias. ¿Estás en Hortes?»

**Criterios de aceptación:**
- Mismo flujo del Caso 23, location = Hortes. Misma `nonTroubleshootingIncident="card-payment"`.
- Confirmación de location proactiva si no fue dada en el primer mensaje.
- Resumen al operador: `Hortes + tarjeta + no se puede pagar`.

**Ejemplo de conversación:**

**Usuario:** La tarjeta no funciona para pagar.  
**Bot:** Gracias. ¿Estás en Hortes?

**Usuario:** Sí.  
**Bot:** De acuerdo. Vamos a revisar la incidencia manualmente para ayudarte correctamente.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre en este caso

---

## Caso 25 — El cliente está muy enfadado

**Objetivo:**  
Mantener un tono calmado y no discutir.

**Cuándo aplica:**  
El cliente usa un tono agresivo, exigente o muy molesto.

**Trigger (frases típicas del cliente):**
- «¡Esto siempre falla!»
- «¡Quiero una solución ya!»
- «¡Estoy harto!»
- «¡Quiero hablar con un operador ahora mismo!»

**Primera respuesta del bot:**  
«Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?»

**Criterios de aceptación:**
- T1: el bot abre con empatía explícita ("entiendo tu malestar, quiero ayudarte") **antes** de cualquier pregunta — `guardAngryCustomerEmpathic`.
- Si el cliente sigue alterado o exige solución inmediata → escalación con resumen que indica "cliente muy enfadado, requiere atención prioritaria".
- El bot **nunca** se justifica, no contradice, no minimiza ("no es para tanto" = ❌).
- Si el cliente colabora tras la empatía, sigue el flujo normal del problema reportado (puede ser cualquier Caso 1-24).

**Ejemplo de conversación:**

**Usuario:** ¡Esto siempre falla! ¡Quiero una solución ya!  
**Bot:** Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. Para poder ayudarte bien, necesito una información básica primero. ¿Es una lavadora o una secadora?

**Resultado esperado:**  
El bot mantiene la calma y recoge datos mínimos.

**Escalar si:**  
- el cliente continúa muy alterado
- exige una solución inmediata no automática
- se niega a colaborar

---

## Caso 26 — El cliente exige devolución inmediata

**Objetivo:**  
Recoger datos sin prometer una devolución automática.

**Cuándo aplica:**  
El cliente pide devolución inmediata.

**Trigger (frases típicas del cliente):**
- «Quiero que me devolváis el dinero»
- «Devolución ya»
- «Me lo tenéis que devolver»

**Primera respuesta del bot:**  
«Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta, una captura del pago y un breve resumen.»

**Criterios de aceptación:**
- Trigger: `topicRefundDemand`. Set `nonTroubleshootingIncident="refund-demand"`.
- El bot recoge datos mínimos (4 dígitos, captura, resumen) **sin prometer** la devolución (la decisión es del operador).
- Reply de escalación contiene `revisión` + `devolución` pero NO "te lo devolvemos" / "haremos la devolución".
- Resumen al operador: nombre + "devolución" + datos parseados.

**Ejemplo de conversación:**

**Usuario:** Quiero que me devolváis el dinero ahora mismo.  
**Bot:** Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta, una captura del pago y un breve resumen de lo ocurrido.

**Usuario:** Quiero la devolución ya.  
**Bot:** Entiendo lo que me indicas. Vamos a pasar el caso a revisión para aplicar la solución más adecuada.

**Resultado esperado:**  
Caso escalado sin prometer devolución.

**Escalar si:**  
- siempre que exija devolución inmediata
- si falta información
- si la incidencia es compleja

---

## Caso 27 — El cliente pide una compensación concreta

**Objetivo:**  
No prometer compensaciones no automatizadas.

**Cuándo aplica:**  
El cliente exige una secadora gratis, una lavadora gratis, un código nuevo o cualquier compensación concreta.

**Trigger (frases típicas del cliente):**
- «Quiero una secadora gratis»
- «Dame una lavadora gratis por las molestias»
- «Quiero un código nuevo de descuento»
- «Por las molestias, necesito una compensación»

**Primera respuesta del bot:**  
«Vamos a revisar tu caso para ayudarte con la solución más adecuada.»

**Criterios de aceptación:**
- Trigger: `topicCompensation`. Set `nonTroubleshootingIncident="compensation-demand"`.
- El bot reconoce la petición pero **no** confirma activaciones gratuitas, códigos nuevos, ni cualquier solución ad-hoc.
- Si el cliente insiste ("confirma ya"), el bot mantiene la línea: "no puedo confirmarlo desde aquí, lo pasamos a revisión".
- Resumen al operador: nombre + "compensación" + descripción.
- Diferencia con Caso 26: aquí el cliente pide algo CONCRETO (lavadora gratis), no una devolución.

**Ejemplo de conversación:**

**Usuario:** Quiero una secadora gratis por las molestias.  
**Bot:** Vamos a revisar tu caso para ayudarte con la solución más adecuada.

**Usuario:** Pero quiero que me lo confirmes ya.  
**Bot:** No puedo confirmarlo directamente desde aquí. Vamos a pasarlo a revisión para que se valore correctamente.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre que haya que decidir compensación
- si se solicita activación gratuita
- si se solicita un código nuevo

---

## Caso 28 — Relato contradictorio en un doble cobro

**Objetivo:**  
Detectar incoherencia y escalar sin discutir.

**Cuándo aplica:**  
El cliente mezcla versiones incompatibles de lo ocurrido.

**Trigger (frases típicas del cliente):**
- «Me cobró dos veces, aunque creo que también pagué con monedas»
- «Cobró dos veces, creo, no sé bien»
- «No estoy seguro pero me cobró 3 o 4 veces»

**Primera respuesta del bot:**  
«Gracias. Vamos a revisarlo contigo. ¿Has podido finalmente usar el servicio?»

**Criterios de aceptación:**
- Trigger: `topicContradictoryNarrative` — patrón "cobró dos veces / aunque también pagué + creo / no sé / o algo así". Detector en `guardContradictoryNarrative`.
- Set `nonTroubleshootingIncident="contradictory-narrative"`.
- El bot **no** intenta clarificar el relato (no interroga al cliente sobre incoherencias) — eso lo hace el operador.
- Reply de escalación menciona "revisar" sin acusar al cliente de mentir.
- Resumen al operador: nombre + "relato contradictorio" o "relato confuso".

**Ejemplo de conversación:**

**Usuario:** Me cobró dos veces, aunque creo que también pagué en efectivo, pero no sé si llegó a arrancar.  
**Bot:** Gracias. Vamos a revisarlo contigo. ¿Has podido finalmente usar el servicio?

**Usuario:** No lo sé bien.  
**Bot:** De acuerdo. Para comprobarlo bien, vamos a revisar el caso manualmente.

**Usuario:** Vale.  
**Bot:** Gracias. Pasaremos tu caso a revisión.

**Resultado esperado:**  
Caso escalado por relato confuso.

**Escalar si:**  
- siempre que el relato sea contradictorio o muy confuso

---

## Caso 29 — El cliente menciona cámaras o revisión técnica

**Objetivo:**  
No prometer una comprobación directa desde el bot y derivar correctamente.

**Cuándo aplica:**  
El cliente menciona cámaras, AJAX o soporte técnico.

**Trigger (frases típicas del cliente):**
- «Mirad las cámaras»
- «Revisad las cámaras de seguridad»
- «Necesito que el soporte técnico lo mire»
- «AJAX»

**Primera respuesta del bot:**  
«Gracias por indicarlo. Vamos a revisar tu caso manualmente para poder comprobarlo bien. ¿Cómo te llamas?»

**Criterios de aceptación:**
- Trigger: `topicOps` (palabras: cámaras, AJAX, soporte técnico). Set `nonTroubleshootingIncident="cameras-or-ajax"`.
- El bot **no** dice "vamos a mirarlo" como si pudiera ver las cámaras — eso es un job del operador. Sólo dice "lo revisamos manualmente".
- Escalación inmediata: el bot pide directamente el nombre, sin más gather (no necesita máquina/display).
- Resumen al operador: nombre + "cámaras" o "AJAX".

**Ejemplo de conversación:**

**Usuario:** Mirad las cámaras porque yo he pagado.  
**Bot:** Gracias por indicarlo. Vamos a revisar tu caso manualmente para poder comprobarlo bien.

**Usuario:** Vale.  
**Bot:** Lo pasaremos a revisión para ayudarte correctamente.

**Resultado esperado:**  
Caso escalado.

**Escalar si:**  
- siempre que implique cámaras
- siempre que implique AJAX
- siempre que implique revisión técnica

---

## Caso 30 — Código no documentado en pantalla

**Objetivo:**  
Escalar cuando el cliente da un código que no coincide con ningún caso conocido, ya sea porque es un código real no documentado (ERR 52, STOP, FILTRO) o porque el cliente escribe algo que no parece un código (typo o texto libre).

**Cuándo aplica:**  
El cliente facilita un código distinto de los conocidos (PUSH PROG, SEL, DOOR, ALM DOOR, 001, ALM, ALN, AL001), o escribe un texto que el bot no consigue reconocer como un código.

**Trigger (frases típicas del cliente):**
- «En la pantalla sale ERR 52»
- «STOP» / «FILTRO» / códigos no documentados
- «asdf» / typos no reconocibles tras gather de display

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

(Detección activa cuando el bot ya ha pedido el display y el cliente da algo que no es ningún código conocido — re-ask, luego escala.)

**Criterios de aceptación:**
- El bot pregunta primero la lavandería, el tipo de máquina y el número de máquina.
- Tras pedir qué aparece en pantalla, el bot acepta variantes con typos pequeños (1-2 letras de diferencia): "USH PROG" se reconoce como PUSH PROG, "DOR" como DOOR, "ALM01" como AL001.
- Si lo que escribe el cliente no parece un código (sea un typo grande o texto sin sentido), el bot le pide que lo compruebe nuevamente con un mensaje amable: **"No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?"**.
- Si el cliente vuelve a dar algo que no se reconoce, el bot pasa el caso a un operador (pide el nombre y avisa que se desactivará el chatbot).
- Si el cliente sí da un código real pero no documentado (ej. "ERR 52"), el bot escala con un resumen que incluye **el código exacto** que el cliente ha escrito (sin reinterpretarlo ni normalizarlo).
- El bot **no** inventa interpretaciones del código en ningún caso.

**Ejemplo de conversación (typo recuperado al segundo intento):**

**Usuario:** asdf  
**Bot:** No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?

**Usuario:** PUSH PROG  
**Bot:** Pulsa un botón de programa para iniciar el lavado. [...]

**Ejemplo de conversación (código no documentado real):**

**Usuario:** En la pantalla sale ERR 52.  
**Bot:** Ese código no coincide con un caso documentado y necesitamos revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

**Ejemplo de conversación (escalada tras dos intentos sin reconocer):**

**Usuario:** asdf  
**Bot:** No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?

**Usuario:** qwerty  
**Bot:** Vamos a revisar tu caso manualmente para poder ayudarte mejor. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

**Resultado esperado:**  
- Si el cliente corrige el typo en el segundo intento → flujo normal del código corregido.
- Si el cliente sigue sin dar un código reconocible tras dos intentos → caso escalado.

**Escalar si:**  
- el código es real pero no documentado.
- el cliente da algo no reconocible y, tras un segundo intento, sigue sin reconocerse.

---

## Caso 31 — El cliente no indica local

**Objetivo:**  
Evitar diagnosticar sin el dato mínimo más importante.

**Cuándo aplica:**  
El cliente explica el problema pero no dice en qué lavandería está.

**Trigger (frases típicas del cliente):**
- «La secadora no funciona» (sin mención de local)
- «No me arranca» (sin local)
- Cualquier descripción del problema sin referencia a una lavandería conocida

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

(Si el cliente responde «no lo sé» / «ni idea» → bot insiste: «Para poder ayudarte, necesito saber primero en qué lavandería estás exactamente.»)

**Criterios de aceptación:**
- El bot **no** procede al gather de tipo/número/display sin location (excepción: Casos no-troubleshooting que escalan directo).
- Si el cliente dice "no lo sé" / "ni idea" → re-ask con énfasis: "para poder ayudarte, necesito saber primero en qué lavandería estás".
- Si tras la insistencia el cliente da un nombre conocido (Goya, Pineda, etc.) → procede al siguiente paso.
- Si el cliente da un nombre desconocido (ej. "Girona") → `guardInsistLocation` lista las lavanderías reales.
- Si el cliente se niega o no puede identificar el local → escalación tras 2-3 intentos.

**Ejemplo de conversación:**

**Usuario:** La secadora no funciona.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** No lo sé.  
**Bot:** Para poder ayudarte, necesito saber primero en qué lavandería estás exactamente.

**Usuario:** Vale, estoy en Goya.  
**Bot:** Perfecto. ¿Qué número de secadora es?

**Resultado esperado:**  
El bot no diagnostica hasta identificar el local.

**Escalar si:**  
- el cliente no puede identificar el local
- el cliente se niega a indicarlo

---

## Caso 32 — El cliente mezcla incidencia de máquina y pago

**Objetivo:**  
Reconducir el caso al flujo correcto sin perder ningún dato que el cliente
adelante (ej. el número de máquina).

**Cuándo aplica:**  
El cliente mezcla el problema técnico con el problema de cobro y suele
adelantar respuestas (números, "lavadora", etc.) antes de que el bot las
pida explícitamente.

**Trigger (frases típicas del cliente):**
- «He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro»
- «He pagado dos veces y la lavadora 3 no funciona»
- Mensajes que combinan múltiples facts en una sola frase

**Primera respuesta del bot:**  
«👋 Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás ahora mismo?»

(El bot recoge primero la lavandería y luego procede con el canonical order, captando los facts adelantados sin re-preguntarlos.)

**Criterios de aceptación:**
- T1: el bot pregunta location y **no** se deja confundir por la narrativa mixta del cliente (no entra en gather de pago todavía).
- Canonical question order respetado: Step 2 = tipo, Step 3 = número (una pregunta por turno).
- Si el cliente adelanta un fact (ej. "lavadora 3" combinado, o sólo "3"), `autoExtractFacts` lo captura **antes** de que el guard correspondiente fire → el guard pregunta sólo lo que falta, evitando re-asks awkward.
- Si tras gather el problema se aclara como display + pago (Caso 4 / Caso 7), el bot reenruta al flujo correspondiente sin reset de los facts ya capturados.

**Ejemplo de conversación:**

**Usuario:** He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro.  
**Bot:** Hola, soy el asistente virtual de la lavandería. Tranquilo, te ayudo. ¿En qué lavandería estás ahora mismo?

**Usuario:** Pineda.  
**Bot:** ¿Podrías indicarme, por favor, si es una lavadora o una secadora? 🙂

**Usuario:** Lavadora 3.  
**Bot:** Cuéntame, por favor, ¿qué aparece exactamente en la pantalla? 🙂

**Resultado esperado:**  
El bot reconduce el caso al flujo adecuado siguiendo el canonical question
order: Step 2 = tipo, Step 3 = número, una pregunta por turno. Si el
cliente adelanta el número, `autoExtractFacts` lo captura y el guard
sequencial evita la re-ask.

**Comportamiento garantizado por código (no por prompt):**  
- L3 `autoExtractFacts` captura `machineNumber` aunque venga sin
  `machineType` (whole-message digit cuando hay `location`).
- L4 `guardForceMachineType` (`utils/guards/location.ts`) pide siempre
  SOLO el tipo (i18n key `machineType`). El número lo pide el turno
  siguiente `guardForceMachineNumber`. La separación está pinneada por
  `__tests__/unit/force-machine-type.test.ts`.
- Si el cliente adelanta el número (`"3"`), `autoExtractFacts` lo guarda
  y el guard pide solo el tipo en el turno siguiente — ninguna re-ask
  awkward del número.

**Escalar si:**  
- el relato sigue siendo confuso
- el cliente no sabe confirmar qué ocurrió
- hay incoherencia de importe

---

### 32.1 — Marathon: greeting → FAQ → trouble-machine → display switching (SEL → PUSH PROG → DOOR → AL001) → escalación

**Objetivo:** El cliente atraviesa **muchos contextos diferentes en una sola sesión** — un torture test del topic-switching del bot. Empieza con un saludo, hace una FAQ, después abre un problema de máquina y la pantalla cambia 4 veces en cadena (SEL → PUSH PROG → DOOR → AL001). El bot debe re-rutar el flow engine en cada cambio de display **sin perder los facts ya capturados** (location, machineNumber) y **sin atascarse** en el flow anterior. Cuando aparece la alarma hardware (AL001), escala con un summary que cita la cadena completa de displays.

**Criterios de aceptación:**
- **Sticky language**: la lengua se fija en T1 vía `resolveLanguageForTurn` y NO cambia en los 15+ turnos siguientes.
- **FAQ-first sin contaminación**: la FAQ de horarios (T2) se responde con `apply_faq_override('openingHours')` y NO mete al cliente en ningún `pendingFlow` — T3 arranca el trouble-machine desde cero.
- **Reset de display al cambio de pantalla**: cada vez que el cliente reporta un display nuevo (PUSH PROG, DOOR, AL001), `autoExtractFacts` reescribe `state.displayState` + `state.displayLabel`, y la transición resetea `displayAskAttempts` (counter del 3-strikes) sin tocar `location` / `machineNumber`.
- **El bot NO re-pregunta** location / numero después del primer gather (T4–T6).
- **El flow engine re-arranca por display**: `washer_hs60xx.json` se re-resuelve en cada nuevo `displayState`. El `pendingFlow` viejo se borra antes de aplicar el nuevo.
- **AL001 escala automáticamente** (marcado `requiresOperator: true` en `washer_hs60xx.json`). Salta directo a `requireCustomerName`.
- **El summary del operador** lista TODOS los displays vistos en orden cronológico (`state.displayHistory[]`), no solo el último.
- **Una sola escalación** al final, no una por cada display.

**Conversación:**

**Usuario:** ¡Hola! ¿Cómo va?  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué puedo ayudarte?

**Usuario:** ¿Qué horarios hacéis?  
**Bot:** Estamos abiertos todos los días de 7:00 a 23:00. ¿Hay algo más en lo que pueda ayudarte?

**Usuario:** Tengo un problema con la lavadora.  
**Bot:** Lamento la incidencia. ¿En qué lavandería te encuentras?

**Usuario:** Pineda.  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** La 3.  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SEL.  
**Bot:** SEL significa que tienes que seleccionar el programa. Pulsa el programa que quieras (40º, 60º…) y después el botón START. ¿Te ha funcionado?

**Usuario:** No, ahora aparece PUSH PROG.  
**Bot:** PUSH PROG quiere decir que la máquina está esperando que confirmes el programa. Estos son los disponibles:  
**30º** — colores delicados  
**40º** — algodón color  
**60º** — algodón blanco  
**90º** — sanitario / toallas

Pulsa el botón del programa y la lavadora arrancará. ¿Te ha funcionado?

**Usuario:** No, ahora pone DOOR.  
**Bot:** DOOR indica que la puerta no está bien cerrada. Empuja la puerta firmemente hasta oír el clic y vuelve a pulsar START. ¿Se ha resuelto?

**Usuario:** No, ahora aparece AL001.  
**Bot:** El código AL001 es una alarma técnica de la máquina. Voy a derivar el caso a un operador para que te ayude. ¿Cómo te llamas?

**Usuario:** Marc  
**Bot:** Gracias Marc. Un operador humano se encargará de tu caso. Por favor, espera un momento mientras revisan la situación. El chatbot será desactivado.

👤 **Human Support:** Usuario Marc en Pineda reporta lavadora 3 con secuencia de displays SEL → PUSH PROG → DOOR → AL001. La máquina probablemente tiene un fallo hardware (AL001) tras múltiples intentos de arranque. Necesita revisión técnica.

**Comportamiento garantizado por código (no por prompt):**

✅ **DONE — display switching pivot (Andrea, 2026-05-09):**
- **L3 `autoExtractFacts`** sobrescribe `displayState` + `displayLabel` en cada turno donde el cliente reporta una pantalla nueva. La sobreescritura es determinística — no depende del LLM. Pinneada por `__tests__/unit/display-change-mid-flow.test.ts`.
- **L2 snapshot pre-extract** en `agent.ts:agentTurn`: `state.displayStateAtTurnStart = state.displayState` ANTES de llamar a `autoExtractFacts`. Permite a los guards downstream detectar un cambio de display ocurrido EN este turno comparando snapshot vs current.
- **L4 Phase B pivot** en `utils/guards/display.ts:guardPostInstructionFailure`: cuando el cliente combina señal de fallo ("no") + nuevo display ("ahora aparece PUSH PROG") en el mismo mensaje, el guard detecta `displayState !== displayStateAtTurnStart && displayStateAtTurnStart !== ''` y hace pivot — limpia `pendingFlow` / `activeFlowId` / `activeStepId` / `lastPresentedStepId` y retorna `null`, dejando que la siguiente pasada del pipeline rute al nuevo flow. Simétrico con el pivot de Phase C que ya existía. Pinneado por `__tests__/unit/display-pivot-phase-b.test.ts` (3 paths: pivot / preserved / no-pivot first capture) + el e2e `__tests__/agent/32-marathon.test.spec.ts` Scenario 32.1.
- **L4 flow engine `washer_hs60xx.json`** se re-resuelve cada vez que `displayState` cambia. La resolución es idempotente — re-aplicarla no produce side effects.
- **L1 sticky language** garantizado por `resolveLanguageForTurn` que solo evalúa el primer mensaje de la sesión.

⏳ **TODO RED-SPEC — chronological summary:**
- **L2 `state.displayHistory[]`** para acumular cronológicamente todos los displays vistos en la sesión (SEL → PUSH → DOOR → AL001). Hoy `state.displayState` solo guarda el ÚLTIMO.
- **L5 `extractEscalationContext`** debería leer `displayHistory[]` y citar todos los códigos en orden, no solo el último. Hoy el summary cita solo `displayState` / `displayLabel`.
- **Trigger para implementar**: cuando el operador necesite tracciabilità completa. Oggi el summary actual ("Marc en Pineda reporta lavadora 3 con AL001") basta per il caso d'uso real.

---

### 32.2 — Marathon: trouble-machine resuelto → cliente pivota a factura (Caso 9) en la misma sesión

**Objetivo:** El cliente abre un problema de máquina, lo resuelve, y a continuación pide la factura — todo en la misma sesión. El bot debe cerrar limpiamente el primer flow (`markResolved`) y abrir el flow de factura **preservando** los datos comunes ya conocidos (location), pero pidiendo solo lo que falta (datos fiscales, importe, fecha).

**Criterios de aceptación:**
- El primer flow (trouble-machine) se cierra con `markResolved(ar)` cuando el cliente confirma "ha funcionado".
- El segundo flow (Caso 9 invoice) **no re-pregunta location** — la lee de `state.location`.
- Los counters del primer flow (`displayAskAttempts`, `machineNumberAskAttempts`) se resetean al pivotar.
- El `pendingFlow` viejo se borra antes de setear `pendingFlow='invoice-ask-fiscal-data'`.
- `customerNameRequested` NO está activo entre los dos flows: el primer flow resuelto no requiere nombre.
- **No hay escalación** entre los dos flows — el cliente recibe ambos servicios sin handover.

**Conversación:**

**Usuario:** Hola, la lavadora no funciona.  
**Bot:** Lamento la incidencia. ¿En qué lavandería te encuentras?

**Usuario:** Goya.  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** La 5.  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG.  
**Bot:** PUSH PROG quiere decir que la máquina está esperando que confirmes el programa. Estos son los disponibles:  
**30º** — colores delicados  
**40º** — algodón color  
**60º** — algodón blanco  
**90º** — sanitario / toallas

Pulsa el botón del programa y la lavadora arrancará. ¿Te ha funcionado?

**Usuario:** ¡Sí! Ya está lavando, gracias.  
**Bot:** ¡Me alegro! ¿Hay algo más en lo que pueda ayudarte?

**Usuario:** Sí, ¿podría tener la factura del lavado?  
**Bot:** Por supuesto. Para emitirte la factura necesito unos datos. ¿Cuál es tu nombre o razón social?

**Usuario:** Marc Aubareda.  
**Bot:** Gracias. ¿Cuál es tu NIF/CIF?

**Usuario:** 12345678Z  
**Bot:** ¿Y la dirección fiscal?

**Usuario:** Calle Mayor 12, Mataró 08301  
**Bot:** Perfecto. ¿Cuál es el importe del lavado y la fecha?

**Usuario:** 5€, hoy.  
**Bot:** Recibido. Te enviaremos la factura por email en las próximas horas. ¿Algo más?

**Usuario:** No, gracias.  
**Bot:** ¡Gracias a ti! Que tengas buen día.

**Comportamiento garantizado por código (no por prompt):**
- **L2 `markResolved(ar)`** se llama tras la confirmación "sí ha funcionado". Resetea `pendingFlow`, `displayAskAttempts`, `machineNumberAskAttempts` pero preserva `location`.
- **L3 `detectInvoiceIntent`** captura el trigger "factura" y setea `pendingFlow='invoice-ask-fiscal-data'`. NO requiere location porque ya está en estado.
- **L4 `guardCaso9Factura`** lee `state.location` y salta el primer paso del invoice gather. Continúa pidiendo solo nombre/NIF/dirección/importe/fecha.
- **L5 `polishReplyForTurn`** garantiza que el bot diga *"¡Me alegro! ¿Hay algo más?"* (i18n key `resolvedAskMore`) tras `markResolved`, no improvisa.
- Pinneado por `__tests__/agent/32-marathon-trouble-then-invoice.test.spec.ts` (Scenario 32.2).

---

### 32.3 — Marathon abandono/recupero: cliente abre trouble, salta a FAQ a mitad de gather, vuelve al trouble

**Objetivo:** El cliente abre un problema de máquina, a mitad del gather (después de location, antes del display) hace una pregunta FAQ aislada ("¿cuánto cuesta lavar?"). El bot responde la FAQ y **vuelve al gather pendiente** sin re-preguntar la location. La FAQ es un flow paralelo que NO debe destruir el `pendingFlow` activo — solo pausarlo.

**Criterios de aceptación:**
- T2 captura `state.location` correctamente.
- T3 (FAQ pricing) se responde con `apply_faq_override('washDryPrice')` SIN tocar `pendingFlow`.
- T4 el bot retoma el gather de trouble-machine desde donde quedó (canonical order: machine number).
- El `pendingFlow` trouble-machine **persiste** durante la FAQ paralela (no se borra, solo se "pausa" via `state.faqPause`).
- Si el cliente hace una segunda FAQ, el bot la responde y vuelve a retomar el gather.
- Si el cliente abandona explícitamente ("ya no me interesa"), el `pendingFlow` se borra con `resetForNewIncident(ar)`.

**Conversación:**

**Usuario:** Tengo un problema con la lavadora.  
**Bot:** Lamento la incidencia. ¿En qué lavandería te encuentras?

**Usuario:** Goya.  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** Espera, antes una pregunta: ¿cuánto cuesta lavar?  
**Bot:** El lavado cuesta 5€ y el secado 4€. ¿Quieres que sigamos con el problema de la lavadora?

**Usuario:** Sí, perdona. La lavadora 3.  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SEL.  
**Bot:** SEL significa que tienes que seleccionar el programa. Pulsa el programa que quieras (40º, 60º…) y después el botón START. ¿Te ha funcionado?

**Usuario:** Sí, gracias.  
**Bot:** ¡Me alegro! ¿Hay algo más en lo que pueda ayudarte?

**Comportamiento garantizado por código (no por prompt):**
- **L3 nuevo detector `detectFaqPause`** (en `utils/intent.ts`) reconoce que el mensaje es una FAQ aislada (pricing, hours, location, payment-methods) en medio de un `pendingFlow`. Setea un flag transitorio `state.faqPause = true` para el turno actual.
- **L4 los guards FAQ** (`guardHoursAndPricing` etc.) responden cuando ven `faqPause = true` PERO no tocan `pendingFlow` (rule #4: solo state-transitions modifica `pendingFlow`).
- **L5 `polishReplyForTurn`** añade el prompt de retorno *"¿Quieres que sigamos con el problema?"* (i18n key `resumeAfterFaq`) cuando `faqPause = true` y `pendingFlow !== null`. El cliente responde "sí" → reanuda, o "no" → `resetForNewIncident(ar)`.
- **L2 `pendingFlow` persiste** durante toda la rama FAQ. El gather guard `guardForceMachineNumber` se re-activa porque `pendingFlow` sigue presente y `machineNumber` sigue vacío.
- Pinneado por `__tests__/agent/32-marathon-faq-pause.test.spec.ts` (Scenario 32.3) + `__tests__/unit/faq-pause.test.ts`.