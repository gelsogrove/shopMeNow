// i18n strings for the Beauty (centri estetici) landing page.
// Base language is Italian; English mirrors it 1:1. Other UI languages fall
// back to English at the page level.
// Positioning: ONE AI for a multi-location beauty-center franchise (Demobeauty).
// Each sede has its own services, prices, hours, specialists and product catalog.

export type BeautyLang = "it" | "en"

export interface IndustryItem {
  icon: string
  label: string
}

export interface ProblemItem {
  num: string
  problem: string
  solutionTitle: string
  solutionDesc: string
  icon: string
}

export interface DataCard {
  icon: string
  title: string
  desc: string
}

export interface FaqItem {
  q: string
  a: string
}

// One sede shown in the animated per-location catalog loader.
export interface SedeData {
  name: string
  address: string
  hours: string
  services: { name: string; price: string }[]
}

export interface BeautyCopy {
  // SEO
  seoTitle: string
  seoDesc: string
  seoKeys: string
  breadcrumb: string
  // Hero
  badge: string
  heroTitleTop: string
  heroTitleAccent: string
  heroSub: string
  cta: string
  ctaSub: string
  tryDemo: string
  // Industries / use cases
  industriesTitle: string
  industriesSub: string
  industries: IndustryItem[]
  industriesNote: string
  // Problems → solutions
  problemsTitle: string
  problemsSub: string
  problems: ProblemItem[]
  problemsBanner: string
  // Per-sede catalog loader
  sedesTitle: string
  sedesAccent: string
  sedesSub: string
  sedeLoading: string
  sedeHoursLabel: string
  sedeServicesLabel: string
  sedeAddressLabel: string
  sedes: SedeData[]
  // Language
  langBadge: string
  langTitle: string
  langTitleAccent: string
  langDesc: string
  langEvery: string
  // Booking chat
  bookingTitle: string
  bookingTitleAccent: string
  bookingDesc: string
  bookingBot: string
  bookingCustomer1: string
  bookingAi1: string
  bookingCustomer2: string
  bookingAi2: string
  bookingCartTitle: string
  bookingCartText: string
  // Push
  campaignsTitle: string
  campaignsTitleAccent: string
  campaignsDesc: string
  pushDate: string
  pushText: string
  // Data control
  dataTitle: string
  dataTitleAccent: string
  dataCards: DataCard[]
  dataBanner: string
  // FAQ
  faqTitle: string
  faqTitleAccent: string
  faqs: FaqItem[]
  // CTA
  ctaTitle: string
  ctaDesc: string
}

const SEDES_IT: SedeData[] = [
  {
    name: "Navigli",
    address: "Via Naviglio Grande 12, Milano",
    hours: "9:00–20:00",
    services: [
      { name: "Pulizia viso profonda", price: "50€" },
      { name: "Manicure semipermanente", price: "35€" },
      { name: "Epilazione laser", price: "su preventivo" },
    ],
  },
  {
    name: "Isola",
    address: "Via Pietro Borsieri 18, Milano",
    hours: "10:00–20:00",
    services: [
      { name: "Pulizia viso profonda", price: "48€" },
      { name: "Manicure semipermanente", price: "33€" },
      { name: "Massaggio drenante", price: "53€" },
    ],
  },
  {
    name: "Monza",
    address: "Via Vittorio Emanuele II 5, Monza",
    hours: "9:00–19:30",
    services: [
      { name: "Pulizia viso profonda", price: "45€" },
      { name: "Manicure semipermanente", price: "32€" },
      { name: "Massaggio rilassante", price: "55€" },
    ],
  },
]

const SEDES_EN: SedeData[] = [
  {
    name: "Navigli",
    address: "Via Naviglio Grande 12, Milan",
    hours: "9:00–20:00",
    services: [
      { name: "Deep facial cleanse", price: "€50" },
      { name: "Gel-polish manicure", price: "€35" },
      { name: "Laser hair removal", price: "on quote" },
    ],
  },
  {
    name: "Isola",
    address: "Via Pietro Borsieri 18, Milan",
    hours: "10:00–20:00",
    services: [
      { name: "Deep facial cleanse", price: "€48" },
      { name: "Gel-polish manicure", price: "€33" },
      { name: "Lymph-drainage massage", price: "€53" },
    ],
  },
  {
    name: "Monza",
    address: "Via Vittorio Emanuele II 5, Monza",
    hours: "9:00–19:30",
    services: [
      { name: "Deep facial cleanse", price: "€45" },
      { name: "Gel-polish manicure", price: "€32" },
      { name: "Relaxing massage", price: "€55" },
    ],
  },
]

