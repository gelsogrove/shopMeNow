# Chatbot Ecolaundry — Panoramica tecnica

**Documento tecnico** — descrive l'architettura, le capacità del sistema e le aree funzionali del chatbot Ecolaundry.
**Non costituisce offerta commerciale**: pricing, SLA, tempistiche, modalità contrattuali e di rilascio sono oggetto di documento separato e non sono trattati in questa panoramica.

**Data**: 2026-05-15

---

## 1. Overview

Ecolaundry gestisce una catena di lavanderie self-service su sette sedi (Goya, Pineda, Hortes, Mataró, Alemanya, Platja d'Aro, L'Escala) con macchine HS60xx e ED340.

La proposta è un assistente virtuale conversazionale, già implementato e validato, che gestisce in autonomia i 32 casi d'uso del playbook Ecolaundry: incidenti tecnici (PUSH PROG, DOOR, SEL, AL001, ERR), problemi di pagamento (doppio addebito, cambio non restituito, codici sconto), informazioni operative (orari, prezzi per sede, tessera fidelizzazione, fatture) e escalation strutturata all'operatore umano.

Il bot **non sostituisce** l'operatore: lo integra. Risolve i casi standard in pochi secondi e, quando serve intervento umano, raccoglie tutti i dati rilevanti e produce un briefing pronto per il back-office.

---

## 2. Architettura LLM

Ecolaundry ha **32 casi d'uso documentati**, ciascuno con sotto-casi (es. doppio addebito con 2 rami, fatture con 10 step di raccolta dati, display che cambia mid-conversazione, cliente arrabbiato, racconto contraddittorio), potenzialmente in 6 lingue. Gestire questa complessità con un unico prompt LLM "monolitico" sarebbe fragile, costoso e difficile da debuggare.

Per questo abbiamo sviluppato un'**architettura LLM in cascata**: invece di un'unica chiamata gigante al modello, usiamo più chiamate piccole e focalizzate, ciascuna con un ruolo preciso. Per ogni messaggio del cliente:

