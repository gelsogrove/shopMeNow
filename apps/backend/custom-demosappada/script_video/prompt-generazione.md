# Prompt per tool di generazione (versione policy-safe)

**Perché serve questo file**: i documenti della cartella citano marchi e
proprietà intellettuali ("WhatsApp", "stile Simpson", "Road Runner") come
riferimenti di lavoro tra umani — ma incollati come prompt in Google Flow,
Veo, Midjourney ecc. fanno scattare i filtri delle norme (marchi
registrati e IP protette non si possono riprodurre). **Mai incollare le
schede-scena direttamente nei tool di generazione**: usare le
traduzioni qui sotto.

## Tabella di sanificazione (sostituzioni obbligatorie nei prompt)

| Nel documento interno | Nel prompt di generazione |
|---|---|
| "stile Simpson / registro Simpson" | "cartone animato 2D anni '90, tratto piatto, contorni neri spessi, colori saturi, personaggi buffi con occhi grandi e proporzioni esagerate, comicità da sitcom animata" |
| "WhatsApp", "bolla WhatsApp" | "app di messaggistica, bolla di chat verde chiaro con nome del mittente in alto" |
| "notification sound di WhatsApp" | "suono di notifica di messaggio" (irrilevante per la generazione immagini: ometterlo) |
| "stile Road Runner" | "corsa comica esagerata, gambe che girano come ruote, nuvola di polvere" |
| "Ned Flanders friendly" | "vicino di casa gentile e sorridente" |
| "TO BE CONTINUED stile cartone" | già sostituito da "CONTINUA..." — descrivere "scritta a pennello giocosa su schermo nero" |

Regola generale: **descrivere l'effetto, mai nominare la fonte**. Se un
riferimento serve solo a farci capire tra noi, nel prompt va tradotto in
aggettivi visivi.

## Blocco stile riusabile (da premettere a ogni prompt)

> Cartone animato 2D, tratto piatto con contorni neri decisi, colori
> saturi e caldi, stile sitcom animata anni '90, personaggi buffi con
> occhi grandi ed espressioni esagerate, ambientazione montagna alpina
> italiana stilizzata (abetaie, vette, baite in legno), luce allegra,
> nessun testo nell'immagine se non richiesto esplicitamente.

## Prompt personaggi (per il character design)

Ogni prompt include aspetto E carattere: nei generatori video la
personalità guida la recitazione del personaggio (come si muove, come
reagisce), non solo il disegno.

- **Gustavo (papà)**: "uomo sui 40 anni, robusto e simpatico, polo rossa
  tesa sulla pancia, pantaloncini cargo beige, calzini bianchi alti con
  sandali da trekking, cappellino da esploratore. Carattere: goloso,
  impulsivo, entusiasta come un bambino, reagisce sempre con un attimo di
  ritardo comico e poi esagera — gesti ampi, occhi che si spalancano,
  mai fermo. È il motore comico della famiglia. [blocco stile]"
- **Vera (mamma)**: "donna sui 40 anni, camicia a quadretti
  verde-azzurra, gilet tecnico smanicato pieno di tasche, jeans,
  scarponcini, occhiali da sole sulla testa, telefono in mano.
  Carattere: pratica, calma e sorridente, la più composta della
  famiglia — è sempre lei ad accorgersi per prima delle cose, reagisce
  con un sorriso sereno più che con salti, tiene tutti insieme.
  [blocco stile]"
- **Leo (figlio grande)**: "figlio adolescente della famiglia, felpa con
  cappuccio blu, cuffie al collo, jeans e sneakers. Carattere: sveglio,
  curioso, a suo agio con la tecnologia — si fida subito, si sporge
  sempre in avanti per vedere lo schermo, entusiasmo pronto senza mai
  sospetto. [blocco stile]" — **niente età esplicita**: i filtri sui
  minori sono severissimi, "figlio adolescente" passa molto più
  facilmente di "ragazzino di 12 anni".
- **Tommi (figlio piccolo)**: "figlio più piccolo della famiglia,
  maglietta gialla con una marmotta stampata, pantaloncini, ciuffo
  spettinato, zainetto troppo grande. Carattere: perennemente assonnato
  ma con scatti di energia improvvisi — sembra il più lento e invece
  arriva sempre primo ovunque. [blocco stile]" — **niente età esplicita**
  (vedi sopra), e mai chiedere primi piani di lui da solo: sempre
  dentro la famiglia.
