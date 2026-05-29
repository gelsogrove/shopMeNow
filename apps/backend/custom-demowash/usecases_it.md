## Indice

DemoWash è una rete di lavanderie self-service in franchising con 6 sedi in Catalogna: **Eixample**, **Gràcia**, **Mataró**, **Rubí**, **Sant Cugat** e **Terrassa**.

Ogni sede ha i suoi orari, le sue macchine, i suoi programmi, prezzi e metodi di pagamento. Il chatbot, prima di dare qualunque dato operativo, identifica sempre la sede del cliente. Per i problemi tecnici chiede i 4 dati uno alla volta: **sede → tipo → numero → schermo**.

### La macchina ha un problema

- [Messaggio OPEN sullo schermo (porta non chiusa bene)](#messaggio-open)
- [Messaggio ERR-01 sullo schermo (programma prima del pagamento)](#messaggio-err-01)
- [Messaggio ALERT o BLOCK (guasto tecnico)](#messaggio-alert-o-block)
- [La lavatrice non parte dopo il pagamento (schermo spento)](#non-parte-dopo-pagamento)
- [La porta non si sblocca alla fine del ciclo](#porta-non-si-sblocca)
- [L'asciugatrice non scalda](#asciugatrice-non-scalda)

### Pagamenti e rimborsi

- [Doppio addebito sulla carta](#doppio-addebito)
- [Ho pagato ma la macchina non si è attivata](#pagamento-senza-attivazione)
- [Le monete dell'asciugatrice non si sommano](#monete-asciugatrice-non-sommano)
- [I panni sono usciti mal lavati (sporchi, bagnati, con cattivo odore)](#panni-mal-lavati)
- [Voglio la fattura](#fattura)

### Consigli di lavaggio (FAQ universale)

- [A che temperatura lavo una camicia bianca macchiata?](#camicia-bianca-macchiata)
- [A che temperatura lavo i colorati?](#temperatura-colorati)
- [Ho una macchia di grasso, come la tolgo?](#macchia-di-grasso)
- [Devo portare il detersivo?](#detersivo-incluso)
- [Posso lavare piumoni e coperte?](#piumoni-e-coperte)
- [Quanto dura un lavaggio?](#durata-del-lavaggio)

### Dati per sede (franchising)

- [Quali sono gli orari?](#orari)
- [Quanto costa lavare?](#prezzi)
- [Si può pagare con la carta?](#metodi-di-pagamento)
- [Che programmi ha la lavatrice?](#programmi)
- [Come funziona la tessera fedeltà?](#tessera-fedeltà)
- [Quanto risparmio con la tessera?](#risparmio-con-la-tessera)
- [Dove si trova la lavanderia più vicina?](#lavanderia-più-vicina)

---

## Messaggio OPEN

> Problema tecnico — flusso sede → tipo → numero → schermo (1 dato per turno).

**Cliente:** La mia lavatrice non parte.
**Bot:** Ciao! 👋 Sono l'assistente virtuale di **Demowash**. In quale lavanderia ti trovi?

**Cliente:** Eixample.
**Bot:** Lavatrice o asciugatrice?

**Cliente:** Lavatrice.
**Bot:** Che numero ha la macchina?

**Cliente:** La 3.
**Bot:** Cosa vedi sullo schermo?

**Cliente:** OPEN.
**Bot:** Apri la porta con cura, controlla se c'è qualche capo incastrato nella guarnizione e richiudila bene fino a sentire il clic. Il messaggio è sparito?

**Cliente:** Sì, adesso è sparito.
**Bot:** Perfetto. Seleziona di nuovo il programma. Buon lavaggio! 👋

---

## Messaggio ERR-01

**Cliente:** Sono a Mataró, lavatrice 6 con ERR-01.
**Bot:** Hai premuto il programma prima di pagare. Ripartiamo da capo:

1. Carica i panni e chiudi bene la porta.
2. Vai al totem di pagamento, paga e seleziona il numero della tua macchina.
3. Torna alla macchina e premi il programma.

Dimmi se parte.

**Cliente:** Adesso parte.
**Bot:** Perfetto! Buon lavaggio 👋

---

## Messaggio ALERT o BLOCK

**Cliente:** Sant Cugat, lavatrice 4, esce ALERT.
**Bot:** La macchina ha rilevato un'anomalia e ha bisogno di assistenza. Sposta i panni in un'altra lavatrice libera e dimmi quale hai scelto. La attiviamo da remoto così puoi lavare senza costi aggiuntivi.

**Cliente:** Adesso sono sulla lavatrice 2.
**Bot:** Grazie. Come ti chiami? Passo il caso a un operatore per attivarti la 2 e registrare l'anomalia sulla 4.

**Cliente:** Andrea.
**Bot:** Ho registrato il caso, Andrea. Un operatore ti contatterà entro pochi minuti.

---

## Non parte dopo pagamento

> Caso particolare: lo schermo è spento o non mostra alcun codice — il bot scala direttamente perché senza codice non c'è procedura documentata.

**Cliente:** Ho pagato ma la macchina non parte.
**Bot:** In quale lavanderia ti trovi?

**Cliente:** Rubí.
**Bot:** Lavatrice o asciugatrice?

**Cliente:** Lavatrice.
**Bot:** Che numero ha la macchina?

**Cliente:** La 3.
**Bot:** Cosa vedi sullo schermo?

**Cliente:** Niente, è spento.
**Bot:** Capito. Come ti chiami? Passo il caso a un operatore per attivare la macchina da remoto.

**Cliente:** Marta.
**Bot:** Ho registrato il caso, Marta. Un operatore ti contatterà entro pochi minuti.

---

## Porta non si sblocca

**Cliente:** La porta non si apre, il lavaggio è già finito.
**Bot:** Tranquilla. Quando il ciclo finisce, la porta impiega qualche minuto per sbloccarsi. Da quanto tempo è finito il lavaggio?

**Cliente:** Più di 5 minuti.
**Bot:** In quale lavanderia ti trovi?

**Cliente:** Gràcia.
**Bot:** Che numero ha la lavatrice?

**Cliente:** La 2.
**Bot:** Come ti chiami? Passo il caso a un operatore per sbloccare la porta da remoto.

**Cliente:** Luis.
**Bot:** Ho registrato il caso, Luis. Un operatore ti contatterà entro pochi minuti.

---

## Asciugatrice non scalda

**Cliente:** L'asciugatrice non scalda, i minuti passano ma i panni restano bagnati.
**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Terrassa.
**Bot:** Che numero ha l'asciugatrice?

**Cliente:** La 5.
**Bot:** Come ti chiami? Passo il caso a un operatore per rimborsare il ciclo e controllare la macchina.

**Cliente:** Anna.
**Bot:** Ho registrato il caso, Anna. Un operatore ti contatterà entro pochi minuti.

---

## Doppio addebito

**Cliente:** Mi avete addebitato due volte sulla carta.
**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Eixample.
**Bot:** Che numero ha la macchina?

**Cliente:** La 1.
**Bot:** Mi dici le ultime 4 cifre della carta e il tuo nome? Passo il caso a un operatore per verificare il doppio addebito.

**Cliente:** Carta 8821, sono Jordi.
**Bot:** Ho registrato il caso, Jordi. Un operatore ti contatterà entro pochi minuti.

---

## Pagamento senza attivazione

**Cliente:** Ho pagato ma la macchina non si è attivata e voglio il rimborso.
**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Mataró.
**Bot:** Lavatrice o asciugatrice?

**Cliente:** Lavatrice, la 6.
**Bot:** Come hai pagato: contanti, tessera fedeltà o carta bancaria?

**Cliente:** Carta bancaria, finisce in 4412.
**Bot:** Come ti chiami?

**Cliente:** Carla.
**Bot:** Ho registrato il caso, Carla. Un operatore ti contatterà entro pochi minuti per il rimborso.

---

## Monete asciugatrice non sommano

**Cliente:** Ho messo monete nell'asciugatrice ma i minuti non aumentano.
**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Rubí.
**Bot:** Che numero ha l'asciugatrice?

**Cliente:** La 3.
**Bot:** Come ti chiami? Passo il caso a un operatore per restituire i soldi e controllare la macchina.

**Cliente:** Mireia.
**Bot:** Ho registrato il caso, Mireia. Un operatore ti contatterà entro pochi minuti.

---

## Panni mal lavati

> Il cliente riporta un risultato di servizio difettoso (panni sporchi dopo il ciclo, ancora bagnati dopo l'asciugatura completa, cattivo odore). Il bot tratta il caso come incidente di qualità, raccoglie sede + tipo + numero macchina + nome e passa il caso a un operatore per valutare il rimborso. Il bot **non decide** il rimborso — è l'operatore a gestirlo.

**Cliente:** I panni sono usciti sporchi e puzzano dopo il lavaggio, voglio un rimborso.
**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Eixample.
**Bot:** Lavatrice o asciugatrice?

**Cliente:** Lavatrice, la 3.
**Bot:** Come ti chiami?

**Cliente:** Marta.
**Bot:** Ho registrato il caso, Marta. Un operatore ti contatterà entro pochi minuti per valutare il caso e il rimborso.

---

## Fattura

> Il bot chiede i dati uno alla volta (regola "una domanda per turno"): ragione sociale → importo → data del servizio → email → nota opzionale.
>
> 🔒 **Dati sensibili fuori dal flusso LLM**: ragione sociale, P.IVA/CF, indirizzo, email e altri dati personali NON vengono inviati al modello di IA (OpenAI/OpenRouter). Il bot raccoglie ciascun campo e il nostro codice lo elabora in modo deterministico — le risposte di questi turni sono **cablate nel codice**, non generate dal LLM. In questo modo i dati PII restano esclusi dal flusso standard verso l'IA.

**Cliente:** Voglio la fattura del lavaggio.
**Bot:** Perfetto! Ti preparo la fattura. Qual è il nome dell'azienda o la ragione sociale?

**Cliente:** Marta Ribas SRL.
**Bot:** Grazie. Qual è l'importo che hai pagato? (in euro)

**Cliente:** 8 €.
**Bot:** Perfetto. Quando hai usato il servizio? (es. oggi, ieri, 29/05/2026)

**Cliente:** Oggi.
**Bot:** Capito. A quale email ti mando la fattura?

**Cliente:** marta@example.com
**Bot:** Grazie. Vuoi aggiungere una nota? (es. CIF, codice cliente, riferimento) Se no, scrivi "no".

**Cliente:** CIF B12345678.
**Bot:** Perfetto. Ho registrato la fattura con i dati: Marta Ribas SRL, 8 €, oggi, CIF B12345678. La riceverai a marta@example.com tra pochi minuti.

---

## Camicia bianca macchiata

> FAQ universale — non dipende dalla sede.

**Cliente:** Ho una camicia bianca macchiata, a che temperatura la posso lavare per non rovinarla?
**Bot:** Per una camicia bianca con macchie:

- **Cotone resistente**: **40°C** (fino a 60°C se la macchia è molto ostinata)
- **Tessuti delicati** (seta, lana, misti fini): **30°C**

Sopra i 40°C su tessuti delicati rischi di fissare la macchia. Seleziona il programma corrispondente sul display della macchina — il detersivo viene dosato in automatico.

---

## Temperatura colorati

**Cliente:** A che temperatura lavo i colorati?
**Bot:** Regola generale per i colorati:

- **Colori scuri / neri**: **30°C** (evita la perdita di colore)
- **Colori chiari**: **30-40°C**
- **Colori resistenti con macchie**: fino a **40°C**

Mai lavare i colorati sopra i 40°C la prima volta: il colore rilascia di più quando è nuovo.

---

## Macchia di grasso

**Cliente:** Ho una macchia di grasso su una camicia, come la tolgo?
**Bot:** Prima assorbi l'eccesso con carta da cucina senza strofinare (strofinare allarga la macchia). Poi seleziona:

- **Cotone**: **60°C**
- **Sintetici o delicati**: **40°C**

Il detersivo Demowash include un componente sgrassante che viene dosato in automatico.

---

## Detersivo incluso

**Cliente:** Devo portare il detersivo?
**Bot:** No, non serve portare niente! Le macchine Demowash **dosano in automatico** detersivo e ammorbidente ecologici certificati, fatti con ingredienti 100% naturali. Devi solo portare i panni. 😊

---

## Piumoni e coperte

**Cliente:** Posso lavare piumoni e coperte?
**Bot:** Sì, puoi lavarli! Questi i consigli:

**Piumoni e coperte in cotone o poliestere resistente:**

- **Temperatura**: **40°C**
- **Capacità**: usa una lavatrice da **20 kg** per piumoni grandi
- **Dopo il lavaggio**: asciugatrice ad **alta o media temperatura** per eliminare bene l'umidità

**Piumoni delicati o con imbottitura sintetica:**

- **Temperatura**: **30°C**

**Consigli**:

- Non sovraccaricare la macchina — il piumone ha bisogno di spazio per muoversi bene
- Dopo il lavaggio il piumone uscirà molto bagnato: passalo in **asciugatrice** per finire

Se vuoi sapere quali macchine grandi ci sono e i prezzi esatti, dimmi in quale lavanderia sei. 😊

---

## Durata del lavaggio

**Cliente:** Quanto dura un lavaggio?
**Bot:** La durata dipende dal **programma** che scegli:

- **60°C** (molto caldo): **50-55 minuti**
- **40°C** (caldo): **45-50 minuti**
- **30°C** (tiepido): **40-45 minuti**
- **Freddo** (\*): **35-40 minuti**

Sono tempi approssimativi. Durante il ciclo vedrai sullo schermo il conto alla rovescia del tempo restante (es. `T-28` significa 28 minuti). 😊

---

## Orari

> FAQ per-sede — il bot chiede solo la sede.

**Cliente:** Quali sono gli orari?
**Bot:** In quale lavanderia ti trovi?

**Cliente:** Gràcia.
**Bot:** A **Gràcia** siamo aperti dalle **7:00 alle 23:00**, tutti i giorni.

---

## Prezzi

**Cliente:** Quanto costa lavare?
**Bot:** In quale lavanderia ti trovi?

**Cliente:** Eixample.
**Bot:** A **Eixample** questi sono i prezzi della lavatrice:

| Num. | Peso  | Fedeltà | Contanti |
| ---- | ----- | ------- | -------- |
| 1    | 20 kg | 7 €     | 8 €      |
| 2    | 20 kg | 7 €     | 8 €      |
| 3    | 10 kg | 4 €     | 4,50 €   |
| 4    | 10 kg | 4 €     | 4,50 €   |

Vuoi anche i prezzi dell'asciugatrice?

---

## Metodi di pagamento

**Cliente:** Si può pagare con la carta?
**Bot:** In quale lavanderia ti trovi?

**Cliente:** Gràcia.
**Bot:** A **Gràcia** si accetta solo **carta di credito/debito**. Non ci sono contanti né tessera fedeltà in questa sede.

---

## Programmi

**Cliente:** Che programmi ha la lavatrice?
**Bot:** In quale lavanderia ti trovi?

**Cliente:** Eixample.
**Bot:** A **Eixample** la lavatrice ha 4 programmi:

| Tasto | Programma   | Temperatura |
| ----- | ----------- | ----------- |
| 1     | Molto caldo | 60°         |
| 2     | Caldo       | 40°         |
| 3     | Tiepido     | 30°         |
| 4     | Freddo      | \*          |

L'asciugatrice ne ha 3: alta, media e bassa temperatura.

---

## Tessera fedeltà

> Il bot conferma se la sede del cliente accetta la tessera e mostra i prezzi ridotti. Per attivazione, ricarica o saldo rimanda al team della lavanderia — sono loro che gestiscono la tessera fisicamente. Il bot lo presenta come un servizio del locale, non come una propria limitazione.

**Cliente:** Come funziona la tessera fedeltà?
**Bot:** Con la tessera fedeltà paghi **meno** che con contanti o carta — lo sconto si applica in automatico su ogni lavaggio e asciugatura.

In quale lavanderia ti trovi? Ti confermo se la accettiamo lì e ti passo i prezzi.

**Cliente:** Eixample.
**Bot:** A **Eixample** sì, accettiamo la tessera fedeltà. Questi sono i prezzi:

| Macchina         | Capacità | Tessera |
| ---------------- | -------- | ------- |
| Lavatrice 1-2    | 20 kg    | 7 €     |
| Lavatrice 3-4    | 10 kg    | 4 €     |
| Asciugatrice 5-6 | 20 kg    | 2,50 €  |

---

## Risparmio con la tessera

> Il bot ha bisogno della sede per mostrare il risparmio esatto — ogni locale ha prezzi diversi.

**Cliente:** Quanto risparmio con la tessera?
**Bot:** Per dirti il risparmio esatto, in quale lavanderia ti trovi?

**Cliente:** Rubí.
**Bot:** A **Rubí** il risparmio con la tessera fedeltà è:

**Lavatrici**:

- Macchina 1 (10 kg): **0,50 € di risparmio** (4,50 € con tessera vs 5 € in contanti)
- Macchina 2 (15 kg): **1 € di risparmio** (6 € con tessera vs 7 € in contanti)
- Macchina 3 (20 kg): **1 € di risparmio** (7 € con tessera vs 8 € in contanti)

**Asciugatrici** (macchine 4 e 5, 20 kg): **stesso prezzo** con tessera o in contanti (2 € / 15 min).

💡 Se usi la lavatrice grande (macchina 3) abitualmente, la tessera si ammortizza in pochi utilizzi. 😊

---

## Lavanderia più vicina

**Cliente:** Dove si trova la lavanderia più vicina?
**Bot:** In che zona sei? Ti passo i dati della sede più comoda.

**Cliente:** Sono a Barcellona.
**Bot:** A Barcellona abbiamo due sedi Demowash:

1. **Eixample** — C/ Aragó 286, vicino a Passeig de Gràcia. Orario: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, vicino a Plaça del Sol. Orario: 7:00 — 23:00

---
