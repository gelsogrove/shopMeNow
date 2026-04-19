# EcoLaundry — MCP Test Scenarios

> Workspace: `9d5cc88b-a550-416f-9b3b-4bcc4a11d00d`
> Phone test: `+39000000099` | Name: `test_andrea`

---

## LAVATRICE HS-60XX

### CASE 1 — Lavatrice non parte: display mostra "SEL"
**Flusso**: `lavatrice_hs60xx` → `no_parte`
1. User: `Ciao`  → Bot: benvenuto, lavatrice o asciugatrice?
2. User: `lavatrice` → Bot: numero macchina?
3. User: `3` → Bot: ha già pagato?
4. User: `sì ho pagato` → Bot: cosa vede nel display?
5. User: `SEL` → Bot: istruzioni seleziona macchina / premi programma
6. User: `risolto` → Bot: ottimo ✅

---

### CASE 2 — Lavatrice non parte: non ha ancora pagato
**Flusso**: `lavatrice_hs60xx` → `no_parte`
1. User: `Ciao` → Bot: benvenuto
2. User: `lavatrice numero 5` → Bot: ha già pagato?
3. User: `no non ho pagato` → Bot: istruzioni pagamento (centrale, seleziona macchina, premi programma, chiudi porta)
4. User: `ok ho pagato` → Bot: cosa vede nel display?
5. User: `PUSH` → Bot: premi il tasto programma
6. User: `funziona grazie` → Bot: ✅

---

### CASE 3 — Lavatrice non parte: display mostra "DOOR"
**Flusso**: `lavatrice_hs60xx` → `no_parte`
1. User: `lavatrice 2 non parte, ho pagato` → Bot: cosa vede nel display?
2. User: `DOOR` → Bot: chiudere bene la porta (click)
3. User: `ancora non parte` → Bot: escalate operatore

---

### CASE 4 — Lavatrice non parte: display mostra "ALM" con sottotipo acqua
**Flusso**: `lavatrice_hs60xx` → `no_parte`
1. User: `lavatrice 4, display ALM` → Bot: che tipo di ALM?
2. User: `water` → Bot: premi STOP una volta
3. User: `ok risolto` → Bot: ✅

---

### CASE 5 — Lavatrice non parte: display mostra "AL001"
**Flusso**: `lavatrice_hs60xx` → `no_parte`
1. User: `lavatrice 1, ho pagato, display AL001` → Bot: errore sequenza (programma prima del pagamento), escalate operatore

---

### CASE 6 — Post ciclo: vestiti ancora bagnati (sovraccarico)
**Flusso**: `lavatrice_hs60xx` → `post_ciclo`
1. User: `ho finito il lavaggio ma i vestiti sono ancora bagnati` → Bot: display END+bAL?
2. User: `no display normale` → Bot: carico eccessivo, dividi il bucato, usa programma rapido €2.50
3. User: `ok grazie` → Bot: ✅

---

### CASE 7 — Post ciclo: porta bloccata dopo il lavaggio
**Flusso**: `lavatrice_hs60xx` → `post_ciclo`
1. User: `lavatrice 3 finita ma porta non si apre` → Bot: aspetti 2-3 min (scarico)
2. User: `si è aperta` → Bot: ✅
3. User: `ancora bloccata` → Bot: escalate operatore

---

### CASE 8 — Post ciclo: poca schiuma
**Flusso**: `lavatrice_hs60xx` → `post_ciclo`
1. User: `ho visto pochissima schiuma è normale?` → Bot: sì, normale — detersivo industriale fa meno schiuma

---

### CASE 9 — Stop button premuto a metà ciclo
**Flusso**: `lavatrice_hs60xx` → `stop_error`
1. User: `ho premuto stop per sbaglio a metà lavaggio` → Bot: era il primo ciclo?
2. User: `no era a metà` → Bot: STOP annulla il lavaggio, nessun rimborso automatico, escalate operatore decide

---

### CASE 10 — Stop button premuto prima del primo ciclo
**Flusso**: `lavatrice_hs60xx` → `stop_error`
1. User: `ho premuto stop prima di iniziare` → Bot: macchina pronta per ripartire, seleziona programma e avvia

---

## ASCIUGATRICE ED-340