1. **LLM Router** — un primo modello legge il messaggio e **capisce l'intento** del cliente, classificandolo in uno dei rami noti: saluto, FAQ, problema macchina, fattura, tessera fidelizzazione, escalation.
2. **Guard di raccolta dati** — un livello deterministico (codice, non LLM) **raccoglie le informazioni necessarie** per il caso identificato: sede, tipo macchina, numero, codice display, dati di pagamento. Se manca un dato lo chiede al cliente, con retry strutturato (3 tentativi → escalation automatica all'operatore).
3. **Redirect alla configurazione del caso** — il sistema instrada la conversazione verso il **flow specifico** del caso, descritto in file JSON modificabili dal back-office. A passi guidati si conduce il cliente verso la risoluzione, gestendo le sotto-casistiche.
4. **LLM di polish** — un secondo modello LLM riformula la risposta finale per renderla **naturale e in tono** con il cliente, preservando tutti i dati strutturati raccolti.

**Modello**: OpenRouter / `openai/gpt-4o-mini` (configurabile per tenant). **Latenza per turno**: 1-2 secondi.

Tre vantaggi concreti della cascata: (1) ogni step è testabile in isolamento → **maggiore affidabilità delle risposte**; (2) la complessità è gestita in modo modulare → **nuovi casi e nuove lingue si aggiungono senza riscrivere il sistema**; (3) i dati sensibili non passano mai dal LLM → **privacy strutturale e conformità GDPR**.

**Principi architetturali**:

1. **Niente regole nel prompt**: ogni comportamento è codificato nel codice. Quando il bot sbaglia, il fix è deterministico — non aggiungiamo regole "non fare X" al prompt LLM. Evita la deriva tipica dei sistemi puramente prompt-based.
2. **Multi-lingua per costruzione**: supporto a 6 lingue (es, it, en, ca, pt, fr) senza riscrivere logica.
3. **Privacy PII**: i dati per fatturazione, le cifre della carta e gli identificativi personali del cliente **non vengono mai inviati al LLM esterno** — bypass deterministico locale.
4. **Idempotenza e tracciabilità**: ogni transizione di stato è atomica e loggata. Reset automatico sessione dopo 1 ora di inattività.

---

## 3. Amministrazione

Il bot è solo metà della soluzione. L'altra metà è il **back-office Ecolaundry**, dove l'operatore gestisce ciò che il bot non può o non deve fare in autonomia.

### 3.1 Fatturazione (Caso 9)

Quando il cliente richiede una fattura, il bot raccoglie in 10 step deterministici tutti i dati fiscali:

1. Sede
2. Ragione sociale
3. Indirizzo fiscale
4. CIF/NIF
5. Tipo macchina
6. Numero macchina
7. Data del servizio
8. Costo totale del servizio
9. Email di destinazione
10. Note/osservazioni
11. Nome del cliente

Al termine, l'operatore riceve nel back-office un **briefing strutturato** con tutti i dati pronti per l'emissione della fattura. L'email dell'inbox fatture è configurabile (oggi: `olga@alberwaz.net`).

### 3.2 Blocco utenti

Il back-office permette di:
- **Bloccare un cliente** per numero di telefono / identificativo WhatsApp — il bot smette di rispondere a quel numero
- **Lista nera per workspace** in caso di abusi o tentativi di frode ripetuti
- **Whitelist temporanea** per test interni o clienti VIP
- **Reset manuale di una sessione** se lo stato è inconsistente

### 3.3 Presa in carico operatore

Quando il bot escala (cliente arrabbiato, rimborso richiesto, problema fuori dal playbook, tre tentativi falliti su una stessa domanda), l'operatore vede nel back-office:
- Riepilogo conversazione completo
- Tutti i dati raccolti (sede, macchina, display, pagamento, foto se presenti)
- Sequenza dei display visti (per i casi "maratona")
- Motivo strutturato dell'escalation

L'operatore può:
- **Subentrare nella conversazione** scrivendo al cliente in tempo reale via WhatsApp (il bot resta in silenzio fino a chiusura)
- **Chiudere il caso** con una nota
- **Riassegnare** a un altro operatore

### 3.4 Pagamenti e formulari di rimborso

Per i casi di doppio addebito o cambio non restituito, il bot raccoglie le **ultime 4 cifre della carta** + **importo + data** del datáfono e produce un formulario di rimborso pre-compilato (URL `forms.gle/...` configurabile). Le cifre della carta non passano mai dal LLM.

### 3.5 Cambio provider WhatsApp (3 provider supportati)

Il sistema è agnostico rispetto al provider WhatsApp. Oggi gestiamo:

- **Meta WhatsApp Business API** (ufficiale)
- **UltraMsg** (provider terzo, fallback rapido)
- **WhatsApp Cloud / Twilio** (provider alternativo)

In caso di disservizio del provider attivo (rate limit, downtime, blocco account), lo **switch su un provider alternativo è supportato dall'architettura** — la configurazione è centralizzata, lo storico cliente è preservato. Tempi e modalità operative dello switch dipendono dal provider di destinazione.

---

## 4. Sicurezza & Privacy

### 4.1 I dati personali non passano dall'AI

Punto chiave da rinforzare con il cliente:

- **I messaggi viaggiano via WhatsApp con cifratura end-to-end nativa** (la stessa protezione di una chat normale tra utenti)
- I 10 campi fiscali del **Caso 9 (fatture)** sono raccolti con **regex deterministiche**, **senza passare dal modello LLM esterno**
- Le **4 cifre della carta** del Caso 6 (doppio addebito) non toccano mai il LLM
- Conseguenza: anche nello scenario peggiore (compromissione del provider LLM), i dati fiscali e di pagamento dei clienti Ecolaundry **non sarebbero esposti**. Conformità GDPR strutturale, non solo formale.

### 4.2 Sicurezza della piattaforma

- **2FA TOTP** per accesso back-office operatori e admin
- **QR Code** per login rapido alla piattaforma
- **Token JWT** con ciclo di refresh + scadenza automatica
- **Firma HMAC SHA256** sui webhook in entrata (validazione provenienza da Meta)
- **De-duplicazione webhook** — nessun messaggio elaborato due volte se il provider rispedisce
- **API rate limit** per cliente/workspace — protezione da abusi e attacchi
- **Audit log** completo: ogni messaggio, ogni transizione di stato, ogni intervento operatore è tracciato
- **Coda di uscita WhatsApp** con cooldown configurabile (oggi 6 secondi) — evita rate-limit del provider

### 4.3 Hosting

- **Default**: hosting cloud su infrastruttura europea (conformità GDPR)
- **On-premise / server dedicato del cliente**: tecnicamente fattibile, da valutare caso per caso in base all'infrastruttura del cliente — **trattato in documento separato**

---

## 5. Funzionalità business aggiuntive

- **Multi-workspace** — un cliente può gestire più sedi o brand sotto lo stesso account (utile in caso di franchising o espansione)
- **Multi-canale** — stesso bot su **WhatsApp + widget web sul sito + Telegram**, conversazioni unificate
- **Modulo campagne push** — notifiche promozionali a liste clienti segmentate
- **Multi-lingua pronta** — oggi spagnolo attivo; italiano, inglese, catalano, portoghese, francese attivabili senza redeploy
- **FAQ editabili dal back-office** (estensione roadmap) — il cliente potrà aggiungere/modificare risposte senza intervento tecnico

---

## 6. Garanzia di qualità

- **32 casi d'uso documentati** dal playbook Ecolaundry — ogni caso ha test di regressione
- **Protocollo strutturato** per intake di nuove richieste e bug (4-source verification: PDF playbook ↔ spec interna ↔ codice ↔ comportamento bot reale)
- **Verifica architetturale automatica** ad ogni rilascio (10 regole ferree non negoziabili)

---

## 7. Fasi tecniche proposte

Le fasi seguenti descrivono l'**evoluzione tecnica** del progetto. Durata, modalità di esecuzione e responsabilità di ciascuna fase sono oggetto di accordo separato.

1. **Conferma del perimetro** dei 32 casi d'uso del playbook
2. **Verifica dati per sede** (orari, prezzi, inventario macchine, contatti) — già caricati ma da rivedere insieme
3. **Pilota tecnico** su una sede singola (suggerito: Goya o Pineda)
4. **Rollout graduale** sulle altre sedi
5. **Definizione dashboard analytics** con il cliente — quali metriche monitorare, chi ha accesso, quali viste servono al management
6. **Estensione multi-lingua** dopo stabilizzazione spagnola
7. **Valutazione hosting on-premise** se richiesto dal cliente

---

*Documento tecnico di lavoro. Gli aspetti commerciali — pricing, SLA contrattuali, tempistiche, modalità di rilascio e di supporto — non sono trattati in questa panoramica e saranno formalizzati in documento separato.*
