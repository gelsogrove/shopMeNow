# Ecolaundry Chatbot — Usecases

## Índice

- [Caso 1 — PUSH PROG](#caso-1--push-prog)
  - [1.1 — Happy Path](#11--happy-path)
  - [1.2 — Escalación: máquina no responde tras pulsar](#12--escalación-máquina-no-responde-tras-pulsar)
- [Caso 2 — DOOR](#caso-2--door)
  - [2.1 — Happy Path](#21--happy-path)
  - [2.2 — Escalación: puerta bloqueada tras repetir](#22--escalación-puerta-bloqueada-tras-repetir)
- [Caso 3 — SEL](#caso-3--sel)
  - [3.1 — Happy Path](#31--happy-path)
  - [3.2 — Escalación: SEL persiste](#32--escalación-sel-persiste)
- [Caso 4 — He pagado y no se ha activado](#caso-4--he-pagado-y-no-se-ha-activado)
  - [4.1 — No-change Happy Path](#41--no-change-happy-path)
  - [4.2 — Escalación: cambio devuelto pero no arranca](#42--escalación-cambio-devuelto-pero-no-arranca)
- [Caso 5 — AL001](#caso-5--al001)
  - [5.1 — Happy Path](#51--happy-path)
  - [5.2 — Escalación: cliente no puede seguir instrucciones](#52--escalación-cliente-no-puede-seguir-instrucciones)
  - [5.3 — Escalación: AL001 persiste](#53--escalación-al001-persiste)
- [Caso 6 — Doble cobro](#caso-6--doble-cobro)
  - [6.1 — Servicio completado (Happy Path)](#61--servicio-completado-happy-path)
  - [6.2 — Escalación: cliente muy molesto](#62--escalación-cliente-muy-molesto)
  - [6.3 — Escalación: relato inconsistente](#63--escalación-relato-inconsistente)
  - [6.4 — SIN haber usado el servicio](#64--sin-haber-usado-el-servicio)
  - [6.5 — Validación 4 dígitos tarjeta](#65--validación-4-dígitos-tarjeta)
- [Caso 7 — Pagado sin usar](#caso-7--pagado-sin-usar)
  - [7.1 — Resuelto vía pantalla PUSH PROG](#71--resuelto-vía-pantalla-push-prog)
  - [7.2 — Escalación: máquina no responde tras paso indicado](#72--escalación-máquina-no-responde-tras-paso-indicado)
- [Caso 8 — Código de descuento](#caso-8--código-de-descuento)
  - [8.1 — Happy Path (formato válido)](#81--happy-path-formato-válido)
  - [8.2 — Formato inválido (retry + escalate)](#82--formato-inválido-retry--escalate)
- [Caso 9 — Factura](#caso-9--factura)
  - [9.1 — Happy Path](#91--happy-path)
  - [9.2 — Email inválido (retry)](#92--email-inválido-retry)
- [Caso 10 — Comprar tarjeta fidelización](#caso-10--comprar-tarjeta-fidelización)
- [Caso 11 — Recargar tarjeta fidelización](#caso-11--recargar-tarjeta-fidelización)
- [Caso 12 — Horarios y precios](#caso-12--horarios-y-precios)
- [Caso 13 — Código de alarma o incoherencia](#caso-13--código-de-alarma-o-incoherencia)
- [Caso 14 — ALM DOOR](#caso-14--alm-door)
- [Caso 15 — 001](#caso-15--001)
- [Caso 16 — ALM / ALN](#caso-16--alm--aln)
- [Caso 17 — No sabe qué aparece en pantalla](#caso-17--no-sabe-qué-aparece-en-pantalla)
- [Caso 18 — Código solo numérico](#caso-18--código-solo-numérico)
- [Caso 19 — Datáfono 10€ en Goya](#caso-19--datáfono-10-en-goya)
- [Caso 20 — Datáfono 10€ en Pineda](#caso-20--datáfono-10-en-pineda)
- [Caso 21 — Alemanya: monedas secadora no suman](#caso-21--alemanya-monedas-secadora-no-suman)
- [Caso 22 — Pineda: monedas secadora no suman](#caso-22--pineda-monedas-secadora-no-suman)
- [Caso 23 — Alemanya: no se puede pagar con tarjeta](#caso-23--alemanya-no-se-puede-pagar-con-tarjeta)
- [Caso 24 — Hortes: no se puede pagar con tarjeta](#caso-24--hortes-no-se-puede-pagar-con-tarjeta)
- [Caso 25 — Cliente muy enfadado](#caso-25--cliente-muy-enfadado)
- [Caso 26 — Devolución inmediata](#caso-26--devolución-inmediata)
- [Caso 27 — Compensación concreta](#caso-27--compensación-concreta)
- [Caso 28 — Relato contradictorio doble cobro](#caso-28--relato-contradictorio-doble-cobro)
- [Caso 29 — Cámaras o revisión técnica](#caso-29--cámaras-o-revisión-técnica)
- [Caso 30 — Código no documentado](#caso-30--código-no-documentado)
- [Caso 31 — Cliente no indica local](#caso-31--cliente-no-indica-local)
- [Caso 32 — Mezcla incidencia máquina y pago](#caso-32--mezcla-incidencia-máquina-y-pago)
  - [32.1 — Marathon: display switching](#321--marathon-display-switching)
  - [32.2 — Marathon: trouble resuelto → factura](#322--marathon-trouble-resuelto--factura)
  - [32.3 — Marathon: FAQ pause mid-gather](#323--marathon-faq-pause-mid-gather)

---

## Caso 1 — PUSH PROG

### 1.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → número de máquina → pantalla. NO pregunta «¿has pagado?».
2. Tras PUSH PROG, el bot pide pulsar un botón de programa.
3. Cuando el cliente confirma que funciona, el bot cierra como resuelto.
4. No se escala a operador.

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado.

**Usuario:** Sí, ahora funciona  
**Bot:** ✅ Perfecto, incidencia resuelta.

---

### 1.2 — Escalación: máquina no responde tras pulsar

**Criterios de aceptación:**
1. Si el cliente dice «no responde» tras pulsar, el bot re-pregunta el código exacto.
2. Confirmado PUSH PROG de nuevo → escala y pide nombre.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: nombre, lavandería, número, código pantalla.

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado.

**Usuario:** He pulsado pero no responde  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** PUSH PROG  
**Bot:** ⚠️ Si nada ha funcionado, vamos a notificar al operador. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 2 — DOOR

### 2.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → número → pantalla.
2. Tras DOOR, el bot pide abrir y cerrar bien la puerta.
3. Si el cliente confirma que funciona, cierra como resuelto.
4. No se escala.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás?

**Usuario:** Hortes  
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** DOOR  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez. Dime si la lavadora ha arrancado.

**Usuario:** Sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 2.2 — Escalación: puerta bloqueada tras repetir

**Criterios de aceptación:**
1. Si DOOR persiste, el bot re-pregunta el código exacto.
2. Confirmado DOOR → escala y pide nombre.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: nombre, lavandería, número, estado DOOR.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás?

**Usuario:** Hortes  
**Bot:** ¿Cuál es el número de la lavadora?

**Usuario:** 2  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** DOOR  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez. Dime si la lavadora ha arrancado.

**Usuario:** NO  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** DOOR  
**Bot:** ⚠️ La puerta sigue bloqueada. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 3 — SEL

### 3.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → número → pantalla.
2. Tras SEL, el bot pide comprobar el número en la central de pago.
3. NO muestra los 4 programas (diferencia con Caso 1 PUSH PROG).
4. Si confirma que funciona, cierra como resuelto.

**Conversación:**

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Pineda  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SEL  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número de la máquina en la central de pago. Después dime si la lavadora ha arrancado.

**Usuario:** Ahora sí funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 3.2 — Escalación: SEL persiste

**Criterios de aceptación:**
1. Si SEL persiste, el bot re-pregunta el código exacto.
2. Confirmado SEL → escala y pide nombre.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: nombre, lavandería, número, código SEL.

**Conversación:**

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Pineda  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SEL  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número de la máquina en la central de pago.

**Usuario:** Aun no arranca  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** SEL  
**Bot:** ⚠️ La pantalla sigue mostrando SEL. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso.

---

## Caso 4 — He pagado y no se ha activado

### 4.1 — No-change Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → tipo → número → «¿la central te ha devuelto el cambio?» (NO pantalla).
2. Si responde «No», el bot pide revisar el saldo y marcar el número correcto.
3. Si confirma que arranca, cierra como resuelto.
4. No se escala.

**Conversación:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** ¿La central te ha devuelto el cambio?

**Usuario:** No  
**Bot:** Es posible que no se haya marcado bien el número de la máquina. Mira si todavía aparece saldo en la central y pulsa correctamente el botón correspondiente.

**Usuario:** Sí, ahora ya se ha puesto en marcha  
**Bot:** Perfecto, ya estaría resuelto.

---

### 4.2 — Escalación: cambio devuelto pero no arranca

**Criterios de aceptación:**
1. Si «Sí, pero no arranca» → escala directo (no es error de marcación).
2. El bot pide el nombre.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: nombre, lavandería, número, tipo.

**Conversación:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** ¿La central te ha devuelto el cambio?

**Usuario:** Sí, pero la máquina no arranca  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 5 — AL001

### 5.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → tipo → número.
2. El bot explica que es un error de secuencia y pide qué ha hecho antes.
3. Si el cliente confirma que ya funciona, cierra como resuelto.
4. Acepta variantes naturales del código (AL001 / AL 001 / ALM 001 / alarm 001 / alarma 001).

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** Sí, ya funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 5.2 — Escalación: cliente no puede seguir instrucciones

**Criterios de aceptación:**
1. Si el cliente dice que no entiende cómo hacerlo, el bot escala.
2. El bot pide el nombre antes de cerrar.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: lavandería, número, pantalla AL001.

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** No entiendo cómo hacerlo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** AL001  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### 5.3 — Escalación: AL001 persiste

**Criterios de aceptación:**
1. Si el cliente dice que el error persiste, el bot re-pregunta el código exacto.
2. Confirmado AL001 → escala.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: lavandería, número, pantalla AL001.

**Conversación:**

**Usuario:** Me sale AL001  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** L'Escala  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** Lo he hecho bien pero sigue saliendo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** AL001  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 6 — Doble cobro

### 6.1 — Servicio completado (Happy Path)

**Criterios de aceptación:**
1. Gather: lavandería → ¿has podido lavar/secar? → tipo → número → relato → 4 dígitos → captura → nombre.
2. Validación 4 dígitos: exactamente 4 cifras; si no, re-ask; tras 2° fallo escala.
3. Mensaje final NO menciona «operador» ni «desactivado» (trámite de devolución).
4. El final incluye URL del formulario de reembolso.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta  
**Bot:** ¡Hola! ¿En qué lavandería te encuentras?

**Usuario:** Goya  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** Sí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** 5  
**Bot:** De acuerdo. ¿Podrías explicarme paso a paso qué has hecho desde que has entrado? ¿Es posible que hayas pasado varias veces la tarjeta por el datáfono?

**Usuario:** He pagado, no iba y volví a pasar la tarjeta  
**Bot:** ¡Gracias! ¿Podrías indicarme los últimos 4 dígitos de la tarjeta?

**Usuario:** 4821  
**Bot:** ¡Perfecto! ¿Podrías enviarme una captura del pago? ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Aquí tienes el formulario de reembolso: https://forms.gle/XFGPAd9581AhC9eu7. Vamos a revisar tu situación.

---

### 6.2 — Escalación: cliente muy molesto

**Criterios de aceptación:**
1. Si el cliente está muy enfadado y exige operador → escala inmediatamente.
2. El bot pide el nombre antes de cerrar.
3. Mensaje final con «operador» + «desactivado».
4. NO sigue pidiendo relato, dígitos, captura.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### 6.3 — Escalación: relato inconsistente

**Criterios de aceptación:**
1. Si el relato es contradictorio o «no sé exactamente» → escala.
2. NO sigue pidiendo dígitos ni captura.
3. El bot pide el nombre antes de cerrar.
4. Mensaje final con «operador» + «desactivado».

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta  
**Bot:** ¡Hola! ¿En qué lavandería te encuentras?

**Usuario:** Goya  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** Sí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** 5  
**Bot:** De acuerdo. ¿Podrías explicarme paso a paso qué has hecho?

**Usuario:** No sé exactamente, creo que me han cobrado tres o cuatro veces, no me cuadra  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso.

---

### 6.4 — SIN haber usado el servicio

**Criterios de aceptación:**
1. Gather mínimo: lavandería → ¿has podido? → escala si «No».
2. NO pide tipo, número, relato, dígitos, captura.
3. El bot pide el nombre antes de cerrar.
4. Resumen al operador: indica explícitamente que NO ha podido usar el servicio.

**Conversación:**

**Usuario:** Me habéis cobrado dos veces con la tarjeta  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** no, no he podido  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso.

---

### 6.5 — Validación 4 dígitos tarjeta

**Criterios de aceptación:**
1. Acepta exactamente 4 dígitos consecutivos.
2. Si no, re-ask: «Necesito exactamente los 4 últimos dígitos de la tarjeta».
3. Tras 2° intento inválido → escala.
4. Si válido, continúa flujo 6.1 normalmente.

**Conversación A — recuperado al segundo intento:**

**Usuario:** 48215  
**Bot:** Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?

**Usuario:** 4821  
**Bot:** ¡Perfecto! ¿Podrías enviarme una captura del pago?

**Conversación B — escalada tras 2 intentos inválidos:**

**Usuario:** 482  
**Bot:** Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?

**Usuario:** no me acuerdo  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 7 — Pagado sin usar

### 7.1 — Resuelto vía pantalla PUSH PROG

**Criterios de aceptación:**
1. Gather: lavandería → tipo → número → pantalla.
2. Reconoce el código y da la indicación correspondiente.
3. Si confirma que funciona, cierra como resuelto.
4. No se escala.

**Conversación:**

**Usuario:** He pagado y no he podido usar la máquina  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado.

**Usuario:** Ahora sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### 7.2 — Escalación: máquina no responde tras paso indicado

**Criterios de aceptación:**
1. Tras la instrucción, si no arranca el bot pide el código exacto.
2. Si el cliente describe el bloqueo → escala.
3. Mensaje final con «operador» + «desactivado».
4. Resumen al operador: lavandería, número, código pantalla.

**Conversación:**

**Usuario:** He pagado y no he podido usar la máquina  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado.

**Usuario:** no arranca  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** se ha bloqueado  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 8 — Código de descuento

### 8.1 — Happy Path (formato válido)

**Criterios de aceptación:**
1. El bot pide SOLO el código (no lavandería ni tipo en el mismo turno).
2. Validación formato: `^[A-Z]{3}\d{6}\d+$` (3 letras + DDMMYY + importe).
3. Si formato válido, recoge: nombre → pueblo → número → puerta.
4. Escala siempre al operador para activación remota.

**Conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves, incluyendo letras si las hay?

**Usuario:** SAU2904266  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** ¿En qué pueblo / lavandería quieres usarlo?

**Usuario:** Goya  
**Bot:** ¿Qué número de máquina deseas usar?

**Usuario:** 5  
**Bot:** ¿La tienes cargada y con la puerta cerrada?

**Usuario:** Sí  
**Bot:** Dame un minuto, hacemos las comprobaciones. Si el código es correcto, te activaremos la máquina.

---

### 8.2 — Formato inválido (retry + escalate)

**Criterios de aceptación:**
1. Si formato no encaja, el bot pide reescribirlo (1° intento).
2. Tras 2° intento inválido → escala (no escala al primer intento).
3. El bot pide el nombre.
4. Mensaje final con «operador» + «desactivado».

**Conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves?

**Usuario:** AB12345  
**Bot:** Ese código no encaja con el formato que esperamos (3 letras + fecha + importe, p. ej. SAU2904266). ¿Podrías comprobarlo y escribírmelo de nuevo?

**Usuario:** XYZ123  
**Bot:** El código no encaja con el formato esperado, vamos a revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

## Caso 9 — Factura

### 9.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → tipo → razón social → dirección → CIF/NIF → fecha → email → notas → nombre.
2. Una pregunta por turno (NO listas combinadas).
3. Datos PII NO pasan por rephrase LLM ni operator-briefing LLM.
4. Mensaje final incluye disclaimer de privacidad.

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
**Bot:** ¿Qué día utilizaste el servicio? (puedes decirme «hoy», «ayer» o una fecha)

**Usuario:** Ayer  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana@example.com  
**Bot:** ¿Quieres añadir alguna nota u observación para la factura? Si no, escribe «no».

**Usuario:** no  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-07 a tu correo: ana@example.com.

🔒 Tus datos (razón social, CIF/NIF, dirección, correo) se usan únicamente para emitir la factura y no se comparten con terceros.

---

### 9.2 — Email inválido (retry)

**Criterios de aceptación:**
1. Email mal formado → reply contiene «no parece válido» y vuelve a pedirlo.
2. El bot NO avanza al siguiente paso hasta recibir un email válido.
3. Al segundo intento válido continúa al paso siguiente.
4. Cierre canónico con disclaimer de privacidad.

**Conversación:**

[gather hasta email]

**Usuario:** ana  
**Bot:** El correo no parece válido. ¿Puedes escribírmelo de nuevo, por favor?

**Usuario:** ana@example.com  
**Bot:** ¿Quieres añadir alguna nota u observación para la factura? Si no, escribe «no».

[continúa hasta cierre 9.1]

---

## Caso 10 — Comprar tarjeta fidelización

**Criterios de aceptación:**
1. Respuesta canónica: 20€ en efectivo + solo funciona en la tienda donde se compró.
2. Si el cliente da location, el bot añade instrucción específica del local.
3. NO se inventa instrucción para locales sin override.
4. No se piden tipo, número ni display (es una FAQ).

**Conversación:**

**Usuario:** ¿Cómo consigo la tarjeta de fidelización?  
**Bot:** La tarjeta de fidelización se compra con 20€ en efectivo y solo funciona en la tienda donde se ha comprado.

**Usuario:** Estoy en Goya  
**Bot:** Perfecto. En Goya, en la central de botones, debes pulsar el segundo botón de la línea de la derecha.

**Usuario:** Entendido  
**Bot:** Perfecto.

---

## Caso 11 — Recargar tarjeta fidelización

**Criterios de aceptación:**
1. Respuesta corta: introduce la tarjeta y sigue las instrucciones de la central.
2. NO pide location (operación estándar en todas las centrales).
3. Cierre proactivo: invita a reportar si aparece mensaje extraño.
4. Escala si el cliente reporta error o central no responde.

**Conversación:**

**Usuario:** ¿Cómo recargo la tarjeta?  
**Bot:** Introduce la tarjeta y sigue las instrucciones de la central.

**Usuario:** Vale  
**Bot:** Perfecto. Si al hacerlo aparece algún mensaje extraño, dímelo y lo revisamos.

---

## Caso 12 — Horarios y precios

**Criterios de aceptación:**
1. Horarios: respuesta por defecto 8:00-22:00.
2. Excepción L'Escala: 7:00-23:00.
3. Precios: respuesta de deflect, NO inventa importes.
4. Follow-up «¿y en L'Escala?» tras horario general → excepción.

**Conversación A — horario general:**

**Usuario:** ¿Cuál es el horario?  
**Bot:** El horario general de atención al público es de 8:00 a 22:00 cada día del año.

**Conversación B — excepción L'Escala:**

**Usuario:** ¿Y en L'Escala?  
**Bot:** En L'Escala, las máquinas se pueden utilizar de 7:00 a 23:00.

**Conversación C — precios:**

**Usuario:** ¿Cuánto cuesta esta máquina?  
**Bot:** Tengo que revisarlo antes de confirmarte ese importe.

---

## Caso 13 — Código de alarma o incoherencia

**Criterios de aceptación:**
1. Gather completo antes de escalar: location → tipo → número → display.
2. Reply de escalación contiene «revisión manual» + petición del nombre.
3. NO confronta al cliente.
4. Caso «paraguas» para alarmas genéricas no cubiertas por 14-18.

**Conversación:**

**Usuario:** He pagado y ahora sale ALN  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿Dónde está la lavandería?

**Usuario:** Goya  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 5  
**Bot:** El código ALN requiere revisión manual. Pasaremos tu caso a revisión. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

## Caso 14 — ALM DOOR

**Criterios de aceptación:**
1. El bot intenta UNA vez la guía «abrir + revisar prendas + cerrar bien».
2. Si el cliente confirma que el mensaje desaparece → resolved.
3. Si NO desaparece → escala con resumen que incluye «ALM DOOR» (no «DOOR» genérico).
4. Acepta ALM DOOR / ALM/DOOR / ALMDOOR.

**Conversación:**

**Usuario:** La lavadora no funciona y pone ALM DOOR  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** ¿Qué número de lavadora es?

**Usuario:** La 6  
**Bot:** Ese mensaje puede indicar un problema de cierre o que hay alguna pieza atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien.

**Usuario:** Ya lo he hecho  
**Bot:** Perfecto. Dime si el mensaje ha desaparecido.

**Usuario:** No  
**Bot:** Vamos a pasar tu caso a revisión.

---

## Caso 15 — 001

**Criterios de aceptación:**
1. Reconocimiento de «001» puro (sin AL/ALM) → token canónico C001.
2. Explicación educativa antes de escalar.
3. Solo necesita location antes de escalar (NO display de nuevo, NO número obligatorio).
4. Diferencia con Caso 5 AL001: este NO admite recovery — siempre escala.

**Conversación:**

**Usuario:** En la pantalla sale 001  
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** Pineda  
**Bot:** Ese mensaje puede aparecer cuando el programa se ha seleccionado antes del pago.

**Usuario:** ¿Qué hago?  
**Bot:** Vamos a revisarlo manualmente para ayudarte de la mejor manera posible.

---

## Caso 16 — ALM / ALN

**Criterios de aceptación:**
1. Reconocimiento robusto: ALN, ALN A, ALN N, ALM/A, ALM/E, ALM/VAr.
2. Tras location + tipo + número → escala inmediata.
3. NO pide abrir/cerrar nada (diferencia con Caso 14 ALM DOOR).
4. Resumen al operador incluye el código exacto, location, tipo y número.

**Conversación:**

**Usuario:** La secadora pone ALN  
**Bot:** Tranquilo, te ayudo. ¿Dónde está la lavandería?

**Usuario:** Alemanya  
**Bot:** Gracias. ¿Qué número de secadora es?

**Usuario:** La 4  
**Bot:** El código ALN requiere revisión manual. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

## Caso 17 — No sabe qué aparece en pantalla

**Criterios de aceptación:**
1. Gather mínimo: location + tipo de máquina.
2. Tras gather → escalación inmediata.
3. NO se pide foto (feature no soportada hoy).
4. Resumen al operador indica falta de información de pantalla.

**Conversación:**

**Usuario:** La máquina no va, pero no sé qué pone  
**Bot:** Tranquilo, lo revisamos juntos. ¿En qué lavandería estás?

**Usuario:** Hortes  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** Vamos a revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Pasamos tu caso a revisión. Un operador se pondrá en contacto contigo.

---

## Caso 18 — Código solo numérico

**Criterios de aceptación:**
1. Trigger: input que matche `^\d{3,}$` (3+ dígitos puros sin letras).
2. Step 1: el bot pregunta «¿ves alguna letra delante?».
3. «Sí» → reset al flujo Caso 8 (pide código completo).
4. «No» → escalación, resumen indica «código solo numérico».

**Conversación:**

**Usuario:** Tengo un código: 23432023  
**Bot:** Gracias. ¿Ves alguna letra delante de los números?

**Usuario:** No  
**Bot:** De acuerdo. Hay una información que necesitamos revisar manualmente.

**Usuario:** ¿Por qué?  
**Bot:** Vamos a pasarlo a revisión para ayudarte correctamente.

---

## Caso 19 — Datáfono 10€ en Goya

**Criterios de aceptación:**
1. Trigger: mención datáfono + cifra atípica + location Goya.
2. NO se piden tipo ni número de máquina.
3. El bot pregunta solo «¿has podido usar el servicio?» antes de escalar.
4. Resumen al operador: Goya + datáfono + importe incoherente.

**Conversación:**

**Usuario:** Estoy en Goya y el datáfono me ha cobrado 10€  
**Bot:** Gracias por indicarlo. Vamos a revisarlo. ¿Has podido usar el servicio?

**Usuario:** No  
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos revisarla manualmente.

**Usuario:** Vale  
**Bot:** Pasaremos tu caso a revisión.

---

## Caso 20 — Datáfono 10€ en Pineda

**Criterios de aceptación:**
1. Mismo flujo del Caso 19 con location Pineda.
2. En otras locations (no Goya/Pineda) → mismatch: «no tenemos registrado en <local>».
3. NO pide tipo ni número.
4. Resumen al operador: Pineda + datáfono + importe incoherente.

**Conversación:**

**Usuario:** En Pineda me ha cobrado 10€  
**Bot:** Gracias. Vamos a revisarlo. ¿Has podido lavar o secar la ropa?

**Usuario:** No  
**Bot:** De acuerdo. Hay una información que no coincide.

**Usuario:** Vale  
**Bot:** Lo pasaremos a revisión.

---

## Caso 21 — Alemanya: monedas secadora no suman

**Criterios de aceptación:**
1. Trigger: minutos no añadidos + secadora + location Alemanya.
2. NO entra al gather de display.
3. El bot confirma location antes de escalar.
4. Resumen al operador: Alemanya + secadora + monedas no sumadas.

**Conversación:**

**Usuario:** He puesto más dinero en la secadora y no suma minutos  
**Bot:** Gracias. ¿Estás en la lavandería Alemanya?

**Usuario:** Sí  
**Bot:** De acuerdo. Esa incidencia necesita revisión.

**Usuario:** ¿No se puede arreglar ahora?  
**Bot:** Vamos a pasarlo a revisión.

---

## Caso 22 — Pineda: monedas secadora no suman

**Criterios de aceptación:**
1. Mismo flujo del Caso 21 con location Pineda.
2. En otras locations → mismatch.
3. NO pide tipo ni número.
4. Resumen al operador: Pineda + secadora + monedas no sumadas.

**Conversación:**

**Usuario:** He añadido tiempo a la secadora y no lo ha sumado  
**Bot:** Gracias. ¿Estás en Pineda?

**Usuario:** Sí  
**Bot:** De acuerdo. Vamos a revisarlo manualmente.

**Usuario:** Vale  
**Bot:** Gracias. Pasaremos tu caso a revisión.

---

## Caso 23 — Alemanya: no se puede pagar con tarjeta

**Criterios de aceptación:**
1. Trigger: no pago tarjeta + location Alemanya.
2. Mensaje de escalación menciona «soporte técnico».
3. En otras locations (no Alemanya/Hortes) → mismatch.
4. Resumen al operador: Alemanya + tarjeta + no se puede pagar.

**Conversación:**

**Usuario:** No puedo pagar con tarjeta  
**Bot:** Te ayudo. ¿En qué lavandería estás?

**Usuario:** Alemanya  
**Bot:** Gracias. Vamos a revisarlo manualmente porque esa incidencia puede requerir soporte técnico.

**Usuario:** Vale  
**Bot:** Pasaremos tu caso a revisión.

---

## Caso 24 — Hortes: no se puede pagar con tarjeta

**Criterios de aceptación:**
1. Mismo flujo del Caso 23 con location Hortes.
2. Confirmación de location proactiva.
3. NO pide tipo ni número.
4. Resumen al operador: Hortes + tarjeta + no se puede pagar.

**Conversación:**

**Usuario:** La tarjeta no funciona para pagar  
**Bot:** Gracias. ¿Estás en Hortes?

**Usuario:** Sí  
**Bot:** De acuerdo. Vamos a revisar la incidencia manualmente.

**Usuario:** Vale  
**Bot:** Pasaremos tu caso a revisión.

---

## Caso 25 — Cliente muy enfadado

**Criterios de aceptación:**
1. T1: el bot abre con empatía explícita ANTES de cualquier pregunta.
2. NUNCA se justifica, contradice ni minimiza.
3. Si sigue alterado → escala con «atención prioritaria».
4. Si colabora, sigue el flujo normal del problema reportado.

**Conversación:**

**Usuario:** ¡Esto siempre falla! ¡Quiero una solución ya!  
**Bot:** Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

---

## Caso 26 — Devolución inmediata

**Criterios de aceptación:**
1. NO promete devolución (la decisión es del operador).
2. Recoge datos mínimos: 4 dígitos, captura, resumen.
3. Reply menciona «revisión» + «devolución» pero NO «te lo devolvemos».
4. Resumen al operador: nombre + «devolución» + datos.

**Conversación:**

**Usuario:** Quiero que me devolváis el dinero ahora mismo  
**Bot:** Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta, una captura del pago y un breve resumen.

**Usuario:** Quiero la devolución ya  
**Bot:** Entiendo. Vamos a pasar el caso a revisión.

---

## Caso 27 — Compensación concreta

**Criterios de aceptación:**
1. NO confirma activaciones gratuitas ni códigos nuevos.
2. Si el cliente insiste, mantiene la línea «no puedo confirmarlo desde aquí».
3. Resumen al operador: nombre + «compensación» + descripción.
4. Diferencia con Caso 26: pide algo CONCRETO (lavadora gratis), no devolución.

**Conversación:**

**Usuario:** Quiero una secadora gratis por las molestias  
**Bot:** Vamos a revisar tu caso para ayudarte con la solución más adecuada.

**Usuario:** Pero quiero que me lo confirmes ya  
**Bot:** No puedo confirmarlo directamente desde aquí. Vamos a pasarlo a revisión.

---

## Caso 28 — Relato contradictorio doble cobro

**Criterios de aceptación:**
1. Trigger: «cobró dos veces» + «aunque/creo/no sé».
2. NO intenta clarificar el relato (lo hace el operador).
3. Reply menciona «revisar» sin acusar al cliente.
4. Resumen al operador: nombre + «relato contradictorio».

**Conversación:**

**Usuario:** Me cobró dos veces, aunque creo que también pagué en efectivo  
**Bot:** Gracias. Vamos a revisarlo contigo. ¿Has podido finalmente usar el servicio?

**Usuario:** No lo sé bien  
**Bot:** Para comprobarlo bien, vamos a revisar el caso manualmente.

**Usuario:** Vale  
**Bot:** Gracias. Pasaremos tu caso a revisión.

---

## Caso 29 — Cámaras o revisión técnica

**Criterios de aceptación:**
1. Trigger: cámaras / AJAX / soporte técnico.
2. NO dice «vamos a mirarlo» como si pudiera ver las cámaras.
3. Escalación inmediata, pide directamente el nombre.
4. Resumen al operador: nombre + «cámaras» o «AJAX».

**Conversación:**

**Usuario:** Mirad las cámaras porque yo he pagado  
**Bot:** Gracias por indicarlo. Vamos a revisar tu caso manualmente.

**Usuario:** Vale  
**Bot:** Lo pasaremos a revisión.

---

## Caso 30 — Código no documentado

**Criterios de aceptación:**
1. Acepta variantes con typos pequeños (USH PROG → PUSH PROG, DOR → DOOR).
2. Si no reconoce, pide comprobar nuevamente.
3. Tras 2° intento sin reconocer → escala.
4. Si código real no documentado (ERR 52) → resumen incluye el código exacto literal.

**Conversación A — typo recuperado:**

**Usuario:** asdf  
**Bot:** No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?

**Usuario:** PUSH PROG  
**Bot:** Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado.

**Conversación B — código no documentado:**

**Usuario:** En la pantalla sale ERR 52  
**Bot:** Ese código no coincide con un caso documentado y necesitamos revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Caso 31 — Cliente no indica local

**Criterios de aceptación:**
1. NO procede al gather de tipo/número/display sin location.
2. Si dice «no lo sé» → re-ask con énfasis.
3. Si nombre desconocido (ej. «Girona») → lista las lavanderías reales.
4. Tras 2-3 intentos sin location → escala.

**Conversación:**

**Usuario:** La secadora no funciona  
**Bot:** Hola. Te ayudo. ¿En qué lavandería estás?

**Usuario:** No lo sé  
**Bot:** Para poder ayudarte, necesito saber primero en qué lavandería estás exactamente.

**Usuario:** Estoy en Goya  
**Bot:** Perfecto. ¿Qué número de secadora es?

---

## Caso 32 — Mezcla incidencia máquina y pago

**Criterios de aceptación:**
1. T1 pregunta location; NO entra al gather de pago.
2. Canonical order: tipo → número → pantalla, una pregunta por turno.
3. Si el cliente adelanta facts, el guard pregunta solo lo que falta.
4. Si se aclara como Caso 4/7, reenruta sin reset de facts.

**Conversación:**

**Usuario:** He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro  
**Bot:** Hola. Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Pineda  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora 3  
**Bot:** ¿Qué aparece en la pantalla?

---

### 32.1 — Marathon: display switching

**Criterios de aceptación:**
1. El bot NO re-pregunta location ni número tras primer gather.
2. Cada nuevo display reescribe state y re-resuelve el flow engine.
3. AL001 escala automáticamente.
4. Resumen al operador lista TODOS los displays vistos en orden cronológico.

**Conversación:**

**Usuario:** ¡Hola! ¿Cómo va?  
**Bot:** ¡Hola! Soy el asistente virtual de Ecolaundry. ¿En qué puedo ayudarte?

**Usuario:** ¿Qué horarios hacéis?  
**Bot:** El horario general es de 8:00 a 22:00 cada día del año.

**Usuario:** Tengo un problema con la lavadora  
**Bot:** Lamento la incidencia. ¿En qué lavandería te encuentras?

**Usuario:** Pineda  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SEL  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número en la central de pago.

**Usuario:** No, ahora aparece PUSH PROG  
**Bot:** Pulsa ahora el programa que quieras y dime si la lavadora ha arrancado.

**Usuario:** No, ahora pone DOOR  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.

**Usuario:** No, ahora aparece AL001  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo.

**Usuario:** sigo con el mismo error  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Marc  
**Bot:** Gracias Marc. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### 32.2 — Marathon: trouble resuelto → factura

**Criterios de aceptación:**
1. Primer flow se cierra con resolved.
2. Segundo flow (factura) NO re-pregunta location ni tipo (sticky cross-flow).
3. customerNameRequested NO está activo entre los dos flows.
4. NO hay escalación entre los dos flows.

**Conversación:**

[T1-T5: trouble PUSH PROG resuelto]

**Usuario:** Sí, ya funciona  
**Bot:** ✅ Perfecto, incidencia resuelta.

**Usuario:** ¿Podría tener la factura del lavado?  
**Bot:** Perfecto. ¿Me indicas la razón social?

[continúa flujo Caso 9 desde razón social — salta location y tipo]

---

### 32.3 — Marathon: FAQ pause mid-gather

**Criterios de aceptación:**
1. FAQ aislada no destruye pendingFlow activo (pausa solo).
2. El bot responde la FAQ y vuelve al gather.
3. NO re-pregunta location ya capturada.
4. El cliente puede hacer múltiples FAQ y retomar el gather siempre.

**Conversación:**

**Usuario:** Tengo un problema con la lavadora  
**Bot:** ¿En qué lavandería te encuentras?

**Usuario:** Goya  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** Espera, antes una pregunta: ¿cuánto cuesta lavar?  
**Bot:** Tengo que revisarlo antes de confirmarte ese importe. ¿Quieres que sigamos con el problema?

**Usuario:** Sí, la lavadora 3  
**Bot:** ¿Qué aparece en la pantalla?
