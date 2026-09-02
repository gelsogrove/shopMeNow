# Produzione e tecnica — il tocco del programmatore

## L'obiettivo misurabile: essere chiamati

Il video non si giudica dalle visualizzazioni ma dai **contatti generati**.
Tutta la catena tecnica è costruita per questo:

1. **Il QR della end-card è un link WhatsApp reale** (wa.me) con parametro
   di tracciamento: sappiamo quanti decisori hanno scansionato, da quale
   versione del video (pitch, social 30", reel 15") e quando.
2. **Il bot in modalità demo-B2B raccoglie il lead**: quando a scansionare
   è una Pro Loco (arriva dal QR della end-card, non da quello turistico),
   il bot fa la sua figura per 3-4 scambi — le stesse risposte brillanti
   del cartone — e poi chiude: *"Vuoi vederlo sul tuo territorio? Lasciami
   nome, ente e numero: ti richiamiamo entro domani."* Il lead entra
   direttamente nel database, con tutto il contesto.
3. **Ogni formato chiude con un contatto**: anche i tagli social hanno
   sempre QR + recapito nell'ultimo frame — mai un'uscita senza porta
   d'ingresso.

Il funnel completo: cartone (attenzione) → slide (comprensione) → QR
(prova immediata) → bot (raccolta lead) → **telefonata**. Il decisore non
deve mai cercarci: è il sistema che si fa richiamare — che è poi
esattamente il prodotto che stiamo vendendo, applicato a noi stessi.

## Pipeline di produzione (nell'ordine giusto)

1. **Animatic prima di tutto**: storyboard + voci provvisorie (anche IA) +
   suoni chiave (BIP, sting) montati sui tempi interni delle schede. Costa
   poco e verifica l'unica cosa che conta: se le gag atterrano coi tempi
   scritti. Solo dopo l'ok sull'animatic si anima davvero.
2. **Asset riusabili, costruiti una volta**:
   - Turnaround dei 5 personaggi + Mascotte (il corpo-QR va progettato
     per essere animabile: i moduli si muovono nella nascita di scena 1).
   - **Componente "bolla WhatsApp" parametrica**: un solo template
     (mittente "Pro Loco", avatar Mascotte, testo variabile) riusato in
     tutti i push — coerenza garantita e zero rifacimenti.
   - Location: gazebo Pro Loco (2 stagioni: estate/neve), auto (interno/
     esterno), rifugio, bosco, piazza sagra, ufficio.
3. **Render multipli dallo stesso master**: versione pubblica (pulita),
   versione pitch (micro-etichette + end-card B2B), tagli 30" e 15"
   verticale. Un progetto, quattro uscite.

## ⚠️ Nota legale da risolvere prima del rendering

Il **suono di notifica ufficiale di WhatsApp è proprietà di Meta**, e
anche il trade dress dell'interfaccia va usato con misura. Da verificare
prima della produzione: se il suono originale non è utilizzabile in uno
spot commerciale, serve un suono "evocativo" — stesso attacco, stessa
funzione scenica, abbastanza simile da far scattare il riconoscimento
senza essere identico. La meccanica dello spot (BIP → freeze → sting) non
cambia; cambia solo il file audio. Stesso discorso per la bolla: layout
riconoscibile ma non copia pixel-perfect. Decisione da prendere con chi
cura gli aspetti legali, NON in fase di montaggio.

## Strumenti

- Animatic e tagli social: realizzabili anche in Remotion (React → mp4),
  utile per iterare veloci su testi e tempi.
- Animazione finale: decisione aperta (animatore 2D, tool IA, o ibrido) —
  vedi [decisioni.md](./decisioni.md).