export const BEAUTY_I18N: Record<BeautyLang, BeautyCopy> = {
  it: {
    seoTitle: "Chatbot WhatsApp per Centri Estetici in Franchising - eChatbot",
    seoDesc:
      "Un'unica AI su WhatsApp per tutta la tua rete di centri estetici. Risponde 24/7, riconosce la sede, mostra servizi e prezzi di quel centro, compone il carrello, prenota in agenda e passa all'operatore. Ogni centro con i suoi servizi, prezzi, orari e specialiste.",
    seoKeys:
      "chatbot centro estetico, whatsapp estetica, prenotazione estetista ai, franchising estetica, rete centri estetici, agenda estetista whatsapp",
    breadcrumb: "Centri Estetici",
    badge: "Per Reti di Centri Estetici",
    heroTitleTop: "Una sola AI per tutta la tua rete di centri estetici.",
    heroTitleAccent: "Ogni centro, i suoi servizi e prezzi.",
    heroSub:
      "Un'unica AI su WhatsApp per tutta la tua rete: accoglie i clienti, riconosce da quale centro scrivono, mostra servizi e listino di QUELLA sede, compone un carrello di trattamenti e prodotti, prenota in agenda con conferma via email e passa all'operatore quando serve.",
    cta: "Parliamone",
    ctaSub: "Demo su misura, nessun impegno",
    tryDemo: "Prova la demo →",
    industriesTitle: "Una soluzione, ogni tipo di centro",
    industriesSub:
      "L'esempio che vedi è Demobeauty, una rete di centri estetici con sedi a Milano e Monza. La stessa AI gestisce ogni sede del tuo marchio, con i suoi servizi e specialiste.",
    industries: [
      { icon: "💆‍♀️", label: "Estetica" },
      { icon: "💅", label: "Nail & sguardo" },
      { icon: "🧖‍♀️", label: "SPA & benessere" },
      { icon: "✨", label: "Epilazione" },
      { icon: "💇‍♀️", label: "Parrucchieri" },
      { icon: "🧴", label: "Skincare" },
      { icon: "🤲", label: "Massaggi" },
      { icon: "🏢", label: "Franchising" },
    ],
    industriesNote:
      "I dati (servizi, prezzi, orari, specialiste, prodotti) sono inventati per la demo: ogni centro configura i propri.",
    problemsTitle: "I problemi di ogni giorno,",
    problemsSub: "risolti dall'AI",
    problems: [
      {
        num: "1",
        problem: "Il telefono squilla mentre l'estetista ha le mani occupate sul trattamento.",
        solutionTitle: "Risponde sempre, h24",
        solutionDesc:
          "L'AI risponde su WhatsApp anche di notte e la domenica, senza interrompere il lavoro in cabina. Nessuna prenotazione persa.",
        icon: "whatsapp",
      },
      {
        num: "2",
        problem: "Ogni centro ha prezzi, servizi e orari diversi: facile dare l'informazione sbagliata.",
        solutionTitle: "Dati giusti per ogni sede",
        solutionDesc:
          "Prima chiede la sede, poi mostra solo servizi, prezzi e disponibilità di QUEL centro. Mai un prezzo medio o di un'altra sede.",
        icon: "pin",
      },
      {
        num: "3",
        problem: "Un servizio non c'è in quella sede e il cliente va dal concorrente.",
        solutionTitle: "Instrada nella rete",
        solutionDesc:
          "Se il laser non c'è a Monza, l'AI indirizza alla sede di Navigli o propone un'alternativa locale. Il cliente resta nel brand.",
        icon: "bot",
      },
      {
        num: "4",
        problem: "Prenotazioni e carrello prodotti gestiti a mano, tra chat e foglietti.",
        solutionTitle: "Carrello + agenda",
        solutionDesc:
          "Compone un carrello di trattamenti e prodotti, calcola durata e orario di fine, prenota in agenda e manda la conferma via email.",
        icon: "megaphone",
      },
    ],
    problemsBanner: "Un solo chatbot per tutta la rete — e nessun cliente finisce dal concorrente.",
    sedesTitle: "Ogni sede,",
    sedesAccent: "i suoi dati",
    sedesSub:
      "Stesso chatbot, dati isolati per centro. Guarda come carica servizi, prezzi e orari della sede giusta.",
    sedeLoading: "Carico i dati della sede…",
    sedeHoursLabel: "Orari",
    sedeServicesLabel: "Servizi & prezzi",
    sedeAddressLabel: "Indirizzo",
    sedes: SEDES_IT,
    langBadge: "Multilingua",
    langTitle: "Parla la lingua di",
    langTitleAccent: "ogni cliente",
    langDesc:
      "Il cliente scrive come preferisce, l'AI risponde nella sua lingua. Se manda un audio, risponde con un audio. Nessun elenco fisso di lingue.",
    langEvery: "Ogni lingua del mondo",
    bookingTitle: "Prenota, propone,",
    bookingTitleAccent: "ricorda",
    bookingDesc:
      "Dall'informazione alla prenotazione in pochi messaggi: durata calcolata, upsell naturale, conferma e promemoria.",
    bookingBot: "Demobeauty · Navigli",
    bookingCustomer1: "Avete posto venerdì pomeriggio per pulizia viso e manicure?",
    bookingAi1:
      "Sì! Venerdì ho le 14:30 o le 17:30. La pulizia viso (50min) + manicure (30min) finiscono per le 18:50 ✨",
    bookingCustomer2: "Le 17:30. Per la manicure fate il semipermanente?",
    bookingAi2:
      "Certo 💅 Con il semipermanente sono 85€ in totale e finiamo verso le 19:05. Confermo?",
    bookingCartTitle: "🧺 Carrello",
    bookingCartText: "Pulizia viso 50€ · Semipermanente 35€ — Totale 85€",
    campaignsTitle: "Notifiche push",
    campaignsTitleAccent: "che fanno tornare",
    campaignsDesc:
      "Nuovi servizi, nuovi prodotti, nuove sedi e promemoria appuntamento — direttamente su WhatsApp.",
    pushDate: "venerdì 20 giugno",
    pushText:
      "Promemoria: domani alle 17:30 hai Pulizia viso + Semipermanente con Elena, sede Navigli 🌸",
    dataTitle: "I tuoi dati,",
    dataTitleAccent: "sotto controllo",
    dataCards: [
      {
        icon: "shield",
        title: "Isolamento per sede",
        desc: "Ogni centro vede solo i propri appuntamenti e clienti. La sede centrale ha la visione di tutta la rete.",
      },
      {
        icon: "server",
        title: "Servizi per sede, prodotti di rete",
        desc: "Servizi, prezzi, orari e specialiste li imposta ogni affiliato; il catalogo prodotti e il calendario sono unici per tutto il franchising.",
      },
      {
        icon: "expand",
        title: "Scala con la rete",
        desc: "Aggiungere una sede o una specialista è una riga di configurazione: il chatbot si adatta da solo.",
      },
      {
        icon: "together",
        title: "Operatore quando serve",
        desc: "Per pagamenti, reclami o richieste esplicite il cliente parla con una persona: il bot si disattiva e passa la mano.",
      },
    ],
    dataBanner: "Stesso brand, dati locali: ogni affiliato gestisce il suo, tu governi tutto.",
    faqTitle: "Domande",
    faqTitleAccent: "frequenti",
    faqs: [
      {
        q: "Posso gestire più calendari?",
        a: "C'è un unico calendario per tutto il franchising: ogni appuntamento è un evento taggato per sede e specialista, con cliente, servizi e prodotti nella descrizione. Ogni centro filtra e vede i propri appuntamenti, la sede centrale ha la visione di tutta la rete.",
      },
      {
        q: "Posso gestire un catalogo di prodotti e servizi?",
        a: "Sì. Ogni sede ha il proprio catalogo di servizi con prezzi, durate e specialiste proprie; l'AI propone solo ciò che è davvero disponibile in quella sede. Il catalogo prodotti è invece unico per tutta la rete: stessi prodotti e prezzi in ogni centro.",
      },
      {
        q: "Come fa l'AI a sapere di quale centro parla il cliente?",
        a: "Lo chiede all'inizio, come fa con il messaggio di benvenuto, e da lì tutta la conversazione usa i dati di quella sede. In produzione può anche riconoscerla dal numero WhatsApp dedicato.",
      },
      {
        q: "Il cliente può parlare con una persona?",
        a: "Sempre. Per pagamenti, reclami o richieste esplicite il bot passa la conversazione a un operatore e si disattiva per quel cliente, così non si sovrappone.",
      },
      {
        q: "E se un servizio non c'è in quella sede?",
        a: "L'AI lo dice con onestà e indirizza alla sede più vicina che lo offre, oppure propone un'alternativa nello stesso centro. Il cliente non finisce dal concorrente.",
      },
      {
        q: "Funziona in più lingue e con gli audio?",
        a: "Sì: risponde nella lingua del cliente, qualunque essa sia, e se riceve un messaggio vocale risponde con un vocale.",
      },
    ],
    ctaTitle: "Porta il tuo centro estetico su WhatsApp",
    ctaDesc:
      "Ti mostriamo come l'AI prenota, compone il carrello e gestisce tutta la tua rete. Demo su misura, nessun impegno.",
  },
  en: {
    seoTitle: "WhatsApp Chatbot for Beauty-Center Franchises - eChatbot",
    seoDesc:
      "One AI on WhatsApp for your whole network of beauty centers. Replies 24/7, recognizes the sede, shows that center's services and prices, builds a cart, books appointments and hands over to an operator. Each center with its own services, prices, hours and specialists.",
    seoKeys:
      "beauty salon chatbot, whatsapp beauty booking, beauty franchise ai, spa chatbot, multi location beauty, esthetician booking whatsapp",
    breadcrumb: "Beauty Centers",
    badge: "For Beauty-Center Networks",
    heroTitleTop: "One AI for your whole beauty-center network.",
    heroTitleAccent: "Each center, its own services and prices.",
    heroSub:
      "One AI on WhatsApp for your whole network: it welcomes clients, recognizes which center they're writing from, shows that sede's services and price list, builds a cart of treatments and products, books the appointment with an email confirmation, and hands over to an operator when needed.",
    cta: "Let's talk",
    ctaSub: "Tailored demo, no commitment",
    tryDemo: "Try the demo →",
    industriesTitle: "One solution, every kind of center",
    industriesSub:
      "The example you see is Demobeauty, a network of beauty centers across Milan and Monza. The same AI runs every sede of your brand, with its own services and specialists.",
    industries: [
      { icon: "💆‍♀️", label: "Beauty" },
      { icon: "💅", label: "Nails & lashes" },
      { icon: "🧖‍♀️", label: "SPA & wellness" },
      { icon: "✨", label: "Hair removal" },
      { icon: "💇‍♀️", label: "Hair salons" },
      { icon: "🧴", label: "Skincare" },
      { icon: "🤲", label: "Massage" },
      { icon: "🏢", label: "Franchise" },
    ],
    industriesNote:
      "The data (services, prices, hours, specialists, products) is made up for the demo: each center configures its own.",
    problemsTitle: "Everyday headaches,",
    problemsSub: "solved by the AI",
    problems: [
      {
        num: "1",
        problem: "The phone rings while the esthetician's hands are busy with a treatment.",
        solutionTitle: "Always answers, 24/7",
        solutionDesc:
          "The AI replies on WhatsApp at night and on Sundays too, without interrupting the work in the cabin. No lost bookings.",
        icon: "whatsapp",
      },
      {
        num: "2",
        problem: "Each center has different prices, services and hours — easy to give the wrong info.",
        solutionTitle: "Right data per sede",
        solutionDesc:
          "It asks the center first, then shows only that sede's services, prices and availability. Never an average or another sede's price.",
        icon: "pin",
      },
      {
        num: "3",
        problem: "A service isn't offered at that center and the client goes to a competitor.",
        solutionTitle: "Routes across the network",
        solutionDesc:
          "If laser isn't at Monza, the AI points to the Navigli center or offers a local alternative. The client stays in the brand.",
        icon: "bot",
      },
      {
        num: "4",
        problem: "Bookings and a product cart juggled by hand, between chats and sticky notes.",
        solutionTitle: "Cart + calendar",
        solutionDesc:
          "It builds a cart of treatments and products, computes duration and end time, books the slot and sends the email confirmation.",
        icon: "megaphone",
      },
    ],
    problemsBanner: "One chatbot for the whole network — and no client ends up at a competitor.",
    sedesTitle: "Every center,",
    sedesAccent: "its own data",
    sedesSub:
      "Same chatbot, data isolated per center. Watch it load the right sede's services, prices and hours.",
    sedeLoading: "Loading the center's data…",
    sedeHoursLabel: "Hours",
    sedeServicesLabel: "Services & prices",
    sedeAddressLabel: "Address",
    sedes: SEDES_EN,
    langBadge: "Multilingual",
    langTitle: "Speaks the language of",
    langTitleAccent: "every client",
    langDesc:
      "Clients write however they like, the AI replies in their language. If they send audio, it replies with audio. No fixed list of languages.",
    langEvery: "Every language in the world",
    bookingTitle: "Books, suggests,",
    bookingTitleAccent: "reminds",
    bookingDesc:
      "From info to booking in a few messages: computed duration, natural upsell, confirmation and reminder.",
    bookingBot: "Demobeauty · Navigli",
    bookingCustomer1: "Any room Friday afternoon for a facial and a manicure?",
    bookingAi1:
      "Yes! Friday I have 2:30pm or 5:30pm. The facial (50min) + manicure (30min) finish by 6:50pm ✨",
    bookingCustomer2: "5:30pm. Do you do gel polish for the manicure?",
    bookingAi2:
      "Of course 💅 With gel polish it's €85 total and we finish around 7:05pm. Shall I confirm?",
    bookingCartTitle: "🧺 Cart",
    bookingCartText: "Facial €50 · Gel manicure €35 — Total €85",
    campaignsTitle: "Push notifications",
    campaignsTitleAccent: "that bring them back",
    campaignsDesc:
      "New services, new products, new centers and appointment reminders — straight to WhatsApp.",
    pushDate: "Friday, June 20",
    pushText:
      "Reminder: tomorrow at 5:30pm you have Facial + Gel manicure with Elena, Navigli center 🌸",
    dataTitle: "Your data,",
    dataTitleAccent: "under control",
    dataCards: [
      {
        icon: "shield",
        title: "Per-sede isolation",
        desc: "Each center sees only its own appointments and clients. Headquarters has the view across the whole network.",
      },
      {
        icon: "server",
        title: "Services per sede, network products",
        desc: "Services, prices, hours and specialists are set by each franchisee; the product catalog and the calendar are shared across the whole franchise.",
      },
      {
        icon: "expand",
        title: "Scales with the network",
        desc: "Adding a center or a specialist is one config line: the chatbot adapts on its own.",
      },
      {
        icon: "together",
        title: "Operator when needed",
        desc: "For payments, complaints or explicit requests the client talks to a person: the bot deactivates and hands over.",
      },
    ],
    dataBanner: "Same brand, local data: each franchisee runs their own, you govern it all.",
    faqTitle: "Frequently asked",
    faqTitleAccent: "questions",
    faqs: [
      {
        q: "Can I manage multiple calendars?",
        a: "There's a single calendar for the whole franchise: each appointment is an event tagged by sede and specialist, with the client, services and products in the description. Each center filters and sees its own appointments, while headquarters has the full view across the network.",
      },
      {
        q: "Can I manage a catalog of products and services?",
        a: "Yes. Each center has its own catalog of services with its own prices, durations and specialists; the AI offers only what's actually available at that sede. The product catalog, instead, is shared across the whole network: same products and prices at every center.",
      },
      {
        q: "How does the AI know which center the client means?",
        a: "It asks at the start, as part of the welcome, and from there the whole conversation uses that sede's data. In production it can also recognize it from a dedicated WhatsApp number.",
      },
      {
        q: "Can the client talk to a person?",
        a: "Always. For payments, complaints or explicit requests the bot hands the conversation to an operator and deactivates for that client, so they don't overlap.",
      },
      {
        q: "What if a service isn't offered at that center?",
        a: "The AI says so honestly and routes to the nearest center that offers it, or proposes an alternative at the same sede. The client doesn't go to a competitor.",
      },
      {
        q: "Does it work in multiple languages and with audio?",
        a: "Yes: it replies in the client's language, whatever it is, and if it receives a voice message it replies with a voice message.",
      },
    ],
    ctaTitle: "Bring your beauty center to WhatsApp",
    ctaDesc:
      "We'll show you how the AI books, builds the cart and runs your whole network. Tailored demo, no commitment.",
  },
}
