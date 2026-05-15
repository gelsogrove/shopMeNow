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
  - [5.4 — Pivot AL001 → Caso 4 (cliente confirma pagamento)](#54--pivot-al001--caso-4-cliente-confirma-pagamento)
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
  - [8.3 — Cliente repite un código en el campo nombre (rechazo + re-ask)](#83--cliente-repite-un-código-en-el-campo-nombre-rechazo--re-ask)
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

## 🏛 Convenciones arquitectónicas (transversales)

**F48 — Separation of concerns: customer-facing vs operator-facing wording.**

Los prompts customer-facing (i18n) usan términos **genéricos** cuando el rephrase
LLM podría deformarlos. La especificidad se conserva en el `state` y se utiliza
**determinísticamente** en el operator briefing.

- `machineType` (washer/dryer): el prompt customer-facing del turno "ask number"
  usa "máquina/machine/macchina/màquina" en lugar de "lavadora/secadora". Razón:
  el rephrase LLM con T=0.4 puede flippar lavadora↔secadora (chat real Andrea
  2026-05-12). Estado preservado en `state.machineType`; operator briefing
  ([utils/escalation.ts](../utils/escalation.ts)) interpola el término correcto
  ("Andrea en Pineda con la **lavadora** número 3...").
- **Patrón aplicable a futuros bugs análogos**: si el rephrase puede deformar
  otro `fact` estructurado del estado (`location`, `displayState`, `machineNumber`),
  el fix arquitectónico es genericar el prompt customer-facing y dejar la
  interpolación específica al briefing operatore (no añadir reglas textuales
  al prompt rephrase — Iron rule #1).

**F55 — Override condicional de `state.machineType` en contexto FAQ.**

`autoExtractFacts` aplica **first-set-wins** por defecto a `state.machineType`
para evitar flips accidentales mid-trouble (ej. typo «ah no scusa la
secadora»). PERO esa regla falla cuando el cliente entra primero en una FAQ
con un verbo que captura el tipo, y luego pivota a un problema real con tipo
distinto: el state se queda pegado en el tipo equivocado y el bot ejecuta el
flow JSON de la máquina incorrecta.

- **Trigger real**: chat Andrea 2026-05-15. T1 «ma quanto costa asciugare a
  Pineda?» → `state.machineType='dryer'` (vía detector F52 verb form). T2
  «Pineda» → FAQ resuelta. T3 «mi lavadora no funciona» → el bot respondía
  *«La puerta no está cerrada... dime si la **secadora** ha arrancado»* (mal:
  ejecutaba `dryer_ed340.json:case_door`).
- **Fix L3** en [utils/agent-extract.ts](../utils/agent-extract.ts): permite
  override sólo si **3 gates cumulativos** son verdaderos:
  1. `!state.pendingFlow` (no hay flow de gather activo)
  2. `!state.activeFlowId` (no hay display flow activo)
  3. `state.lastResolvedIntent === 'faq'` (venimos de una FAQ resuelta)
- **Dentro de un trouble flow activo**: first-set-wins se preserva (anti-flip
  «ah no scusa la secadora» mid-troubleshoot).
- **Pin** en [`__tests__/unit/machine-type-faq-flip.test.ts`](../__tests__/unit/machine-type-faq-flip.test.ts)
  con 7 escenarios (happy + 3 guards + backcompat).
- **Patrón aplicable**: si aparece un tercer state field con misma dinámica
  (sticky con first-set-wins y un caso FAQ→trouble), aplicar el mismo gate
  cumulativo. Espejo del F51 para `state.location`.

**F57 — State pollution scoping en el briefing operador (LLM path).**

Cuando el cliente abandona un flujo (ej. abre un trouble Caso 2 DOOR, no lo
resuelve, no escala) y pivota a un caso totalmente NO relacionado (ej. Caso 8
discount code), los facts machine-related (`machineType`, `machineNumber`,
`displayLabel`, `displayHistory`) permanecen sticky en `SessionState`. El
briefing generado por el LLM (`operatorBriefingFromLlm=true`) los incluía
indiscriminadamente, produciendo summaries como:

> *"Andrea en Goya **reportó un problema con la lavadora número 5**. El
> **código de pantalla** mostrado fue **DOOR**. Motivo: código de descuento
> — formato no reconocido."*

El operador recibe facts pertenecientes a otra conversación → confusión, posible
mal trato del caso. Trigger real: Andrea CLI 2026-05-15.

- **Fix L3+L5** en [utils/operator-briefing.ts](../utils/operator-briefing.ts):
  nuevo helper `getEscalationCategory(state)` que clasifica la escalación en:
  - `discount-code`: customer + location + código son relevantes (machine
    facts marcados como "(not applicable ...)" en STATE_FACTS para que el
    LLM los ignore).
  - `invoice`: customer + location + `invoiceData` son relevantes.
  - `non-trouble`: customer + location + `nonTroubleshootingIncident`.
  - `machine-trouble` (default): todos los machine facts.

  Mirror de las ramas que ya existían en `buildEscalationSummaryBody`
  (deterministic path) — mantener en sync al añadir un nuevo flujo.

- **Fix L5** en [`prompts/operator-briefing.txt`](../prompts/operator-briefing.txt):
  nueva regla #10 que instruye al LLM a IGNORAR los machine/display details
  que aparezcan en CONVERSATION_HISTORY si `STATE_FACTS.machineFacts` está
  marcado como "(not applicable for X escalations)". El LLM ve el bloque
  scoped y entiende que esos turns son de otra conversación.

- **Pin** en [`__tests__/unit/escalation-category.test.ts`](../__tests__/unit/escalation-category.test.ts)
  con 12 escenarios (3 paths × 4 categorías + 2 regressions + 1 priority).

- **Patrón aplicable**: cada vez que un nuevo flujo de escalación se añade
  al casebook, extender `getEscalationCategory` con la rama correspondiente
  AND actualizar tanto el código (STATE_FACTS scoping) como el prompt
  (regla #10 explícita). Mantener mirror con `buildEscalationSummaryBody`
  para que ambos paths (deterministic / LLM) produzcan briefings con
  el mismo scoping.

---

**F56 — Rephrase governance via `state.activeFlowId` gate.**

El rephrase LLM (T=0.4, `naturalRephrase=true`) inventa repetidamente detalles
operativos sobre interacciones físicas con las máquinas: «hasta oír un clic»
(F32), «ropa atascada» (F37), «pegado en la máquina» (F38), «ropa atrapada»
(F39), «ropa en la goma» (F56), «hasta que encaje bien» (F56). Cada anti-pattern
añadido al `prompts/rephrase.txt` el LLM lo ignora o lo sustituye por otra
variante — el approach de anti-pattern lists no escala.

- **Trigger real**: chat Andrea 2026-05-15. Display DOOR → bot inventa *«revisa
  si hay **ropa en la goma** y cierres la puerta **hasta que encaje bien**»*.
  El source [`json/washer_hs60xx.json:case_door`](../json/washer_hs60xx.json)
  post-F37 dice sólo *«La puerta no está cerrada correctamente. Ábrela y
  ciérrala bien, y prueba otra vez.»* — sin «goma», sin «encaje».
- **Fix L5** en [agent.ts](../agent.ts): nueva condición
  `isDisplayFlowActive = !!ar.state.activeFlowId` añadida a la lista de bypass
  del rephrase (`isT1Welcome`, `isInvoiceFlow`, `hasFormattedBulletList`,
  `isDiscountCodeAsk`, **`isDisplayFlowActive`**). Cuando un display flow está
  activo, el customer ve el prompt JSON-vetted **verbatim** sin polish.
- **Gate `state.activeFlowId` vs pattern match en `outcome.reason`**: elegimos
  `activeFlowId` porque persiste durante TODOS los turnos del display flow
  (case_push, case_sel, case_door, AL001, ALM-DOOR, C001, …), independientemente
  de qué guard concreto emita la respuesta.
- **Patrón aplicable**: cada layer de contenido que describa interacciones
  físicas con dispositivos reales (display flows, machine instructions,
  hardware troubleshooting) DEBE bypassar el rephrase. Anti-pattern lists
  textuales son lotería. La secuencia F32→F37→F38→F39→F41→F56 demuestra el
  fracaso del approach textual.

---

## Caso 1 — PUSH PROG

### 1.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → número de máquina → pantalla. NO pregunta «¿has pagado?».
2. Tras PUSH PROG, el bot muestra los 4 programas disponibles (**60º**, **40º**, **30º**, **FRÍO**) con descripción y pide pulsar uno.
3. Cuando el cliente confirma que funciona, el bot cierra como resuelto.
4. No se escala a operador.

**Conversación:**

**Usuario:** La lavadora no funciona  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué lavandería estás?

**Usuario:** Goya  
**Bot:** Gracias. ¿Qué número tiene la máquina?

**Usuario:** La 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
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
**Bot:** Gracias. ¿Qué número tiene la máquina?

**Usuario:** La 5  
**Bot:** ¿Qué aparece en la pantalla?

**Usuario:** PUSH PROG  
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

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
**Bot:** ¿Qué número tiene la máquina?

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
**Bot:** ¿Qué número tiene la máquina?

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
**Bot:** ¿Qué número tiene la máquina?

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
**Bot:** ¿Qué número tiene la máquina?

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
1. Cualquier «Sí» a «¿cambio devuelto?» → escala (el contexto del trigger ya indica que la máquina no se activó — el «sigue sin arrancar» es implícito).
2. Excepción: «Sí, ahora arranca / ya funciona» → resolved (corner case, no escala).
3. El bot pide el nombre antes del cierre con «operador» + «desactivado».
4. Resumen al operador: nombre, lavandería, número, tipo.

**Conversación A — bare «Sí»:**

**Usuario:** He pagado y no se ha activado  
**Bot:** Hola, soy el asistente virtual de Ecolaundry. ¿En qué local estás?

**Usuario:** Goya  
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

### 5.4 — Pivot AL001 → Caso 4 (cliente confirma pagamento)

**Criterios de aceptación:**
1. El cliente entra con AL001 → bot hace gather (lavandería → tipo → número) y explica el error de secuencia (Caso 5 happy path).
2. Si en el siguiente turno el cliente menciona que ha pagado (señal `detectPaidNotActivatedIntent`, multi-idioma — "he pagado", "ho pagato", "I paid", "paguei", "j'ai payé", "he pagat"), el bot **pivota deterministically al Caso 4**: abandona el flow AL001 (`activeFlowId=null`) y arma `pendingFlow='no-change-ask'`.
3. A partir de ahí los guards de Caso 4 (4.1 / 4.2) toman el control: la próxima pregunta es «¿La central te ha devuelto el cambio?». Un «Sí» → escalación inmediata (regla 4.2). Un «No» → instrucción de revisar saldo y, si tras eso el cliente confirma que sigue roto, escalación (regla 4.2).
4. NO se acumulan instrucciones improvisadas por el LLM: el pivot deja el state machine en una rama documentada y deterministica.

**Conversación:**

**Usuario:** AL001  
**Bot:** Hola, soy el asistente virtual de la lavandería. ¿En qué pueblo está la lavandería?

**Usuario:** Pineda  
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

## Caso 8 — Código de descuento

### 8.1 — Happy Path (formato válido)

**Criterios de aceptación:**
1. El bot pide SOLO el código (no lavandería ni tipo en el mismo turno).
2. Validación formato: `^<prefix>(\d{2})(\d{2})(\d{2})(\d{1,2})$` (prefijo + DDMMYY + importe 1-2 dígitos). Adicional: `dd ∈ 01..31` y `mm ∈ 01..12` (saneamiento de fecha). El **prefijo es config-driven** por tenant — `settings.discountCodePrefix` en `json/settings.json` (default Ecolaundry: `SAU`). `validateSettings` falla al boot si el prefijo falta o no es uppercase letters-only. El mismo prefijo se pasa a `validateCustomerName` para que un código (p. ej. `SAU2904266`) NO sea aceptado como nombre del cliente (F46).
3. Si formato válido, recoge: nombre → pueblo → número → puerta.
4. Escala siempre al operador para activación remota.

**Conversación:**

**Usuario:** Tengo un código y no sé cómo usarlo  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves?

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
**Bot:** Ese código no encaja con el formato que esperamos. ¿Podrías comprobarlo y escribírmelo de nuevo?

**Usuario:** XYZ123  
**Bot:** El código no encaja con el formato esperado, vamos a revisarlo manualmente. ¿Cómo te llamas?

**Usuario:** Andrea  
**Bot:** Gracias Andrea. Un operador humano se encargará de tu caso.

---

### 8.3 — Cliente repite un código en el campo nombre (rechazo + re-ask)

**Criterios de aceptación:**
1. Tras un código válido (`SAU2904266`), el bot pregunta `¿Cuál es tu nombre?`.
2. Si el cliente responde con un token que coincide con el formato del código de descuento (`^<prefix>(\d{2})(\d{2})(\d{2})(\d{1,2})$` con `prefix = settings.discountCodePrefix`), `validateCustomerName` lo rechaza con `reason = "<token> looks like a discount code, not a name"` (F46).
3. El bot **NO acepta** el token como nombre — vuelve a preguntar `¿Cómo te llamas?` y mantiene `pendingFlow='discount-code-await-name'`.
4. El contador `awaitNameAskAttempts` se incrementa con cada intento no valido (3-strikes ladder via `nextRetryLadderStep`): 1° y 2° invalidos → re-ask; 3° invalido → escala al operador (ladder corolario regla #10).
5. El rechazo es deterministico — vale en las 6 lenguas soportadas porque el detector `looksLikeDiscountCode` solo mira el formato, no el contenido lingüístico.

**Conversación A — recuperado al re-ask:**

**Usuario:** Tengo un código  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto tal como lo ves?

**Usuario:** SAU2904266  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** SAU2904266  
**Bot:** ¿Cómo te llamas? *(rechazo silencioso del token: looks like a discount code, no como nombre)*

**Usuario:** Andrea  
**Bot:** ¿En qué pueblo / lavandería quieres usarlo?

**Conversación B — escalación tras 3 intentos no validos (ladder):**

**Usuario:** Tengo un código  
**Bot:** ¡Hola! Te ayudo. ¿Me dices el código exacto?

**Usuario:** SAU2904266  
**Bot:** ¡Gracias! ¿Cuál es tu nombre?

**Usuario:** SAU2904266  
**Bot:** ¿Cómo te llamas?

**Usuario:** sau2904266  
**Bot:** ¿Cómo te llamas?

**Usuario:** SAU2904266  
**Bot:** Vamos a revisar tu caso manualmente. *(escalación tras 3 intentos)*

---

## Caso 9 — Factura

### 9.1 — Happy Path

**Criterios de aceptación:**
1. Gather: lavandería → tipo → razón social → dirección → CIF/NIF → fecha → **coste** → email → notas → nombre.
2. Una pregunta por turno (NO listas combinadas). Coste total se acepta verbatim (cualquier formato).
3. Datos PII NO pasan por rephrase LLM ni operator-briefing LLM.
4. Mensaje final incluye disclaimer de privacidad. Operator briefing incluye `coste: X`.

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

### 9.2 — Email inválido (retry)

**Criterios de aceptación:**
1. Email mal formado → reply contiene «no parece válido» y vuelve a pedirlo.
2. El bot NO avanza al siguiente paso hasta recibir un email válido.
3. Al segundo intento válido continúa al paso siguiente.
4. Cierre canónico con disclaimer de privacidad.

**Conversación:**

[gather hasta coste → bot pide email]

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

### 12.1 — Horarios por location

**Criterios de aceptación:**
1. Bot pregunta: «¿En qué lavandería / pueblo estás?»
2. Cliente responde con pueblo/calle → bot responde con `metadata.hours` de esa location
3. Si el cliente dice un pueblo con múltiples ubicaciones (ej. Mataró), bot pregunta calle/zona
4. Respuesta incluye días de apertura si varían (e.g. "abierto todos los días")
5. No se inventa información de horarios

**Conversación:**

**Usuario:** ¿Cuáles son los horarios?  
**Bot:** ¿En qué lavandería o pueblo estás?

**Usuario:** Platja d'Aro  
**Bot:** En Platja d'Aro, el horario es de 8:00 a 22:00, todos los días del año.

**Usuario:** Y en L'Escala  
**Bot:** En L'Escala, las máquinas se pueden utilizar de 7:00 a 23:00, todos los días.

---

### 12.2 — Precios de lavadora por location y peso

**Criterios de aceptación:**
1. Bot pregunta: «¿Cuánto cuesta la lavadora?» → «¿En qué lavandería estás?»
2. Cliente responde con pueblo → bot muestra lista de lavatrices **en bold** con peso y precios (fidelity/cash)
3. Formato: `**L1** 20kg: 10€ (fidelidad) / 10€ (efectivo), **L2** 15kg: 8€ / 8€, …`
4. Si cliente pide información de secadora o máquina específica, bot responde con esos datos
5. NO inventa precios, usa solo data de `locations.json:machines`
6. Cuando el cliente pide precios SIN especificar el tipo de máquina, el bot muestra la lavadora por defecto y añade la pregunta explícita «¿También quieres información de secadora?». La respuesta «sí» del cliente debe tener un contexto semántico claro.
7. Cuando dos o más máquinas de la misma location comparten `weightKg + fidelity + cash`, el bot las colapsa en una sola línea bajo la etiqueta plural «Lavadoras» / «Secadoras» sin enumerar los números individuales. Si todas las specs difieren, cada máquina conserva su número (L1, L2, …).
8. Cuando el cliente pide explícitamente UN tipo en T1 (verbo «lavar» / «asciugare» o sustantivo «lavadora» / «secadora»), el bot muestra solo ese tipo en T2 y añade el hint del opuesto («¿También quieres información de secadora?» tras lavadora, y simétrico). Un follow-up «y la secadora?» / «y la lavadora?» en T3 renderiza el otro tipo.
9. Cuando el cliente, después de un render de precios/horarios, cambia de location en un mensaje de seguimiento («e a Pineda?», «en L'Escala?»), el bot actualiza la location y renderiza los precios/horarios de la nueva location de manera determinística (mismo formato que el render inicial).
10. En la transición de FAQ a una incidencia (trouble-machine), el bot resetea la location capturada en contexto FAQ y vuelve a preguntar la lavandería para el caso actual — no arrastra la location de la comparación FAQ previa.

**Conversación:**

**Usuario:** ¿Cuánto cuesta la lavadora?  
**Bot:** ¿En qué lavandería estás?

**Usuario:** Platja d'Aro  
**Bot:** En Platja d'Aro, los precios de lavadora son:

- **L1** 20kg: 10€ (fidelidad) / 10€ (efectivo)
- **L2** 15kg: 8€ / 8€
- **L3** 15kg: 8€ / 8€
- **L4** 13kg: 5€ / 5€

¿También quieres información de secadora?

**Usuario:** Sí  
**Bot:** En Platja d'Aro, los precios de secadora son:

- **S5** 20min: 3€
- **S6** 20min: 3€

**Ejemplo (follow-up del tipo opuesto tras rama type-specific):**

**Usuario:** ¿Cuánto cuesta lavar la ropa?  
**Bot:** ¿En qué pueblo o lavandería estás?

**Usuario:** Goya  
**Bot:** En Goya, los precios de lavadora son:

- **L4** 20kg: 6,5€ (fidelidad) / 7€ (efectivo)
- **L5** 10kg: 3,5€ (fidelidad) / 4€ (efectivo)

¿También quieres información de secadora?

**Usuario:** y la secadora?  
**Bot:** En Goya, los precios de secadora son:

- **S1**: 2€/15min

(Simétrico para la rama dryer-first: «¿cuánto cuesta asciugare?» → muestra secadora + «¿También quieres información de lavadora?» → «y la lavadora?» → muestra lavadora.)

**Ejemplo (collapse de máquinas con specs idénticas) — Pineda con 2 secadoras idénticas:**

**Usuario:** quanto costa asciugare a Pineda?  
**Bot:** En Calle Pineda (Pineda de Mar), los precios de secadora son:

- **Secadoras** 20kg: 2€/15min

> En lugar de listar `**S4** 20kg: 2€/15min` y `**S5** 20kg: 2€/15min` como dos líneas duplicadas, el formatter detecta que comparten specs (weightKg+fidelity+cash) y las colapsa bajo la etiqueta plural «Secadoras» sin enumerar los números individuales (el cliente no necesita saber qué número concreto para conocer el precio).

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
**Bot:** ¿Qué número tiene la máquina?

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
**Bot:** ¿Qué número tiene la máquina?

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
**Bot:** Gracias. ¿Qué número tiene la máquina?

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
2. La primera respuesta incluye el wording `compensationReview` + `¿Cómo te llamas?` en un único mensaje (F65).
3. Si el cliente insiste, mantiene la línea «no puedo confirmarlo desde aquí».
4. Resumen al operador: nombre + «compensación» + descripción.
5. Diferencia con Caso 26: pide algo CONCRETO (lavadora gratis), no devolución.

**Conversación:**

**Usuario:** Quiero una secadora gratis por las molestias  
**Bot:** Vamos a echar un vistazo a tu caso para poder ofrecerte la mejor solución. 🙏 ¿Cómo te llamas, por favor?

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
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

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
**Bot:** Perfecto. ¿Qué número tiene la máquina?

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
**Bot:** Para iniciar el lavado, por favor, pulsa un botón de programa en la máquina.

Los programas disponibles son:

- **60º** (muy caliente) → ideal para ropa muy sucia, blanca o de trabajo
- **40º** (templado) → perfecto para ropa normal (algodón, color)
- **30º** (suave) → adecuado para ropa delicada o sintética
- **FRÍO** → recomendado para prendas muy delicadas (lana, seda, etc.)

Selecciona uno y presiona el botón en la máquina. Luego, cuéntame si la lavadora ha comenzado a funcionar.

**Usuario:** No, ahora pone DOOR  
**Bot:** La puerta no está cerrada correctamente. Ábrela y ciérrala bien, y prueba otra vez.

**Usuario:** No, ahora aparece AL001  
**Bot:** Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Te ayudo a completarlo.

**Usuario:** sigo con el mismo error  
**Bot:** ⚠️ Si nada ha funcionado, por favor usa otra lavadora. Tenemos que notificar al operador. ¿Cómo te llamas?

**Usuario:** Marc  
**Bot:** Gracias Marc. Un operador humano se encargará de tu caso. El chatbot será desactivado.

