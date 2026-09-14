// i18n strings for the Tourism / Destination Boards landing page.
// Base language is Italian; the others mirror it 1:1.
// Positioning: ONE AI for any tourist board / DMO / visitor office.
// No named demo or specific destination is mentioned — the product fits any
// destination (mountain, seaside, city, lakes...).

export type TourismLang = "it" | "en" | "es" | "de"

export interface CapabilityCard {
  icon: string
  title: string
  desc: string
}

export interface PushStep {
  badge: string
  title: string
  desc: string
}

export interface ChatLine {
  role: "guest" | "bot"
  tag?: string
  text: string
  /**
   * Optional media attachment rendered above the bubble text, the way
   * WhatsApp shows a photo or a video with its caption underneath (Andrea,
   * 2026-09-14: "esempi con video e foto di passeggiate rifugi o altro").
   *
   * `emoji` + `caption` draw a lightweight illustrative preview rather than a
   * real image: the landing page must stay fast and must not ship a photo of
   * a real business it has no licence for. `kind` only changes the chrome —
   * a video gets a play button and a duration pill.
   */
  media?: {
    kind: "photo" | "video"
    emoji: string
    caption: string
    /** Shown on video previews only, e.g. "0:45". */
    duration?: string
  }
}

export interface Scenario {
  title: string
  rule: string
  script: ChatLine[]
}

/** Before/after row for the "what happens at the desk today" section. */
export interface PainRow {
  icon: string
  pain: string
  fix: string
}

/** Headline number with a caption, used by the results band. */
export interface MetricItem {
  value: string
  label: string
  desc: string
}

export interface FaqItem {
  q: string
  a: string
}

export interface TourismCopy {
  // SEO
  seoTitle: string
  seoDesc: string
  seoKeys: string
  // Hero
  badge: string
  heroTitleTop: string
  heroTitleAccent: string
  heroSub: string
  cta: string
  ctaSub: string
  tryDemo: string
  heroProof1: string
  heroProof2: string
  heroProof3: string
  heroCardTitle: string
  heroCardStatus: string
  heroScript: ChatLine[]
  // Hero phone chrome + the two-mode pills above it
  heroPhoneTyping: string
  heroPhoneInput: string
  heroModeIn: string
  heroModeOut: string
  // Pain section (what the desk lives through today)
  painTitle: string
  painAccent: string
  painSub: string
  painColPain: string
  painColFix: string
  painRows: PainRow[]
  // How it works
  howTitle: string
  howAccent: string
  howSub: string
  howSteps: { badge: string; title: string; desc: string }[]
  // What it answers
  whatTitle: string
  whatAccent: string
  whatSub: string
  capabilities: CapabilityCard[]
  // Push / outbound messages
  pushTitle: string
  pushAccent: string
  pushSub: string
  pushSteps: PushStep[]
  pushBoardTitle: string
  pushBoardStatus: string
  pushFirstTag: string
  pushFirstText: string
  pushGuardTag: string
  pushGuardText: string
  pushLabelSent: string
  pushLabelBlocked: string
  // Results band
  metricsTitle: string
  metricsAccent: string
  metrics: MetricItem[]
  // Try it (scenario demo)
  tryTitle: string
  tryAccent: string
  trySub: string
  tryReplay: string
  scenarios: Scenario[]
  /** Caption under the scenario phone, next to the language flags. */
  scenarioLangs: string
  /** Contact name shown in the scenario phone's WhatsApp header. */
  scenarioBoardTitle: string
  // FAQ
  faqTitle: string
  faqAccent: string
  faqItems: FaqItem[]
  // CTA
  ctaTitle: string
  ctaDesc: string
}

