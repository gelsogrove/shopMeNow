# Flussi canonici cliente-0

**Owner**: Andrea
**Sorgenti di verità**: [`02reglas.md`](../../apps/backend/custom-client-0/02reglas.md), [`01usecaases.md`](../../apps/backend/custom-client-0/01usecaases.md)
**Stato**: documento di riferimento per il refactoring Step A. Da non sovrascrivere senza approvazione di Andrea.

Questo documento estrae dai due file di documentazione le **sequenze di domande deterministiche** che il bot deve seguire. È la base contro cui validare ogni dialog dopo Step A.

---

## Regola d'oro (Andrea, 2026-05-02)

> **Ciò che conta sono i CONCETTI delle domande e l'ORDINE, non le parole esatte.**

Tradotto in regole operative:

- ✅ Le **parole esatte** delle risposte possono variare ("Perfecto" / "De acuerdo" / "Gracias" / "Bien" sono tutti accettabili) → l'History LLM ha libertà sul wording
- ✅ Il **tono** caldo è vincolante (sempre rassicurante, mai robotico)
- ❌ La **sequenza concettuale** è vincolante (se la doc dice "salta il display", il bot NON lo chiede mai, neanche con altre parole)
- ❌ I **fatti raccolti** sono vincolanti (se la doc dice "chiede 4 cifre tarjeta", il bot le chiede sempre)

Quindi i test di acceptance verificano i **concetti** (es: "il bot al turno 4 ha chiesto del cambio?"), non le stringhe esatte ("includes \"cambio\"" è una proxy, non la verità).

---

## Principi (da 02reglas.md)

