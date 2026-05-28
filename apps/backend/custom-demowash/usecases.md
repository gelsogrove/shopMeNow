# Demowash Chatbot — Usecases

## Casos demo destacados

Primera frase típica del cliente. Cada item enlaza al caso documentado abajo (cuando existe). Multilingüe (es / it / en / ca / pt / fr): el chatbot detecta automáticamente el idioma del cliente.

- [La lavadora no funciona](#select)
- [Me sale error OPEN](#open)
- [He pagado pero la lavadora no empieza](#wait)
- [He pagado y no se ha activado](#he-pagado-y-no-se-ha-activado)
- [Me sale ERR-12](#err-12)
- [He pagado y ahora sale BLOCK](#código-de-alarma-o-incoherencia)
- [La máquina no va, pero no sé qué pone](#no-sabe-qué-aparece-en-pantalla)
- [Non funziona la lavatrice](#cliente-no-indica-local)
- [The washing machine won't start](#select)
- [Me habéis cobrado dos veces con la tarjeta](#doble-cobro)
- [La lavadora no funciona y pone ALERT OPEN](#alert-open)
- [He pagado y no he podido usar la máquina](#pagado-sin-usar)
- [Estoy en Mataró y el datáfono me ha cobrado 10€](#datáfono-10-en-mataró)
- [He puesto más dinero en la secadora y no suma minutos](#eixample-monedas-secadora-no-suman)
- [No puedo pagar con tarjeta](#eixample-no-se-puede-pagar-con-tarjeta)
- [Tengo un código y no sé cómo usarlo](#código-de-descuento)
- [Quiero una factura](#factura)
- [Vorrei la fattura](#factura)
- [¿Cómo consigo la tarjeta de fidelización?](#comprar-tarjeta-fidelización)
- [Sono a Mataró, posso usare una tessera di fidelizzazione comprata in un'altra lavanderia?](#mataró-pregunta-loyalty-card-en-t1--sub-localización-en-t2-f100)
- [¿Cómo recargo la tarjeta?](#recargar-tarjeta-fidelización)
- [¿Cuáles son los horarios?](#horarios-y-precios)
- [Quins horaris feu?](#horarios-y-precios)
- [¿Cuánto cuesta lavar?](#horarios-y-precios)
- [¿Qué programas tiene la lavadora?](#horarios-y-precios)
- [Quanto costa?](#horarios-y-precios)
- [Che programmi avete?](#horarios-y-precios)
- [A che temperatura lavo i colorati?](#faq-temperatura-colores-sant-cugat-colortemperature-trasversal)
- [¡Esto siempre falla! ¡Quiero una solución ya!](#cliente-muy-enfadado)
- [Quiero hablar con un operador ahora mismo](#cliente-muy-enfadado)
- [Quiero que me devolváis el dinero ahora mismo](#devolución-inmediata)
- [Mirad las cámaras porque yo he pagado](#cámaras-o-revisión-técnica)
- [He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro](#mezcla-incidencia-máquina-y-pago)
- [Non c'è sapone nella lavatrice?](#el-cliente-pregunta-por-el-jabón-detergente-o-suavizante)
- [Come si usa?](#el-cliente-pregunta-cómo-se-usa-la-lavandería)
- [Non centrifuga](#la-lavadora-no-centrifuga)
- [Ho una camicia bianca macchiata, a quanti gradi la posso lavare per non rovinarla?](#faq-camisa-blanca-manchada-temperatura)

---

## SELECT

### Happy Path

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Demowash. ¿En qué lavandería estás?

**Usuario:** Mataró  
**Bot:** Gracias. ¿Qué número tiene la máquina?

**Usuario:** La 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SELECT  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** Sí, ahora funciona  
**Bot:** ✅ Perfecto, incidencia resuelta.

---

### Escalación: máquina no responde tras pulsar

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Demowash. ¿En qué lavandería estás?

**Usuario:** Mataró  
**Bot:** Gracias. ¿Qué número tiene la máquina?

**Usuario:** La 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SELECT  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** He pulsado pero no responde  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora, incluso si es el mismo que antes.

**Usuario:** SELECT  
**Bot:** ⚠️ Si nada ha funcionado, vamos a notificar al operador. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## OPEN

### Happy Path

**Usuario:** La lavadora no arranca  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás?

**Usuario:** Sant Cugat  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** 2  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** OPEN  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez. Dime si la lavadora ha arrancado.

**Usuario:** Sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Escalación: puerta bloqueada tras repetir

**Usuario:** La lavadora no arranca  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás?

**Usuario:** Sant Cugat  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** 2  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** OPEN  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez. Dime si la lavadora ha arrancado.

**Usuario:** NO  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** OPEN  
**Bot:** ⚠️ La puerta sigue bloqueada. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### Recap display flow: Phase A / Phase B / cadence N (F74 + F75)

**Usuario:** La lavadora no funciona  
**Bot:** ¿En qué lavandería estás?

**Usuario:** Mataró  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** OPEN  
**Bot:** **No te preocupes, tiene solución** 😊  
Estás en **Mataró** con la **lavadora 5** y el error **OPEN**.  
La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.  
Cuéntame si arranca 😊

**Usuario:** no funciona  
**Bot:** Por favor, escríbeme solo el código exacto que aparece en la pantalla en este momento.

**Usuario:** no funciona  
**Bot:** Por favor, escríbeme solo el código exacto que aparece en la pantalla en este momento.

**Usuario:** no funciona  
**Bot:** Estás en **Mataró** con la **lavadora 5** y el error **OPEN**.  
Seguimos intentándolo 💪  
Por favor, escríbeme solo el código exacto que aparece en la pantalla en este momento.

---

## WAIT

### Happy Path

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** WAIT  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número de la máquina en la central de pago. Después dime si la lavadora ha arrancado.

**Usuario:** Ahora sí funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Escalación: WAIT persiste

**Usuario:** He pagado pero la lavadora no empieza  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** WAIT  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número de la máquina en la central de pago.

**Usuario:** Aun no arranca  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** WAIT  
**Bot:** ⚠️ La pantalla sigue mostrando WAIT. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso.

---

## He pagado y no se ha activado

### No-change Happy Path

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Demowash. ¿En qué local estás?

**Usuario:** Mataró  
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

### Escalación: cambio devuelto pero no arranca

**Conversación A — bare «Sí»:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Demowash. ¿En qué local estás?

**Usuario:** Mataró  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número de máquina es?

**Usuario:** La 4  
**Bot:** ¿La central te ha devuelto el cambio?

**Usuario:** Sí  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

**Conversación B — «Sí, pero no arranca» (variante explícita):**

**Usuario:** Sí, pero la máquina no arranca  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## ERR-12

### Happy Path

**Usuario:** Me sale ERR-12  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Gràcia  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** Sí, ya funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Escalación: cliente no puede seguir instrucciones

**Usuario:** Me sale ERR-12  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Gràcia  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** No entiendo cómo hacerlo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** ERR-12  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### Escalación: ERR-12 persiste

**Usuario:** Me sale ERR-12  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Gràcia  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** Lo he hecho bien pero sigue saliendo  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** ERR-12  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### Pivot ERR-12 → Caso 4 (cliente confirma pagamento)

**Usuario:** ERR-12  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué pueblo está la lavandería?

**Usuario:** Rubí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 3  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo: dime qué has hecho justo antes de que apareciera.

**Usuario:** He pagado y apretado el número de la lavadora  
**Bot:** ¿La central te ha devuelto el cambio?

**Usuario:** Sí  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias, Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Doble cobro

### Servicio completado (Happy Path)

**Usuario:** Me habéis cobrado dos veces con la tarjeta  
**Bot:** ¡Hola! ¿En qué lavandería te encuentras?

**Usuario:** Mataró  
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
**Bot:** Gracias Carlos. Aquí tienes el formulario de reembolso: https://demowash.demo/refund. Vamos a revisar tu situación.

---

### Escalación: cliente muy molesto

**Usuario:** Me habéis cobrado dos veces, estoy muy enfadado y quiero hablar con un operador ahora mismo  
**Bot:** ⚠️ Necesitamos derivar tu caso a un operador. ¿Cómo te llamas?

**Usuario:** María  
**Bot:** Gracias María. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### Escalación: relato inconsistente

**Usuario:** Me habéis cobrado dos veces con la tarjeta  
**Bot:** ¡Hola! ¿En qué lavandería te encuentras?

**Usuario:** Mataró  
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

### SIN haber usado el servicio

**Usuario:** Me habéis cobrado dos veces con la tarjeta  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué lavandería estás?

**Usuario:** Mataró  
**Bot:** ¿Has podido lavar o secar la ropa?

**Usuario:** no, no he podido  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Carlos  
**Bot:** Gracias Carlos. Un operador humano se encargará de tu caso.

---

### Validación 4 dígitos tarjeta

**Usuario:** 48215  
**Bot:** Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?

**Usuario:** 4821  
**Bot:** ¡Perfecto! ¿Podrías enviarme una captura del pago?

**Usuario:** 482  
**Bot:** Necesito exactamente los 4 últimos dígitos de la tarjeta. ¿Podrías escribírmelos de nuevo?

**Usuario:** no me acuerdo  
**Bot:** Vamos a revisar tu caso manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Pagado sin usar

### Resuelto vía pantalla SELECT

**Usuario:** He pagado y no he podido usar la máquina  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SELECT  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** Ahora sí  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

### Escalación: máquina no responde tras paso indicado

**Usuario:** He pagado y no he podido usar la máquina  
**Bot:** ¡Hola! ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Cuál es el número de la máquina?

**Usuario:** 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** SELECT  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** no arranca  
**Bot:** Por favor, escribe solo el código exacto que aparece en la pantalla ahora.

**Usuario:** se ha bloqueado  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador para que revise el caso y la posible compensación. ¿Cómo te llamas?

**Usuario:** Luis  
**Bot:** Gracias Luis. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Código de descuento

### Happy Path (formato válido)

**Usuario:** Tengo un código y no sé cómo usarlo  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves?

**Usuario:** SAU2904266  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** ¿En qué pueblo / lavandería quieres usarlo?

**Usuario:** Mataró  
**Bot:** ¿Qué número de máquina deseas usar?

**Usuario:** 5  
**Bot:** ¿La tienes cargada y con la puerta cerrada?

**Usuario:** Sí  
**Bot:** Dame un minuto, hacemos las comprobaciones. Si el código es correcto, te activaremos la máquina.

---

### Formato inválido (retry + escalate)

**Usuario:** Tengo un código y no sé cómo usarlo  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves?

**Usuario:** AB12345  
**Bot:** Ese código no encaja con el formato que esperamos. ¿Podrías comprobarlo y escribírmelo de nuevo?

**Usuario:** XYZ123  
**Bot:** El código no encaja con el formato esperado, vamos a revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

### Cliente repite un código en el campo nombre (rechazo + re-ask)

**Usuario:** Tengo un código  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves?

**Usuario:** SAU2904266  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** SAU2904266  
**Bot:** ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** ¿En qué pueblo / lavandería quieres usarlo?

**Usuario:** Tengo un código  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto?

**Usuario:** SAU2904266  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** SAU2904266  
**Bot:** ¿Cómo te llamas?

**Usuario:** sau2904266  
**Bot:** ¿Cómo te llamas?

**Usuario:** SAU2904266  
**Bot:** Vamos a revisar tu caso manualmente.

---

## Factura

### Happy Path

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. ¿En qué lavandería estuviste?

**Usuario:** Mataró  
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
**Bot:** ¿Cuál fue el coste total del servicio?

**Usuario:** 6€  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana@example.com  
**Bot:** ¿Quieres añadir alguna nota u observación para la factura? Si no, escribe «no».

**Usuario:** no  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-07 a tu correo: ana@example.com.

🔒 Tus datos (razón social, CIF/NIF, dirección, correo) se usan únicamente para emitir la factura y no se comparten con terceros.

---

### Email inválido (retry)

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. ¿En qué lavandería estuviste?

**Usuario:** Mataró  
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
**Bot:** ¿Cuál fue el coste total del servicio?

**Usuario:** 6€  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** ana  
**Bot:** El correo no parece válido. ¿Puedes escribírmelo de nuevo, por favor?

**Usuario:** ana@example.com  
**Bot:** ¿Quieres añadir alguna nota u observación para la factura? Si no, escribe «no».

**Usuario:** no  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura del 2026-05-27 a tu correo: ana@example.com.

🔒 Tus datos (razón social, CIF/NIF, dirección, correo) se usan únicamente para emitir la factura y no se comparten con terceros.

---

## Comprar tarjeta fidelización

**Usuario:** ¿Cómo consigo la tarjeta de fidelización?  
**Bot:** La tarjeta de fidelización se compra con 20€ en efectivo y solo funciona en la tienda donde se ha comprado.

**Usuario:** Estoy en Mataró  
**Bot:** Perfecto. En Mataró, en la central de botones, debes pulsar el segundo botón de la línea de la derecha.

**Usuario:** Entendido  
**Bot:** Perfecto.

---

### Tarjeta comprada en otro local (cross-location warning)

**Bot:** ¿En qué lavandería estás?  
**Usuario (en Mataró):** Tengo la tarjeta de Rubí, ¿la puedo usar aquí?  
**Bot:** ⚠️ La tarjeta comprada en Rubí solo funciona en ese local. No es válida aquí en Mataró. Si necesitas una tarjeta para esta lavandería, puedes comprarla aquí con 20€ en efectivo.

**Bot:** In quale lavanderia sei?  
**Usuario (a Mataró):** Ho comprato la tessera a Rubí, funziona anche qui?  
**Bot:** ⚠️ La tessera acquistata a Rubí funziona solo in quella sede. Non è valida qui a Mataró. Se hai bisogno di una tessera per questa lavanderia, puoi acquistarla qui con 20€ in contanti.

**Bot:** Which laundry are you at?  
**Usuario (at Mataró):** I bought my loyalty card at Sant Cugat, will it work here?  
**Bot:** ⚠️ The card bought at Sant Cugat only works at that location. It's not valid here at Mataró. If you need a card for this laundry, you can buy one here for €20 in cash.

**Bot:** A quina bugaderia ets?  
**Usuario (a Eixample):** Vaig comprar la targeta a Rubí, funciona aquí?  
**Bot:** ⚠️ La targeta comprada a Rubí només funciona en aquell local. No és vàlida aquí a Eixample. Si necessites una targeta per a aquesta bugaderia, pots comprar-la aquí amb 20€ en efectiu.

### Mataró: pregunta loyalty card en T1 + sub-localización en T2 (F100)

**Usuario:** ciao sono a Mataró posso usare una tessera di fidelizzazione comprata in un altra lavanderia?  
**Bot:** En Mataró tenemos dos lavanderías: C/ Francisco de Mataró 117 y C/ Eixample 17. ¿Podrías indicarme en cuál estás?  
**Usuario:** Mataró  
**Bot:** En Mataró, la tarjeta de fidelidad se compra con 20€ en efectivo y se activa pulsando el segundo botón de la fila derecha de la central. Solo funciona en este local.

**Usuario:** Estoy en Mataró y quiero comprar la tarjeta de fidelización  
**Bot:** En Mataró tenemos dos lavanderías: C/ Francisco de Mataró 117 y C/ Eixample 17. ¿Podrías indicarme en cuál estás?  
**Usuario:** Eixample  
**Bot:** En Eixample, la tarjeta de fidelidad se compra con 20€ en efectivo en la caja. Solo funciona en este local.

---

## Recargar tarjeta fidelización

**Usuario:** ¿Cómo recargo la tarjeta?  
**Bot:** Introduce la tarjeta y sigue las instrucciones de la central.

**Usuario:** Vale  
**Bot:** Perfecto. Si al hacerlo aparece algún mensaje extraño, dímelo y lo revisamos.

**Usuario:** Como puedo recargar la targeta de fidelización  
**Bot:** Introduce la tarjeta y sigue las instrucciones de la central.

---

## Horarios y precios

### Horarios por location

**Usuario:** ¿Cuáles son los horarios?  
**Bot:** ¿En qué lavandería o pueblo estás?

**Usuario:** Terrassa  
**Bot:** En Terrassa, el horario es de 8:00 a 22:00, todos los días del año.

**Usuario:** Y en Gràcia  
**Bot:** En Gràcia, las máquinas se pueden utilizar de 7:00 a 23:00, todos los días.

---

### Precios de lavadora por location y peso

**Usuario:** ¿Cuánto cuesta la lavadora?  
**Bot:** ¿En qué lavandería estás?

**Usuario:** Terrassa  
**Bot:** En Terrassa, los precios de lavadora son:

- **L1** 20kg: 10€ (fidelidad) / 10€ (efectivo)
- **L2** 15kg: 8€ / 8€
- **L3** 15kg: 8€ / 8€
- **L4** 13kg: 5€ / 5€

¿También quieres información de secadora?

**Usuario:** Sí  
**Bot:** En Terrassa, los precios de secadora son:

- **S5** 20min: 3€
- **S6** 20min: 3€

**Ejemplo F87 — Mataró con TPV importe exacto:**

**Usuario:** ¿cuánto cuesta lavar?  
**Bot:** ¿En qué pueblo o lavandería estás?

**Usuario:** Mataró  
**Bot:** En Mataró, los precios de lavadora son:

- **Lavadoras** 20kg: 6,5€ (fidelidad) / 7€ (efectivo)
- **Lavadoras** 10kg: 3,5€ (fidelidad) / 4€ (efectivo)

💡 El TPV cobra el importe exacto de **7€** (no devuelve cambio).

¿También quieres información de secadora?

**Ejemplo F87 — Gràcia con solo tarjeta de crédito:**

**Usuario:** ¿cuánto cuesta lavar?  
**Bot:** ¿En qué pueblo o lavandería estás?

**Usuario:** Gràcia  
**Bot:** En Gràcia, los precios de lavadora son:

- **Lavadoras** 10kg: 6€
- **Lavadoras** 20kg: 9€

⚠️ En esta lavandería solo se acepta tarjeta de crédito.

¿También quieres información de secadora?

---

### Programas de lavadora y secadora por location (F81)

**Ejemplo — T1 sin location:**

**Usuario:** ¿qué programas tiene la lavadora?  
**Bot:** ¿En qué pueblo o lavandería estás?  
**Usuario:** Mataró  
**Bot:** Los programas disponibles para la lavadora son:

- **1** — Muy caliente (60º)
- **2** — Caliente (40º)
- **3** — Templado (30º)
- **4** — Frío (*)

Los programas disponibles para la secadora son:

- **Alta temperatura**
- **Media temperatura**
- **Baja temperatura**

**Ejemplo — T1 con location ya conocida:**

**Usuario:** cuáles son los programas aquí?  
**Bot:** Los programas disponibles para la lavadora son:

- **1** — Muy caliente (60º)
- **2** — Caliente (40º)
- **3** — Templado (30º)
- **4** — Frío (*)

Los programas disponibles para la secadora son:

- **Alta temperatura**
- **Media temperatura**
- **Baja temperatura**

**Ejemplo — Gràcia (orden diferente, 5 programas):**

- **1** — Frío (*)
- **2** — Templado (30º)
- **3** — Caliente (40º)
- **4** — Muy caliente (60º)
- **5** — Centrifugado

---

## Código de alarma o incoherencia

**Usuario:** He pagado y ahora sale BLOCK  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿Dónde está la lavandería?

**Usuario:** Mataró  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** La 5  
**Bot:** El código BLOCK requiere revisión manual. Pasaremos tu caso a revisión. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

## ALERT OPEN

**Usuario:** La lavadora no funciona y pone ALERT OPEN  
**Bot:** Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Mataró  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** La 6  
**Bot:** Ese mensaje puede indicar un problema de cierre o que hay alguna pieza atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien.

**Usuario:** Ya lo he hecho  
**Bot:** Perfecto. Dime si el mensaje ha desaparecido.

**Usuario:** No  
**Bot:** Vamos a pasar tu caso a revisión.

---

## ERR-01

**Usuario:** En la pantalla sale ERR-01  
**Bot:** Gracias. ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** Ese mensaje puede aparecer cuando el programa se ha seleccionado antes del pago.

**Usuario:** ¿Qué hago?  
**Bot:** Vamos a revisarlo manualmente para ayudarte de la mejor manera posible.

---

## ALERT / BLOCK

**Usuario:** La secadora pone BLOCK  
**Bot:** Tranquilo, te ayudo. ¿Dónde está la lavandería?

**Usuario:** Eixample  
**Bot:** Gracias. ¿Qué número tiene la máquina?

**Usuario:** La 4  
**Bot:** El código BLOCK requiere revisión manual. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

## No sabe qué aparece en pantalla

**Usuario:** La máquina no va, pero no sé qué pone  
**Bot:** Tranquilo, lo revisamos juntos. ¿En qué lavandería estás?

**Usuario:** Sant Cugat  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** Vamos a revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Pasamos tu caso a revisión. Un operador se pondrá en contacto contigo.

---

## Código solo numérico

**Usuario:** Tengo un código: 23432023  
**Bot:** Gracias. ¿Ves alguna letra delante de los números?

**Usuario:** No  
**Bot:** De acuerdo. Hay una información que necesitamos revisar manualmente.

**Usuario:** ¿Por qué?  
**Bot:** Vamos a pasarlo a revisión para ayudarte correctamente.

---

## Datáfono 10€ en Mataró

**Usuario:** Estoy en Mataró y el datáfono me ha cobrado 10€  
**Bot:** Gracias por indicarlo. Vamos a revisarlo. ¿Has podido usar el servicio?

**Usuario:** No  
**Bot:** De acuerdo. Hay una información que no coincide y necesitamos revisarla manualmente.

**Usuario:** Vale  
**Bot:** Pasaremos tu caso a revisión.

---

## Datáfono 10€ en Rubí

**Usuario:** En Rubí me ha cobrado 10€  
**Bot:** Gracias. Vamos a revisarlo. ¿Has podido lavar o secar la ropa?

**Usuario:** No  
**Bot:** De acuerdo. Hay una información que no coincide.

**Usuario:** Vale  
**Bot:** Lo pasaremos a revisión.

---

## Eixample: monedas secadora no suman

**Usuario:** He puesto más dinero en la secadora y no suma minutos  
**Bot:** Gracias. ¿Estás en la lavandería Eixample?

**Usuario:** Sí  
**Bot:** De acuerdo. Esa incidencia necesita revisión.

**Usuario:** ¿No se puede arreglar ahora?  
**Bot:** Vamos a pasarlo a revisión.

---

## Rubí: monedas secadora no suman

**Usuario:** He añadido tiempo a la secadora y no lo ha sumado  
**Bot:** Gracias. ¿Estás en Rubí?

**Usuario:** Sí  
**Bot:** De acuerdo. Vamos a revisarlo manualmente.

**Usuario:** Vale  
**Bot:** Gracias. Pasaremos tu caso a revisión.

---

## Eixample: no se puede pagar con tarjeta

**Usuario:** No puedo pagar con tarjeta  
**Bot:** Te ayudo. ¿En qué lavandería estás?

**Usuario:** Eixample  
**Bot:** Gracias. Vamos a revisarlo manualmente porque esa incidencia puede requerir soporte técnico.

**Usuario:** Vale  
**Bot:** Pasaremos tu caso a revisión.

---

## Sant Cugat: no se puede pagar con tarjeta

**Usuario:** La tarjeta no funciona para pagar  
**Bot:** Gracias. ¿Estás en Sant Cugat?

**Usuario:** Sí  
**Bot:** De acuerdo. Vamos a revisar la incidencia manualmente.

**Usuario:** Vale  
**Bot:** Pasaremos tu caso a revisión.

---

## Cliente muy enfadado

**Usuario:** ¡Esto siempre falla! ¡Quiero una solución ya!  
**Bot:** Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?

**Usuario:** Mataró  
**Bot:** Gracias. ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** La 3  
**Bot:** ⚠️ Para resolverlo lo antes posible vamos a pasar tu caso a un operador humano. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Devolución inmediata

**Usuario:** Quiero que me devolváis el dinero ahora mismo  
**Bot:** Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta, una captura del pago y un breve resumen.

**Usuario:** Quiero la devolución ya  
**Bot:** Entiendo. Vamos a pasar el caso a revisión.

---

## Compensación concreta

**Usuario:** Quiero una secadora gratis por las molestias  
**Bot:** Vamos a echar un vistazo a tu caso para poder ofrecerte la mejor solución. 🙏 ¿Cómo te llamas, por favor?

**Usuario:** Pero quiero que me lo confirmes ya  
**Bot:** No puedo confirmarlo directamente desde aquí. Vamos a pasarlo a revisión.

---

## Relato contradictorio doble cobro

**Usuario:** Me cobró dos veces, aunque creo que también pagué en efectivo  
**Bot:** Gracias. Vamos a revisarlo contigo. ¿Has podido finalmente usar el servicio?

**Usuario:** No lo sé bien  
**Bot:** Para comprobarlo bien, vamos a revisar el caso manualmente.

**Usuario:** Vale  
**Bot:** Gracias. Pasaremos tu caso a revisión.

---

## Cámaras o revisión técnica

**Usuario:** Mirad las cámaras porque yo he pagado  
**Bot:** Gracias por indicarlo. Vamos a revisar tu caso manualmente.

**Usuario:** Vale  
**Bot:** Lo pasaremos a revisión.

---

## Código no documentado

**Usuario:** asdf  
**Bot:** No reconozco ese código exactamente. ¿Podrías comprobarlo nuevamente?

**Usuario:** SELECT  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** En la pantalla sale ERR 52  
**Bot:** Ese código no coincide con un caso documentado y necesitamos revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

## Cliente no indica local

**Usuario:** La secadora no funciona  
**Bot:** Hola. Te ayudo. ¿En qué lavandería estás?

**Usuario:** No lo sé  
**Bot:** Para poder ayudarte, necesito saber en qué lavandería estás. ¿Hay cerca un Mercadona, Carrefour, Aldi u otro punto de referencia?

**Usuario:** Estoy en Mataró  
**Bot:** Perfecto. ¿Qué número tiene la máquina?

**Usuario:** non funziona la lavatrice  
**Bot:** Ciao. ¿In quale lavanderia ti trovi?

**Usuario:** non lo so  
**Bot:** Per poterti aiutare ho bisogno di sapere in quale lavanderia sei. C'è vicino un Mercadona, Carrefour, Aldi o un altro punto di riferimento?

---

## Mezcla incidencia máquina y pago

**Usuario:** He pagado, no arrancaba, volví a pagar y ahora no sé si el problema es la máquina o el cobro  
**Bot:** Hola. Tranquilo, te ayudo. ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** WAIT  
**Bot:** La máquina está pendiente de selección. Como además has pagado dos veces, vamos a revisar tu caso manualmente para verificar el cobro duplicado. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso y comprobará el doble cobro. El chatbot será desactivado.

---

### Marathon: display switching

**Usuario:** ¡Hola! ¿Cómo va?  
**Bot:** ¡Hola! Soy el asistente virtual de Demowash. ¿En qué puedo ayudarte?

**Usuario:** ¿Qué horarios hacéis?  
**Bot:** El horario general es de 8:00 a 22:00 cada día del año.

**Usuario:** Tengo un problema con la lavadora  
**Bot:** Lamento la incidencia. ¿En qué lavandería te encuentras?

**Usuario:** Rubí  
**Bot:** ¿Qué número tiene la lavadora?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** WAIT  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número en la central de pago.

**Usuario:** No, ahora aparece SELECT  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** No, ahora pone OPEN  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.

**Usuario:** No, ahora aparece ERR-12  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo.

**Usuario:** sigo con el mismo error  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Marc  
**Bot:** Gracias Marc. Un operador humano se encargará de tu caso. El chatbot será desactivado.

---

### Marathon: trouble resuelto → factura

**Criterios de aceptación:**
1. Si el cliente confirma que la máquina arranca, el bot cierra el flow de incidencia.
2. Si después pide factura, el bot pivota al flow de factura SIN volver a preguntar lavandería/máquina (los facts ya están en state).
3. Resumen factura: lavandería, tipo de máquina, fecha por defecto = hoy.

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** WAIT  
**Bot:** La máquina está pendiente de selección. Comprueba que has pulsado bien el número en la central de pago.

**Usuario:** Ahora sí, ya arranca  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

**Usuario:** Quiero una factura  
**Bot:** Claro, te ayudo con la factura. Veo que has usado la **lavadora 3** en **Rubí**. ¿Me indicas la razón social?

**Usuario:** ACME SL  
**Bot:** ¿Y la dirección?

**Usuario:** Calle Mayor 1, Madrid  
**Bot:** ¿Cuál es tu CIF/NIF/NIE?

**Usuario:** B12345678  
**Bot:** ¿Cuál fue el coste total del servicio?

**Usuario:** 6€  
**Bot:** ¿A qué correo electrónico te enviamos la factura?

**Usuario:** andrea@example.com  
**Bot:** ¿Quieres añadir alguna nota u observación para la factura? Si no, escribe «no».

**Usuario:** no  
**Bot:** Por último, ¿cuál es tu nombre?

**Usuario:** Andrea  
**Bot:** Gracias Andrea, te enviaremos pronto la factura de hoy a tu correo: andrea@example.com.

---

### Marathon: FAQ pause mid-gather

**Criterios de aceptación:**
1. Si el cliente interrumpe el gather con una pregunta FAQ (ej. jabón, horarios), el bot responde la FAQ y RETOMA el gather donde se quedó.
2. NO se pierden los facts ya recolectados (lavandería, tipo, número).
3. Tras la FAQ, el bot repite la última pregunta pendiente.

**Conversación:**

**Usuario:** La lavadora no arranca  
**Bot:** ¿En qué lavandería estás?

**Usuario:** Rubí  
**Bot:** ¿Es una lavadora o una secadora?

**Usuario:** Lavadora  
**Bot:** ¿Qué número tiene la máquina?

**Usuario:** Espera, ¿hace falta llevar jabón?  
**Bot:** No, no hace falta traer nada. Las máquinas Demowash dosifican automáticamente detergente y suavizante ecológicos certificados. Solo tienes que traer la ropa.

¿Qué número tiene la máquina?

**Usuario:** La 3  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** OPEN  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.

**Usuario:** Ya funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

---

## Feedback del cliente (positivo o negativo)

### Feedback positivo (IT)

**Usuario:** ho lavato molto bene la roba volevo farvi i miei complimenti  
**Bot:** Grazie mille per il tuo messaggio! 😊 Siamo felici che tu sia soddisfatto.

### Feedback negativo (ES)

**Usuario:** la lavandería estaba muy sucia  
**Bot:** Gracias por tu feedback, lo tendremos en cuenta lo antes posible.

### Feedback negativo (FR)

**Usuario:** les machines sont trop vieilles  
**Bot:** Merci pour ton retour, nous en tiendrons compte le plus tôt possible.

---

## El cliente pregunta por el jabón, detergente o suavizante

### Pregunta directa (ES, cold start)

**Usuario:** No veo jabón  
**Bot:** No, no hace falta traer nada. Las máquinas Demowash dosifican automáticamente detergente y suavizante ecológicos certificados, elaborados con ingredientes 100% naturales. Solo tienes que traer la ropa.

### Pivot mid-OPEN-flow (ES)

**Usuario:** La lavadora no funciona, sale OPEN  
**Bot:** ¿En qué lavandería estás?  
**Usuario:** Rubí  
**Bot:** ¿Es una lavadora o una secadora?  
**Usuario:** lavadora  
**Bot:** ¿Qué número tiene la máquina?  
**Usuario:** 5  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.  
**Usuario:** ¿hay jabón en la máquina?  
**Bot:** No, no hace falta traer nada. Las máquinas Demowash dosifican automáticamente detergente y suavizante ecológicos…  
**Usuario:** ok, ahora la puerta cierra  
**Bot:** Perfecto. Dime si la lavadora ha arrancado.

**Usuario:** sí, ya funciona  
**Bot:** ✅ Perfecto. La lavadora ha comenzado correctamente.

### Multi-language

**Usuario (IT):** non vedo il sapone  
**Bot:** No, non è necessario portare niente. Le macchine Demowash dosificano automaticamente…

**Usuario (EN):** do I need to bring soap?  
**Bot:** No, you don't need to bring anything. Demowash machines automatically dispense…

### "Manca/falta + sapone"

**Usuario (IT):** mi manca il sapone  
**Bot:** No, no hace falta traer nada. Las máquinas Demowash dosifican automáticamente detergente y suavizante ecológicos certificados, elaborados con ingredientes 100% naturales. Solo tienes que traer la ropa.

**Usuario (IT, typo):** mi manca il sapo e  
**Bot:** No, non è necessario portare niente. Le macchine Demowash dosano automaticamente detergente e ammorbidente ecologici certificati, prodotti con ingredienti 100% naturali. Devi solo portare i panni.

**Usuario (ES):** falta jabón en la máquina  
**Bot:** No, no hace falta traer nada. Las máquinas Demowash dosifican automáticamente detergente y suavizante ecológicos certificados, elaborados con ingredientes 100% naturales. Solo tienes que traer la ropa.

**Usuario (EN):** soap is missing  
**Bot:** No, you don't need to bring anything. Demowash machines automatically dispense certified eco-friendly detergent and softener, made with 100% natural ingredients. Just bring your clothes.

---

## El cliente pregunta cómo se usa la lavandería

### Cold start (ES)

**Usuario:** ¿Cómo se usa la lavandería? Es mi primera vez.  
**Bot:** Para usar la lavandería, sigue estos pasos:

1. **Coloca la ropa en la lavadora** y cierra la puerta.
2. **Dirígete a la central de pago** y efectúa el pago seleccionando el número de máquina que deseas usar.
3. **Vuelve a la máquina** y selecciona el programa y la temperatura que deseas.
4. **Vuelve a recoger tu ropa** cuando la máquina indique que ha terminado.

El detergente y el suavizante se dosifican automáticamente. No hace falta traer nada.

### Pivot mid-flow (ES)

**Usuario:** La lavadora no funciona, sale OPEN  
**Bot:** ¿En qué lavandería estás?  
**Usuario:** Mataró  
**Bot:** ¿Qué número tiene la máquina?  
**Usuario:** espera, ¿cómo se usa exactamente?  
**Bot:** Para usar la lavandería, sigue estos pasos:

1. Coloca la ropa en la lavadora y cierra la puerta.
2. Dirígete a la central de pago y efectúa el pago seleccionando el número de máquina.
3. Vuelve a la máquina y selecciona el programa y la temperatura.
4. Recoge tu ropa cuando termine.

¿Qué número tiene la máquina?

**Usuario:** 5  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.

### Multi-language

**Usuario (IT):** come si usa la lavatrice? è la prima volta  
**Bot:** Per usare la lavanderia, segui questi passi:

1. **Metti i panni nella lavatrice** e chiudi lo sportello.
2. **Vai alla cassa centrale** e paga selezionando il numero di macchina.
3. **Torna alla macchina** e seleziona il programma e la temperatura.
4. **Ritira i panni** quando la macchina segnala la fine del ciclo.

Detergente e ammorbidente vengono dosati automaticamente. Non serve portare nulla.

**Usuario (EN):** first time here, what do I do?  
**Bot:** To use the laundry, follow these steps:

1. **Place your clothes in the washing machine** and close the door.
2. **Go to the central payment terminal** and pay by selecting the machine number.
3. **Return to the machine** and select the program and temperature.
4. **Collect your clothes** when the machine signals the cycle is done.

Detergent and softener are dispensed automatically. You don't need to bring anything.

---

## Orarios Gràcia (caso límite 7:00–23:00)

### Cliente pregunta explícito (ES)

**Usuario:** ¿Qué horario tenéis en Gràcia?  
**Bot:** En **Gràcia** las máquinas se pueden utilizar de **7:00 a 23:00**, todos los días del año.

### Cliente sin location (ES → 2 turnos)

**Usuario:** ¿A qué hora abrís?  
**Bot:** ¿En qué lavandería estás?  
**Usuario:** Gràcia  
**Bot:** En **Gràcia** las máquinas se pueden utilizar de **7:00 a 23:00**, todos los días del año.

### Multi-language (IT)

**Usuario:** che orari fate a Gràcia?  
**Bot:** A **Gràcia** le macchine si possono utilizzare dalle **7:00 alle 23:00**, tutti i giorni dell'anno.

---

## Precios lavadora Mataró (lista L4-L7 desde metadata.machines)

### Cliente pregunta directo (ES)

**Usuario:** ¿Cuánto cuesta lavar en Mataró?  
**Bot:** En **Mataró** los precios de las lavadoras son:

- **Lavadoras** 20kg: 6,5€ (fidelidad) / 7€ (efectivo)
- **Lavadoras** 10kg: 3,5€ (fidelidad) / 4€ (efectivo)

💡 El datáfono cobra el importe exacto de **7€**.

¿También quieres información de secadora?

### Cliente confirma "sí" para secadora (T3)

**Usuario:** sí  
**Bot:** En **Mataró** los precios de las secadoras son:

- **Secadoras**: 2€/15min

---

## Precios secadora Rubí (S4-S5 con TPV 8€)

### Cliente pregunta directo (ES)

**Usuario:** ¿Cuánto cuesta secar en Rubí?  
**Bot:** En **Rubí** los precios de las secadoras son:

- **Secadoras** 20kg: 2€/15min

💡 El datáfono cobra el importe exacto de **8€**.

¿También quieres información de lavadora?

### Cliente confirma "sí" para lavadora (T3, simétrico F58)

**Usuario:** sí  
**Bot:** En **Rubí** los precios de las lavadoras son:

- **L1** 10kg: 4,5€ (fidelidad) / 5€ (efectivo)
- **L2** 15kg: 6€ (fidelidad) / 7€ (efectivo)
- **L3** 20kg: 7€ (fidelidad) / 8€ (efectivo)

💡 El datáfono cobra el importe exacto de **8€**.

---

## Programas temperatura Eixample (4 programas sin número pulsante)

### Cliente pregunta directo (ES)

**Usuario:** ¿Qué programas tiene la lavadora en Eixample?  
**Bot:** En **Eixample** la lavadora tiene los siguientes programas:

- **60º** (muy caliente) — ideal para ropa muy sucia
- **40º** (caliente) — ropa normal
- **30º** (templado) — colores delicados
- **FRÍO** — lana, seda, prendas muy delicadas

En Eixample elige el programa por su nombre — no hay número de pulsante asignado.

### Multi-language (IT)

**Usuario:** che programmi avete a Eixample?  
**Bot:** A **Eixample** la lavatrice ha i seguenti programmi:

- **60º** (molto caldo) — ideale per panni molto sporchi
- **40º** (caldo) — panni normali
- **30º** (tiepido) — colori delicati
- **FRÍO** — lana, seta, capi molto delicati

A Eixample scegli il programma per nome — non c'è un numero di pulsante assegnato.

---

## FAQ temperatura colores Sant Cugat (colorTemperature trasversal)

### Cliente en Sant Cugat pregunta temperatura colores (ES)

**Usuario:** Estoy en Sant Cugat. ¿A qué temperatura lavo la ropa de color?  
**Bot:** Para ropa de color usa agua fría o tibia, entre **20 y 30°C**. El agua caliente abre las fibras y hace que el tinte se escape. También te recomendamos dar la vuelta a las prendas antes de meterlas al tambor para proteger los colores.

### Multi-language (IT)

**Usuario:** a che temperatura lavo i colorati?  
**Bot:** Per i panni colorati usa acqua fredda o tiepida, tra **20 e 30°C**. L'acqua calda apre le fibre e fa scolorire i tinti. Ti consigliamo anche di rovesciare i capi prima di metterli nel cestello per proteggere i colori.

---

## FAQ macchie grasse Terrassa (greaseStains)

### Cliente en Terrassa pregunta mancha (ES)

**Usuario:** Estoy en Terrassa. Tengo una mancha de aceite en una camisa, ¿qué hago?  
**Bot:** Absorbe primero el exceso con papel de cocina sin frotar. Luego usa este programa en nuestras lavadoras:
- **Tejidos resistentes** (algodón): **60°C**
- **Sintéticos o delicados**: **40°C**

Nuestras máquinas aplican el detergente automáticamente para disolver la grasa.

### Multi-language (FR)

**Usuario:** j'ai une tache de graisse, comment l'enlever?  
**Bot:** Absorbe d'abord l'excès avec du papier essuie-tout sans frotter. Ensuite utilise ce programme dans nos machines :
- **Tissus résistants** (coton) : **60°C**
- **Synthétiques ou délicats** : **40°C**

Nos machines appliquent le détergent automatiquement pour dissoudre la graisse.

---

## Instrucciones howToUse Mataró (faqOverride 5 pasos con central)

### Cliente en Mataró pregunta cómo usar (ES)

**Usuario:** Es mi primera vez en Mataró, ¿cómo funciona?  
**Bot:** En **Mataró (Mataró)**, para usar la lavandería sigue estos pasos:

1. **Mete la ropa en la máquina seleccionada** y cierra bien la puerta.
2. **Dirígete a la centralita** y sigue las instrucciones de pago (o paga con la App).
3. **Vuelve a la máquina y confirma el inicio**.
4. **No abras la puerta** antes de que finalice el lavado.
5. **Al terminar**, deja la puerta abierta para que se ventile.

### Cliente sin location (2 turnos)

**Usuario:** ¿Cómo se usa? Primera vez.  
**Bot:** ¿En qué lavandería estás?  
**Usuario:** Mataró  
**Bot:** En **Mataró (Mataró)**, para usar la lavandería sigue estos pasos:

1. **Mete la ropa en la máquina seleccionada** y cierra bien la puerta.
2. **Dirígete a la centralita** y sigue las instrucciones de pago (o paga con la App).
3. **Vuelve a la máquina y confirma el inicio**.
4. **No abras la puerta** antes de que finalice el lavado.
5. **Al terminar**, deja la puerta abierta para que se ventile.

---

## Instrucciones howToUse Gràcia (faqOverride 4 pasos sin "confirma inicio")

### Cliente en Gràcia pregunta cómo usar (ES)

**Usuario:** Estoy en Gràcia, ¿cómo se usa?  
**Bot:** En **Gràcia**, para usar la lavandería sigue estos pasos:

1. **Mete la ropa en la máquina seleccionada** y cierra bien la puerta.
2. **Dirígete a la centralita** y sigue las instrucciones de pago (o paga con la App).
3. **No abras la puerta** antes de que finalice el lavado.
4. **Al terminar**, deja la puerta abierta para que se ventile.

### Multi-language (FR)

**Usuario:** comment utiliser la laverie à Gràcia?  
**Bot:** À **Gràcia**, pour utiliser la laverie suis ces étapes :

1. **Mets le linge dans la machine** et ferme bien la porte.
2. **Va à la centrale de paiement** et suis les instructions (ou paye avec l'App).
3. **N'ouvre pas la porte** avant la fin du lavage.
4. **À la fin**, laisse la porte ouverte pour aérer.

---

## Combinatorio: cliente pregunta horario + precio en la misma sesión (Mataró → Mataró)

### Mataró ambiguo + clarificación + chain hours→prices (ES)

**Usuario:** Estoy en Mataró. ¿A qué hora abrís y cuánto cuesta lavar?  
**Bot:** En Mataró tenemos 2 lavanderías: **Mataró** (Carrer Francisco de Mataró 117) y **Eixample** (C/ Eixample 17). ¿En cuál estás?  
**Usuario:** Mataró  
**Bot:** En **Mataró** abrimos de **8:00 a 22:00** todos los días del año.

En **Mataró** los precios de las lavadoras son:
- **Lavadoras** 20kg: 6,5€ (fidelidad) / 7€ (efectivo)
- **Lavadoras** 10kg: 3,5€ (fidelidad) / 4€ (efectivo)

💡 El datáfono cobra el importe exacto de **7€**.

¿También quieres información de secadora?

### Cliente pivota a Eixample (F51 location switch)

**Usuario:** ¿y en Eixample?  
**Bot:** En **Eixample** abrimos de **8:00 a 22:00** todos los días del año.

En **Eixample** los precios de las lavadoras son:
- **L1/L2** 20kg: 7€ (fidelidad) / 8€ (efectivo)
- **L3/L4** 10kg: 4€ (fidelidad) / 4,5€ (efectivo)

⚠️ En Eixample a veces el pago con tarjeta puede fallar — si pasa, usa monedas o pide ayuda al operador.

---

## El cliente pregunta cómo se usa la secadora

### Cold start sin location (ES)

**Usuario:** ¿Cómo se usa la secadora?  
**Bot:** Para usar la secadora, sigue estos pasos:

1. **Mete la ropa en la secadora** y cierra la puerta.
2. **Dirígete a la central de pago** y efectúa el pago seleccionando el número de secadora.
3. **Elige el programa**: Alta temperatura (para ropa resistente), Media (para ropa normal) o Baja (para ropa delicada).
4. **Durante el ciclo** puedes abrir la puerta en cualquier momento si lo necesitas.
5. **Consejo**: cuando queden ~5 minutos, puedes añadir más tiempo (+5 min) si ves que la ropa no está del todo seca.

### Cliente en Mataró (faqOverride location-specific)

**Usuario:** Estoy en Mataró. ¿Cómo funciona la secadora?  
**Bot:** En **Mataró**, para usar la secadora sigue estos pasos:

1. **Mete la ropa en la secadora** y cierra la puerta.
2. **Dirígete a la central de pago** y selecciona el número de secadora (puedes pagar con monedas, billetes o tarjeta).
3. **Elige el programa**: Alta, Media o Baja temperatura.
4. **Durante el ciclo** puedes abrir la puerta si lo necesitas.
5. **Si la ropa no está del todo seca**, puedes añadir +5 min cuando queden ~5 minutos.

### Cliente en Gràcia (card-only)

**Usuario:** como se usa la secadora, estoy en Gràcia  
**Bot:** En **Gràcia**, para usar la secadora sigue estos pasos:

1. **Mete la ropa en la secadora** y cierra la puerta.
2. **Dirígete a la central de pago** y selecciona el número de secadora. ⚠️ En Gràcia solo se acepta **pago con tarjeta**.
3. **Elige el programa**: Alta, Media o Baja temperatura.
4. **Durante el ciclo** puedes abrir la puerta si lo necesitas.
5. **Si la ropa no está del todo seca**, puedes añadir +5 min cuando queden ~5 minutos.

### Multi-language (IT)

**Usuario (IT):** come si usa l'asciugatrice?  
**Bot:** Per usare l'asciugatrice, segui questi passi:

1. **Metti i panni nell'asciugatrice** e chiudi lo sportello.
2. **Vai alla cassa centrale** e paga selezionando il numero di asciugatrice.
3. **Scegli il programma**: Alta temperatura (panni resistenti), Media (panni normali) o Bassa (delicati).
4. **Durante il ciclo** puoi aprire lo sportello quando vuoi.
5. **Consiglio**: a ~5 minuti dalla fine puoi aggiungere +5 min se i panni non sono ancora asciutti.

---

## La máquina muestra "120" (cuenta atrás fin de ciclo)

### Happy path (ES)

**Usuario:** La pantalla pone 120  
**Bot:** La máquina está terminando su ciclo. Por favor, espera a que la cuenta atrás termine y la pantalla muestre END — en ese momento podrás abrir la puerta.  
**Usuario:** Ya pone END  
**Bot:** ¡Perfecto! Puedes abrir la puerta y recoger tu ropa. ¡Hasta pronto!

### Display 120 (IT)

**Usuario (IT):** il display fa 120  
**Bot:** *(countdownGuidance in italiano: la macchina sta terminando il ciclo, aspetta END)*

### Display 120 (EN)

**Usuario (EN):** screen shows 120  
**Bot:** *(countdownGuidance in English: machine is finishing its cycle, wait for END)*

---

## La lavadora no centrifuga

Problema técnico de la máquina: el ciclo termina pero la ropa sale empapada porque el tambor no centrifuga. Es un incidente que NO se resuelve desde el chat — el bot pide los datos mínimos y escala al operador.

### Happy Path (ES)

**Usuario:** La lavadora no centrifuga, la ropa sale empapada.  
**Bot:** Lo siento, lo paso a un operador. ¿Me dices tu nombre, la localidad (Sants / Eixample / Gràcia / Sant Cugat / Hospitalet / Mataró / Terrassa / Rubí) y el número de la máquina?

**Usuario:** Soy Marco, Sants, máquina 7.  
**Bot:** *(escalate_to_operator({reason: "machine_no_spin", summary: "Cliente Marco en Sants, lavadora 7 no centrifuga, ropa sale empapada."}))*  
He registrado el caso, Marco. Un operador te contactará en pocos minutos.

### Multi-language (IT)

**Usuario:** La lavatrice non centrifuga, i panni escono bagnati.  
**Bot:** Mi dispiace, ti passo a un operatore. Mi dici il tuo nome, la sede (Sants / Eixample / Gràcia / Sant Cugat / Hospitalet / Mataró / Terrassa / Rubí) e il numero della macchina?

### Multi-language (EN)

**Usuario:** The washing machine doesn't spin, clothes come out soaked.  
**Bot:** I'm sorry — I'll forward this to an operator. Can you tell me your name, the location (Sants / Eixample / Gràcia / Sant Cugat / Hospitalet / Mataró / Terrassa / Rubí), and the machine number?

---

## FAQ camisa blanca manchada temperatura

Consejo de lavado puro (no requiere escalación ni tools): el cliente quiere saber a qué temperatura lavar una prenda blanca manchada sin estropearla. El bot responde con la recomendación textil estándar.

### Happy Path (ES)

**Usuario:** Tengo una camisa blanca manchada, ¿a qué temperatura la puedo lavar para no estropearla?  
**Bot:** Para una camisa blanca con manchas:
- **Algodón resistente**: **40°C** (máx. 60°C si la mancha es muy persistente)
- **Tejidos delicados** (seda, lana, mezclas finas): **30°C**

Por encima de 40°C en tejidos delicados arriesgas a fijar la mancha y amarillear la fibra. En nuestras lavadoras Demowash selecciona el programa correspondiente en el display de la máquina — el detergente se dosifica automáticamente.

### Multi-language (IT)

**Usuario:** Ho una camicia bianca macchiata, a quanti gradi la posso lavare per non rovinarla?  
**Bot:** Per una camicia bianca con macchie:
- **Cotone resistente**: **40°C** (max 60°C se la macchia è molto persistente)
- **Tessuti delicati** (seta, lana, misti fini): **30°C**

Sopra i 40°C su tessuti delicati rischi di fissare la macchia e ingiallire la fibra. Nelle nostre lavatrici Demowash seleziona il programma corrispondente sul display della macchina — il detersivo viene dosato automaticamente.

### Multi-language (EN)

**Usuario:** I have a stained white shirt — what temperature can I wash it at without ruining it?  
**Bot:** For a stained white shirt:
- **Sturdy cotton**: **40°C** (up to 60°C if the stain is stubborn)
- **Delicate fabrics** (silk, wool, fine blends): **30°C**

Above 40°C on delicate fabrics you risk setting the stain and yellowing the fiber. On our Demowash machines, pick the matching program on the machine display — detergent is dosed automatically.

---
