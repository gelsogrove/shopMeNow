# Ecolaundry Chatbot - Bloque 1 de casos

[TOC]

## Cómo usar este bloque

Este documento reúne casos de conversación en español para configurar y probar el chatbot de Ecolaundry.

Cada caso incluye:
- objetivo
- cuándo aplica
- ejemplo de conversación
- resultado esperado
- cuándo escalar

Reglas generales para todos los casos:
- hacer una sola pregunta por turno
- identificar primero el local
- no diagnosticar sin saber qué aparece en pantalla cuando hay una incidencia de máquina
- no prometer compensaciones
- si el caso no encaja claramente, escalar a revisión

---

## Caso 1 — La lavadora no funciona y aparece PUSH PROG

**Objetivo:**  
Ayudar al cliente a iniciar el lavado cuando falta seleccionar el programa.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `PUSH PROG`.

**Ejemplo de conversación:**

**Usuario:** La lavadora no funciona.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo paso a paso. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5.  
**Bot:** Perfecto. ¿Has podido realizar el pago?

**Usuario:** Sí.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG.  
**Bot:** Perfecto. Ese mensaje indica que falta seleccionar el programa. Pulsa ahora el programa que quieras usar y dime si la lavadora empieza a funcionar.

**Usuario:** Sí, ahora funciona.  
**Bot:** Perfecto, incidencia resuelta. Si vuelve a pasar o aparece otro mensaje en pantalla, dímelo y te sigo ayudando.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente pulsa el programa y la máquina no responde
- el mensaje cambia a otro código no documentado

---

## Caso 2 — La lavadora no funciona y aparece DOOR

**Objetivo:**  
Ayudar al cliente a cerrar correctamente la puerta.

**Cuándo aplica:**  
El cliente indica que en pantalla aparece `DOOR`.

**Ejemplo de conversación:**

**Usuario:** La lavadora no arranca.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** Hortes.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 2.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** DOOR.  
**Bot:** Ese mensaje indica que la puerta no está bien cerrada. Ábrela y ciérrala bien, y vuelve a probar.

**Usuario:** Ahora sí funciona.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el mensaje `DOOR` sigue apareciendo
- el cliente repite el paso y no arranca

---

## Caso 3 — La lavadora no funciona y aparece SEL

**Objetivo:**  
Ayudar al cliente cuando la máquina está pendiente de selección.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `SEL`.

**Ejemplo de conversación:**

**Usuario:** He pagado pero la lavadora no empieza.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 3.  
**Bot:** Perfecto. ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL.  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina o el programa correspondiente.

**Usuario:** Ya lo he hecho y ahora sí funciona.  
**Bot:** Perfecto, incidencia resuelta.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente ya ha repetido la selección y la máquina sigue sin responder

---

## Caso 4 — He pagado y no se ha activado, y la central no ha devuelto el cambio

**Objetivo:**  
Detectar un posible error de selección de máquina.

**Cuándo aplica:**  
El cliente ha pagado, la máquina no se activa y la central no ha devuelto el cambio.

**Ejemplo de conversación:**

**Usuario:** He pagado y no se ha activado.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** Perfecto. ¿Qué número de máquina es?

**Usuario:** La 4.  
**Bot:** De acuerdo. ¿La central te ha devuelto el cambio?

**Usuario:** No.  
**Bot:** Es posible que no se haya marcado bien el número de la máquina. Mira si todavía aparece saldo en la central y pulsa correctamente el botón correspondiente.

**Usuario:** Sí, ahora ya se ha puesto en marcha.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente sigue sin poder activarla
- aparece un código de pantalla no documentado

---

## Caso 5 — Error AL001

**Objetivo:**  
Explicar el motivo del error y corregir la secuencia de uso.

**Cuándo aplica:**  
El cliente indica que aparece `AL001`.

**Ejemplo de conversación:**

**Usuario:** Me sale AL001.  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** L’Escala.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** De acuerdo. Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. ¿Qué has hecho justo antes de que apareciera el mensaje?

**Usuario:** Creo que toqué el programa antes de acabar el pago.  
**Bot:** Perfecto, eso nos ayuda. Vamos a revisarlo paso a paso para que puedas continuar correctamente.

**Resultado esperado:**  
El bot identifica que el problema está en la secuencia de uso y guía o escala.

**Escalar si:**  
- el cliente no puede seguir las instrucciones
- el error persiste después de repetir el proceso correctamente

---

## Caso 6 — Me han cobrado dos veces pero he podido usar el servicio

**Objetivo:**  
Recoger los datos mínimos para revisión y devolución.

**Cuándo aplica:**  
El cliente dice que ha habido doble cobro, pero sí ha podido lavar o secar.