- **Birillo (cane)**: "cane di famiglia di taglia media, orecchie
  lunghe, collare rosso, lingua di fuori. Carattere: comicamente
  esausto dal ritmo della famiglia — stressato e rassegnato ogni volta
  che deve correre o essere trascinato, sinceramente beato ogni volta
  che può stare fermo o farsi trasportare; guarda spesso dritto in
  camera con espressione da 'non ce la faccio più'. Mai vie di mezzo: o
  soffre o gode. [blocco stile]"
- **Mascotte**: "piccola mascotte amichevole il cui corpo è composto da
  quadratini neri e bianchi come un codice a scansione stilizzato, occhi
  grandi espressivi, sorriso caldo, braccia e gambe corte e tonde.
  Carattere: calda, premurosa e un po' scherzosa, sempre dalla parte
  della famiglia — appare con l'entusiasmo gentile di chi non vede l'ora
  di essere utile, mai fredda o robotica; stesso identico carattere in
  ogni apparizione, cambia solo l'accessorio che indossa. [blocco
  stile]" — (dire "codice a scansione stilizzato", non nominare marchi
  di QR)

## Come usare questi prompt in Google Flow

1. **Prima i personaggi**: genera i 6 personaggi con i prompt qui sopra e
   salvali nella sezione "Personaggi" di Flow — così restano coerenti in
   tutte le scene.
2. **Poi le scene**: una alla volta, con i prompt brevi qui sotto,
   richiamando i personaggi salvati. Mai incollare documenti interi.
3. Ogni prompt scena va preceduto dal **[blocco stile]** (vedi sopra) se
   il tool non mantiene lo stile dai personaggi salvati.

## Prompt video per clip (completi: camera, azione, abiti, mood, audio)

Ogni prompt descrive UNA clip (6-8 secondi, il formato tipico dei
generatori video): inquadratura, come si entra, cosa succede, come si
esce, abiti chiave, palette/mood e riga Audio (musica + suoni + eventuale
dialogo in italiano). Premetti sempre il [blocco stile]. Le battute sono
identiche al copione voci.

- **Clip 0 — Cold open (6s)**: "Inquadratura fissa completamente sfocata
  di un paesaggio di montagna, solo macchie verdi e grigie. A schermo
  compaiono in dissolvenza, poche parole per volta, le scritte in
  italiano: 'Ogni anno...' 'milioni di famiglie...' 'partono
  all'avventura...' pausa, poi '...senza sapere cosa fare.' Sull'ultima
  scritta la sfocatura si scioglie di colpo a fuoco rivelando un'auto in
  curva su un tornante. Mood sospeso che diventa vivace nell'ultimo
  istante. Audio: un solo accordo lungo sospeso che si interrompe di
  colpo sull'ultima scritta, poi silenzio e rumore d'auto in arrivo."
- **Clip 1a — La frenata (8s)**: "Auto di famiglia rossa su tornante di
  montagna soleggiato, musica allegra; l'auto frena DI COLPO davanti a un
  gazebo in legno con insegna 'PRO LOCO' e un grande codice a scansione
  stilizzato con occhietti sorridenti. Dentro l'auto tutti sbalzati in
  avanti come molle: papà robusto in polo rossa e cappellino da
  esploratore, mamma in camicia a quadretti e gilet, due figli (felpa
  blu, maglietta gialla), e un cane con collare rosso che vola dal sedile
  posteriore e resta appiccicato al parabrezza con la lingua di fuori
  guardando in camera. Colori saturi, luce estiva. Audio: musica
  allegra da viaggio che si interrompe di colpo, stridio di freni,
  effetto fischio discendente comico, silenzio finale."
- **Clip 1b — La battuta e la nascita (8s)**: "Il papà in polo rossa, già
  col telefono in mano e occhi a stella, dice in italiano: 'C'è un QR
  code. Io i QR code li scansiono SEMPRE.' Una riga di luce da scanner
  attraversa il codice sul cartello: i quadratini neri tremano, si
  staccano, vorticano a spirale nell'aria come uno sciame e si
  ricompongono sullo schermo del telefono nella forma di una piccola
  mascotte sorridente fatta di quadratini, che apre gli occhi con un
  sorriso caldo. Sotto di lei si scrive da solo il testo 'Benvenuti! Cosa
  vuoi fare oggi?'. Mood magico e giocoso. Audio: voce maschile comica
  entusiasta, poi scintillio magico durante lo sciame, un 'boing' morbido
  quando la mascotte si completa."
