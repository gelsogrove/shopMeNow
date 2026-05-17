
# Chatbot Ecolaundry — Panoramica tecnica

## 1. Panoramica

La proposta è un assistente virtuale conversazionale su WhatsApp, che gestisce in autonomia i casi d'uso del playbook Ecolaundry: incidenti tecnici (PUSH PROG, DOOR, SEL, AL001, ERR), problemi di pagamento (doppio addebito, cambio non restituito, codici sconto), informazioni operative (orari, prezzi per sede, tessera fidelizzazione, fatture) e escalation strutturata all'operatore umano tramite mail o whatsapp.


Il bot **non sostituisce** l'operatore: lo integra. Risolve i casi standard in pochi secondi e, quando serve intervento umano, raccoglie tutti i dati rilevanti e produce un briefing pronto per il back-office dove l'operatore puo' decidere se chiamare oppure chattare tramite il pannello di controllo dedicato

Lingue supportate: **italiano, spagnolo, inglese, catalano, francese**.

### Benefici principali

- **Disponibile 24/7** — risponde ai clienti in qualsiasi orario, senza costi aggiuntivi
- **Tempi di risposta immediati** — nessuna attesa in coda, il cliente riceve aiuto in pochi secondi
- **Meno carico per l'operatore** — i casi standard vengono risolti in autonomia; l'operatore interviene solo quando serve davvero
- **Briefing strutturato** — quando il bot scala all'operatore, porta già tutti i dati raccolti: sede, macchina, problema, nome cliente
- **Multilingua** — gestisce clienti in 5 lingue senza configurazioni aggiuntive
- **Tracciabilità completa** — ogni conversazione è registrata e consultabile dal back-office
- **On-premise** — il sistema gira sull'infrastruttura del cliente e non ha costi di hosting  cosi da poter garantire  che i dati dei clienti non escano in mano a terzi (ovviamente tranne il servizio di whtaspp business necessario per inviare il messaggio)

---

## 2. Architettura LLM

Per gestire i casi d'uso  e le 5 lingue, abbiamo sviluppato un'**architettura a cascata**: più chiamate LLM focalizzate invece di un unico prompt monolitico fragile e costoso.

Per ogni messaggio del cliente:

1. **LLM Router** — classifica l'intento (saluto, FAQ, problema macchina, fattura, tessera, escalation).
2. **Guard deterministici** — raccolgono i dati necessari (sede, tipo macchina, numero, display, dati di pagamento) tramite codice, non LLM. Se manca un dato lo chiedono al cliente, con retry strutturato (3 tentativi → escalation automatica).
3. **Flow specifico del caso** — guida il cliente a passi, configurato in file JSON modificabili dal back-office.
4. **LLM di polish** — riformula la risposta finale in tono naturale, preservando tutti i dati strutturati.

**Modello**: `gpt-4o-mini`

### Allucinazioni

I modelli LLM possono produrre risposte imprecise — è un limite noto della tecnologia, le chat vengono monitorizzate e in caso di errori "gravi" provvediamo con un fix

---

## 3. Pannello di amministrazione

Il back-office web (accessibile da browser) permette al team Ecolaundry di:

- Visualizzare in tempo reale le conversazioni WhatsApp attive
- Intervenire manualmente e chattare direttamente con i clienti
- Bloccare utenti di spam
- Configurare le notifiche
- Condividere il workspace con altri utenti

---

## 4. Sicurezza & Privacy

### Sicurezza della piattaforma

- **HTTPS/TLS** su tutte le comunicazioni (back-office, API, webhook)
- **2FA TOTP** per accesso back-office
- **Token JWT** con refresh automatico
---

## 5. Tecnologia

| Componente | Tecnologia |
|---|---|
| Backend API | Node.js / Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Frontend back-office | React 18 + Vite |
| Modello AI  `gpt-4o-mini` |
| Infrastruttura | On-premise |
| Autenticazione | JWT + 2FA |
| WhatsApp | Meta Business API |

---

## 6. Prezzi

| Voce | Importo |
|---|---|
| Sviluppo chatbot V1 | **2.500 €** |
| Setup on-premise configurazione iniziale | **1.000 €** |
| Assistenza mensile | **100 €** |
| Consumo messaggi | **0,05 € / per msg** |

## 6.1 Feature
| Voce | Importo |
|---|---|
| Send and receive file (image/pdf) | **1.000 €** |
| Receive Audio | **1.000 €** |
| Transalation human message to the user language | **1.000 €** |

Il canone mensile include:

- **Monitoraggio** — revisione periodica delle conversazioni per individuare anomalie e risposte errate
- **Correzione bug** — fix su casistiche problematiche emerse in produzione
- **Aggiornamenti configurazione** — modifica di orari, prezzi, sedi e nuove casistiche nei file di configurazione
- **Supporto tecnico** — canale diretto per segnalare problemi e ricevere assistenza
- **Aggiornamenti di sicurezza** — patch e aggiornamenti dell'infrastruttura

Non include lo sviluppo di nuove funzionalità major, che vengono quotate separatamente.

---

## 7. Cosa non prevede l'offerta

- Il chatbot in questa versione non invia né riceve immagini o audio
- Il chatbot in questa versione non si collega a fonti di dati esterne
- il chatbot in queta cersione non prevede piu di 5 lingue
- Il pannello di controllo non invia immagini o documenti


---

## 8. Da definire

- Modalità di registrazione del cliente (accesso diretto o registrazione obbligatoria)
- Definizione dei casi d'uso specifici per singola lavanderia (al momento prezzi e orari sono già differenziati per sede; da valutare ulteriori casistiche isolate)
- Tipo di statistiche da visualizzare nel pannello di controllo
- Da definire se il chatbot viene disattivato quando l'utente chiede supporto operatore
