# Piano — Allegati (immagini / PDF) in chat: invio e ricezione

**Obiettivo (Andrea)**: il sistema deve poter **inviare e ricevere file** (immagini e PDF), sia nella **demo/playground** sia nella **chat operatore**, sia in **entrata** che in **uscita**, su **WhatsApp e widget**. Se è un'immagine → anteprima/popup immagine; se è un PDF → anteprima PDF. Gestire allineamento (sinistra/destra), limiti WhatsApp, storage, ciclo di vita dei file (cancellazione a cascata), test. E capire cosa manca.

> Stato: **piano**, nessun codice ancora scritto. Le righe e i path sotto sono quelli reali del repo (mappati il 2026-06-02).

---

## 0. TL;DR — cosa c'è già e cosa manca

| Pezzo | Stato oggi | Lavoro |
|---|---|---|
| **Invio media via provider** (Meta, UltraMsg, Wasender) | ✅ **Già implementato**: `WhatsAppProvider.sendMediaMessage(to, mediaUrl, caption?, mediaType)` esiste in tutti e 3 i provider | Riusare, non riscrivere |
| **Storage file** | ✅ **Già configurato**: Cloudinary (prod) + `./uploads` (dev), `multer` + `multer-storage-cloudinary`, `storage.service.ts` auto-switch | Estendere a PDF + nuova "category" chat |
| **Pattern attachment in DB** | ✅ Esiste `SupportAttachment` (url + `storageKey` + mimeType + size, `onDelete: Cascade`) come modello di riferimento | Replicare per i messaggi chat |
| **Ricezione media (inbound)** | ❌ **NON gestita**: i webhook estraggono solo la caption o mettono `[image message]`. Nessun download, nessun media-id, nessun salvataggio | **Il grosso del lavoro è qui** |
| **Invio media dall'operatore** | ❌ `WhatsAppDirectSendService.send()` chiama solo `sendTextMessage()` | Aggiungere percorso media |
| **FE: rendering allegati + popup** | ❌ Solo testo/markdown; esiste `MessageRenderer` con pattern modale (YouTube) e componenti upload (`react-dropzone`) | Nuovo rendering bubble + lightbox |
| **FE: icona attachment nel composer** | ❌ Solo `<Textarea>` + bottone Send | Nuovo bottone 📎 + preview pre-invio |
| **Modello `Message` con allegati** | ❌ Solo `content` + `type` enum (TEXT/IMAGE/DOCUMENT già nell'enum) | Nuovo modello `MessageAttachment` |

**Conclusione**: ~40% dell'infrastruttura esiste. Il lavoro pesante è (1) **inbound media pipeline**, (2) **modello dati + ciclo di vita**, (3) **FE rendering + composer**, (4) **send media dall'operatore**.

---

## 1. Formati e limiti WhatsApp (risposta diretta alla domanda)

Limiti **Cloud API Meta** (i provider terzi UltraMsg/Wasender si allineano a questi, a volte più stretti):

| Tipo | Formati accettati | Limite dimensione |
|---|---|---|
| **Immagini** | `image/jpeg`, `image/png` (PNG viene ri-codificato in JPEG, -70/80% peso) | **5 MB** |
| **Documenti** | **`application/pdf`**, doc(x), ppt(x), xls(x), txt, csv | **100 MB** |
| Audio | aac, mp3, m4a, amr, ogg(opus) | 16 MB |
| Video | mp4, 3gp (codec H.264 + AAC) | 16 MB |
| Sticker | webp | 100 KB statico / 500 KB animato |

Per il nostro caso (immagini + PDF) i due numeri che contano sono **immagini ≤ 5 MB** e **PDF ≤ 100 MB**.

**Note critiche** (vedi anche §11):
- **I media inbound restano sui server WhatsApp solo 14 giorni** e vanno scaricati tramite `media_id` entro quella finestra → noi li ri-archiviamo subito su Cloudinary.
- **Le immagini vengono ricompresse** da WhatsApp: non aspettarti il file bit-identico.
- WhatsApp **non** ha un singolo messaggio multi-allegato: N file = **N messaggi/webhook separati** (vedi §6.1, debounce).

Fonti in fondo al documento.

---

## 2. Modello dati (database-first, come da CLAUDE.md)

Nuovo modello in `packages/database/prisma/schema.prisma`, sul pattern di `SupportAttachment` (già nel repo, righe ~1927-1940):

```prisma
model MessageAttachment {
  id          String   @id @default(uuid())
  messageId   String
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  workspaceId String                                  // isolamento multi-tenant (regola #2)
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  kind        AttachmentKind   // IMAGE | DOCUMENT
  url         String           // URL Cloudinary (o /uploads in dev)
  storageKey  String           // public_id Cloudinary → per la cancellazione
  mimeType    String           // "image/jpeg" | "application/pdf"
  filename    String?          // nome originale (per i PDF)
  sizeBytes   Int
  width       Int?             // immagini
  height      Int?

  // Provenienza media WhatsApp (per audit / ri-download entro 14gg se serve)
  waMediaId   String?
  createdAt   DateTime @default(now())

  @@index([messageId])
  @@index([workspaceId])
  @@map("message_attachments")
}

enum AttachmentKind { IMAGE DOCUMENT }
```

`Message` guadagna la relazione inversa `attachments MessageAttachment[]` e riusiamo l'enum `MessageType` (già contiene `IMAGE`, `DOCUMENT`).

> **Perché `onDelete: Cascade`**: quando un `Message` viene cancellato, il record attachment sparisce in automatico dal DB. Ma il **file su Cloudinary NON si cancella da solo**: va eliminato esplicitamente via `storageKey` (vedi §9). Questo è il punto chiave della domanda "quando si cancellano chat o clienti si devono cancellare anche i file".

---

## 3. Storage — il "terzo provider di immagini" è **Cloudinary**

È già nel repo: `cloudinary@1.41.3`, `multer-storage-cloudinary`, `storage.service.ts` (auto-switch local↔Cloudinary), config in `.env.example` (`CLOUDINARY_*`, `UPLOADS_DIR`). Free tier 25 GB.

Estensioni necessarie:
- Nuova **category/folder** dedicata, es. `chat-attachments/<workspaceId>/<sessionId>/`, così la cancellazione per-cliente/per-chat è una `delete by prefix`.
- Abilitare i **PDF** in `uploadMiddleware.ts` (oggi limita a immagini, 10 MB) → aggiungere `application/pdf` e alzare il cap a 100 MB **per i soli documenti** (immagini restano a 5 MB, allineate a WhatsApp).
- **URL firmati / accesso privato** per i media dei clienti (sono PII, vedi §11): i file chat NON devono essere pubblici e indicizzabili. Usare la category "private" già servita da `files.routes.ts` (`GET /api/v1/files/private/...`) oppure Cloudinary signed URLs.

**Spazio**: con 25 GB free, ricomprimendo le immagini e con un retention policy (vedi §9) lo spazio non è un problema a breve. Se cresce → upgrade Cloudinary o spostamento su S3 (lo `storage.service.ts` è già un'astrazione, quindi sostituibile).

---

## 4. Backend — INBOUND (la parte che manca davvero)

Oggi i 3 webhook (`whatsapp-webhook.controller.ts` Meta, `ultramsg-webhook.controller.ts`, `wasender-webhook.controller.ts`) chiamano `extractMessageText()` che per i media ritorna solo la caption o `[image message]`. Va aggiunta una **media ingestion pipeline**:

```
webhook riceve messaggio con media
  → riconosce type ∈ {image, document}            (oggi già rilevato, ma scartato)
  → estrae il riferimento media specifico per provider:
        Meta:     media_id  → GET /{media_id} (Graph) → media URL → download (con Bearer)
        UltraMsg: media URL diretto nel payload → download
        Wasender: media URL/base64 nel payload → download
  → valida mime + size (whitelist: image/jpeg, image/png, application/pdf; ≤ limiti)
  → upload su Cloudinary (category privata chat-attachments/<ws>/<session>)
  → crea Message(direction=INBOUND, type=IMAGE|DOCUMENT, content=caption||'')
         + MessageAttachment(url, storageKey, mime, size, waMediaId, workspaceId)
  → prosegue il flusso normale (inoltro al bot / coda operatore)
```

Punti di attenzione:
- **Astrazione provider**: aggiungere `downloadInboundMedia(payload)` all'interfaccia `WhatsAppProvider` (parallela a `sendMediaMessage`), così ogni provider implementa il proprio modo di recuperare il binario. Tiene il codice pulito (un solo punto di branch per provider).
- **Caption**: la didascalia del cliente diventa `Message.content`; l'allegato è separato.
- **Cosa passa al bot LLM**: NON i byte. Un descrittore tipo `[il cliente ha inviato 1 immagine]` + (eventuale OCR/vision in futuro, oggi NO). Questo è coerente con l'architettura demowash (logica nel prompt, side-effect nel codice): il file resta lato server, il bot decide solo l'intento ed eventualmente escala con l'allegato agganciato (vedi `escalate_to_operator`).

---

## 5. Backend — OUTBOUND (operatore che invia un file)

`sendMediaMessage()` **esiste già** per i 3 provider. Manca il percorso applicativo:
- Estendere `WhatsAppDirectSendService.send()` (oggi solo `sendTextMessage`) con un ramo media: dato un `attachmentId` (già caricato su Cloudinary), risolve l'`url` pubblico/firmato e chiama `provider.sendMediaMessage(to, url, caption, kind)`.
- Salvare il `Message(direction=OUTBOUND)` + `MessageAttachment` come per l'inbound.
- Rispettare billing/delivery status già presenti in `whatsapp-direct-send.service.ts`.
- **Provider-specific**: Meta accetta `link` (URL pubblico raggiungibile da Meta) **oppure** un `media_id` pre-caricato; UltraMsg/Wasender vogliono un **URL pubblico**. → Per gli outbound serve un URL **raggiungibile pubblicamente** dal provider (signed URL con TTL va bene). Questo è un vincolo da non dimenticare: i file "privati" per l'operatore devono comunque essere fetchabili dal provider al momento dell'invio.

---

## 6. Canali: WhatsApp **e** Widget (entrambi)

### 6.1 WhatsApp
- **Inbound**: pipeline §4. Ricorda che **multi-file = più webhook separati** in rapida successione → introdurre un **debounce ~8-15s per `sessionId`** che raggruppa gli allegati nello stesso "turno logico" (altrimenti il bot vede N messaggi scollegati).
- **Outbound**: §5 via provider attivo (`workspace.whatsappProvider`).

### 6.2 Widget (`echatbot.ai/chat` lato visitatore + demo/playground)
- Il widget **non passa da WhatsApp**: l'upload è una normale `POST multipart` al nostro backend (niente webhook, niente download da Meta, niente debounce — il browser può mandare più file in una richiesta).
- **Inbound widget**: `POST /api/v1/.../upload` → Cloudinary → `Message(INBOUND)` + attachment → polling FE che già esiste.
- **Outbound widget**: l'operatore invia → si salva il `Message(OUTBOUND)` + attachment; il widget fa polling e lo renderizza. **Nessun send WhatsApp** (il canale è `widget`).
- **Demo/playground** (`PlaygroundPage.tsx`, `POST /api/v1/playground/messages`): stesso meccanismo widget, ma è una sandbox → upload su category effimera con retention breve.

> Il discriminante è `ChatSession.channel` (`whatsapp` | `widget`) già presente nello schema: decide se l'outbound passa dal provider o resta interno.

---

## 7. Gating "se active = false → non riceve e non manda nulla"

Da chiarire **quale flag** (vedi domande aperte §13), ma il principio è uno solo: **la feature allegati rispetta esattamente lo stesso gate dei messaggi di testo**. Quando il canale/chatbot/workspace non è attivo:
- **Inbound**: il webhook NON processa il media (né download né upload né salvataggio) → si scarta come si scartano i messaggi oggi.
- **Outbound**: l'API di invio rifiuta con errore esplicito; nel FE l'icona 📎 è **disabilitata** (con tooltip "channel inactive").
- Candidati al flag: `workspace.isActive` / `whatsappProvider` non configurato / `customer.activeChatbot` / lo stato "Manual Operator Control" (`isChatbotActive`) visto nello screenshot. Da confermare quale governa cosa.

---

## 8. Frontend

### 8.1 Chat operatore — `apps/frontend/src/pages/ChatPage.tsx`
- **Allineamento** (già esiste, righe ~1800-1947): `sender === "user"` (operatore/bot) → **destra**; `sender === "customer"` → **sinistra**. Backend manda `direction INBOUND/OUTBOUND` → mappato a `sender`. Gli allegati seguono lo stesso identico criterio.
- **Rendering bubble**: estendere `MessageRenderer.tsx`:
  - immagine → thumbnail cliccabile → **lightbox** (riuso del pattern modale `Dialog` / `YouTubePlayerModal.tsx`);
  - PDF → card con icona + filename + "apri" → **viewer PDF** in `Dialog` (iframe/`<embed>` o `react-pdf`).
- **Composer + icona attachment** (richiesta UX di Andrea, righe ~1964-1997):
  - bottone **📎 `Paperclip`** (lucide-react, già in uso) a sinistra del Send, stile coerente shadcn/Tailwind (verde #22c55e del tema);
  - apre file picker (riuso `react-dropzone` già in dipendenze) con **drag&drop** sull'area chat;
  - **strip di preview pre-invio**: thumbnail immagini / chip PDF con nome+peso, bottone ✕ per rimuovere, badge se si superano i limiti;
  - validazione client-side immediata (mime + size + max N file) con messaggi in **inglese** (regola UI #15);
  - invio: `multipart/form-data` con file + testo opzionale.
- **Gate operatore**: il composer è già mostrato solo in "Manual Operator Control" (`!isChatbotActive`); l'icona 📎 eredita lo stesso gate + il gate "active" §7.

### 8.2 Demo / playground — `apps/frontend/src/pages/PlaygroundPage.tsx`
- `MessageBody` (righe ~186-201, alignment via `isInbound`): stesso rendering allegati.
- Aggiungere upload nell'input della demo per **testare il flusso inbound** senza WhatsApp reale.

### 8.3 Coerenza UI
Tailwind + shadcn/ui (Radix) + lucide-react ovunque. Niente nuove librerie pesanti: lightbox e PDF viewer con `Dialog` esistente; `react-pdf` solo se serve preview PDF inline (altrimenti `<embed>`/nuova scheda). Testi UI **in inglese**.

---

## 9. Ciclo di vita dei file (la parte "archiviare bene + cancellare")

Questo risponde direttamente a *"quando si cancellano le chat o i clienti si devono cancellare anche i file"*.

**Regola d'oro**: ogni `MessageAttachment` ha uno `storageKey` (public_id Cloudinary). La cancellazione DB a cascata (`onDelete: Cascade`) **non basta** — serve eliminare anche il binario su Cloudinary.

Punti di intervento (la cancellazione oggi è **manuale** in `customer.repository.ts`, righe ~425-500, e hard-delete):
1. **Cancellazione singolo messaggio** → prima del delete, leggi gli `storageKey` → `storageService.delete(keys)` → poi delete DB.
2. **Cancellazione chat** (`DELETE /api/chat/{sessionId}`) → raccogli tutti gli `storageKey` dei messaggi della sessione → delete su Cloudinary (meglio ancora: `delete_resources_by_prefix(chat-attachments/<ws>/<session>/)`) → poi delete DB.
3. **Cancellazione cliente** (`customer.repository.deleteRelatedRecords`) → estendere lo step "Message" per cancellare prima gli attachment fisici, idealmente con `delete by prefix` a livello di sessione/workspace.
4. **Retention** (opzionale ma consigliato): job che elimina allegati di chat chiuse oltre N giorni; per la **demo/playground** retention breve (es. 24-48h).

> Attenzione al **soft-delete vs hard-delete**: oggi i `Message` hanno `deletedAt` (soft) in alcuni flussi e hard-delete in altri. Definire la policy: se soft-delete del messaggio, il file resta finché non scatta la hard-delete/retention. Da decidere con Andrea.

---

## 10. API (nuovi endpoint, con 3-layer middleware e Swagger)

Tutti gli endpoint protetti seguono il pattern `authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation`, filtrano per `workspaceId`, e aggiornano `swagger.yaml` (regola #6).

| Metodo | Endpoint | Scopo |
|---|---|---|
| `POST` | `/api/chat/:sessionId/attachments` | Upload multipart (operatore o widget) → Cloudinary → crea Message+attachment. Ritorna l'attachment. |
| `POST` | `/api/chat/:sessionId/send` (esteso) | Accetta `attachmentIds[]` + `content` opzionale → invio (provider se canale whatsapp). |
| `GET` | `/api/v1/files/private/chat-attachments/...` (esiste) | Serve il file privato (auth). |
| `DELETE` | `/api/chat/:sessionId` (esteso) | Cancella anche i file Cloudinary. |
| webhook (esistenti) | meta / ultramsg / wasender (estesi) | Inbound media pipeline §4. |

---

## 11. Cosa potresti dimenticare (checklist ad alto valore)

Cose che **non** sono ovvie e che mordono in produzione:

1. **PII**: le foto dei clienti (scontrini, documenti, volti, IBAN su carta) sono **dati personali**. → storage **privato/firmato**, niente URL pubblici indicizzabili, e cancellazione effettiva su GDPR-delete del cliente. Allinearsi alla redaction PII già presente in `custom-demowash/pii.ts`.
2. **Scadenza 14 giorni dei media WhatsApp**: scaricali e ri-archivia **subito** alla ricezione, mai "lazy".
3. **URL pubblico per l'outbound**: Meta/UltraMsg/Wasender devono poter **fetchare** il file → un file "privato" va esposto con signed URL a TTL al momento dell'invio.
4. **MIME sniffing reale**, non fidarsi dell'estensione né dell'header dichiarato (un `.pdf` può essere altro) → validare i magic bytes lato server.
5. **Antivirus / contenuti malevoli**: file da utenti esterni → almeno limitare i tipi; valutare scan (ClamAV / servizio) se il rischio è alto.
6. **Multi-file su WhatsApp = N webhook**: senza debounce il bot vede messaggi scollegati e l'operatore vede una raffica.
7. **Ricompressione immagini WhatsApp**: il file ricevuto non è l'originale; per i PDF invece è integro.
8. **Cap nostri ≤ cap WhatsApp**: imporre limiti applicativi (es. max 5 file/turno, immagini 5 MB, PDF 20 MB anche se WA arriva a 100) per costo storage + limite email operatore (Gmail ~25 MB se gli allegati finiscono in escalation).
9. **Billing/quote**: l'invio media conta come messaggio a pagamento → riusare la deduzione già in `whatsapp-direct-send.service.ts`.
10. **Rate limiting / abuse**: upload ripetuti → riusare i cap (`maxMessagesPerMinute`) e limitare dimensione/numero.
11. **Stato di invio fallito**: upload o send può fallire (provider down, file troppo grande) → stato `failed` sul messaggio + retry, e UI che lo mostra.
12. **Accessibilità**: `alt` text sulle immagini, focus trap nel lightbox, ESC per chiudere.
13. **Thumbnail / lazy-load**: non caricare i full-res nella lista chat (perf) → Cloudinary transformations per le thumb.
14. **Ordinamento e timestamp**: l'allegato e la sua caption devono restare allineati nel thread.
15. **Backoffice**: esiste un secondo FE (`apps/backoffice`, `ChatSurface.tsx`) — decidere se ha gli stessi requisiti.
16. **Soft vs hard delete** (vedi §9): policy chiara per non lasciare file orfani su Cloudinary.
17. **Widget anonimo**: sessioni `isAnonymous`/`visitorId` → a chi appartengono i file e quando si cancellano.
18. **i18n testi UI in inglese** (regola #15) ma risposte LLM al cliente multilingua.

---

## 12. Test (solo **unit**, niente integration — regola #7B)

Con mock di provider e di Cloudinary (`storage.service`):
- **Provider media**: `sendMediaMessage` per Meta/UltraMsg/Wasender (URL/payload corretto per ciascuno).
- **Inbound pipeline**: parsing webhook media per i 3 provider → crea `Message + MessageAttachment` con mime/size/storageKey attesi; scarta tipi non in whitelist; rispetta i limiti di size.
- **Gating active=false**: inbound scartato, outbound rifiutato.
- **Debounce multi-file**: N media in finestra → un turno logico.
- **Validazione**: mime sniffing, size cap, max N file.
- **Ciclo di vita**: delete messaggio/chat/cliente → `storageService.delete` chiamato con gli `storageKey` giusti (cascade DB + delete fisico).
- **API**: `POST /attachments` e `/send` esteso (auth + workspace isolation + payload).
- **Contract**: shape della risposta con allegati.
- **FE** (component test): rendering bubble immagine/PDF, apertura lightbox, validazione client del picker, icona disabilitata su canale inattivo.

Eseguire con `npm run test:unit` prima di dichiarare "done".

---

## 13. Domande aperte (da confermare prima di implementare)

1. **Quale "active"** governa il gate §7? (`workspace.isActive` / `customer.activeChatbot` / `isChatbotActive` "Manual Operator Control" / provider non configurato). Cambia dove mettiamo il guard.
2. **Scope file**: solo immagini+PDF, o anche audio/video più avanti?
3. **Vision/OCR**: per la v1 confermo **no** (solo ricezione/inoltro/anteprima). Si aggiunge dopo se serve (es. leggere lo scontrino per la fattura).
4. **Cap applicativi**: confermi immagini 5 MB / PDF 20 MB / max 5 file per messaggio?
5. **Retention**: dopo quanti giorni cancellare gli allegati di chat chiuse? Demo a 24-48h?
6. **Backoffice** (`apps/backoffice`): stesso trattamento della chat principale?

---

## 14. Fasi di rollout proposte

1. **DB + storage**: modello `MessageAttachment`, migration, category Cloudinary privata, abilitare PDF in `uploadMiddleware`. + unit test storage/lifecycle.
2. **Inbound WhatsApp**: `downloadInboundMedia` per i 3 provider + pipeline §4 + debounce. + unit test pipeline.
3. **Outbound operatore**: estendere `WhatsAppDirectSendService` + `/send` con `attachmentIds`. + unit test.
4. **FE chat operatore**: rendering bubble + lightbox/PDF viewer + icona 📎 + preview pre-invio + gate. + component test.
5. **Widget + demo/playground**: upload + rendering, retention breve.
6. **Ciclo di vita**: cancellazione fisica su delete messaggio/chat/cliente + retention job.
7. **Swagger + QA finale** + `npm run test:unit`.

Ogni fase è autoconsistente e testabile: si può rilasciare incrementale (es. far prima funzionare l'inbound, che è il buco principale).

---

## Vincoli di progetto rispettati (CLAUDE.md)

Database-first (nessun valore hardcoded), `workspaceId` su ogni query, middleware 3-layer sugli endpoint protetti, Swagger aggiornato dopo ogni modifica API, **solo unit test**, testi UI in inglese, nessun `git add/commit/push` (li fa Andrea), nessuna modifica a `.env`.

---

## Fonti (limiti/formati WhatsApp)

- [Supported media file types and sizes in WhatsApp — AWS End User Messaging Social](https://docs.aws.amazon.com/social-messaging/latest/userguide/supported-media-types.html)
- [WhatsApp API: Maximum Media Size & Supported Formats — WhatChimp](https://whatchimp.com/docs/whatsapp-api-maximum-media-size-supported-formats/)
- [Supported message types on WhatsApp Business API (Cloud API) — SleekFlow](https://help.sleekflow.io/en_US/whatsapp/supported-message-types-on-whatsapp-business-api-cloud-a)
- [Upload, retrieve or delete media — 360Dialog](https://docs.360dialog.com/partner/messaging-and-calling/media-messages/upload-retrieve-delete-media)
- [What file types and sizes are supported on WhatsApp? — Vonage](https://api.support.vonage.com/hc/en-us/articles/10900821425308-What-file-types-and-sizes-are-supported-on-WhatsApp)

*Piano redatto il 2026-06-02. Path e righe riferiti allo stato del repo a quella data.*