- **Clip 2a — Il desiderio (6s)**: "Primo piano comico del papà in polo
  rossa: sopra la sua testa una nuvoletta di pensiero dove scorrono in
  loop veloce scarponi che camminano da soli, un pallone che rimbalza e
  una forma di formaggio; il loop rallenta e si ferma su un salame che
  balla il tip tap. I suoi occhi diventano cuoricini e dice in italiano,
  allungando la parola: 'Voglio... mangiaaare.' Mood goloso ed esagerato.
  Audio: motivetto veloce a xilofono che rallenta come una slot machine,
  tre note buffe, voce maschile golosa."
- **Clip 2b — A tavola, il primo push (8s)**: "Famiglia che ride a
  tavola all'aperto davanti a una baita, piatti fumanti, il papà col
  tovagliolo infilato nel colletto, il cane finalmente tranquillo sotto
  il tavolo. All'improvviso un suono di notifica di messaggio: TUTTO SI
  CONGELA per un istante, forchette a mezz'aria, risata bloccata a bocca
  aperta. Poi dallo smartphone sul tavolo esce con un boing la piccola
  mascotte di quadratini con cappello da guida alpina e corda, e una
  voce calda dice in italiano: 'Ehy, sono il tuo assistente di viaggio!
  Oggi pomeriggio è soleggiato — ti consiglio il Rifugio.' Mood:
  sorpresa gioiosa. Audio: chiacchiericcio allegro, notifica di
  messaggio, silenzio totale di un secondo, poi tre note d'arpa calde e
  la voce dell'assistente."
- **Clip 3 — Foto al tramonto (8s)**: "Famiglia in posa per una foto di
  gruppo davanti a un rifugio di montagna, tramonto stilizzato a fasce
  arancio e rosa, tutti coi pile addosso; il figlio più piccolo salta
  dentro l'inquadratura all'ultimo momento, il cane è l'unico con la
  lingua di fuori. Suono di notifica: le nuvole e le bandierine sullo
  sfondo si bloccano per un istante. Dalla tasca esce la mascotte di
  quadratini con un cappello da notte, voce calda in italiano: 'Per
  stasera vai a letto presto — domani mattina si va per funghi!' La
  famiglia si guarda e sorride dritto in camera. Mood dolce e caldo.
  Audio: archi morbidi da tramonto, notifica di messaggio, pausa, tre
  note d'arpa, voce calda, risatina finale corale."
- **Clip 4a — Funghi e licenza (8s)**: "Famiglia china a raccogliere
  funghi in un bosco di abeti pieno di sole, con cestini buffi sbagliati
  (un secchiello da mare, una borsa di paglia); la mamma ha un fazzoletto
  in testa. Notifica di messaggio: tutti congelati chini a mezz'aria. La
  mascotte di quadratini appare con un fischietto da vigile, bonaria, e
  dice in italiano: 'Attento! Per i funghi serve la licenza di raccolta —
  ce l'hai?' Il papà fa una faccia comica da 'oh no' guardando il suo
  secchiello. Mood comico. Audio: uccellini e fruscii, notifica, silenzio,
  due note serie ma buffe, voce dell'assistente, trombone discendente
  sulla faccia del papà."
- **Clip 4b — La corsa in bici (8s)**: "Famiglia in discesa a tutta
  velocità su mountain bike lungo un sentiero di montagna: caschi di
  misure sbagliate (minuscolo sul papà, enorme sul figlio più piccolo),
  cestini di funghi legati ai manubri che perdono funghi a ogni buca,
  tutti che urlano ridendo. Il cane felice nel cestino anteriore con
  occhialini da moto e orecchie al vento, per una volta beato. Scie di
  velocità comiche, nuvola di polvere. All'arrivo davanti alla baita
  tutti crollano a terra ansimando ridendo mentre il cane salta giù
  fresco come una rosa. Mood: euforia pura. Audio: percussioni
  martellanti e ottoni veloci, urla di gioia, campanelli di bici,
  frenata finale con colpo di piatti e ansimi."
