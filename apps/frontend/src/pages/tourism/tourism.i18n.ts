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
      { role: "guest", text: "Ciao! Siamo in famiglia, cosa fate di bello sabato?" },
      {
        role: "bot",
        tag: "dal catalogo eventi",
        text: "Sabato alle 17:00 c'è il mercatino in piazza, e alle 20:30 la serata musicale al centro civico — entrambi a ingresso libero.",
      },
      { role: "guest", text: "Perfetto, dove mangiamo qualcosa di tipico dopo?" },
      {
        role: "bot",
        tag: "dal catalogo ristoranti",
        text: "A due minuti a piedi c'è la Locanda del Bosco, aperta fino alle 22:30, nota per i piatti fatti in casa.",
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
    pushTitle: "E quando serve,",
    pushAccent: "è lui a scrivere per primo.",
    pushSub:
      "Un chatbot normale aspetta. Questo no: se succede qualcosa che riguarda chi vi ha già scritto — un evento nuovo, una data che si avvicina, una sagra spostata per pioggia — il messaggio parte da solo. E prima di partire controlla di non essere già stato detto.",
    pushSteps: [
      {
        badge: "Quando parte",
        title: "Succede qualcosa che interessa a qualcuno",
        desc: "Pubblicate un evento nuovo, una data si avvicina, un alloggio segna gli ultimi posti: il messaggio parte verso chi vi ha già scritto ed è in target. Nessuno in ufficio deve premere niente.",
      },
      {
        badge: "Cosa lo ferma",
        title: "Un controllo prima di ogni invio",
        desc: "Prima di inviare, il sistema guarda cosa quella persona ha già ricevuto nei giorni scorsi. Se un'altra iniziativa gli ha già segnalato la stessa cosa, il secondo messaggio non parte.",
      },
      {
        badge: "Perché conta",
        title: "Nessuno si sente inondato",
        desc: "È la differenza tra un avviso utile e lo spam che fa silenziare la chat. Il controllo è automatico: nessuno deve ricordarsi \"a questo l'abbiamo già scritto\".",
      },
    ],
    pushBoardTitle: "Ufficio del Turismo",
    pushBoardStatus: "messaggio in uscita",
    pushFirstTag: "campagna: eventi del weekend",
    pushFirstText: "Ciao! Domenica c'è la Fiera d'Autunno in piazza, dalle 9:00 — pensavamo potesse interessarti.",
    pushGuardTag: "campagna: newsletter mercatini",
    pushGuardText:
      "Stessa fiera già segnalata 3 giorni fa da un'altra iniziativa: invio annullato in automatico, il visitatore non riceve il doppione.",
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
        title: "Cosa c'è questo weekend",
        rule: "catalogo → eventi",
        script: [
          { role: "guest", text: "Cosa c'è da fare questo weekend?" },
          {
            role: "bot",
            tag: "dal catalogo eventi",
            text: "Questo weekend: sabato mercatino artigianale in piazza (10:00–19:00) e serata musicale (20:30); domenica camminata guidata al rifugio, ritrovo alle 9:00.",
          },
          { role: "guest", text: "La camminata va bene per bambini?" },
          {
            role: "bot",
            tag: "dal catalogo eventi",
            text: "Sì, è un percorso facile e adatto alle famiglie: circa 2 ore, dislivello contenuto, ritrovo al parcheggio del rifugio.",
          },
        ],
      },
      {
        title: "Dove dormire in 4 persone",
        rule: "catalogo → alloggi",
        script: [
          { role: "guest", text: "Cerchiamo un posto per dormire, siamo in 4" },
          {
            role: "bot",
            tag: "dal catalogo alloggi",
            text: "Ho un paio di soluzioni per 4 persone: un appartamento in centro con cucina e balcone, e un B&B a 5 minuti dal paese. Preferite il centro?",
          },
          { role: "guest", text: "Meglio in centro, e vicino a un parcheggio" },
          {
            role: "bot",
            tag: "dal catalogo alloggi",
            text: "L'appartamento in centro ha un posto auto incluso. Vi lascio il contatto diretto della proprietaria per verificare le date.",
          },
        ],
      },
      {
        title: "Turista straniero, sentiero facile",
        rule: "catalogo → outdoor · rilevamento lingua",
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
            tag: "dal catalogo ristoranti",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
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
      { role: "guest", text: "Hi! We're a family, what's going on Saturday?" },
      {
        role: "bot",
        tag: "from events catalogue",
        text: "On Saturday there's a market in the square at 5pm, and a live music night at 8:30pm — both free entry.",
      },
      { role: "guest", text: "Great, where can we get something local to eat afterwards?" },
      {
        role: "bot",
        tag: "from restaurants catalogue",
        text: "Two minutes' walk away is Locanda del Bosco, open until 10:30pm, known for its homemade dishes.",
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
    pushTitle: "And when it matters,",
    pushAccent: "it writes first.",
    pushSub:
      "A normal chatbot waits. This one doesn't: when something happens that concerns people who already wrote to you — a new event, a date coming up, a fair moved because of rain — the message goes out on its own. And before it goes, it checks it hasn't been said already.",
    pushSteps: [
      {
        badge: "What triggers it",
        title: "Something happens that someone cares about",
        desc: "You publish a new event, a date is approaching, a place flags its last rooms: the message goes to people who already wrote to you and match. Nobody at the office has to press anything.",
      },
      {
        badge: "What stops it",
        title: "A check before every send",
        desc: "Before sending, the system looks at what that person has already received in recent days. If another campaign already flagged the same thing, the second message doesn't go out.",
      },
      {
        badge: "Why it matters",
        title: "Nobody feels flooded",
        desc: "It's the difference between a useful heads-up and the spam that gets a chat muted. The check is automatic: nobody has to remember \"we already told this one\".",
      },
    ],
    pushBoardTitle: "Tourist Information",
    pushBoardStatus: "outbound message",
    pushFirstTag: "campaign: weekend events",
    pushFirstText: "Hi! On Sunday there's the Autumn Fair in the square, from 9am — we thought it might interest you.",
    pushGuardTag: "campaign: markets newsletter",
    pushGuardText:
      "Same fair already flagged 3 days ago by another campaign: send cancelled automatically, the visitor gets no duplicate.",
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
        title: "What's on this weekend",
        rule: "catalogue → events",
        script: [
          { role: "guest", text: "What is there to do this weekend?" },
          {
            role: "bot",
            tag: "from events catalogue",
            text: "This weekend: Saturday, craft market in the square (10am–7pm) and live music night (8:30pm); Sunday, guided walk to the mountain hut, meeting at 9am.",
          },
          { role: "guest", text: "Is the walk ok for children?" },
          {
            role: "bot",
            tag: "from events catalogue",
            text: "Yes, it's an easy family-friendly route: around 2 hours, gentle elevation, meeting point at the hut car park.",
          },
        ],
      },
      {
        title: "Somewhere to sleep for 4",
        rule: "catalogue → stays",
        script: [
          { role: "guest", text: "We're looking for a place to stay, there are 4 of us" },
          {
            role: "bot",
            tag: "from stays catalogue",
            text: "I have a couple of options for 4 people: an apartment in the centre with a kitchen and balcony, and a B&B 5 minutes from the village. Do you prefer the centre?",
          },
          { role: "guest", text: "Centre is better, and near a car park" },
          {
            role: "bot",
            tag: "from stays catalogue",
            text: "The apartment in the centre includes a parking space. Here's the owner's direct contact to check the dates.",
          },
        ],
      },
      {
        title: "Foreign visitor, easy trail",
        rule: "catalogue → outdoor · language detection",
        script: [
          { role: "guest", text: "Hallo, wir suchen einen leichten Wanderweg für morgen" },
          {
            role: "bot",
            tag: "answers in German",
            text: "Guten Tag! Ich empfehle den Weg zum Waldsee: leicht, ca. 5 km, 1,5 Stunden, kaum Höhenunterschied.",
          },
          { role: "guest", text: "Gibt es dort auch eine Einkehrmöglichkeit?" },
          {
            role: "bot",
            tag: "from restaurants catalogue",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
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
      { role: "guest", text: "¡Hola! Somos una familia, ¿qué hay el sábado?" },
      {
        role: "bot",
        tag: "del catálogo de eventos",
        text: "El sábado a las 17:00 hay mercadillo en la plaza, y a las 20:30 noche de música en el centro cívico — ambos con entrada libre.",
      },
      { role: "guest", text: "Perfecto, ¿dónde comemos algo típico después?" },
      {
        role: "bot",
        tag: "del catálogo de restaurantes",
        text: "A dos minutos a pie está la Locanda del Bosco, abierta hasta las 22:30, conocida por sus platos caseros.",
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
    pushTitle: "Y cuando hace falta,",
    pushAccent: "escribe él primero.",
    pushSub:
      "Un chatbot normal espera. Este no: si pasa algo que afecta a quien ya os escribió — un evento nuevo, una fecha que se acerca, una fiesta aplazada por lluvia — el mensaje sale solo. Y antes de salir comprueba que no se haya dicho ya.",
    pushSteps: [
      {
        badge: "Qué lo dispara",
        title: "Pasa algo que le interesa a alguien",
        desc: "Publicáis un evento nuevo, se acerca una fecha, un alojamiento marca sus últimas plazas: el mensaje sale hacia quien ya os escribió y encaja. Nadie en la oficina tiene que pulsar nada.",
      },
      {
        badge: "Qué lo frena",
        title: "Una comprobación antes de cada envío",
        desc: "Antes de enviar, el sistema mira qué ha recibido esa persona en los últimos días. Si otra campaña ya le avisó de lo mismo, el segundo mensaje no sale.",
      },
      {
        badge: "Por qué importa",
        title: "Nadie se siente inundado",
        desc: "Es la diferencia entre un aviso útil y el spam que hace silenciar el chat. La comprobación es automática: nadie tiene que acordarse de \"a este ya se lo dijimos\".",
      },
    ],
    pushBoardTitle: "Oficina de Turismo",
    pushBoardStatus: "mensaje saliente",
    pushFirstTag: "campaña: eventos del fin de semana",
    pushFirstText: "¡Hola! El domingo está la Feria de Otoño en la plaza, desde las 9:00 — pensamos que podría interesarte.",
    pushGuardTag: "campaña: newsletter de mercadillos",
    pushGuardText:
      "La misma feria ya avisada hace 3 días por otra campaña: envío cancelado automáticamente, el visitante no recibe el duplicado.",
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
        title: "Qué hay este fin de semana",
        rule: "catálogo → eventos",
        script: [
          { role: "guest", text: "¿Qué hay para hacer este fin de semana?" },
          {
            role: "bot",
            tag: "del catálogo de eventos",
            text: "Este fin de semana: el sábado mercadillo artesanal en la plaza (10:00–19:00) y noche de música (20:30); el domingo caminata guiada al refugio, quedada a las 9:00.",
          },
          { role: "guest", text: "¿La caminata va bien para niños?" },
          {
            role: "bot",
            tag: "del catálogo de eventos",
            text: "Sí, es un recorrido fácil y apto para familias: unas 2 horas, desnivel suave, punto de encuentro en el aparcamiento del refugio.",
          },
        ],
      },
      {
        title: "Dónde dormir 4 personas",
        rule: "catálogo → alojamientos",
        script: [
          { role: "guest", text: "Buscamos sitio para dormir, somos 4" },
          {
            role: "bot",
            tag: "del catálogo de alojamientos",
            text: "Tengo un par de opciones para 4 personas: un apartamento en el centro con cocina y balcón, y una casa rural a 5 minutos del pueblo. ¿Preferís el centro?",
          },
          { role: "guest", text: "Mejor en el centro, y cerca de un aparcamiento" },
          {
            role: "bot",
            tag: "del catálogo de alojamientos",
            text: "El apartamento del centro incluye una plaza de aparcamiento. Os dejo el contacto directo de la propietaria para comprobar las fechas.",
          },
        ],
      },
      {
        title: "Turista extranjero, sendero fácil",
        rule: "catálogo → aire libre · detección de idioma",
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
            tag: "del catálogo de restaurantes",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
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
      { role: "guest", text: "Hallo! Wir sind mit der Familie da, was ist am Samstag los?" },
      {
        role: "bot",
        tag: "aus dem Veranstaltungskatalog",
        text: "Am Samstag um 17:00 Uhr ist Markt auf dem Platz, und um 20:30 Uhr Musikabend im Gemeindezentrum — beides bei freiem Eintritt.",
      },
      { role: "guest", text: "Super, wo können wir danach etwas Typisches essen?" },
      {
        role: "bot",
        tag: "aus dem Restaurantkatalog",
        text: "Zwei Gehminuten entfernt ist die Locanda del Bosco, geöffnet bis 22:30 Uhr, bekannt für hausgemachte Gerichte.",
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
    pushTitle: "Und wenn es darauf ankommt,",
    pushAccent: "schreibt er von sich aus.",
    pushSub:
      "Ein normaler Chatbot wartet. Dieser nicht: Wenn etwas passiert, das Leute betrifft, die Ihnen schon geschrieben haben — eine neue Veranstaltung, ein näher rückendes Datum, ein wegen Regen verschobenes Fest — geht die Nachricht von selbst raus. Und bevor sie rausgeht, prüft sie, ob es nicht schon gesagt wurde.",
    pushSteps: [
      {
        badge: "Was ihn auslöst",
        title: "Es passiert etwas, das jemanden betrifft",
        desc: "Sie veröffentlichen eine neue Veranstaltung, ein Datum rückt näher, eine Unterkunft meldet letzte Plätze: Die Nachricht geht an alle, die Ihnen schon geschrieben haben und infrage kommen. Niemand im Büro muss etwas anklicken.",
      },
      {
        badge: "Was ihn stoppt",
        title: "Eine Prüfung vor jedem Versand",
        desc: "Vor dem Senden schaut das System nach, was diese Person in den letzten Tagen schon bekommen hat. Hat eine andere Kampagne dasselbe bereits gemeldet, geht die zweite Nachricht nicht raus.",
      },
      {
        badge: "Warum das zählt",
        title: "Niemand fühlt sich überflutet",
        desc: "Das ist der Unterschied zwischen einem nützlichen Hinweis und dem Spam, der dazu führt, dass der Chat stummgeschaltet wird. Die Prüfung läuft automatisch: Niemand muss sich merken, \"dem haben wir es schon geschrieben\".",
      },
    ],
    pushBoardTitle: "Tourist-Information",
    pushBoardStatus: "ausgehende Nachricht",
    pushFirstTag: "Kampagne: Veranstaltungen am Wochenende",
    pushFirstText: "Hallo! Am Sonntag ist ab 9:00 Uhr der Herbstmarkt auf dem Platz — wir dachten, das könnte Sie interessieren.",
    pushGuardTag: "Kampagne: Markt-Newsletter",
    pushGuardText:
      "Derselbe Markt wurde vor 3 Tagen bereits von einer anderen Kampagne gemeldet: Versand automatisch abgebrochen, der Gast bekommt keine Dopplung.",
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
        title: "Was ist dieses Wochenende los",
        rule: "Katalog → Veranstaltungen",
        script: [
          { role: "guest", text: "Was kann man dieses Wochenende unternehmen?" },
          {
            role: "bot",
            tag: "aus dem Veranstaltungskatalog",
            text: "Dieses Wochenende: Samstag Handwerkermarkt auf dem Platz (10:00–19:00 Uhr) und Musikabend (20:30 Uhr); Sonntag geführte Wanderung zur Hütte, Treffpunkt um 9:00 Uhr.",
          },
          { role: "guest", text: "Ist die Wanderung für Kinder geeignet?" },
          {
            role: "bot",
            tag: "aus dem Veranstaltungskatalog",
            text: "Ja, es ist ein leichter, familienfreundlicher Weg: etwa 2 Stunden, wenig Höhenunterschied, Treffpunkt am Parkplatz der Hütte.",
          },
        ],
      },
      {
        title: "Unterkunft für 4 Personen",
        rule: "Katalog → Unterkünfte",
        script: [
          { role: "guest", text: "Wir suchen eine Unterkunft, wir sind zu viert" },
          {
            role: "bot",
            tag: "aus dem Unterkunftskatalog",
            text: "Ich habe zwei Möglichkeiten für 4 Personen: eine Ferienwohnung im Zentrum mit Küche und Balkon, und eine Pension 5 Minuten außerhalb des Ortes. Lieber im Zentrum?",
          },
          { role: "guest", text: "Lieber im Zentrum, und in der Nähe eines Parkplatzes" },
          {
            role: "bot",
            tag: "aus dem Unterkunftskatalog",
            text: "Die Wohnung im Zentrum hat einen Stellplatz inklusive. Ich gebe Ihnen den direkten Kontakt der Eigentümerin, um die Termine zu prüfen.",
          },
        ],
      },
      {
        title: "Gast aus dem Ausland, leichter Weg",
        rule: "Katalog → Outdoor · Spracherkennung",
        script: [
          { role: "guest", text: "Hallo, wir suchen einen leichten Wanderweg für morgen" },
          {
            role: "bot",
            tag: "antwortet auf Deutsch",
            text: "Guten Tag! Ich empfehle den Weg zum Waldsee: leicht, ca. 5 km, 1,5 Stunden, kaum Höhenunterschied.",
          },
          { role: "guest", text: "Gibt es dort auch eine Einkehrmöglichkeit?" },
          {
            role: "bot",
            tag: "aus dem Restaurantkatalog",
            text: "Ja, direkt am See gibt es eine Almhütte mit warmen Speisen, geöffnet bis 18:00 Uhr.",
          },
        ],
      },
    ],
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