**Ejemplo de conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** Lo revisamos contigo. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Has podido lavar o secar la ropa?

**Usuario:** Sí.  
**Bot:** De acuerdo. Explícame, por favor, paso a paso qué has hecho desde que has entrado.

**Usuario:** He pagado, no iba y volví a pasar la tarjeta.  
**Bot:** Gracias. Para revisarlo bien, necesito los últimos 4 dígitos de la tarjeta.

**Usuario:** 4821.  
**Bot:** Perfecto. Ahora necesito una captura del pago.

**Usuario:** Vale.  
**Bot:** Gracias. Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contacta con nosotros y te ayudaremos al momento.

**Resultado esperado:**  
Datos recogidos y caso preparado para revisión.

**Escalar si:**  
- el importe no cuadra con el local
- el relato es confuso
- el cliente está muy molesto

---

## Caso 7 — He pagado pero no he podido usar el servicio

**Objetivo:**  
Comprobar si la central devolvió el cambio y reconducir al flujo correcto.

**Cuándo aplica:**  
El cliente pagó, pero no llegó a usar la máquina.

**Ejemplo de conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** Te ayudo a revisarlo. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** Gracias. ¿La central te ha devuelto el cambio?

**Usuario:** Sí.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** PUSH PROG.  
**Bot:** Perfecto. Pulsa ahora el programa que quieras usar y dime si la máquina responde.

**Usuario:** Ahora sí.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Resolución o redirección al flujo de pantalla.

**Escalar si:**  
- tras seguir el paso, la máquina no responde
- el cliente no sabe leer la pantalla y no puede enviar foto

---

## Caso 8 — Tengo un código de importe menor

**Objetivo:**  
Ayudar al cliente a completar el proceso con un código y un pequeño importe pendiente.

**Cuándo aplica:**  
El cliente tiene un código válido y solo le falta una pequeña parte del importe.

**Ejemplo de conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo.  
**Bot:** Te ayudo. Dime el código exacto tal como lo ves, incluyendo letras si las hay.

**Usuario:** AB12345.  
**Bot:** Gracias. ¿En qué lavandería lo quieres usar?

**Usuario:** Goya.  
**Bot:** Perfecto. ¿Te falta una pequeña parte para completar el importe o el código cubre un importe mayor?

**Usuario:** Me falta un poco.  
**Bot:** De acuerdo. Introduce en la central el importe que falta y no toques nada más. Después ponte delante de la máquina y dime si ya puedes continuar.

**Usuario:** Sí, ya funciona.  
**Bot:** Perfecto, incidencia resuelta.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el código no encaja con el formato esperado
- el cliente dice que solo hay números y no hay letras delante
- tras introducir el importe pendiente, no funciona

---

## Caso 9 — Quiero una factura

**Objetivo:**  
Dar una instrucción cerrada y clara.

**Cuándo aplica:**  
El cliente pide factura.

**Ejemplo de conversación:**

**Usuario:** Quiero una factura.  
**Bot:** Para obtenerla, debes enviar un correo a olga@alberwaz.net con esta información: razón social, email, lavandería utilizada, CIF/NIF, dirección, fecha de uso, máquinas utilizadas y observaciones.

**Usuario:** Perfecto.  
**Bot:** Gracias. Si lo necesitas, te repito la lista paso a paso.

**Resultado esperado:**  
Consulta cerrada.

**Escalar si:**  
- el cliente plantea una excepción no contemplada

---

## Caso 10 — Cómo comprar la tarjeta de fidelización

**Objetivo:**  
Explicar compra y limitación de uso de la tarjeta.

**Cuándo aplica:**  
El cliente quiere adquirir una tarjeta.

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
Escalar sin confrontar al cliente.

**Cuándo aplica:**  
Aparece `ALM`, `ALN`, `001`, un código no documentado, o hay incoherencias en el relato o en el importe.

**Ejemplo de conversación:**

**Usuario:** He pagado y ahora sale ALN.  
**Bot:** Gracias. Parece que la máquina ha detectado una incidencia y tenemos que revisarlo manualmente.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión para poder ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado correctamente.

**Escalar si:**  
- siempre, en este tipo de códigos o incoherencias



# Ecolaundry Chatbot - Bloque 1 de casos

[TOC]

## Cómo usar este bloque

Este documento reúne casos de conversación en español para configurar y probar el chatbot de Ecolaundry.

Cada caso incluye:
- objetivo
- cuándo aplica
- ejemplo de conversación
- resultado esperado
- cuándo escalar

Reglas generales para todos los casos:
- hacer una sola pregunta por turno
- identificar primero el local
- no diagnosticar sin saber qué aparece en pantalla cuando hay una incidencia de máquina
- no prometer compensaciones
- si el caso no encaja claramente, escalar a revisión