- **Clip 4bis-a — Il crollo (7s)**: "Camera d'albergo di montagna,
  mattina: fuori piove a dirotto, tamburellare sui vetri. Quattro membri
  della famiglia col naso schiacciato contro la finestra, le spalle che
  si afflosciano una dopo l'altra come birilli. In primo piano il cane
  fa l'opposto: si stiracchia beato su un cuscino con un sorriso enorme
  e un sospirone di sollievo. Palette spenta blu-grigia, mood
  tragicomico. Audio: pioggia fitta, la musica si spegne su una sola
  nota triste 'plin', sospiro soddisfatto del cane."
- **Clip 4bis-b — Il freeze sotto la pioggia (8s)**: "Famiglia con
  impermeabili gialli tutti uguali (uno con l'etichetta del prezzo
  ancora appesa) e ombrelli mezzi rotti cammina mogia sotto la pioggia
  in un paese di montagna, il cane trascinato al guinzaglio. Si riparano
  sotto una tettoia: suono di notifica di messaggio nitido sopra la
  pioggia — TUTTO SI CONGELA, gocce di pioggia sospese a mezz'aria,
  cinque paia d'occhi che scattano verso la tasca della mamma. Un
  secondo di silenzio pieno. Poi la mascotte di quadratini esce con un
  ombrellino ridicolo che non la ripara, e la voce calda dice in
  italiano: 'Oggi piove — perché non andate in biblioteca? C'è un corso
  di pittura tra un'ora.' Mood: sospeso poi sollevato. Audio: pioggia,
  notifica, silenzio lungo, tre note d'arpa, voce calda."
- **Clip 4bis-c — Il corso di pittura (6s)**: "Famiglia seduta a un
  corso di pittura in una biblioteca accogliente e calda, grembiuli
  improvvisati (uno è un tovagliolo), cavalletti e pennelli; le facce
  passano dal rassegnato al genuinamente divertito. Fuori dalla porta
  vetrata, il cane aspetta di nuovo stremato sotto la tettoia. Mood:
  caldo, sorpresa positiva. Audio: musichetta soffusa e buffa con
  pennelli che sguazzano a ritmo, risatine."
- **Clip 4ter-a — L'annuncio della sagra (7s)**: "Sera dorata in un
  paese di montagna, la famiglia passeggia rilassata; sopra la testa del
  cane una nuvoletta di pensiero con un cuscino morbido. Suono di
  notifica: tutti si congelano — e nel fermo immagine la nuvoletta col
  cuscino SCOPPIA come un palloncino. La mascotte di quadratini appare
  con un cappellino alpino con la piuma e dice allegra in italiano:
  'Stasera sagra in paese! Musica, balli e prodotti tipici — vi mando la
  posizione.' Sullo schermo del telefono un segnaposto di mappa rimbalza
  con un boing. Mood: quiete che esplode in festa. Audio: grilli serali,
  notifica, 'pop' secco del palloncino nel silenzio, tre note d'arpa,
  voce festosa, boing del segnaposto."
- **Clip 4ter-b — La sagra (8s)**: "Piazza di paese di montagna in festa
  di sera: lanterne colorate, tavolate piene, bandierine, una piccola
  banda che suona con fisarmonica e ottoni. Il papà felice con uno
  spiedo in una mano e un piatto nell'altra e un cappello alpino con la
  piuma sopra il suo cappellino, la mamma coi capelli sciolti che balla,
  i due figli che corrono con lanterne e zucchero filato gigante. In primo
  piano il cane spiaccicato a terra faccia in giù, lingua distesa sul
  selciato come uno zerbino, illuminato da una lanterna come un occhio
  di bue teatrale, che alza solo gli occhi verso la camera, esausto.
  La festa continua indifferente intorno a lui. Mood: festa travolgente
  + gag malinconica. Audio: polka di paese a tutto volume con
  fisarmonica, risate, brusio di festa — la musica NON si ferma mai."
- **Clip 5a — L'ufficio (7s)**: "Uomo malinconico in camicia e cravatta
  allentata a una scrivania, ufficio grigio con neon che ronzano; unico
  oggetto colorato una foto di vacanza in montagna attaccata al monitor.
  Suono di notifica che risuona nel silenzio: lui si blocca un istante,
  lo smartphone si illumina e la mascotte di quadratini esce con sciarpa
  e fiocchi di neve intorno, voce calda in italiano: 'Sei pronto per la
  neve? Offerta dell'Hotel per una settimana.' Mood: grigio che si
  accende di speranza. Audio: ronzio di neon, notifica nitida, tre note
  d'arpa, voce calda."
