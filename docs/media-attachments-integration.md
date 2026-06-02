# Allegati chat — Guida di integrazione (cablaggio finale)

Stato: la **logica** è implementata e testata (64 unit test). Restano gli **innesti** in file grandi che vanno compilati/eseguiti nell'ambiente reale (richiedono `prisma generate` e il build FE). Questa guida elenca gli innesti esatti.

## 0. Comandi preliminari (ambiente Andrea)

```bash
npm run prisma:migrate     # applica 20260602120000_add_message_attachments
npm run prisma:generate    # tipizza prisma.messageAttachment
npm run test:unit          # deve restare verde
```

## 1. File già pronti (additivi, nessuna modifica a codice esistente salvo dove indicato)

Backend:
- `services/chat-attachment.validation.ts` — whitelist MIME, cap size, magic-byte sniff
- `interfaces/http/middlewares/chatAttachmentUpload.ts` — multer multi-file (jpeg/png/pdf)
- `services/whatsapp/whatsapp-provider.interface.ts` — `downloadInboundMedia` + tipi (modificato, additivo)
- `services/whatsapp/{meta,ultramsg,wasender}-whatsapp-provider.ts` — `downloadInboundMedia` implementato
- `services/inbound-media.service.ts` — pipeline download→valida→upload→persisti
- `services/webhook-media.extract.ts` — parser payload media per i 3 provider
- `services/outbound-attachment.service.ts` — invio operatore (gate active + canale)
- `services/attachment-lifecycle.service.ts` — purge binari best-effort
- `repositories/message-attachment.repository.ts` — CRUD + finder storageKey
- `services/storage.service.ts` — `deleteByKey(key,{raw})` (modificato, additivo)

Già cablato:
- `repositories/customer.repository.ts` → purge binari prima della delete cliente
- `repositories/message.repository.ts` `deleteChat()` → purge binari prima della delete chat

FE (additivi):
- `components/chat/attachment-utils.ts`
- `components/chat/AttachmentButton.tsx` (icona 📎)
- `components/chat/AttachmentPreviewStrip.tsx` (anteprime pre-invio)
- `components/chat/MessageAttachments.tsx` (bolle: lightbox immagine + viewer PDF)

## 2. Webhook inbound — innesto (vale per i 3 controller)

> ⚠️ **Ancoraggio corretto = `ConversationMessage`** (tabella `conversation_messages`), NON il vecchio modello `Message`. La chat UI legge da lì (vedi `message.repository.getChatSessionMessages` → "Query conversationMessage table (NEW)"). Gli attachment sono FK su `conversation_messages`.

L'inbound va agganciato **dopo** che `ChatEngine.saveMessages()` ha salvato il messaggio utente in `conversation_messages` (role "user"), e **dentro lo stesso gate** che già scarta i messaggi quando il canale non è attivo. Nel `whatsapp-webhook.controller.ts` esiste già il pattern per ritrovare il messaggio salvato (cfr. come recupera l'`assistant` con `prisma.conversationMessage.findFirst`). Per l'inbound si recupera il `user` message della sessione:

```ts
import { extractMetaMedia /* o Ultramsg/Wasender */ } from "../../../services/webhook-media.extract"
import { ingestInboundMedia } from "../../../services/inbound-media.service"
import { messageAttachmentRepository } from "../../../repositories/message-attachment.repository"
import { storageService } from "../../../services/storage.service"
import { WhatsAppProviderFactory } from "../../../services/whatsapp/whatsapp-provider.factory"

const media = extractMetaMedia(message)        // o extractUltramsgMedia(data) / extractWasenderMedia(message)
if (media) {
  // il messaggio utente appena salvato da ChatEngine in conversation_messages
  const userMsg = await prisma.conversationMessage.findFirst({
    where: { conversationId: chatSession.id, role: "user" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  if (userMsg) {
    const provider = WhatsAppProviderFactory.create(customerWorkspace) // o carica il workspace
    await ingestInboundMedia(
      { provider, storage: storageService, repository: messageAttachmentRepository, logger },
      {
        workspaceId: customer.workspaceId,
        chatSessionId: chatSession.id,
        conversationMessageId: userMsg.id,   // ← ancorato a ConversationMessage
        ref: media.ref,
        filename: media.filename,
        waMediaId: media.waMediaId,
      }
    )
    // ingestInboundMedia non lancia mai: errore → {ok:false}, il testo prosegue.
  }
}
```

File: `whatsapp-webhook.controller.ts` (Meta), `ultramsg-webhook.controller.ts`, `wasender-webhook.controller.ts`. Punto d'innesto: subito dopo il blocco "Messages already saved by ChatEngine.saveMessages()".

Debounce multi-file (opzionale v1): bufferizzare per `sessionId` ~8-15s e usare `ingestInboundMediaBundle`. Senza debounce funziona comunque.