---

## Caso 1 — La lavadora no funciona y aparece PUSH PROG

**Objetivo:**  
Ayudar al cliente a iniciar el lavado cuando falta seleccionar el programa.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `PUSH PROG`.

**Ejemplo de conversación:**

**Usuario:** La lavadora no funciona.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo paso a paso. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5.  
**Bot:** Perfecto. ¿Has podido realizar el pago?

**Usuario:** Sí.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** PUSH PROG.  
**Bot:** Perfecto. Ese mensaje indica que falta seleccionar el programa. Pulsa ahora el programa que quieras usar y dime si la lavadora empieza a funcionar.

**Usuario:** Sí, ahora funciona.  
**Bot:** Perfecto, incidencia resuelta. Si vuelve a pasar o aparece otro mensaje en pantalla, dímelo y te sigo ayudando.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente pulsa el programa y la máquina no responde
- el mensaje cambia a otro código no documentado

---

## Caso 2 — La lavadora no funciona y aparece DOOR

**Objetivo:**  
Ayudar al cliente a cerrar correctamente la puerta.

**Cuándo aplica:**  
El cliente indica que en pantalla aparece `DOOR`.

**Ejemplo de conversación:**

**Usuario:** La lavadora no arranca.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** Hortes.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 2.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla?

**Usuario:** DOOR.  
**Bot:** Ese mensaje indica que la puerta no está bien cerrada. Ábrela y ciérrala bien, y vuelve a probar.

**Usuario:** Ahora sí funciona.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el mensaje `DOOR` sigue apareciendo
- el cliente repite el paso y no arranca

---

## Caso 3 — La lavadora no funciona y aparece SEL

**Objetivo:**  
Ayudar al cliente cuando la máquina está pendiente de selección.

**Cuándo aplica:**  
El cliente ha pagado y la pantalla muestra `SEL`.

**Ejemplo de conversación:**

**Usuario:** He pagado pero la lavadora no empieza.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. Te ayudo. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 3.  
**Bot:** Perfecto. ¿Qué aparece exactamente en la pantalla?

**Usuario:** SEL.  
**Bot:** Ese mensaje indica que la máquina está pendiente de selección. Comprueba, por favor, que has pulsado bien el número de la máquina o el programa correspondiente.

**Usuario:** Ya lo he hecho y ahora sí funciona.  
**Bot:** Perfecto, incidencia resuelta.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente ya ha repetido la selección y la máquina sigue sin responder

---

## Caso 4 — He pagado y no se ha activado, y la central no ha devuelto el cambio

**Objetivo:**  
Detectar un posible error de selección de máquina.

**Cuándo aplica:**  
El cliente ha pagado, la máquina no se activa y la central no ha devuelto el cambio.

**Ejemplo de conversación:**

**Usuario:** He pagado y no se ha activado.  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** Perfecto. ¿Qué número de máquina es?

**Usuario:** La 4.  
**Bot:** De acuerdo. ¿La central te ha devuelto el cambio?

**Usuario:** No.  
**Bot:** Es posible que no se haya marcado bien el número de la máquina. Mira si todavía aparece saldo en la central y pulsa correctamente el botón correspondiente.

**Usuario:** Sí, ahora ya se ha puesto en marcha.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el cliente sigue sin poder activarla
- aparece un código de pantalla no documentado

---

## Caso 5 — Error AL001

**Objetivo:**  
Explicar el motivo del error y corregir la secuencia de uso.

**Cuándo aplica:**  
El cliente indica que aparece `AL001`.

**Ejemplo de conversación:**

**Usuario:** Me sale AL001.  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** L’Escala.  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora.  
**Bot:** De acuerdo. Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. ¿Qué has hecho justo antes de que apareciera el mensaje?

**Usuario:** Creo que toqué el programa antes de acabar el pago.  
**Bot:** Perfecto, eso nos ayuda. Vamos a revisarlo paso a paso para que puedas continuar correctamente.

**Resultado esperado:**  
El bot identifica que el problema está en la secuencia de uso y guía o escala.

**Escalar si:**  
- el cliente no puede seguir las instrucciones
- el error persiste después de repetir el proceso correctamente

---

## Caso 6 — Me han cobrado dos veces pero he podido usar el servicio

**Objetivo:**  
Recoger los datos mínimos para revisión y devolución.

**Cuándo aplica:**  
El cliente dice que ha habido doble cobro, pero sí ha podido lavar o secar.

**Ejemplo de conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta.  
**Bot:** Lo revisamos contigo. ¿En qué lavandería estás?

**Usuario:** Goya.  
**Bot:** Gracias. ¿Has podido lavar o secar la ropa?