### CASE 11 — Asciugatrice non parte: non ha pagato
**Flusso**: `asciugatrice_ed340` → `no_parte`
1. User: `asciugatrice non parte` → Bot: numero macchina?
2. User: `6` → Bot: ha inserito monete al display centrale?
3. User: `no` → Bot: istruzioni pagamento (€3=15min, €4=20min, €5=25min, premi PAUSE)
4. User: `ok inserito` → Bot: il display mostra i minuti?
5. User: `sì vedo 15 minuti` → Bot: premi PAUSE per confermare e avviare ✅

---

### CASE 12 — Asciugatrice non parte: display mostra "DOOR"
**Flusso**: `asciugatrice_ed340` → `no_parte`
1. User: `asciugatrice 7, ho pagato, display DOOR` → Bot: chiudere bene il portello (click)
2. User: `ora funziona` → Bot: ✅

---

### CASE 13 — Asciugatrice non parte: display mostra "FILTRO"
**Flusso**: `asciugatrice_ed340` → `no_parte`
1. User: `asciugatrice mostra FILTRO` → Bot: pulire filtro + sensore, chiudere portello filtro, premere STOP una volta
2. User: `fatto, ora funziona` → Bot: ✅

---

### CASE 14 — Asciugatrice non parte: FALLO DE ROTACION
**Flusso**: `asciugatrice_ed340` → `no_parte`
1. User: `asciugatrice 2, display FALLO DE ROTACION` → Bot: guasto sensore tamburo, escalate operatore

---

### CASE 15 — Asciugatrice non parte: FALLO DE ASPIRACION
**Flusso**: `asciugatrice_ed340` → `no_parte`
1. User: `FALLO DE ASPIRACION` → Bot: pulire filtro + tubo aspirazione, premere STOP per reset
2. User: `risolto` → Bot: ✅

---

### CASE 16 — Post ciclo asciugatrice: biancheria ancora umida (caricata bagnata)
**Flusso**: `asciugatrice_ed340` → `post_ciclo`
1. User: `ho finito ma i vestiti sono ancora umidi` → Bot: causa possibile?
2. User: `li ho messi bagnati fradici dalla lavatrice` → Bot: MAI mettere vestiti fradici, danneggiano il filtro — escalate operatore per valutazione

---

### CASE 17 — Post ciclo asciugatrice: porta ancora bloccata
**Flusso**: `asciugatrice_ed340` → `post_ciclo`
1. User: `asciugatrice finita ma porta bloccata` → Bot: aspetti 2 min (fase raffreddamento)
2. User: `si è aperta grazie` → Bot: ✅

---

### CASE 18 — Post ciclo asciugatrice: odore strano
**Flusso**: `asciugatrice_ed340` → `post_ciclo`
1. User: `dalla asciugatrice esce un odore strano` → Bot: escalate operatore — controllare tamburo/filtro

---

## CASI SPECIALI

### CASE 19 — Reset sessione: utente si era sbagliato di macchina
**Flusso**: reset → router
1. User: `lavatrice 3` → Bot assegna lavatrice_hs60xx
2. User: `aspetta mi sono sbagliato era l'asciugatrice` → Bot: chiama `resetSession()`, pulisce contesto
3. User: `asciugatrice 3` → Bot: riassegna asciugatrice_ed340 e ricomincia

---

### CASE 20 — FAQ durante il flow (cambio argomento)
**Flusso**: sub-LLM risponde a domanda generica
1. User: `lavatrice 2` → assegnata
2. User: `quanto costa il lavaggio a 40 gradi?` → Bot risponde con prezzo (€3.50) senza uscire dal flow

---

### CASE 21 — Escalate a operatore manuale
**Flusso**: qualsiasi → `contactOperator()`
1. User: `lavatrice 1, non parte da 20 minuti, nessuna soluzione funziona` → Bot: dopo vari tentativi falliti → contatta operatore

---

### CASE 22 — Lingua spagnola (cliente ES)
**Flusso**: router risponde in spagnolo
1. User: `hola, la lavadora no funciona` → Bot risponde in spagnolo, assegna lavatrice_hs60xx
2. Tutto il flow prosegue in spagnolo

---

### CASE 23 — debugMode WIP (non playground)
> Questo scenario va testato **senza** MCP, tramite WhatsApp reale
> Con debugMode=true → Bot risponde con messaggio WIP
> Con MCP (isPlayground=true) → Bot bypassa WIP e risponde normalmente

---