1. **Una sola domanda per turno**
2. **Tono di apertura standard**: caldo, "Hola, soy el asistente virtual de Ecolaundry. Te ayudo paso a paso." NON una versione neutra
3. **Tranquilizzare, poi diagnosticare, poi risolvere** (in quest'ordine)
4. **Mai accusare, mai promettere compensazioni, mai inventare prezzi**
5. **Sticky facts** mai cancellati senza smentita esplicita del cliente

---

## Flussi canonici per caso (dalla doc)

### Caso 1 — `PUSH PROG` lavadora

```
T1  cliente: "La lavadora no funciona"
    bot:    saluto + ask local
T2  cliente: "Goya"
    bot:    "Gracias. ¿Qué número de lavadora es?"            ← num PRIMA del pagato
T3  cliente: "La 5"
    bot:    "Perfecto. ¿Has podido realizar el pago?"         ← pagato PRIMA del display
T4  cliente: "Sí"
    bot:    "De acuerdo. ¿Qué aparece exactamente en la pantalla?"
T5  cliente: "PUSH PROG"
    bot:    spiegazione case_push + "dime si la lavadora empieza a funcionar"
T6  cliente: "Sí, ahora funciona"
    bot:    chiusura
```

### Caso 2 — `DOOR` lavadora

```
T1  cliente: "La lavadora no arranca"
    bot:    saluto + ask local
T2  cliente: "Hortes"
    bot:    "Gracias. ¿Qué número de lavadora es?"
T3  cliente: "La 2"
    bot:    "De acuerdo. ¿Qué aparece exactamente en la pantalla?"  ← qui salta il pagato
T4  cliente: "DOOR"
    bot:    spiegazione case_door
T5  cliente: "Ahora sí funciona"
    bot:    chiusura
```

### Caso 3 — `SEL` lavadora

```
T1  cliente: "He pagado pero la lavadora no empieza"
    bot:    saluto + ask local
T2  cliente: "Pineda"
    bot:    "Gracias. ¿Qué número de lavadora es?"
T3  cliente: "La 3"
    bot:    "Perfecto. ¿Qué aparece exactamente en la pantalla?"   ← pagato già implicito da T1
T4  cliente: "SEL"
    bot:    case_sel
T5  cliente: "Ya lo he hecho y ahora sí funciona"
    bot:    chiusura
```

### Caso 4 — pagato + non attivato + nessun cambio reso

```
T1  cliente: "He pagado y no se ha activado"
    bot:    saluto + ask local
T2  cliente: "Goya"
    bot:    "Gracias. ¿Es una lavadora o una secadora?"            ← qui chiede TIPO (non sa già)
T3  cliente: "Lavadora"
    bot:    "Perfecto. ¿Qué número de máquina es?"
T4  cliente: "La 4"
    bot:    "De acuerdo. ¿La central te ha devuelto el cambio?"    ← qui SALTA display
T5  cliente: "No"
    bot:    "Es posible que no se haya marcado bien... mira si todavía aparece saldo en la central y pulsa correctamente"
T6  cliente: "Sí, ahora ya se ha puesto en marcha"
    bot:    chiusura
```

### Caso 5 — `AL001`

```
T1  cliente: "Me sale AL001"
    bot:    "Tranquilo, te ayudo. ¿En qué lavandería estás?"       ← TONO TRANQUILIZZANTE
T2  cliente: "L'Escala"
    bot:    "Gracias. ¿Es una lavadora o una secadora?"
T3  cliente: "Lavadora"
    bot:    "De acuerdo. Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. ¿Qué has hecho justo antes de que apareciera el mensaje?"
T4  cliente: "Creo que toqué el programa antes de acabar el pago"
    bot:    "Perfecto, eso nos ayuda. Vamos a revisarlo paso a paso..."
```

Nota: AL001 può chiudere con guida o escalare. **Non è auto-escalate immediato** come avevo capito io. Il bot prova prima a chiarire la sequenza.

### Caso 6 — doppio addebito + servizio usato

```
T1  cliente: "Me habéis cobrado dos veces con la tarjeta"
    bot:    "Lo revisamos contigo. ¿En qué lavandería estás?"     ← MAI accusa, MAI promette
T2  cliente: "Goya"
    bot:    "Gracias. ¿Has podido lavar o secar la ropa?"
T3  cliente: "Sí"
    bot:    "De acuerdo. Explícame, por favor, paso a paso qué has hecho desde que has entrado."
T4  cliente: relato
    bot:    "Gracias. Para revisarlo bien, necesito los últimos 4 dígitos de la tarjeta."
T5  cliente: "4821"
    bot:    "Perfecto. Ahora necesito una captura del pago."
T6  cliente: "Vale"
    bot:    "Gracias. Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contacta con nosotros y te ayudaremos al momento."
```

### Caso 7 — pagato senza poter usare

```
T1  cliente: "He pagado y no he podido usar la máquina"
    bot:    saluto + ask local
T2  cliente: "Pineda"
    bot:    "Gracias. ¿La central te ha devuelto el cambio?"      ← qui SALTA tipo+numero
T3  cliente: "Sí"
    bot:    "De acuerdo. ¿Qué aparece exactamente en la pantalla de la máquina?"
T4  cliente: "PUSH PROG"
    bot:    case_push
T5  cliente: "Ahora sí"
    bot:    chiusura
```

### Caso 8 — codice importo minore

```
T1  cliente: "Tengo un código y no sé cómo usarlo"
    bot:    "Te ayudo. Dime el código exacto tal como lo ves, incluyendo letras si las hay."
T2  cliente: "AB12345"
    bot:    "Gracias. ¿En qué lavandería lo quieres usar?"
T3  cliente: "Goya"
    bot:    "Perfecto. ¿Te falta una pequeña parte para completar el importe o el código cubre un importe mayor?"
T4  cliente: "Me falta un poco"
    bot:    istruzione: "Introduce en la central el importe que falta..."
T5  cliente: "Sí, ya funciona"
    bot:    chiusura
```

Escalation se "solo numeri" o codice non riconosciuto.

### Caso 9 — fattura

```
T1  cliente: "Quiero una factura"
    bot:    [EXACT] "Para obtenerla, debes enviar un correo a olga@alberwaz.net con esta información: razón social, email, lavandería utilizada, CIF/NIF, dirección, fecha de uso, máquinas utilizadas y observaciones."
T2  cliente: "Perfecto"
    bot:    "Gracias. Si lo necesitas, te repito la lista paso a paso."
```

### Caso 10 — comprare tarjeta fidelización

```
T1  cliente: "¿Cómo consigo la tarjeta de fidelización?"
    bot:    risposta base + "¿En qué lavandería estás?"
T2  cliente: "Goya"
    bot:    risposta location-aware (Goya: "...se activa pulsando el segundo botón de la fila derecha")
```

### Caso 11 — ricaricare tessera

Stesso schema: domanda + risposta location-aware.

### Caso 12 — orari e prezzi

Risposta diretta. Per L'Escala: "8:00-22:00 in generale, máquinas 7:00-23:00".

### Caso 13 — escalation per codice di alarma o incoerenza

```
T1  cliente: codice strano (es. "ALN", "ERR 52")
    bot:    saluto + ask local                                    ← prima identifica local
T2  cliente: location
    bot:    "¿Es una lavadora o una secadora?"
T3  cliente: tipo
    bot:    "Vamos a revisarlo manualmente. ¿Cómo te llamas?"
T4  cliente: nome
    bot:    handover summary
```

---

## Mappa codici display (da 02reglas.md sez. "Estados de pantalla conocidos")

| Codice | Significato | Risposta base | Escalate sempre? |
|---|---|---|---|
| `PUSH PROG` / `PUSH` | falta seleccionar el programa | "Pulsa ahora el programa que quieras usar y dime si la máquina empieza a funcionar." | NO (solo se non risponde) |
| `DOOR` | puerta no cerrada | "Abre y cierra bien la puerta, y vuelve a probar." | NO (solo se persiste) |
| `SEL` | máquina pendiente de selección | "Comprueba que has pulsado bien el número de la máquina." | NO |
| `ALM DOOR` | posible prenda atrapada | "Abre la puerta con cuidado, revisa si hay alguna prenda atrapada..." | NO (se persiste, sì) |
| `001` / `AL001` | selección antes del pago | "Vamos a revisarlo manualmente." | **SÍ** |
| `ALM` / `ALN` / similari | alarma máquina | "La máquina ha detectado una incidencia y tenemos que revisarlo." | **SÍ** |
| Codice non documentato | — | "Ese código no coincide con un caso documentado y necesitamos revisarlo manualmente." | **SÍ** |

---

## Sequenze di domande riassuntive (per fase P11 machineGather)

Il bot **non chiede sempre tutto in ordine fisso**. La sequenza dipende da quanto già sa.

### Caso classico (cliente non dice nulla di tecnico)
`local → tipo (washer/dryer) → numero → pagato? → display`

### Cliente dice "lavadora" subito
`local → numero → pagato? → display`

### Cliente dice "He pagado" nel primo messaggio
`local → tipo (se non chiaro) → numero → display`     (salta domanda pagato)

### Cliente dice "He pagado y no se ha activado"
`local → tipo → numero → cambio devuelto? → istruzione` (NO display)

Questa è la quarta variante che NON era nel mio piano. Va modellata in P14 paidNotActivatedChain.

### Cliente dice "He pagado y no he podido usar la máquina"
`local → cambio devuelto? → display → flow`            (salta tipo+numero)

Quinta variante.

### Cliente dice "Me han cobrado dos veces"
`local → has servito? → relato → 4 dígitos → captura → escalate`

### Cliente dice un codice direttamente (AL001, ERR 52)
`local → tipo → escalate manuale`                      (salta numero+display)

### Cliente fa una FAQ
`Risposta diretta + (se location-aware) ¿En qué lavandería estás?`

---

## Bug noti rispetto alla doc

Confrontando il codice attuale con questi flussi canonici:

| # | Flusso canonico | Comportamento attuale | Fix |
|---|---|---|---|
| B1 | Caso 1: numero PRIMA del display | Talvolta chiede display prima | Fix in P11 machineGather |
| B2 | Caso 4: SALTA display | Talvolta chiede display | Fix in P14 |
| B3 | Caso 7: SALTA tipo+numero, va su cambio | Talvolta chiede tipo | Fix in P14 |
| B4 | Apertura "Tranquilo, te ayudo" per casi tecnici | Spesso "Hola..." secco | Fix in P16 prompt history |
| B5 | Caso 5 (AL001): bot prova chiarimento prima di escalare | Escalate immediato | Fix in P12 |
| B6 | Caso 13: ALN escalate, ma chiede prima local+tipo | A volte escala subito | Fix in P12 |
| B7 | Mataró: dopo location chiede via prima di tutto | Va su numero | Fix in P10 (già abbozzato) |

---

## Test transversali aggiuntivi (oltre i 32 usecase)

Da scrivere come `transversal_test.json` durante Step A:

- **TS-1** (FAQ in mezzo a flow): cliente in case_alm dice "a che ora aprite?" → bot risponde, riprende l'ALM
- **TS-2** (cambio numero): location Goya, washer 4 → cliente dice "no aspetta è la 5" → state.machineNumber = 5, niente reset
- **TS-3** (uscita escalation): cliente dà nome → "no aspetta ho risolto" → bot esce dall'escalation
- **TS-4** (cambio lingua): cliente passa da es a it → tutte le risposte successive in it, sticky facts intatti
- **TS-5** (3 FAQ consecutive): durante flow ALM → 3 FAQ → "torniamo all'allarme" riprende dal check_result
- **TS-6** (cliente arrabbiato calmato): T1 angry, bot empatico, T2-T5 normale flow Caso 1
- **TS-7** (codice non documentato + cliente lo conferma): bot chiarisce "ese código no está documentado" + escalate
- **TS-8** (Mataró + via): T1 location Mataró → bot chiede via → T2 via → poi numero → poi pagato → poi display
