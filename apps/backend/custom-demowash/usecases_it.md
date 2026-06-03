### La macchina ha un problema

- [La mia lavatrice non parte](#la-mia-lavatrice-non-parte)
- [La lavatrice mostra ERR-01](#la-lavatrice-mostra-err-01)
- [La lavatrice mostra ALERT o BLOCK](#la-lavatrice-mostra-alert-o-block)
- [Ho pagato ma la macchina non parte](#ho-pagato-ma-la-macchina-non-parte)
- [La porta non si apre, il lavaggio è già finito](#la-porta-non-si-apre-il-lavaggio-è-già-finito)
- [L'asciugatrice non scalda](#lasciugatrice-non-scalda)

### Pagamenti e rimborsi

- [Mi avete addebitato due volte sulla carta](#mi-avete-addebitato-due-volte-sulla-carta)
- [Ho pagato ma la macchina non si è attivata, voglio il rimborso](#ho-pagato-ma-la-macchina-non-si-è-attivata-voglio-il-rimborso)
- [Ho messo monete nell'asciugatrice ma non aggiunge minuti](#ho-messo-monete-nellasciugatrice-ma-non-aggiunge-minuti)
- [I panni sono usciti sporchi e puzzano, voglio un rimborso](#i-panni-sono-usciti-sporchi-e-puzzano-voglio-un-rimborso)
- [Voglio la fattura del lavaggio](#voglio-la-fattura-del-lavaggio)

### Consigli di lavaggio

- [Ho una camicia bianca macchiata, a che temperatura la posso lavare?](#ho-una-camicia-bianca-macchiata-a-che-temperatura-la-posso-lavare)
- [A che temperatura lavo i colorati?](#a-che-temperatura-lavo-i-colorati)
- [Ho una macchia di grasso, come la tolgo?](#ho-una-macchia-di-grasso-come-la-tolgo)
- [Devo portare il detersivo?](#devo-portare-il-detersivo)
- [Posso lavare piumoni e coperte?](#posso-lavare-piumoni-e-coperte)
- [Quanto dura un lavaggio?](#quanto-dura-un-lavaggio)

### Dati per sede

- [Quali sono gli orari?](#quali-sono-gli-orari)
- [Quanto costa lavare?](#quanto-costa-lavare)
- [Si può pagare con la carta?](#si-può-pagare-con-la-carta)
- [Che programmi ha la lavatrice?](#che-programmi-ha-la-lavatrice)
- [Come funziona la tessera fedeltà?](#come-funziona-la-tessera-fedeltà)
- [Quanto risparmio con la tessera?](#quanto-risparmio-con-la-tessera)
- [Dove si trova la lavanderia più vicina?](#dove-si-trova-la-lavanderia-più-vicina)

---

## La mia lavatrice non parte

> Schermo `OPEN` (la porta non chiude PRIMA di lavare). Se dopo aver risistemato i panni il messaggio persiste, di solito è **sovraccarico**: suggerire di togliere qualche capo e ridistribuire la carica prima di scalare. (NON vale per `OPEN ERROR`, dove il ciclo è già finito.)

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

## La lavatrice mostra ERR-01

**Cliente:** Sono a Mataró, lavatrice 6 con ERR-01.

**Bot:** Hai premuto il programma prima di pagare. Ripartiamo da capo:

1. Carica i panni e chiudi bene la porta.
2. Vai al totem di pagamento, paga e seleziona il numero della tua macchina.
3. Torna alla macchina e premi il programma.

Dimmi se parte.

**Cliente:** Adesso parte.

**Bot:** Perfetto! Buon lavaggio 👋

---

## La lavatrice mostra ALERT o BLOCK

**Cliente:** Sant Cugat, lavatrice 4, esce ALERT.

**Bot:** La macchina ha rilevato un'anomalia e ha bisogno di assistenza. Sposta i panni in un'altra lavatrice libera e dimmi quale hai scelto. La attiviamo da remoto così puoi lavare senza costi aggiuntivi.

**Cliente:** Adesso sono sulla lavatrice 2.

**Bot:** Grazie. Come ti chiami? Passo il caso a un operatore per attivarti la 2 e registrare l'anomalia sulla 4.

**Cliente:** Andrea.

**Bot:** Ho registrato il caso, Andrea. Un operatore ti contatterà entro pochi minuti. Il chatbot rimane in attesa del supporto umano.

---

## Ho pagato ma la macchina non parte

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

**Bot:** Ho registrato il caso, Marta. Un operatore ti contatterà entro pochi minuti. Il chatbot rimane in attesa del supporto umano.

---

## La porta non si apre, il lavaggio è già finito

> Schermo tipico: `OPEN ERROR`. Diverso da `OPEN:` (porta che non chiude PRIMA del lavaggio). Vale identico per lavatrice e asciugatrice: i panni sono già processati e intrappolati dentro — non si propone mai di cambiare macchina né di rilavare/riasciugare. È un caso URGENTE.
>
> 🚨 Disambiguazione: se il cliente dice solo «non si apre» senza precisare, CHIEDI prima se il ciclo è già finito con i panni dentro: sì → `OPEN ERROR`; non ancora / non chiude per partire → `OPEN:`.

**Cliente:** La porta non si apre, il lavaggio è già finito.

**Bot:** Tranquilla. Quando il ciclo finisce, la porta impiega qualche minuto per sbloccarsi. Da quanto tempo è finito il lavaggio?

**Cliente:** Più di 5 minuti.

**Bot:** Tira la maniglia con decisione, a volte serve un po' più di forza. Si è aperta?

**Cliente:** No, è ancora bloccata.

**Bot:** In quale lavanderia ti trovi?

**Cliente:** Gràcia.

**Bot:** Che numero ha la lavatrice?

**Cliente:** La 2.

**Bot:** Come ti chiami? Passo il caso con priorità a un operatore per sbloccare la porta da remoto.

**Cliente:** Luis.

**Bot:** Ho registrato il caso, Luis. Un operatore ti contatterà entro pochi minuti. Il chatbot rimane in attesa del supporto umano.

---

## L'asciugatrice non scalda

**Cliente:** L'asciugatrice non scalda, i minuti passano ma i panni restano bagnati.

**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Terrassa.

**Bot:** Che numero ha l'asciugatrice?

**Cliente:** La 5.

**Bot:** Come ti chiami? Passo il caso a un operatore per rimborsare il ciclo e controllare la macchina.

**Cliente:** Anna.

**Bot:** Ho registrato il caso, Anna. Un operatore ti contatterà entro pochi minuti. Il chatbot rimane in attesa del supporto umano.

---

## Mi avete addebitato due volte sulla carta

**Cliente:** Mi avete addebitato due volte sulla carta.

**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Eixample.

**Bot:** Che numero ha la macchina?

**Cliente:** La 1.

**Bot:** Mi dici le ultime 4 cifre della carta e il tuo nome? Passo il caso a un operatore per verificare il doppio addebito.

**Cliente:** Carta 8821, sono Jordi.

**Bot:** Ho registrato il caso, Jordi. Un operatore ti contatterà entro pochi minuti. Il chatbot rimane in attesa del supporto umano.

---

## Ho pagato ma la macchina non si è attivata, voglio il rimborso

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

## Ho messo monete nell'asciugatrice ma non aggiunge minuti

**Cliente:** Ho messo monete nell'asciugatrice ma i minuti non aumentano.

**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Rubí.

**Bot:** Che numero ha l'asciugatrice?

**Cliente:** La 3.

**Bot:** Come ti chiami? Passo il caso a un operatore per restituire i soldi e controllare la macchina.

**Cliente:** Mireia.

**Bot:** Ho registrato il caso, Mireia. Un operatore ti contatterà entro pochi minuti. Il chatbot rimane in attesa del supporto umano.

---

## I panni sono usciti sporchi e puzzano, voglio un rimborso

**Cliente:** I panni sono usciti sporchi e puzzano dopo il lavaggio, voglio un rimborso.

**Bot:** Mi dispiace. In quale lavanderia ti trovi?

**Cliente:** Eixample.

**Bot:** Lavatrice o asciugatrice?

**Cliente:** Lavatrice, la 3.

**Bot:** Come ti chiami?

**Cliente:** Marta.

**Bot:** Ho registrato il caso, Marta. Un operatore ti contatterà entro pochi minuti per valutare il caso e il rimborso.

---

## Voglio la fattura del lavaggio

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

## Ho una camicia bianca macchiata, a che temperatura la posso lavare?

**Cliente:** Ho una camicia bianca macchiata, a che temperatura la posso lavare per non rovinarla?

**Bot:** Per una camicia bianca con macchie:

- **Cotone resistente**: 40°C (fino a 60°C se la macchia è molto ostinata)
- **Tessuti delicati** (seta, lana, misti fini): 30°C

Sopra i 40°C su tessuti delicati rischi di fissare la macchia. Seleziona il programma corrispondente sul display della macchina — il detersivo viene dosato in automatico.

---

## A che temperatura lavo i colorati?

**Cliente:** A che temperatura lavo i colorati?

**Bot:** Regola generale per i colorati:

- **Colori scuri / neri**: 30°C (evita la perdita di colore)
- **Colori chiari**: 30-40°C
- **Colori resistenti con macchie**: fino a 40°C

Mai lavare i colorati sopra i 40°C la prima volta: il colore rilascia di più quando è nuovo.

---

## Ho una macchia di grasso, come la tolgo?

**Cliente:** Ho una macchia di grasso su una camicia, come la tolgo?

**Bot:** Prima assorbi l'eccesso con carta da cucina senza strofinare (strofinare allarga la macchia). Poi seleziona:

- **Cotone**: 60°C
- **Sintetici o delicati**: 40°C

Il detersivo Demowash include un componente sgrassante che viene dosato in automatico.

---

## Devo portare il detersivo?

**Cliente:** Devo portare il detersivo?

**Bot:** No, non serve portare niente! Le macchine Demowash **dosano in automatico** detersivo e ammorbidente ecologici certificati, fatti con ingredienti 100% naturali. Devi solo portare i panni. 😊

---

## Posso lavare piumoni e coperte?

**Cliente:** Posso lavare piumoni e coperte?

**Bot:** Sì, puoi lavarli! Questi i consigli:

Piumoni e coperte in cotone o poliestere resistente:

- Temperatura: 40°C
- Capacità: usa una lavatrice da 20 kg per piumoni grandi
- Dopo il lavaggio: asciugatrice ad alta o media temperatura per eliminare bene l'umidità

Piumoni delicati o con imbottitura sintetica:

- Temperatura: 30°C

Consigli:

- Non sovraccaricare la macchina — il piumone ha bisogno di spazio per muoversi bene
- Dopo il lavaggio il piumone uscirà molto bagnato: passalo in asciugatrice per finire

Se vuoi sapere quali macchine grandi ci sono e i prezzi esatti, dimmi in quale lavanderia sei. 😊

---

## Quanto dura un lavaggio?

**Cliente:** Quanto dura un lavaggio?

**Bot:** La durata dipende dal programma che scegli:

- 60°C (molto caldo): 50-55 minuti
- 40°C (caldo): 45-50 minuti
- 30°C (tiepido): 40-45 minuti
- Freddo (*): 35-40 minuti

Sono tempi approssimativi. Durante il ciclo vedrai sullo schermo il conto alla rovescia del tempo restante (es. `T-28` significa 28 minuti). 😊

---

## Quali sono gli orari?

**Cliente:** Quali sono gli orari?

**Bot:** In quale lavanderia ti trovi?

**Cliente:** Gràcia.

**Bot:** A **Gràcia** siamo aperti dalle **7:00 alle 23:00**, tutti i giorni.

---

## Quanto costa lavare?

**Cliente:** Quanto costa lavare?

**Bot:** In quale lavanderia ti trovi?

**Cliente:** Eixample.

**Bot:** A **Eixample** questi sono i prezzi della lavatrice:

- Macchina 1 (20 kg): 7 € con tessera fedeltà / 8 € in contanti
- Macchina 2 (20 kg): 7 € con tessera fedeltà / 8 € in contanti
- Macchina 3 (10 kg): 4 € con tessera fedeltà / 4,50 € in contanti
- Macchina 4 (10 kg): 4 € con tessera fedeltà / 4,50 € in contanti

Vuoi anche i prezzi dell'asciugatrice?

---

## Si può pagare con la carta?

**Cliente:** Si può pagare con la carta?

**Bot:** In quale lavanderia ti trovi?

**Cliente:** Gràcia.

**Bot:** A **Gràcia** si accetta solo **carta di credito/debito**. Non ci sono contanti né tessera fedeltà in questa sede.

---

## Che programmi ha la lavatrice?

**Cliente:** Che programmi ha la lavatrice?

**Bot:** In quale lavanderia ti trovi?

**Cliente:** Eixample.

**Bot:** A **Eixample** la lavatrice ha 4 programmi:

- Tasto 1 — Molto caldo — 60°C
- Tasto 2 — Caldo — 40°C
- Tasto 3 — Tiepido — 30°C
- Tasto 4 — Freddo — (*)

L'asciugatrice ne ha 3: alta, media e bassa temperatura.

---

## Come funziona la tessera fedeltà?

**Cliente:** Come funziona la tessera fedeltà?

**Bot:** Con la tessera fedeltà paghi **meno** che con contanti o carta — lo sconto si applica in automatico su ogni lavaggio e asciugatura.

In quale lavanderia ti trovi? Ti confermo se la accettiamo lì e ti passo i prezzi.

**Cliente:** Eixample.

**Bot:** A **Eixample** sì, accettiamo la tessera fedeltà. Questi sono i prezzi:

- Lavatrice 1-2 (20 kg): 7 €
- Lavatrice 3-4 (10 kg): 4 €
- Asciugatrice 5-6 (20 kg): 2,50 €

---

## Quanto risparmio con la tessera?

**Cliente:** Quanto risparmio con la tessera?

**Bot:** Per dirti il risparmio esatto, in quale lavanderia ti trovi?

**Cliente:** Rubí.

**Bot:** A **Rubí** il risparmio con la tessera fedeltà è:

Lavatrici:

- Macchina 1 (10 kg): 0,50 € di risparmio (4,50 € con tessera vs 5 € in contanti)
- Macchina 2 (15 kg): 1 € di risparmio (6 € con tessera vs 7 € in contanti)
- Macchina 3 (20 kg): 1 € di risparmio (7 € con tessera vs 8 € in contanti)

Asciugatrici (macchine 4 e 5, 20 kg): stesso prezzo con tessera o in contanti (2 € / 15 min).

💡 Se usi la lavatrice grande (macchina 3) abitualmente, la tessera si ammortizza in pochi utilizzi. 😊

---

## Dove si trova la lavanderia più vicina?

**Cliente:** Dove si trova la lavanderia più vicina?

**Bot:** In che zona sei? Ti passo i dati della sede più comoda.

**Cliente:** Sono a Barcellona.

**Bot:** A Barcellona abbiamo due sedi Demowash:

1. **Eixample** — C/ Aragó 286, vicino a Passeig de Gràcia. Orario: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, vicino a Plaça del Sol. Orario: 7:00 — 23:00

In quale delle due sei, o quale ti interessa? 😊

---