## 3. API outbound — nuovo endpoint upload + invio

Route (in `chat.routes.ts`, con i 3 middleware standard):

```ts
router.post(
  "/:sessionId/attachments",
  authMiddleware, sessionValidationMiddleware, validateWorkspaceOperation,
  uploadChatAttachments, handleChatUploadError,
  asyncHandler(chatController.uploadAttachments.bind(chatController))
)
```

Controller `uploadAttachments` (schizzo):

```ts
// per ogni req.files[]: validateAttachment({mimeType,filename,size}) → sniff buffer
// → storageService.upload(buffer,{folder:`chat-attachments/${ws}/${sessionId}`, contentType, isPublic:false})
// → crea Message(OUTBOUND, type=IMAGE|DOCUMENT, content=caption||'')
// → messageAttachmentRepository.create({...})
// → active = <flag scelto>;  sendOperatorAttachment(
//      { provider: WhatsAppProviderFactory.create(workspace) },
//      { active, channel: session.channel, to: customerPhone,
//        attachment: { kind, publicUrl: signedOrPublicUrl }, caption })
// → ritorna il/i MessageAttachment per il rendering
```

Hydration: in `GET /:sessionId/messages` aggiungere `messageAttachmentRepository.listByMessageIds(ids)` e allegare `attachments[]` a ogni messaggio nel payload.

## 4. FE — innesto nelle pagine

`ChatPage.tsx` (composer ~1964-1997):

```tsx
import { AttachmentButton } from "@/components/chat/AttachmentButton"
import { AttachmentPreviewStrip } from "@/components/chat/AttachmentPreviewStrip"
import { MessageAttachments } from "@/components/chat/MessageAttachments"

const [pending, setPending] = useState<File[]>([])

// sopra al textarea:
<AttachmentPreviewStrip files={pending} onRemove={(i)=>setPending(p=>p.filter((_,k)=>k!==i))} />

// a sinistra del Send:
<AttachmentButton existingCount={pending.length}
  disabled={loading || selectedChat?.isBlacklisted /* || !active */}
  onFilesAccepted={(f)=>setPending(p=>[...p,...f])}
  onErrors={(errs)=>toast.error(errs.join("\n"))} />

// handleSubmit: se pending.length>0 → POST multipart /chat/{sessionId}/attachments
//   (campo "files"), poi setPending([]) e refresh messaggi.
```

Bolla messaggio (~1800-1947), dentro la bubble, passando l'allineamento già calcolato:

```tsx
{message.attachments?.length > 0 && (
  <MessageAttachments attachments={message.attachments}
    align={message.sender === "user" ? "right" : "left"} />
)}
```

Aggiungere `attachments?: ChatAttachment[]` a `types/chat.ts` (`Message`).

`PlaygroundPage.tsx`: stesso pattern con `MessageAttachments` in `MessageBody` (~186-201) e l'upload verso `POST /api/v1/playground/messages` in multipart.

## 5. Swagger (dopo aver aggiunto la route)

In `swagger.yaml`, sotto `paths`:

```yaml
/api/chat/{sessionId}/attachments:
  post:
    summary: Upload one or more attachments (image/PDF) to a chat and send them
    tags: [Chat]
    parameters:
      - in: path
        name: sessionId
        required: true
        schema: { type: string }
    requestBody:
      content:
        multipart/form-data:
          schema:
            type: object
            properties:
              files:
                type: array
                items: { type: string, format: binary }
              caption: { type: string }
    responses:
      "200": { description: Attachments stored (and sent on the whatsapp channel) }
      "400": { description: Invalid file type/size or too many files }
```

## 6. "active" gate

Una sola domanda aperta: quale flag governa `active`. Plug-in:
- inbound: dentro il gate webhook esistente (non ingerire media se il messaggio viene già scartato);
- outbound: `active` passato a `sendOperatorAttachment` + `disabled` sull'`AttachmentButton`.
Candidati: `workspace.isActive` / `customer.activeChatbot` / `isChatbotActive` (Manual Operator Control).

## 7. Checklist verifica manuale

- [ ] `prisma migrate` + `generate` ok, `test:unit` verde
- [ ] WhatsApp: invio immagine da cliente → compare a sinistra nella chat operatore + lightbox
- [ ] WhatsApp: invio PDF da cliente → card + viewer
- [ ] Operatore invia immagine/PDF dalla chat → arriva su WhatsApp + compare a destra
- [ ] Widget/playground: upload e rendering senza WhatsApp
- [ ] File oltre 5MB (img) / 20MB (pdf) o tipo non valido → rifiutato lato FE e BE
- [ ] active=false → niente invio né ricezione, icona 📎 disabilitata
- [ ] Cancella chat → spariscono i file su Cloudinary; cancella cliente → idem