export const TOURISM_I18N: Record<TourismLang, TourismCopy> = {
  it: {
    seoTitle: "Chatbot WhatsApp per Turismo e Destinazioni - eChatbot",
    seoDesc:
      "L'assistente WhatsApp per Pro Loco, APT e uffici del turismo: risponde su eventi, alloggi e ristoranti dal tuo catalogo reale, in più lingue, 24/7. Sa anche quando scrivere per primo, senza mai duplicare i messaggi.",
    seoKeys:
      "chatbot turismo, whatsapp pro loco, assistente turistico ia, chatbot destinazione turistica, whatsapp ufficio turismo, ia multilingua turismo",
    badge: "Per Pro Loco, APT e uffici del turismo",
    heroTitleTop: "Il vostro numero WhatsApp",
    heroTitleAccent: "risponde anche di domenica.",
    heroSub:
      "I visitatori scrivono al numero dell'ufficio come scriverebbero a un amico. Ricevono subito eventi, alloggi e ristoranti presi dal vostro catalogo — nella loro lingua, anche alle undici di sera, anche mentre l'ufficio è chiuso.",
    cta: "Richiedi una demo",
    ctaSub: "Demo su misura, nessun impegno",
    tryDemo: "Guarda le conversazioni ↓",
    heroProof1: "lingue nella stessa chat",
    heroProof2: "sempre attivo, anche a uffici chiusi",
    heroProof3: "un solo catalogo da aggiornare",
    heroCardTitle: "Ufficio del Turismo",
    heroCardStatus: "online",
    heroPhoneTyping: "sta scrivendo…",
    heroPhoneInput: "Scrivi un messaggio",
    heroModeIn: "Risponde a chi scrive",
    heroModeOut: "E scrive per primo",
    heroScript: [
      {
        role: "bot",
        tag: "messaggio di benvenuto",
        text: "Benvenuti! 👋 Siamo l'ufficio del turismo: da qui vi diamo una mano per tutta la vacanza.\n\nChiedeteci cosa fare oggi, dove mangiare, che sentieri fare, come muovervi o un numero utile — rispondiamo con foto e video quando servono.",
      },
    ],
    painTitle: "Le stesse dieci domande,",
    painAccent: "tutti i giorni, a ogni stagione.",
    painSub:
      "Chi sta al banco lo sa: la maggior parte del lavoro non è informare, è ripetere. E le domande non arrivano negli orari d'ufficio — arrivano la sera, il weekend, in agosto.",
    painColPain: "Oggi",
    painColFix: "Con l'assistente su WhatsApp",
    painRows: [
      {
        icon: "📞",
        pain: "Il telefono squilla per la decima volta con la stessa domanda sugli orari della sagra.",
        fix: "La risposta arriva in chat in due secondi, e il banco resta libero per chi ha bisogno davvero di una persona.",
      },
      {
        icon: "🌙",
        pain: "Chi arriva di sera o di domenica trova l'ufficio chiuso e cerca su Google, dove le informazioni sul paese sono vecchie o sbagliate.",
        fix: "Scrive su WhatsApp e riceve la vostra informazione, quella giusta, a qualsiasi ora.",
      },
      {
        icon: "🌍",
        pain: "Arriva una famiglia tedesca e in ufficio, in quel momento, non c'è nessuno che parli tedesco.",
        fix: "Scrivono in tedesco e ricevono risposta in tedesco, dallo stesso catalogo che leggete voi in italiano.",
      },
      {
        icon: "📄",
        pain: "Il volantino degli eventi è già vecchio il giorno dopo la stampa, e il PDF sul sito pure.",
        fix: "Aggiornate una scheda nel pannello e la risposta cambia nello stesso istante, per tutti.",
      },
      {
        icon: "🗂️",
        pain: "Le stesse informazioni stanno sul sito, su Facebook, sul volantino e nella testa di chi lavora da vent'anni — e non coincidono.",
        fix: "Un catalogo solo. Quello che c'è dentro è quello che il bot risponde; quello che non c'è, il bot dice che non lo sa.",
      },
      {
        icon: "📣",
        pain: "Un evento viene spostato per pioggia e non c'è modo di avvisare chi aveva chiesto informazioni.",
        fix: "Il messaggio parte da solo a chi aveva chiesto di quell'evento, e a nessun altro.",
      },
    ],
    howTitle: "Si parte dal vostro catalogo,",
    howAccent: "non da un progetto da sei mesi.",
    howSub:
      "Non c'è niente da programmare e nessuna regola da scrivere. Quello che già raccogliete — eventi, strutture, ristoranti — diventa quello che il bot sa rispondere.",
    howSteps: [
      {
        badge: "1",
        title: "Caricate quello che avete già",
        desc: "Eventi, alloggi, ristoranti, sentieri: ogni scheda che compilate nel pannello diventa subito qualcosa che il bot sa rispondere. Se avete già un elenco, si importa.",
      },
      {
        badge: "2",
        title: "Colleghiamo il vostro numero",
        desc: "Il numero della Pro Loco o dell'ufficio IAT diventa il punto di contatto. Nessuna app da far scaricare ai turisti: usano il WhatsApp che hanno già.",
      },
      {
        badge: "3",
        title: "Da lì in poi risponde da solo",
        desc: "Ogni risposta è costruita sulle vostre schede, non inventata. Voi aggiornate il catalogo quando cambia qualcosa; il resto succede senza che nessuno debba farci niente.",
      },
    ],
    whatTitle: "Le domande che",
    whatAccent: "oggi arrivano allo sportello.",
    whatSub:
      "Le stesse che il vostro ufficio riceve per telefono o al banco — solo che arrivano a qualsiasi ora, e in qualsiasi lingua.",
    capabilities: [
      {
        icon: "🎪",
        title: "Eventi e manifestazioni",
        desc: "Sagre di paese, feste patronali, mercatini locali — con date e orari aggiornati, mai un calendario vecchio di due stagioni.",
      },
      {
        icon: "🏡",
        title: "Alloggi e disponibilità",
        desc: "Appartamenti, B&B, rifugi: caratteristiche, capienza, contatti — chi cerca dove dormire trova la scheda giusta, non un elenco.",
      },
      {
        icon: "🍽️",
        title: "Ristoranti e specialità locali",
        desc: "Piatti tipici, allergeni, chi è aperto stasera — comprese le domande più specifiche, tipo \"c'è un posto senza glutine\".",
      },
      {
        icon: "🥾",
        title: "Sentieri e attività outdoor",
        desc: "Lunghezza, dislivello, difficoltà: informazioni che oggi finiscono su un volantino diventano una risposta immediata.",
      },
      {
        icon: "🌍",
        title: "Più lingue, senza traduzioni a mano",
        desc: "Un turista tedesco e uno spagnolo possono scrivere nella stessa chat: ognuno riceve risposta nella propria lingua, dallo stesso catalogo.",
      },
      {
        icon: "✅",
        title: "Non inventa quello che non sa",
        desc: "Se una domanda esce dal catalogo, il bot lo dice chiaramente — meglio \"non lo so\" che un'informazione sbagliata data a un ospite.",
      },
    ],
    pushTitle: "E quando la vacanza finisce,",
    pushAccent: "è lui a farli tornare.",
    pushSub:
      "Il visitatore che ha già scritto una volta è il contatto più prezioso che avete: sa dov'è, si è trovato bene, e vi ha lasciato il numero. Prima di Natale, di Pasqua o dell'estate riceve le vostre offerte per la prossima vacanza — ma solo se ha detto di sì, e con un NO che basta scrivere per non riceverne più.",
    pushSteps: [
      {
        badge: "Durante il soggiorno",
        title: "Solo quello che serve, mentre sono qui",
        desc: "Meteo che cambia, un evento di stasera, una sagra spostata per pioggia: arriva l'avviso a chi è in paese in quel momento. Nessuno in ufficio deve premere niente.",
      },
      {
        badge: "Prima delle feste",
        title: "Natale, Pasqua, estate: il messaggio che li riporta",
        desc: "Finita la vacanza, il contatto resta. Qualche settimana prima delle festività riceve offerte ed eventi della prossima stagione — il periodo in cui si decide davvero dove andare.",
      },
      {
        badge: "Sempre con il consenso",
        title: "Ricevono solo se hanno detto di sì",
        desc: "Il consenso viene chiesto in chat, e basta scrivere NO per smettere di ricevere. Prima di ogni invio il sistema controlla anche di non ripetere una cosa già detta da un'altra iniziativa.",
      },
    ],
    pushBoardTitle: "Ufficio del Turismo",
    pushBoardStatus: "messaggio in uscita",
    pushFirstTag: "campagna: offerte di Natale",
    pushFirstText: "Ciao! Le settimane di Natale in paese sono aperte: mercatini, pista di pattinaggio e alloggi convenzionati. Se volete tornare, vi mandiamo le offerte?",
    pushGuardTag: "campagna: newsletter inverno",
    pushGuardText:
      "Stessa offerta già inviata 3 giorni fa da un'altra iniziativa: invio annullato in automatico, il visitatore non riceve il doppione.",
    pushLabelSent: "inviato",
    pushLabelBlocked: "bloccato prima dell'invio",
    metricsTitle: "Cosa cambia",
    metricsAccent: "per chi sta al banco.",
    metrics: [
      {
        value: "24/7",
        label: "Sempre aperto",
        desc: "Le domande arrivano la sera, il weekend e in alta stagione. La risposta arriva comunque.",
      },
      {
        value: "4+",
        label: "Lingue nella stessa chat",
        desc: "Italiano, inglese, tedesco, spagnolo: ognuno scrive nella sua e riceve nella sua.",
      },
      {
        value: "1",
        label: "Catalogo da aggiornare",
        desc: "Una scheda cambiata vale per tutte le lingue e per tutte le risposte, nello stesso momento.",
      },
      {
        value: "0",
        label: "App da far scaricare",
        desc: "I turisti usano WhatsApp, che hanno già sul telefono. Nessuna registrazione, nessun download.",
      },
    ],
    tryTitle: "Tre conversazioni vere,",
    tryAccent: "non uno slogan.",
    trySub:
      "Scegliete una domanda tipo e guardate esattamente cosa risponderebbe il bot — lo stesso meccanismo che vedrebbero i vostri visitatori.",
    tryReplay: "Rivedi la conversazione",
    scenarios: [
      {
        title: "Bambini e una celiaca",
        rule: "catalogo → ristoranti · filtro senza glutine",
        script: [
          { role: "guest", text: "Siamo con due bambini e mia figlia è celiaca, dove possiamo mangiare?" },
          {
            role: "bot",
            tag: "dal catalogo ristoranti",
            text: "Due locali con cucina senza glutine certificata e menù per bambini: uno in centro, l'altro a cinque minuti con giardino e area giochi. Vi passo i contatti?",
          },
          { role: "guest", text: "Sì, quello con il giardino" },
          {
            role: "bot",
            tag: "dal catalogo ristoranti",
            media: { kind: "photo", emoji: "🍽️", caption: "La sala e il giardino" },
            text: "Eccolo. Cucina separata per il senza glutine, aperto fino alle 22:30. Conviene prenotare nel weekend — vi lascio il numero diretto.",
          },
        ],
      },
      {
        title: "Senza macchina",
        rule: "catalogo → trasporti · raggiungibile a piedi",
        script: [
          { role: "guest", text: "Siamo senza macchina, cosa riusciamo a fare in giornata?" },
          {
            role: "bot",
            tag: "dal catalogo trasporti",
            text: "Con la navetta arrivate agli impianti in 10 minuti, ferma a 200 metri da voi. A piedi invece raggiungete il sentiero delle cascate direttamente dal paese.",
          },
          { role: "guest", text: "Meglio la passeggiata, è fattibile?" },
          {
            role: "bot",
            tag: "dal catalogo escursioni",
            media: { kind: "photo", emoji: "🏞️", caption: "Il sentiero delle cascate" },
            text: "Sì: un'ora e mezza, nessun tratto esposto, si parte dalla piazza. A metà percorso c'è l'area picnic.",
          },
        ],
      },
      {
        title: "Numeri utili",
        rule: "catalogo → contatti · sempre attivo",
        script: [
          { role: "guest", text: "Mia figlia ha la febbre, a chi possiamo rivolgerci? È domenica" },
          {
            role: "bot",
            tag: "dal catalogo numeri utili",
            text: "La guardia medica risponde allo 0435 000000, attiva nei festivi. La farmacia di turno questa settimana è quella in piazza, aperta fino alle 19:00.\n\nPer un'emergenza il numero è 112.",
          },
          { role: "guest", text: "Grazie, e se servisse una farmacia di notte?" },
          {
            role: "bot",
            tag: "dal catalogo numeri utili",
            text: "Di notte il servizio è a chiamata: si telefona allo stesso numero della guardia medica e vi indirizzano alla farmacia reperibile più vicina.",
          },
        ],
      },
      {
        title: "Prudenza e meteo",
        rule: "meteo → catalogo · consiglio di sicurezza",
        script: [
          { role: "guest", text: "Domani pensavamo di salire in cima, che dite?" },
          {
            role: "bot",
            tag: "meteo + catalogo escursioni",
            text: "Domani pomeriggio sono previsti temporali dalle 14:00. Se salite, partite presto e rientrate entro l'ora di pranzo.\n\nPortate giacca antipioggia e scarponi: l'ultimo tratto è su roccia e diventa scivoloso.",
          },
          { role: "guest", text: "Meglio rimandare?" },
          {
            role: "bot",
            tag: "consiglio di prudenza",
            text: "Con i bambini sì, rimanderei: giovedì è previsto sereno. Per domani vi consiglio il sentiero basso lungo il torrente, al riparo e senza tratti esposti.",
          },
        ],
      },
      {
        title: "Foto e video, non solo testo",
        rule: "catalogo → rifugi · media allegati",
        script: [
          { role: "guest", text: "Com'è il rifugio in quota? Vorrei capire prima di salire" },
          {
            role: "bot",
            tag: "dal catalogo rifugi",
            media: { kind: "video", emoji: "🎥", caption: "Il rifugio e la vista", duration: "0:45" },
            text: "Ecco un video. Si sale in seggiovia e poi venti minuti a piedi; la cucina è aperta fino alle 16:00.",
          },
          { role: "guest", text: "Perfetto, e la chiesa antica del paese?" },
          {
            role: "bot",
            tag: "dal catalogo chiese",
            media: { kind: "photo", emoji: "⛪", caption: "L'interno affrescato" },
            text: "È del Settecento, con gli affreschi originali. Aperta tutti i giorni, ingresso libero, a due passi dalla piazza.",
          },
        ],
      },
      {
        title: "Turista straniero",
        rule: "rilevamento lingua · stesso catalogo",
        script: [
          { role: "guest", text: "Hallo, wir suchen einen leichten Wanderweg für morgen" },
          {
            role: "bot",
            tag: "risponde in tedesco",
            text: "Guten Tag! Ich empfehle den Weg zum Waldsee: leicht, ca. 5 km, 1,5 Stunden, kaum Höhenunterschied.",
          },
          { role: "guest", text: "Gibt es dort auch eine Einkehrmöglichkeit?" },
          {
            role: "bot",
            tag: "dal catalogo rifugi",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
    scenarioLangs: "risponde nella lingua di chi scrive",
    scenarioBoardTitle: "Ufficio del Turismo",
    faqTitle: "Le domande",
    faqAccent: "che ci fanno sempre.",
    faqItems: [
      {
        q: "Serve un numero WhatsApp nuovo?",
        a: "No, si può usare il numero che avete già, purché non sia collegato all'app WhatsApp su un telefono. Se preferite tenere separato il numero dell'ufficio, ne attiviamo uno dedicato: decidete voi.",
      },
      {
        q: "Chi aggiorna le informazioni?",
        a: "Le aggiornate voi, da un pannello che si usa come un foglio di calcolo: si apre la scheda dell'evento, si cambia l'orario, si salva. Nessuno deve toccare codice e non serve chiamarci per una modifica.",
      },
      {
        q: "E se il bot non sa rispondere?",
        a: "Lo dice, invece di inventare. Se la domanda esce dal catalogo — o se la persona chiede espressamente di parlare con qualcuno — la conversazione passa a un operatore vero, che la vede e risponde dal pannello.",
      },
      {
        q: "Quanto ci vuole per partire?",
        a: "Dipende quasi solo da quanto materiale avete già pronto. Con un elenco di eventi e strutture da importare si parte in pochi giorni; se il catalogo va costruito da zero, serve qualche settimana di raccolta dati.",
      },
      {
        q: "I dati dei turisti dove finiscono?",
        a: "Restano vostri. I contatti e le conversazioni sono nel vostro spazio, separati da quelli di ogni altro ente, e la gestione è conforme al GDPR. Non vengono usati per addestrare modelli né ceduti a terzi.",
      },
      {
        q: "Funziona anche se non siamo una destinazione di montagna?",
        a: "Sì. Il bot non sa niente della montagna in particolare: sa quello che c'è nel vostro catalogo. Mare, città d'arte, lago o borgo cambiano le schede, non il funzionamento.",
      },
    ],
    ctaTitle: "Parliamo della vostra destinazione",
    ctaDesc: "Una call di 20 minuti per capire cosa avete già e cosa serve per portarlo su WhatsApp.",
  },

  en: {
    seoTitle: "WhatsApp Chatbot for Tourism & Destinations - eChatbot",
    seoDesc:
      "The WhatsApp assistant for tourist boards, DMOs and visitor offices: answers on events, stays and restaurants from your real catalogue, in multiple languages, 24/7. It also knows when to write first, without ever duplicating messages.",
    seoKeys:
      "tourism chatbot, whatsapp tourist board, ai tourism assistant, destination chatbot, whatsapp visitor office, multilingual tourism ai",
    badge: "For tourist boards, DMOs and visitor offices",
    heroTitleTop: "Your WhatsApp number",
    heroTitleAccent: "answers on Sundays too.",
    heroSub:
      "Visitors message the office number the way they'd message a friend. They get events, stays and restaurants straight from your catalogue — in their own language, at eleven at night, while the office is closed.",
    cta: "Request a demo",
    ctaSub: "Tailored demo, no commitment",
    tryDemo: "See the conversations ↓",
    heroProof1: "languages in the same chat",
    heroProof2: "always on, even out of hours",
    heroProof3: "one catalogue to keep updated",
    heroCardTitle: "Tourist Information",
    heroCardStatus: "online",
    heroPhoneTyping: "typing…",
    heroPhoneInput: "Type a message",
    heroModeIn: "Answers whoever writes",
    heroModeOut: "And writes first",
    heroScript: [
      {
        role: "bot",
        tag: "welcome message",
        text: "Welcome! 👋 We're the visitor office: we'll help you through your whole stay.\n\nAsk us what's on today, where to eat, which trails to walk, how to get around or for a useful number — we answer with photos and videos when they help.",
      },
    ],
    painTitle: "The same ten questions,",
    painAccent: "every day, every season.",
    painSub:
      "Anyone who works the desk knows it: most of the job isn't informing, it's repeating. And the questions don't arrive during office hours — they arrive in the evening, at the weekend, in August.",
    painColPain: "Today",
    painColFix: "With the assistant on WhatsApp",
    painRows: [
      {
        icon: "📞",
        pain: "The phone rings for the tenth time with the same question about the festival opening times.",
        fix: "The answer lands in chat in two seconds, and the desk stays free for the people who actually need a human.",
      },
      {
        icon: "🌙",
        pain: "Visitors arriving in the evening or on a Sunday find the office closed and turn to Google, where information about the area is old or wrong.",
        fix: "They message WhatsApp and get your information, the correct one, at any hour.",
      },
      {
        icon: "🌍",
        pain: "A German family walks in and, right then, nobody at the office speaks German.",
        fix: "They write in German and get answers in German, from the same catalogue you read in your own language.",
      },
      {
        icon: "📄",
        pain: "The events leaflet is out of date the day after it's printed — and so is the PDF on the website.",
        fix: "You update one entry in the panel and the answer changes that same instant, for everyone.",
      },
      {
        icon: "🗂️",
        pain: "The same details live on the website, on Facebook, on the leaflet and in the head of whoever's been here twenty years — and they don't match.",
        fix: "One catalogue. What's in it is what the bot answers; what isn't, the bot says it doesn't know.",
      },
      {
        icon: "📣",
        pain: "An event is moved because of rain and there's no way to tell the people who'd asked about it.",
        fix: "The message goes out on its own to the people who asked about that event, and to nobody else.",
      },
    ],
    howTitle: "It starts from your catalogue,",
    howAccent: "not from a six-month project.",
    howSub:
      "There's nothing to program and no rules to write. What you already collect — events, venues, restaurants — becomes what the bot knows how to answer.",
    howSteps: [
      {
        badge: "1",
        title: "Load what you already have",
        desc: "Events, stays, restaurants, trails: every entry you fill in becomes something the bot can answer straight away. If you already keep a list, we import it.",
      },
      {
        badge: "2",
        title: "We connect your number",
        desc: "The tourist board or visitor office number becomes the point of contact. No app for tourists to download: they use the WhatsApp they already have.",
      },
      {
        badge: "3",
        title: "From then on it answers by itself",
        desc: "Every answer is built from your entries, never invented. You update the catalogue when something changes; the rest happens without anyone having to do a thing.",
      },
    ],
    whatTitle: "The questions",
    whatAccent: "that reach the desk today.",
    whatSub:
      "The same ones your office gets by phone or over the counter — except they arrive at any hour, in any language.",
    capabilities: [
      {
        icon: "🎪",
        title: "Events and festivals",
        desc: "Village fairs, patron saint festivals, local markets — with up-to-date dates and times, never a calendar two seasons old.",
      },
      {
        icon: "🏡",
        title: "Stays and availability",
        desc: "Apartments, B&Bs, mountain huts: features, capacity, contacts — whoever's looking for a bed finds the right entry, not a list.",
      },
      {
        icon: "🍽️",
        title: "Restaurants and local food",
        desc: "Traditional dishes, allergens, who's open tonight — including the more specific questions, like \"is there anywhere gluten-free\".",
      },
      {
        icon: "🥾",
        title: "Trails and outdoor activities",
        desc: "Length, elevation gain, difficulty: information that today ends up on a leaflet becomes an instant answer.",
      },
      {
        icon: "🌍",
        title: "Several languages, no manual translation",
        desc: "A German and a Spanish tourist can write in the same chat: each gets an answer in their own language, from the same catalogue.",
      },
      {
        icon: "✅",
        title: "It doesn't invent what it doesn't know",
        desc: "If a question falls outside the catalogue, the bot says so clearly — better \"I don't know\" than wrong information given to a guest.",
      },
    ],
    pushTitle: "And when the holiday ends,",
    pushAccent: "it brings them back.",
    pushSub:
      "A visitor who has written once is the most valuable contact you have: they know the place, they enjoyed it, and they left you their number. Before Christmas, Easter or the summer they get your offers for the next holiday — but only if they said yes, and a single NO stops it for good.",
    pushSteps: [
      {
        badge: "During the stay",
        title: "Only what matters, while they're here",
        desc: "Weather turning, an event tonight, a festival moved because of rain: the alert reaches whoever is in town at that moment. Nobody at the desk has to press anything.",
      },
      {
        badge: "Before the holidays",
        title: "Christmas, Easter, summer: the message that brings them back",
        desc: "The holiday ends, the contact stays. A few weeks before the season they receive offers and events for the next one — exactly when people decide where to go.",
      },
      {
        badge: "Always with consent",
        title: "They only receive it if they said yes",
        desc: "Consent is asked for in the chat, and writing NO is enough to stop it. Before every send the system also checks it isn't repeating something another campaign already said.",
      },
    ],
    pushBoardTitle: "Tourist Information",
    pushBoardStatus: "outbound message",
    pushFirstTag: "campaign: Christmas offers",
    pushFirstText: "Hello! The Christmas weeks in town are open: markets, ice rink and partner accommodation. Shall we send you the offers if you'd like to come back?",
    pushGuardTag: "campaign: winter newsletter",
    pushGuardText:
      "Same offer already sent 3 days ago by another campaign: the send was cancelled automatically, the visitor gets no duplicate.",
    pushLabelSent: "sent",
    pushLabelBlocked: "blocked before sending",
    metricsTitle: "What changes",
    metricsAccent: "for the people at the desk.",
    metrics: [
      {
        value: "24/7",
        label: "Always open",
        desc: "Questions arrive in the evening, at weekends and in high season. The answer arrives anyway.",
      },
      {
        value: "4+",
        label: "Languages in the same chat",
        desc: "Italian, English, German, Spanish: everyone writes in theirs and gets an answer in theirs.",
      },
      {
        value: "1",
        label: "Catalogue to update",
        desc: "One changed entry applies to every language and every answer, at the same moment.",
      },
      {
        value: "0",
        label: "Apps to download",
        desc: "Tourists use WhatsApp, already on their phone. No sign-up, no download.",
      },
    ],
    tryTitle: "Three real conversations,",
    tryAccent: "not a slogan.",
    trySub:
      "Pick a typical question and see exactly what the bot would answer — the same mechanism your visitors would see.",
    tryReplay: "Replay the conversation",
    scenarios: [
      {
        title: "Kids, and one is coeliac",
        rule: "catalogue → restaurants · gluten-free filter",
        script: [
          { role: "guest", text: "We're with two kids and my daughter is coeliac, where can we eat?" },
          {
            role: "bot",
            tag: "from restaurants catalogue",
            text: "Two places with a certified gluten-free kitchen and a children's menu: one in the centre, the other five minutes away with a garden and a play area. Shall I send you the contacts?",
          },
          { role: "guest", text: "Yes, the one with the garden" },
          {
            role: "bot",
            tag: "from restaurants catalogue",
            media: { kind: "photo", emoji: "🍽️", caption: "The dining room and garden" },
            text: "Here it is. Separate kitchen for gluten-free, open until 10:30pm. Worth booking at the weekend — here's their direct number.",
          },
        ],
      },
      {
        title: "No car",
        rule: "catalogue → transport · reachable on foot",
        script: [
          { role: "guest", text: "We have no car, what can we manage today?" },
          {
            role: "bot",
            tag: "from transport catalogue",
            text: "The shuttle gets you to the lifts in 10 minutes and stops 200 metres from you. On foot, the waterfall trail starts right in the village.",
          },
          { role: "guest", text: "The walk sounds better, is it doable?" },
          {
            role: "bot",
            tag: "from trails catalogue",
            media: { kind: "photo", emoji: "🏞️", caption: "The waterfall trail" },
            text: "Yes: an hour and a half, no exposed sections, starting from the square. There's a picnic area halfway.",
          },
        ],
      },
      {
        title: "Useful numbers",
        rule: "catalogue → contacts · always on",
        script: [
          { role: "guest", text: "My daughter has a fever, who can we call? It's Sunday" },
          {
            role: "bot",
            tag: "from useful numbers",
            text: "The out-of-hours doctor answers on 0435 000000, available on Sundays and holidays. The duty pharmacy this week is the one on the square, open until 7pm.\n\nFor an emergency the number is 112.",
          },
          { role: "guest", text: "Thanks, and what if we need a pharmacy at night?" },
          {
            role: "bot",
            tag: "from useful numbers",
            text: "At night it's an on-call service: you ring the same out-of-hours number and they direct you to the nearest pharmacy on duty.",
          },
        ],
      },
      {
        title: "Safety and weather",
        rule: "weather → catalogue · safety advice",
        script: [
          { role: "guest", text: "We were thinking of going up to the summit tomorrow, what do you think?" },
          {
            role: "bot",
            tag: "weather + trails catalogue",
            text: "Thunderstorms are forecast tomorrow from 2pm. If you go up, start early and be back by lunchtime.\n\nTake a rain jacket and proper boots: the last stretch is on rock and gets slippery.",
          },
          { role: "guest", text: "Better to postpone?" },
          {
            role: "bot",
            tag: "safety advice",
            text: "With children, yes, I'd postpone: Thursday is forecast clear. For tomorrow I'd suggest the lower trail along the stream — sheltered, with no exposed sections.",
          },
        ],
      },
      {
        title: "Photos and video, not just text",
        rule: "catalogue → huts · media attached",
        script: [
          { role: "guest", text: "What's the mountain hut like? I'd like to know before going up" },
          {
            role: "bot",
            tag: "from huts catalogue",
            media: { kind: "video", emoji: "🎥", caption: "The hut and the view", duration: "0:45" },
            text: "Here's a video. Chairlift up, then twenty minutes on foot; the kitchen is open until 4pm.",
          },
          { role: "guest", text: "Great, and the old church in the village?" },
          {
            role: "bot",
            tag: "from churches catalogue",
            media: { kind: "photo", emoji: "⛪", caption: "The frescoed interior" },
            text: "It's 18th century, with the original frescoes. Open daily, free entry, a short walk from the square.",
          },
        ],
      },
      {
        title: "Visitor from abroad",
        rule: "language detection · same catalogue",
        script: [
          { role: "guest", text: "Hallo, wir suchen einen leichten Wanderweg für morgen" },
          {
            role: "bot",
            tag: "replies in German",
            text: "Guten Tag! Ich empfehle den Weg zum Waldsee: leicht, ca. 5 km, 1,5 Stunden, kaum Höhenunterschied.",
          },
          { role: "guest", text: "Gibt es dort auch eine Einkehrmöglichkeit?" },
          {
            role: "bot",
            tag: "from huts catalogue",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
    scenarioLangs: "replies in the language the visitor writes in",
    scenarioBoardTitle: "Tourist Information",
    faqTitle: "The questions",
    faqAccent: "we always get asked.",
    faqItems: [
      {
        q: "Do we need a new WhatsApp number?",
        a: "No, you can use the number you already have, as long as it isn't tied to the WhatsApp app on a phone. If you'd rather keep the office number separate, we set up a dedicated one: it's your call.",
      },
      {
        q: "Who keeps the information up to date?",
        a: "You do, from a panel that works like a spreadsheet: open the event, change the time, save. Nobody has to touch code and you don't have to call us for an edit.",
      },
      {
        q: "What if the bot can't answer?",
        a: "It says so instead of inventing. If the question falls outside the catalogue — or the person explicitly asks for a human — the conversation moves to a real operator, who sees it and replies from the panel.",
      },
      {
        q: "How long does it take to go live?",
        a: "Almost entirely down to how much material you already have ready. With a list of events and venues to import you're live in a few days; if the catalogue has to be built from scratch, allow a few weeks of gathering data.",
      },
      {
        q: "Where does visitor data end up?",
        a: "It stays yours. Contacts and conversations live in your own space, separate from every other organisation's, and handling is GDPR-compliant. It is never used to train models nor passed to third parties.",
      },
      {
        q: "Does it work if we're not a mountain destination?",
        a: "Yes. The bot knows nothing about mountains in particular: it knows what's in your catalogue. Seaside, art city, lake or village changes the entries, not how it works.",
      },
    ],
    ctaTitle: "Let's talk about your destination",
    ctaDesc: "A 20-minute call to understand what you already have and what it takes to bring it to WhatsApp.",
  },

  es: {
    seoTitle: "Chatbot de WhatsApp para Turismo y Destinos - eChatbot",
    seoDesc:
      "El asistente de WhatsApp para oficinas de turismo, patronatos y entes de destino: responde sobre eventos, alojamientos y restaurantes desde tu catálogo real, en varios idiomas, 24/7. También sabe cuándo escribir primero, sin duplicar nunca los mensajes.",
    seoKeys:
      "chatbot turismo, whatsapp oficina de turismo, asistente turístico ia, chatbot destino turístico, whatsapp patronato turismo, ia multilingüe turismo",
    badge: "Para oficinas de turismo, patronatos y entes de destino",
    heroTitleTop: "Vuestro número de WhatsApp",
    heroTitleAccent: "también responde en domingo.",
    heroSub:
      "Los visitantes escriben al número de la oficina como le escribirían a un amigo. Reciben eventos, alojamientos y restaurantes sacados de vuestro catálogo — en su idioma, a las once de la noche, con la oficina cerrada.",
    cta: "Solicita una demo",
    ctaSub: "Demo a medida, sin compromiso",
    tryDemo: "Mira las conversaciones ↓",
    heroProof1: "idiomas en el mismo chat",
    heroProof2: "siempre activo, también fuera de horario",
    heroProof3: "un solo catálogo que actualizar",
    heroCardTitle: "Oficina de Turismo",
    heroCardStatus: "en línea",
    heroPhoneTyping: "escribiendo…",
    heroPhoneInput: "Escribe un mensaje",
    heroModeIn: "Responde a quien escribe",
    heroModeOut: "Y escribe primero",
    heroScript: [
      {
        role: "bot",
        tag: "mensaje de bienvenida",
        text: "¡Bienvenidos! 👋 Somos la oficina de turismo: os echamos una mano durante toda la estancia.\n\nPreguntadnos qué hacer hoy, dónde comer, qué senderos recorrer, cómo moveros o un número útil — respondemos con fotos y vídeos cuando hacen falta.",
      },
    ],
    painTitle: "Las mismas diez preguntas,",
    painAccent: "todos los días, cada temporada.",
    painSub:
      "Quien está en el mostrador lo sabe: la mayor parte del trabajo no es informar, es repetir. Y las preguntas no llegan en horario de oficina — llegan por la tarde, el fin de semana, en agosto.",
    painColPain: "Hoy",
    painColFix: "Con el asistente en WhatsApp",
    painRows: [
      {
        icon: "📞",
        pain: "El teléfono suena por décima vez con la misma pregunta sobre los horarios de la fiesta.",
        fix: "La respuesta llega al chat en dos segundos, y el mostrador queda libre para quien de verdad necesita a una persona.",
      },
      {
        icon: "🌙",
        pain: "Quien llega por la tarde o en domingo encuentra la oficina cerrada y busca en Google, donde la información del pueblo está vieja o es errónea.",
        fix: "Escribe por WhatsApp y recibe vuestra información, la correcta, a cualquier hora.",
      },
      {
        icon: "🌍",
        pain: "Llega una familia alemana y en la oficina, en ese momento, no hay nadie que hable alemán.",
        fix: "Escriben en alemán y reciben respuesta en alemán, del mismo catálogo que vosotros leéis en vuestro idioma.",
      },
      {
        icon: "📄",
        pain: "El folleto de eventos ya está viejo al día siguiente de imprimirlo, y el PDF de la web también.",
        fix: "Actualizáis una ficha en el panel y la respuesta cambia en ese mismo instante, para todos.",
      },
      {
        icon: "🗂️",
        pain: "La misma información está en la web, en Facebook, en el folleto y en la cabeza de quien lleva veinte años aquí — y no coinciden.",
        fix: "Un solo catálogo. Lo que hay dentro es lo que el bot responde; lo que no está, el bot dice que no lo sabe.",
      },
      {
        icon: "📣",
        pain: "Un evento se aplaza por lluvia y no hay forma de avisar a quien había preguntado por él.",
        fix: "El mensaje sale solo hacia quien preguntó por ese evento, y hacia nadie más.",
      },
    ],
    howTitle: "Se parte de vuestro catálogo,",
    howAccent: "no de un proyecto de seis meses.",
    howSub:
      "No hay nada que programar ni reglas que escribir. Lo que ya recopiláis — eventos, establecimientos, restaurantes — se convierte en lo que el bot sabe responder.",
    howSteps: [
      {
        badge: "1",
        title: "Cargáis lo que ya tenéis",
        desc: "Eventos, alojamientos, restaurantes, senderos: cada ficha que rellenáis en el panel se convierte enseguida en algo que el bot sabe responder. Si ya tenéis un listado, se importa.",
      },
      {
        badge: "2",
        title: "Conectamos vuestro número",
        desc: "El número de la oficina de turismo pasa a ser el punto de contacto. Ninguna app que los turistas tengan que descargar: usan el WhatsApp que ya tienen.",
      },
      {
        badge: "3",
        title: "A partir de ahí responde solo",
        desc: "Cada respuesta se construye con vuestras fichas, no se inventa. Vosotros actualizáis el catálogo cuando algo cambia; lo demás ocurre sin que nadie tenga que hacer nada.",
      },
    ],
    whatTitle: "Las preguntas que",
    whatAccent: "hoy llegan al mostrador.",
    whatSub:
      "Las mismas que vuestra oficina recibe por teléfono o en el mostrador — solo que llegan a cualquier hora, y en cualquier idioma.",
    capabilities: [
      {
        icon: "🎪",
        title: "Eventos y fiestas",
        desc: "Fiestas del pueblo, fiestas patronales, mercadillos locales — con fechas y horarios actualizados, nunca un calendario de hace dos temporadas.",
      },
      {
        icon: "🏡",
        title: "Alojamientos y disponibilidad",
        desc: "Apartamentos, casas rurales, refugios: características, capacidad, contactos — quien busca dónde dormir encuentra la ficha correcta, no un listado.",
      },
      {
        icon: "🍽️",
        title: "Restaurantes y cocina local",
        desc: "Platos típicos, alérgenos, quién abre esta noche — incluidas las preguntas más concretas, tipo \"¿hay algún sitio sin gluten?\".",
      },
      {
        icon: "🥾",
        title: "Senderos y actividades al aire libre",
        desc: "Longitud, desnivel, dificultad: información que hoy acaba en un folleto se convierte en una respuesta inmediata.",
      },
      {
        icon: "🌍",
        title: "Varios idiomas, sin traducir a mano",
        desc: "Un turista alemán y uno español pueden escribir en el mismo chat: cada uno recibe respuesta en su idioma, del mismo catálogo.",
      },
      {
        icon: "✅",
        title: "No inventa lo que no sabe",
        desc: "Si una pregunta se sale del catálogo, el bot lo dice claramente — mejor un \"no lo sé\" que una información equivocada dada a un huésped.",
      },
    ],
    pushTitle: "Y cuando acaba las vacaciones,",
    pushAccent: "es él quien les hace volver.",
    pushSub:
      "El visitante que ya os ha escrito una vez es el contacto más valioso que tenéis: conoce el sitio, se encontró a gusto y os dejó su número. Antes de Navidad, Semana Santa o el verano recibe vuestras ofertas para las próximas vacaciones — pero solo si dijo que sí, y con un NO deja de recibirlas.",
    pushSteps: [
      {
        badge: "Durante la estancia",
        title: "Solo lo que hace falta, mientras están aquí",
        desc: "El tiempo cambia, un evento esta noche, una fiesta aplazada por lluvia: el aviso llega a quien está en el pueblo en ese momento. Nadie en la oficina tiene que pulsar nada.",
      },
      {
        badge: "Antes de las fiestas",
        title: "Navidad, Semana Santa, verano: el mensaje que les trae de vuelta",
        desc: "Acaban las vacaciones, el contacto se queda. Unas semanas antes de la temporada recibe ofertas y eventos de la siguiente — justo cuando se decide adónde ir.",
      },
      {
        badge: "Siempre con consentimiento",
        title: "Solo lo reciben si han dicho que sí",
        desc: "El consentimiento se pide en el chat, y basta con escribir NO para dejar de recibir. Antes de cada envío el sistema comprueba además que no repite algo que ya dijo otra campaña.",
      },
    ],
    pushBoardTitle: "Oficina de Turismo",
    pushBoardStatus: "mensaje saliente",
    pushFirstTag: "campaña: ofertas de Navidad",
    pushFirstText: "¡Hola! Las semanas de Navidad en el pueblo ya están en marcha: mercadillos, pista de hielo y alojamientos concertados. ¿Os mandamos las ofertas si queréis volver?",
    pushGuardTag: "campaña: newsletter de invierno",
    pushGuardText:
      "La misma oferta ya se envió hace 3 días desde otra campaña: envío cancelado automáticamente, el visitante no recibe el duplicado.",
    pushLabelSent: "enviado",
    pushLabelBlocked: "bloqueado antes del envío",
    metricsTitle: "Qué cambia",
    metricsAccent: "para quien está en el mostrador.",
    metrics: [
      {
        value: "24/7",
        label: "Siempre abierto",
        desc: "Las preguntas llegan por la tarde, el fin de semana y en temporada alta. La respuesta llega igualmente.",
      },
      {
        value: "4+",
        label: "Idiomas en el mismo chat",
        desc: "Italiano, inglés, alemán, español: cada uno escribe en el suyo y recibe en el suyo.",
      },
      {
        value: "1",
        label: "Catálogo que actualizar",
        desc: "Una ficha cambiada vale para todos los idiomas y para todas las respuestas, en el mismo momento.",
      },
      {
        value: "0",
        label: "Apps que descargar",
        desc: "Los turistas usan WhatsApp, que ya tienen en el móvil. Sin registro, sin descargas.",
      },
    ],
    tryTitle: "Tres conversaciones reales,",
    tryAccent: "no un eslogan.",
    trySub:
      "Elegid una pregunta tipo y ved exactamente qué respondería el bot — el mismo mecanismo que verían vuestros visitantes.",
    tryReplay: "Volver a ver la conversación",
    scenarios: [
      {
        title: "Con niños y una celíaca",
        rule: "catálogo → restaurantes · filtro sin gluten",
        script: [
          { role: "guest", text: "Vamos con dos niños y mi hija es celíaca, ¿dónde podemos comer?" },
          {
            role: "bot",
            tag: "del catálogo de restaurantes",
            text: "Dos locales con cocina sin gluten certificada y menú infantil: uno en el centro y otro a cinco minutos con jardín y zona de juegos. ¿Os paso los contactos?",
          },
          { role: "guest", text: "Sí, el del jardín" },
          {
            role: "bot",
            tag: "del catálogo de restaurantes",
            media: { kind: "photo", emoji: "🍽️", caption: "La sala y el jardín" },
            text: "Aquí lo tenéis. Cocina separada para el sin gluten, abierto hasta las 22:30. Conviene reservar el fin de semana — os dejo el teléfono directo.",
          },
        ],
      },
      {
        title: "Sin coche",
        rule: "catálogo → transporte · accesible a pie",
        script: [
          { role: "guest", text: "Estamos sin coche, ¿qué podemos hacer hoy?" },
          {
            role: "bot",
            tag: "del catálogo de transporte",
            text: "Con la lanzadera llegáis a los remontes en 10 minutos, para a 200 metros de vosotros. A pie, el sendero de las cascadas sale del propio pueblo.",
          },
          { role: "guest", text: "Mejor el paseo, ¿es factible?" },
          {
            role: "bot",
            tag: "del catálogo de senderos",
            media: { kind: "photo", emoji: "🏞️", caption: "El sendero de las cascadas" },
            text: "Sí: hora y media, sin tramos expuestos, se sale de la plaza. A mitad de camino hay zona de picnic.",
          },
        ],
      },
      {
        title: "Números útiles",
        rule: "catálogo → contactos · siempre activo",
        script: [
          { role: "guest", text: "Mi hija tiene fiebre, ¿a quién podemos llamar? Es domingo" },
          {
            role: "bot",
            tag: "del catálogo de números útiles",
            text: "El médico de guardia responde en el 0435 000000, activo los festivos. La farmacia de guardia esta semana es la de la plaza, abierta hasta las 19:00.\n\nPara una emergencia el número es 112.",
          },
          { role: "guest", text: "Gracias, ¿y si hiciera falta una farmacia de noche?" },
          {
            role: "bot",
            tag: "del catálogo de números útiles",
            text: "De noche el servicio es a demanda: se llama al mismo número del médico de guardia y os indican la farmacia de guardia más cercana.",
          },
        ],
      },
      {
        title: "Prudencia y meteo",
        rule: "meteo → catálogo · consejo de seguridad",
        script: [
          { role: "guest", text: "Mañana pensábamos subir a la cima, ¿qué os parece?" },
          {
            role: "bot",
            tag: "meteo + catálogo de senderos",
            text: "Mañana por la tarde se prevén tormentas a partir de las 14:00. Si subís, salid temprano y volved antes de comer.\n\nLlevad chubasquero y botas: el último tramo es de roca y se vuelve resbaladizo.",
          },
          { role: "guest", text: "¿Mejor aplazarlo?" },
          {
            role: "bot",
            tag: "consejo de prudencia",
            text: "Con niños sí, yo lo aplazaría: el jueves se prevé despejado. Para mañana os recomiendo el sendero bajo junto al torrente, resguardado y sin tramos expuestos.",
          },
        ],
      },
      {
        title: "Fotos y vídeo, no solo texto",
        rule: "catálogo → refugios · media adjunta",
        script: [
          { role: "guest", text: "¿Cómo es el refugio de montaña? Me gustaría verlo antes de subir" },
          {
            role: "bot",
            tag: "del catálogo de refugios",
            media: { kind: "video", emoji: "🎥", caption: "El refugio y las vistas", duration: "0:45" },
            text: "Aquí va un vídeo. Se sube en telesilla y luego veinte minutos a pie; la cocina está abierta hasta las 16:00.",
          },
          { role: "guest", text: "Perfecto, ¿y la iglesia antigua del pueblo?" },
          {
            role: "bot",
            tag: "del catálogo de iglesias",
            media: { kind: "photo", emoji: "⛪", caption: "El interior con frescos" },
            text: "Es del siglo XVIII, con los frescos originales. Abierta a diario, entrada libre, a dos pasos de la plaza.",
          },
        ],
      },
      {
        title: "Turista extranjero",
        rule: "detección de idioma · mismo catálogo",
        script: [
          { role: "guest", text: "Hallo, wir suchen einen leichten Wanderweg für morgen" },
          {
            role: "bot",
            tag: "responde en alemán",
            text: "Guten Tag! Ich empfehle den Weg zum Waldsee: leicht, ca. 5 km, 1,5 Stunden, kaum Höhenunterschied.",
          },
          { role: "guest", text: "Gibt es dort auch eine Einkehrmöglichkeit?" },
          {
            role: "bot",
            tag: "del catálogo de refugios",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
    scenarioLangs: "responde en el idioma de quien escribe",
    scenarioBoardTitle: "Oficina de Turismo",
    faqTitle: "Las preguntas",
    faqAccent: "que siempre nos hacen.",
    faqItems: [
      {
        q: "¿Hace falta un número de WhatsApp nuevo?",
        a: "No, se puede usar el número que ya tenéis, siempre que no esté vinculado a la app de WhatsApp en un móvil. Si preferís mantener separado el número de la oficina, activamos uno dedicado: lo decidís vosotros.",
      },
      {
        q: "¿Quién actualiza la información?",
        a: "La actualizáis vosotros, desde un panel que se usa como una hoja de cálculo: se abre la ficha del evento, se cambia el horario, se guarda. Nadie tiene que tocar código y no hace falta llamarnos por un cambio.",
      },
      {
        q: "¿Y si el bot no sabe responder?",
        a: "Lo dice, en vez de inventar. Si la pregunta se sale del catálogo — o si la persona pide expresamente hablar con alguien — la conversación pasa a un operador real, que la ve y responde desde el panel.",
      },
      {
        q: "¿Cuánto se tarda en arrancar?",
        a: "Depende casi solo de cuánto material tengáis ya listo. Con un listado de eventos y establecimientos para importar se arranca en pocos días; si el catálogo hay que construirlo desde cero, contad unas semanas de recogida de datos.",
      },
      {
        q: "¿Dónde acaban los datos de los turistas?",
        a: "Siguen siendo vuestros. Los contactos y las conversaciones están en vuestro espacio, separados de los de cualquier otro ente, y la gestión cumple el RGPD. No se usan para entrenar modelos ni se ceden a terceros.",
      },
      {
        q: "¿Funciona aunque no seamos un destino de montaña?",
        a: "Sí. El bot no sabe nada de montaña en particular: sabe lo que hay en vuestro catálogo. Costa, ciudad histórica, lago o pueblo cambian las fichas, no el funcionamiento.",
      },
    ],
    ctaTitle: "Hablemos de vuestro destino",
    ctaDesc: "Una llamada de 20 minutos para entender qué tenéis ya y qué hace falta para llevarlo a WhatsApp.",
  },

  de: {
    seoTitle: "WhatsApp-Chatbot für Tourismus und Destinationen - eChatbot",
    seoDesc:
      "Der WhatsApp-Assistent für Tourismusvereine, Tourismusverbände und Infobüros: beantwortet Fragen zu Veranstaltungen, Unterkünften und Restaurants aus Ihrem echten Katalog, mehrsprachig, rund um die Uhr. Er weiß auch, wann er von sich aus schreibt — ohne je Nachrichten zu doppeln.",
    seoKeys:
      "chatbot tourismus, whatsapp tourismusverband, ki assistent tourismus, chatbot destination, whatsapp infobüro, mehrsprachige ki tourismus",
    badge: "Für Tourismusvereine, Tourismusverbände und Infobüros",
    heroTitleTop: "Ihre WhatsApp-Nummer",
    heroTitleAccent: "antwortet auch sonntags.",
    heroSub:
      "Gäste schreiben der Nummer des Büros, wie sie einem Freund schreiben würden. Sie bekommen Veranstaltungen, Unterkünfte und Restaurants direkt aus Ihrem Katalog — in ihrer Sprache, um elf Uhr abends, auch wenn das Büro geschlossen ist.",
    cta: "Demo anfragen",
    ctaSub: "Maßgeschneiderte Demo, unverbindlich",
    tryDemo: "Gespräche ansehen ↓",
    heroProof1: "Sprachen im selben Chat",
    heroProof2: "immer erreichbar, auch außerhalb der Öffnungszeiten",
    heroProof3: "nur ein Katalog zu pflegen",
    heroCardTitle: "Tourist-Information",
    heroCardStatus: "online",
    heroPhoneTyping: "schreibt…",
    heroPhoneInput: "Nachricht schreiben",
    heroModeIn: "Antwortet allen, die schreiben",
    heroModeOut: "Und schreibt von sich aus",
    heroScript: [
      {
        role: "bot",
        tag: "Willkommensnachricht",
        text: "Herzlich willkommen! 👋 Wir sind die Tourismusinformation und begleiten Sie durch Ihren ganzen Aufenthalt.\n\nFragen Sie uns, was heute los ist, wo man essen kann, welche Wege sich lohnen, wie Sie unterwegs sind oder nach einer nützlichen Nummer — wir antworten mit Fotos und Videos, wo sie helfen.",
      },
    ],
    painTitle: "Dieselben zehn Fragen,",
    painAccent: "jeden Tag, in jeder Saison.",
    painSub:
      "Wer am Schalter steht, kennt das: Der größte Teil der Arbeit ist nicht informieren, sondern wiederholen. Und die Fragen kommen nicht zu den Öffnungszeiten — sie kommen abends, am Wochenende, im August.",
    painColPain: "Heute",
    painColFix: "Mit dem Assistenten auf WhatsApp",
    painRows: [
      {
        icon: "📞",
        pain: "Das Telefon klingelt zum zehnten Mal mit derselben Frage nach den Öffnungszeiten des Festes.",
        fix: "Die Antwort kommt in zwei Sekunden im Chat an, und der Schalter bleibt frei für alle, die wirklich einen Menschen brauchen.",
      },
      {
        icon: "🌙",
        pain: "Wer abends oder sonntags ankommt, findet das Büro geschlossen und sucht bei Google, wo die Infos zum Ort veraltet oder falsch sind.",
        fix: "Er schreibt auf WhatsApp und bekommt Ihre Information, die richtige, zu jeder Uhrzeit.",
      },
      {
        icon: "🌍",
        pain: "Eine deutsche Familie kommt herein, und im Büro ist in diesem Moment niemand, der Deutsch spricht.",
        fix: "Sie schreiben auf Deutsch und bekommen Antwort auf Deutsch — aus demselben Katalog, den Sie in Ihrer Sprache lesen.",
      },
      {
        icon: "📄",
        pain: "Der Veranstaltungsflyer ist am Tag nach dem Druck schon veraltet, das PDF auf der Website ebenso.",
        fix: "Sie ändern einen Eintrag im Panel, und die Antwort ändert sich im selben Augenblick — für alle.",
      },
      {
        icon: "🗂️",
        pain: "Dieselben Informationen stehen auf der Website, auf Facebook, im Flyer und im Kopf derjenigen, die seit zwanzig Jahren dabei sind — und sie stimmen nicht überein.",
        fix: "Nur ein Katalog. Was darin steht, antwortet der Bot; was nicht darin steht, sagt er ehrlich, dass er es nicht weiß.",
      },
      {
        icon: "📣",
        pain: "Eine Veranstaltung wird wegen Regen verschoben, und es gibt keine Möglichkeit, alle zu informieren, die danach gefragt hatten.",
        fix: "Die Nachricht geht von selbst an genau die Leute, die nach dieser Veranstaltung gefragt hatten — und an sonst niemanden.",
      },
    ],
    howTitle: "Es beginnt mit Ihrem Katalog,",
    howAccent: "nicht mit einem Sechs-Monats-Projekt.",
    howSub:
      "Es gibt nichts zu programmieren und keine Regeln zu schreiben. Was Sie ohnehin schon sammeln — Veranstaltungen, Betriebe, Restaurants — wird zu dem, was der Bot beantworten kann.",
    howSteps: [
      {
        badge: "1",
        title: "Sie laden hoch, was Sie schon haben",
        desc: "Veranstaltungen, Unterkünfte, Restaurants, Wanderwege: Jeder Eintrag, den Sie im Panel ausfüllen, wird sofort zu etwas, das der Bot beantworten kann. Wenn Sie schon eine Liste führen, importieren wir sie.",
      },
      {
        badge: "2",
        title: "Wir binden Ihre Nummer an",
        desc: "Die Nummer des Tourismusvereins oder des Infobüros wird zum Kontaktpunkt. Keine App, die Gäste herunterladen müssen: Sie nutzen das WhatsApp, das sie ohnehin haben.",
      },
      {
        badge: "3",
        title: "Ab da antwortet er von allein",
        desc: "Jede Antwort entsteht aus Ihren Einträgen, nichts wird erfunden. Sie pflegen den Katalog, wenn sich etwas ändert; der Rest passiert, ohne dass jemand etwas tun muss.",
      },
    ],
    whatTitle: "Die Fragen,",
    whatAccent: "die heute am Schalter ankommen.",
    whatSub:
      "Genau dieselben, die Ihr Büro am Telefon oder am Schalter bekommt — nur dass sie zu jeder Uhrzeit und in jeder Sprache eintreffen.",
    capabilities: [
      {
        icon: "🎪",
        title: "Veranstaltungen und Feste",
        desc: "Dorffeste, Patronatsfeste, lokale Märkte — mit aktuellen Daten und Uhrzeiten, nie ein Kalender von vor zwei Saisonen.",
      },
      {
        icon: "🏡",
        title: "Unterkünfte und Verfügbarkeit",
        desc: "Ferienwohnungen, Pensionen, Hütten: Ausstattung, Kapazität, Kontakte — wer eine Unterkunft sucht, findet den passenden Eintrag, keine Liste.",
      },
      {
        icon: "🍽️",
        title: "Restaurants und regionale Küche",
        desc: "Typische Gerichte, Allergene, wer heute Abend geöffnet hat — auch die konkreteren Fragen, etwa \"gibt es etwas Glutenfreies\".",
      },
      {
        icon: "🥾",
        title: "Wanderwege und Outdoor-Aktivitäten",
        desc: "Länge, Höhenmeter, Schwierigkeit: Informationen, die heute auf einem Flyer landen, werden zur sofortigen Antwort.",
      },
      {
        icon: "🌍",
        title: "Mehrere Sprachen, ohne Handübersetzung",
        desc: "Ein deutscher und ein spanischer Gast können im selben Chat schreiben: Jeder bekommt die Antwort in seiner Sprache, aus demselben Katalog.",
      },
      {
        icon: "✅",
        title: "Er erfindet nichts, was er nicht weiß",
        desc: "Fällt eine Frage aus dem Katalog heraus, sagt der Bot das klar — lieber ein \"weiß ich nicht\" als eine falsche Auskunft an einen Gast.",
      },
    ],
    pushTitle: "Und wenn der Urlaub endet,",
    pushAccent: "holt er sie zurück.",
    pushSub:
      "Ein Gast, der Ihnen einmal geschrieben hat, ist Ihr wertvollster Kontakt: Er kennt den Ort, es hat ihm gefallen, und er hat Ihnen seine Nummer hinterlassen. Vor Weihnachten, Ostern oder dem Sommer bekommt er Ihre Angebote für den nächsten Urlaub — aber nur, wenn er zugestimmt hat, und ein einziges NEIN beendet es dauerhaft.",
    pushSteps: [
      {
        badge: "Während des Aufenthalts",
        title: "Nur das Nötige, solange sie hier sind",
        desc: "Wetterumschwung, eine Veranstaltung heute Abend, ein wegen Regen verschobenes Fest: Die Nachricht erreicht, wer gerade im Ort ist. Niemand am Schalter muss etwas drücken.",
      },
      {
        badge: "Vor den Feiertagen",
        title: "Weihnachten, Ostern, Sommer: die Nachricht, die sie zurückholt",
        desc: "Der Urlaub endet, der Kontakt bleibt. Einige Wochen vor der Saison kommen Angebote und Veranstaltungen für die nächste — genau dann, wenn entschieden wird, wohin es geht.",
      },
      {
        badge: "Immer mit Einwilligung",
        title: "Sie erhalten es nur, wenn sie zugestimmt haben",
        desc: "Die Einwilligung wird im Chat eingeholt, und ein NEIN genügt, um nichts mehr zu erhalten. Vor jedem Versand prüft das System zudem, dass es nichts wiederholt, was eine andere Kampagne bereits gesagt hat.",
      },
    ],
    pushBoardTitle: "Tourismusinformation",
    pushBoardStatus: "ausgehende Nachricht",
    pushFirstTag: "Kampagne: Weihnachtsangebote",
    pushFirstText: "Hallo! Die Weihnachtswochen im Ort haben begonnen: Märkte, Eisbahn und Partnerunterkünfte. Sollen wir Ihnen die Angebote schicken, falls Sie wiederkommen möchten?",
    pushGuardTag: "Kampagne: Winter-Newsletter",
    pushGuardText:
      "Dasselbe Angebot wurde vor 3 Tagen bereits von einer anderen Kampagne verschickt: Versand automatisch abgebrochen, der Gast erhält kein Duplikat.",
    pushLabelSent: "gesendet",
    pushLabelBlocked: "vor dem Versand gestoppt",
    metricsTitle: "Was sich ändert",
    metricsAccent: "für alle am Schalter.",
    metrics: [
      {
        value: "24/7",
        label: "Immer geöffnet",
        desc: "Fragen kommen abends, am Wochenende und in der Hochsaison. Die Antwort kommt trotzdem.",
      },
      {
        value: "4+",
        label: "Sprachen im selben Chat",
        desc: "Italienisch, Englisch, Deutsch, Spanisch: Jeder schreibt in seiner Sprache und bekommt Antwort in seiner Sprache.",
      },
      {
        value: "1",
        label: "Katalog zu pflegen",
        desc: "Ein geänderter Eintrag gilt für alle Sprachen und alle Antworten, im selben Moment.",
      },
      {
        value: "0",
        label: "Apps zum Herunterladen",
        desc: "Gäste nutzen WhatsApp, das sie schon auf dem Handy haben. Keine Registrierung, kein Download.",
      },
    ],
    tryTitle: "Drei echte Gespräche,",
    tryAccent: "kein Werbespruch.",
    trySub:
      "Wählen Sie eine typische Frage und sehen Sie genau, was der Bot antworten würde — derselbe Ablauf, den Ihre Gäste sehen würden.",
    tryReplay: "Gespräch erneut ansehen",
    scenarios: [
      {
        title: "Mit Kindern, eines mit Zöliakie",
        rule: "Katalog → Restaurants · glutenfrei-Filter",
        script: [
          { role: "guest", text: "Wir sind mit zwei Kindern da und meine Tochter hat Zöliakie, wo können wir essen?" },
          {
            role: "bot",
            tag: "aus dem Restaurantkatalog",
            text: "Zwei Lokale mit zertifizierter glutenfreier Küche und Kindermenü: eines im Zentrum, das andere fünf Minuten entfernt mit Garten und Spielplatz. Soll ich Ihnen die Kontakte schicken?",
          },
          { role: "guest", text: "Ja, das mit dem Garten" },
          {
            role: "bot",
            tag: "aus dem Restaurantkatalog",
            media: { kind: "photo", emoji: "🍽️", caption: "Gastraum und Garten" },
            text: "Hier ist es. Getrennte Küche für glutenfrei, geöffnet bis 22:30 Uhr. Am Wochenende besser reservieren — hier die direkte Nummer.",
          },
        ],
      },
      {
        title: "Ohne Auto",
        rule: "Katalog → Verkehr · zu Fuß erreichbar",
        script: [
          { role: "guest", text: "Wir sind ohne Auto, was schaffen wir heute?" },
          {
            role: "bot",
            tag: "aus dem Verkehrskatalog",
            text: "Mit dem Shuttle sind Sie in 10 Minuten an den Liften, die Haltestelle ist 200 Meter entfernt. Zu Fuß beginnt der Wasserfallweg direkt im Ort.",
          },
          { role: "guest", text: "Der Spaziergang klingt besser, ist er machbar?" },
          {
            role: "bot",
            tag: "aus dem Wanderkatalog",
            media: { kind: "photo", emoji: "🏞️", caption: "Der Wasserfallweg" },
            text: "Ja: anderthalb Stunden, keine ausgesetzten Stellen, Start am Platz. Auf halber Strecke gibt es einen Picknickplatz.",
          },
        ],
      },
      {
        title: "Nützliche Nummern",
        rule: "Katalog → Kontakte · immer erreichbar",
        script: [
          { role: "guest", text: "Meine Tochter hat Fieber, an wen können wir uns wenden? Es ist Sonntag" },
          {
            role: "bot",
            tag: "aus den nützlichen Nummern",
            text: "Der ärztliche Bereitschaftsdienst ist unter 0435 000000 erreichbar, auch an Feiertagen. Die diensthabende Apotheke ist diese Woche die am Platz, geöffnet bis 19:00 Uhr.\n\nIm Notfall gilt die 112.",
          },
          { role: "guest", text: "Danke, und wenn wir nachts eine Apotheke brauchen?" },
          {
            role: "bot",
            tag: "aus den nützlichen Nummern",
            text: "Nachts läuft es über Rufbereitschaft: Sie rufen dieselbe Nummer des Bereitschaftsdienstes an und man verweist Sie an die nächste diensthabende Apotheke.",
          },
        ],
      },
      {
        title: "Vorsicht und Wetter",
        rule: "Wetter → Katalog · Sicherheitshinweis",
        script: [
          { role: "guest", text: "Wir wollten morgen auf den Gipfel, was meinen Sie?" },
          {
            role: "bot",
            tag: "Wetter + Wanderkatalog",
            text: "Für morgen Nachmittag sind ab 14:00 Uhr Gewitter angesagt. Wenn Sie hinaufgehen, starten Sie früh und seien Sie bis mittags zurück.\n\nNehmen Sie Regenjacke und feste Schuhe mit: Das letzte Stück führt über Fels und wird rutschig.",
          },
          { role: "guest", text: "Lieber verschieben?" },
          {
            role: "bot",
            tag: "Sicherheitshinweis",
            text: "Mit Kindern ja, ich würde verschieben: Für Donnerstag ist es heiter gemeldet. Für morgen empfehle ich den unteren Weg am Bach — geschützt und ohne ausgesetzte Stellen.",
          },
        ],
      },
      {
        title: "Fotos und Video, nicht nur Text",
        rule: "Katalog → Hütten · Medien angehängt",
        script: [
          { role: "guest", text: "Wie ist die Berghütte? Ich würde es gern vorher sehen" },
          {
            role: "bot",
            tag: "aus dem Hüttenkatalog",
            media: { kind: "video", emoji: "🎥", caption: "Die Hütte und die Aussicht", duration: "0:45" },
            text: "Hier ein Video. Mit dem Sessellift hinauf, dann zwanzig Minuten zu Fuß; die Küche ist bis 16:00 Uhr geöffnet.",
          },
          { role: "guest", text: "Super, und die alte Kirche im Ort?" },
          {
            role: "bot",
            tag: "aus dem Kirchenkatalog",
            media: { kind: "photo", emoji: "⛪", caption: "Der freskierte Innenraum" },
            text: "Sie stammt aus dem 18. Jahrhundert, mit den originalen Fresken. Täglich geöffnet, Eintritt frei, wenige Schritte vom Platz.",
          },
        ],
      },
      {
        title: "Gast aus dem Ausland",
        rule: "Spracherkennung · derselbe Katalog",
        script: [
          { role: "guest", text: "Hello, we are looking for an easy walk for tomorrow" },
          {
            role: "bot",
            tag: "antwortet auf Englisch",
            text: "Hello! I'd suggest the forest lake trail: easy, about 5 km, 1.5 hours, hardly any climb.",
          },
          { role: "guest", text: "Is there somewhere to eat along the way?" },
          {
            role: "bot",
            tag: "aus dem Hüttenkatalog",
            text: "Yes, right by the lake there's an alpine hut serving hot food, open until 6pm.",
          },
        ],
      },
    ],
    scenarioLangs: "antwortet in der Sprache des Gastes",
    scenarioBoardTitle: "Tourismusinformation",
    faqTitle: "Die Fragen,",
    faqAccent: "die uns immer gestellt werden.",
    faqItems: [
      {
        q: "Brauchen wir eine neue WhatsApp-Nummer?",
        a: "Nein, Sie können die Nummer nutzen, die Sie schon haben — solange sie nicht mit der WhatsApp-App auf einem Handy verknüpft ist. Wenn Sie die Büronummer lieber getrennt halten, richten wir eine eigene ein: Sie entscheiden.",
      },
      {
        q: "Wer pflegt die Informationen?",
        a: "Sie selbst, über ein Panel, das sich wie eine Tabelle bedienen lässt: Eintrag öffnen, Uhrzeit ändern, speichern. Niemand muss Code anfassen, und für eine Änderung müssen Sie uns nicht anrufen.",
      },
      {
        q: "Und wenn der Bot nicht antworten kann?",
        a: "Dann sagt er es, statt etwas zu erfinden. Fällt die Frage aus dem Katalog heraus — oder bittet die Person ausdrücklich um einen Menschen — geht das Gespräch an eine echte Mitarbeiterin, die es sieht und aus dem Panel antwortet.",
      },
      {
        q: "Wie lange dauert es bis zum Start?",
        a: "Das hängt fast nur davon ab, wie viel Material Sie schon fertig haben. Mit einer Liste von Veranstaltungen und Betrieben zum Importieren starten Sie in wenigen Tagen; muss der Katalog von Grund auf entstehen, rechnen Sie mit einigen Wochen Datenerfassung.",
      },
      {
        q: "Wo landen die Daten der Gäste?",
        a: "Sie bleiben Ihre. Kontakte und Gespräche liegen in Ihrem eigenen Bereich, getrennt von denen jeder anderen Organisation, und die Verarbeitung ist DSGVO-konform. Sie werden weder zum Training von Modellen genutzt noch an Dritte weitergegeben.",
      },
      {
        q: "Funktioniert das auch, wenn wir keine Bergdestination sind?",
        a: "Ja. Der Bot weiß nichts über Berge im Besonderen: Er weiß, was in Ihrem Katalog steht. Meer, Kunststadt, See oder Dorf ändern die Einträge, nicht die Funktionsweise.",
      },
    ],
    ctaTitle: "Sprechen wir über Ihre Destination",
    ctaDesc: "Ein 20-minütiges Gespräch, um zu verstehen, was Sie schon haben und was es braucht, um es auf WhatsApp zu bringen.",
  },
}