**Usuario:** Sí.  
**Bot:** De acuerdo. Explícame, por favor, paso a paso qué has hecho desde que has entrado.

**Usuario:** He pagado, no iba y volví a pasar la tarjeta.  
**Bot:** Gracias. Para revisarlo bien, necesito los últimos 4 dígitos de la tarjeta.

**Usuario:** 4821.  
**Bot:** Perfecto. Ahora necesito una captura del pago.

**Usuario:** Vale.  
**Bot:** Gracias. Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contacta con nosotros y te ayudaremos al momento.

**Resultado esperado:**  
Datos recogidos y caso preparado para revisión.

**Escalar si:**  
- el importe no cuadra con el local
- el relato es confuso
- el cliente está muy molesto

---

## Caso 7 — He pagado pero no he podido usar el servicio

**Objetivo:**  
Comprobar si la central devolvió el cambio y reconducir al flujo correcto.

**Cuándo aplica:**  
El cliente pagó, pero no llegó a usar la máquina.

**Ejemplo de conversación:**

**Usuario:** He pagado y no he podido usar la máquina.  
**Bot:** Te ayudo a revisarlo. ¿En qué lavandería estás?

**Usuario:** Pineda.  
**Bot:** Gracias. ¿La central te ha devuelto el cambio?

**Usuario:** Sí.  
**Bot:** De acuerdo. ¿Qué aparece exactamente en la pantalla de la máquina?

**Usuario:** PUSH PROG.  
**Bot:** Perfecto. Pulsa ahora el programa que quieras usar y dime si la máquina responde.

**Usuario:** Ahora sí.  
**Bot:** Perfecto, ya estaría resuelto.

**Resultado esperado:**  
Resolución o redirección al flujo de pantalla.

**Escalar si:**  
- tras seguir el paso, la máquina no responde
- el cliente no sabe leer la pantalla y no puede enviar foto

---

## Caso 8 — Tengo un código de importe menor

**Objetivo:**  
Ayudar al cliente a completar el proceso con un código y un pequeño importe pendiente.

**Cuándo aplica:**  
El cliente tiene un código válido y solo le falta una pequeña parte del importe.

**Ejemplo de conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo.  
**Bot:** Te ayudo. Dime el código exacto tal como lo ves, incluyendo letras si las hay.

**Usuario:** AB12345.  
**Bot:** Gracias. ¿En qué lavandería lo quieres usar?

**Usuario:** Goya.  
**Bot:** Perfecto. ¿Te falta una pequeña parte para completar el importe o el código cubre un importe mayor?

**Usuario:** Me falta un poco.  
**Bot:** De acuerdo. Introduce en la central el importe que falta y no toques nada más. Después ponte delante de la máquina y dime si ya puedes continuar.

**Usuario:** Sí, ya funciona.  
**Bot:** Perfecto, incidencia resuelta.

**Resultado esperado:**  
Incidencia resuelta.

**Escalar si:**  
- el código no encaja con el formato esperado
- el cliente dice que solo hay números y no hay letras delante
- tras introducir el importe pendiente, no funciona

---

## Caso 9 — Quiero una factura

**Objetivo:**  
Dar una instrucción cerrada y clara.

**Cuándo aplica:**  
El cliente pide factura.

**Ejemplo de conversación:**

**Usuario:** Quiero una factura.  
**Bot:** Para obtenerla, debes enviar un correo a olga@alberwaz.net con esta información: razón social, email, lavandería utilizada, CIF/NIF, dirección, fecha de uso, máquinas utilizadas y observaciones.

**Usuario:** Perfecto.  
**Bot:** Gracias. Si lo necesitas, te repito la lista paso a paso.

**Resultado esperado:**  
Consulta cerrada.

**Escalar si:**  
- el cliente plantea una excepción no contemplada

---

## Caso 10 — Cómo comprar la tarjeta de fidelización

**Objetivo:**  
Explicar compra y limitación de uso de la tarjeta.

**Cuándo aplica:**  
El cliente quiere adquirir una tarjeta.

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
Escalar sin confrontar al cliente.

**Cuándo aplica:**  
Aparece `ALM`, `ALN`, `001`, un código no documentado, o hay incoherencias en el relato o en el importe.

**Ejemplo de conversación:**

**Usuario:** He pagado y ahora sale ALN.  
**Bot:** Gracias. Parece que la máquina ha detectado una incidencia y tenemos que revisarlo manualmente.

**Usuario:** Vale.  
**Bot:** Pasaremos tu caso a revisión para poder ayudarte de la manera más adecuada.

**Resultado esperado:**  
Caso escalado correctamente.

**Escalar si:**  
- siempre, en este tipo de códigos o incoherencias