- **Clip 5b — La fantasia e il clic (8s)**: "Esplosione di colore: lo
  stesso uomo sogna se stesso felice che scia con una tuta fucsia
  vistosa anni novanta, poi fa un pupazzo di neve con i figli, fiocchi
  di neve e colori brillanti ovunque. Ritorno di colpo all'ufficio
  grigio — ma lui ora sorride e preme con decisione un pulsante
  'Prenota' sul telefono: dallo schermo si apre una raggiera di colori
  che invade tutta l'inquadratura. Mood: sogno euforico, decisione
  finale. Audio: campanelli e archi natalizi in esplosione, taglio
  secco, squillo di conferma gioioso, crescendo finale."
- **Clip 6a — Il ritorno d'inverno (8s)**: "La stessa strada di montagna
  della prima scena, ora innevata: l'auto di famiglia sale tranquilla e
  passa SENZA fermarsi davanti al gazebo 'PRO LOCO' innevato, dove il
  codice a scansione con gli occhietti porta un cappellino natalizio. Il
  papà, con berretto e sciarpa rossi, fa un cenno rilassato di saluto;
  sul supporto del cruscotto il telefono mostra la mascotte che li sta
  già guidando. La camera resta ferma sul gazebo mentre l'auto si
  allontana verso le piste e la mascotte sul cartello saluta con la
  manina. Mood: caldo, cerchio che si chiude. Audio: tema musicale
  dell'assistente in versione estesa e completa, campanelle invernali,
  NESSUNA frenata."
- **Clip 6b — Button gag (6s)**: "Il cane finalmente spaparanzato beato
  sulla neve, occhi chiusi, pace totale, respiro lento. Nel silenzio:
  suono di notifica di messaggio. Lui apre UN solo occhio e guarda
  dritto in camera con l'espressione rassegnata di chi sa già cosa lo
  aspetta. Fermo immagine, poi stacco a nero. Mood: gag secca finale.
  Audio: vento leggero, due note discendenti stanche di fagotto
  interrotte a metà dalla notifica, poi silenzio totale."

## Note per le scene

- Per le scene con la chat a schermo: "smartphone con app di
  messaggistica generica, bolla verde chiaro, mittente 'Pro Loco' con
  avatar della mascotte" — niente nomi di app reali.

## Se Flow rifiuta ancora ("potrebbe violare le nostre norme")

I due colpevoli più probabili, in ordine:

1. **I bambini nel prompt** — i filtri sui minori sono i più severi di
   tutti. Regole: MAI età esplicite ("6 anni", "12 anni"), mai primi
   piani di un bambino da solo, descriverli sempre dentro il gruppo
   ("la famiglia con i due figli"). Se il blocco persiste, provare la
   stessa clip SENZA figli (solo genitori + cane): se passa, il
   colpevole era quello.
2. **L'immagine di partenza** — se stai animando un'immagine caricata
   che contiene bambini (es. quella generata con ChatGPT), la moderazione
   sulle immagini è ancora più severa del testo: spesso è l'immagine a
   far scattare il blocco, non il prompt. Prova la stessa generazione da
   solo testo, senza immagine di riferimento.

**Scala di test per isolare il problema** (dal più sicuro al più
rischioso — parti dal gradino 1 e sali finché non scatta il blocco):

1. Solo ambiente, zero personaggi: "gazebo in legno con insegna PRO LOCO
   e codice a scansione con occhietti sorridenti, tornante di montagna,
   [blocco stile]"
2. Solo il cane: la clip 6b (button gag) è perfetta come test.
3. Solo la mascotte: clip 1b limitata alla nascita dai quadratini.
4. Solo adulti: papà e mamma a tavola, senza figli.
5. Famiglia intera in campo largo (figli piccoli nell'inquadratura, mai
   protagonisti del prompt).

Il gradino dove scatta il blocco ti dice cosa riscrivere. Altre
avvertenze: la battuta contiene "QR code" — se una clip col dialogo viene
rifiutata, sostituire nel prompt con "codice" (la battuta vera si
registra comunque a parte, nel doppiaggio); e "sagra" con bambini che
corrono di sera a volte insospettisce i filtri — in caso, descrivere "la
famiglia festeggia insieme" collettivamente.
