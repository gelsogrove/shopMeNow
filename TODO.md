# TODO — demorobot

> Scritto 2026-08-03. Cosa deve fare il chatbot, cosa manca, e le regole che
> non sono negoziabili. Aggiornare qui man mano, non in chat.

---

## 🎯 Il comportamento voluto

Ordine di gestione di una richiesta. Ci si ferma al primo che si applica:

```
1. FAQ risponde?          → rispondi dalla FAQ. Fine.
2. FLOW corrisponde?      → start_flow(id) → carica il compiledPrompt
                            → segui gli STEP nell'ordine, uno alla volta
3. Nessuno dei due?       → raccogli il caso:
                              • cosa succede (domanda APERTA)
                              • numero di serie
                              • quando è iniziato
                            → FLOW GENERALE (terminale acceso? wifi? cut scheduling?)
                            → chiedi il NOME
                            → passa all'operatore
```

**Quando un flow è attaccato**, quello è l'unico copione: si seguono i suoi
STEP e si dimentica il catalogo, incluso il flow generale. Mai mescolare
domande di un flow in un altro.

### Passaggio all'operatore

Deve avvenire **tutto nello stesso turno**, mai a metà:

1. Se il nome non è noto → chiedilo (una domanda breve)
2. Appena risponde → `remember({key:'name'})` **e** `escalate_to_operator`
3. Poi conferma **per nome**: _"Andrea, ti metto in contatto con il nostro
   operatore, ti risponderà il prima possibile"_

Effetti collaterali attesi: email/WhatsApp all'operatore secondo
`operatorDeliveryMode` (all / random), `activeChatbot: false`, briefing 👤
visibile in chat con nome, azienda, seriale, problema, quando, risposte
raccolte.

**Emergenza** (ferito, animale, fumo, incendio, danni): escalation IMMEDIATA,
senza chiedere prima nulla. Poi, nello stesso messaggio, partecipazione e
richiesta dei dati per il richiamo. Mai una riga piatta.

### Come parla

- UNA domanda per messaggio
- Opzioni numerate `1.` `2.` `3.` — ma **solo** se vengono da un flow o da una
  FAQ, mai inventate
- Emoji: al massimo una per messaggio, nessuna va benissimo
- Lingua: quella del cliente, rilevata dal suo messaggio (il profilo è solo un
  suggerimento iniziale)

---

## 🚫 Non deve inventare — mai

Tutto ciò che dice viene da ACTIVE FLOW, FAQ o SESSION STATE. Il suo training
**non è una fonte**.

Casi visti in produzione, tutti da non ripetere:

| Cosa ha inventato                       | Quando                 |
| --------------------------------------- | ---------------------- |
| _"È la batteria carica?"_               | nessun flow agganciato |
| Menu di cause (_"le lame non girano?"_) | fase di raccolta       |
| _"Le lame girano normalmente?"_         | dopo la prima domanda  |
| Promessa di richiamo senza escalation   | terminale SELF_SERVICE |

⚠️ **temperature: 0 NON impedisce le invenzioni** — rende l'output
deterministico, non veritiero. Se inventa, inventa in modo consistente.

Il rimedio non è l'ennesima regola nel prompt: è **togliere spazio**
all'improvvisazione con guardie deterministiche in codice.

---

## ✅ Fatto

- `start_flow` — l'LLM sceglie dal catalogo, il tool valida l'id
- STEP numerati nel compiledPrompt + regole d'ordine
- Gate intake: la domanda la detta il codice, l'LLM traduce soltanto
- Gate escalation: rifiuta finché mancano nome, seriale, descrizione, quando
- Briefing operatore visibile in chat (marker `**👤 Human Support message**`)
- `operatorDeliveryMode` all/random (era dichiarato ma mai implementato)
- Settings dal DB a runtime (`maxTokens` 2500 non aveva effetto)
- Round-trip `maxTokens` verso la UI (l'API non lo restituiva)
- Gate `enableCalendarBooking` (era ignorato dal percorso custom)
- `welcomeBackMessage` + `humanSupportMessage` editabili dall'app
- Zero copy hardcodato (vedi sotto)
- Categorie nel catalogo dei flow
- 36 test nuovi, inclusi quelli che leggono il sorgente

## ⏳ Da fare

- [ ] **FLOW GENERALE** — 3 nodi (acceso / wifi / cut scheduling),
      **senza categoria**, terminali **ESCALATE**. Senza questo il passo 3
      dell'orchestrazione non esiste e ogni problema non coperto va dritto
      all'operatore.
- [ ] **Risalvare i flow dal builder** — i compiledPrompt vecchi non hanno gli
      STEP numerati e alcuni terminali sono ancora SELF_SERVICE (il tool di
      escalation non è permesso lì, quindi il bot promette un contatto che non
      avviene).
- [ ] **Alleggerire `customChatbotSystemPrompt`** — contiene una sua procedura
      di raccolta (13 menzioni del seriale) che compete con l'orchestrazione
      del modulo. Lasciargli identità, tono e conoscenza AmRobots; togliere
      "cosa chiedere e in che ordine".
- [ ] Campi intake editabili dall'app (oggi solo in `settings.json`)
- [ ] `similarityThreshold` / `topK` — ancora decorativi
- [ ] `audioVoices` vuoto su demorobot ma audio attivabile da UI
- [ ] Gli altri 4 moduli custom leggono i settings al boot → per loro
      "Max Reply Length" non ha effetto
- [ ] **Customer Registration** — mai affrontato: link nel welcome, blocco se
      non registrato, accettazione/rifiuto iscrizione

---

## 📌 Regole di lavoro

**Niente hardcoded.** Nessuna frase rivolta al cliente nel codice: viene da
workspace (DB) → `custom-<module>/settings.json` → **silenzio**. Mai inglese
non tradotto come ripiego. Scrivere il default in UNA lingua, l'LLM traduce.

Resta legittimo in codice: istruzioni all'LLM (`OPERATING_RULES`), schemi dei
tool, guardie deterministiche. La regola riguarda il **contenuto**, non il
meccanismo.

**Il criterio**: un secondo cliente di un altro settore potrebbe usare il
modulo senza modifiche? Se una stringa andrebbe riscritta, è contenuto.

**Eccezioni**: solo con l'accordo esplicito di Andrea, annotato nel commento.

Dettaglio completo in `CLAUDE.md` §1A/1B/1C.

RICORDA NON VEDE HARCODEARE NULLA!
