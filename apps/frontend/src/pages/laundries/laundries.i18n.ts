// i18n strings for the Laundries landing page.
// Base language is Italian; the others mirror it 1:1.
// Positioning: ONE AI for a multi-location laundry network.
// DemoWash (self-service laundry) is the running example; the same AI fits
// every kind of laundry — self-service, dry cleaning, industrial, B2B, etc.

export type LaundriesLang = "it" | "en" | "es" | "de"

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

export interface LaundriesCopy {
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
  // Industries
  industriesTitle: string
  industriesSub: string
  industries: IndustryItem[]
  industriesNote: string
  // Problems → solutions
  problemsTitle: string
  problemsSub: string
  problems: ProblemItem[]
  problemsBanner: string
  // Language barriers
  langBadge: string
  langTitle: string
  langTitleAccent: string
  langDesc: string
  langEvery: string // "every language in the world" — no fixed flag list
  // Zone names for the per-location data loader (kept country-neutral)
  zones: string[]
  // Acts & sells
  actsTitle: string
  actsTitleAccent: string
  actsDesc: string
  // Campaigns
  campaignsTitle: string
  campaignsTitleAccent: string
  campaignsDesc: string
  // Data control
  dataTitle: string
  dataTitleAccent: string
  dataCards: DataCard[]
  dataBanner: string
  // Store data loader (animated per-location demo)
  storeTitle: string
  storeAccent: string
  storeSub: string
  storeLoading: string
  storeHoursLabel: string
  storePricesLabel: string
  storeAddressLabel: string
  svcWash: string
  svcDry: string
  // Localized demo mock copy (so visuals always match the UI language)
  mockOperator: string
  mockReply: string // operator reply, in the local language
  mockQ1Local: string // local translation of the 1st Arabic message
  mockQ2Local: string // local translation of the 2nd Arabic message
  mockLiveLang: string // short code shown in the "AR ⇄ XX · live" pill
  actsBot: string
  actsCustomer1: string
  actsAi1: string
  actsAi2: string
  actsCustomer2: string
  actsPromoTitle: string
  actsPromoText: string
  actsPromoCard: string
  pushDate: string
  pushText: string
  // CTA
  ctaTitle: string
  ctaDesc: string
}

export const LAUNDRIES_I18N: Record<LaundriesLang, LaundriesCopy> = {
  it: {
    seoTitle: "Chatbot WhatsApp per Lavanderie Multi-Sede - eChatbot",
    seoDesc:
      "Un'unica AI su WhatsApp per tutta la tua rete di lavanderie. Risponde 24/7, traduce in tempo reale, riconosce la sede, sblocca le macchine e passa all'operatore. Per lavanderie self-service, lavasecco e industriali.",
    seoKeys:
      "chatbot lavanderia, whatsapp lavanderia, lavanderia self service ai, assistente lavanderia, lavanderie multi sede, rete lavanderie",
    breadcrumb: "Lavanderie",
    badge: "Per Reti di Lavanderie",
    heroTitleTop: "Una sola AI per tutta la tua rete di lavanderie.",
    heroTitleAccent: "Ogni lavanderia, la risposta giusta.",
    heroSub:
      "Un'unica AI su WhatsApp per tutta la tua rete di lavanderie: risponde 24/7, traduce in tempo reale, riconosce da quale sede scrive il cliente, sblocca le macchine e passa all'operatore quando serve. Tu governi tutto da un solo pannello.",
    cta: "Parliamone",
    ctaSub: "Demo su misura, nessun impegno",
    industriesTitle: "Una soluzione, ogni tipo di lavanderia",
    industriesSub:
      "L'esempio che vedi è DemoWash, una rete di lavanderie self-service che offre anche il servizio di tintoria. La stessa AI gestisce ogni sede del tuo marchio, qualunque servizio offra.",
    industries: [
      { icon: "🧺", label: "Self-service" },
      { icon: "👔", label: "Lavasecco" },
      { icon: "🚚", label: "Ritiro & consegna" },
      { icon: "🏭", label: "Industriale" },
      { icon: "🏨", label: "Hotel & B2B" },
      { icon: "🪙", label: "A gettoni" },
      { icon: "♻️", label: "Eco-friendly" },
      { icon: "🛏️", label: "Biancheria & tessuti" },
    ],
    industriesNote: "…self-service, tradizionale o industriale: ogni lavanderia, un solo assistente.",
    problemsTitle: "Abbiamo individuato alcuni dettagli",
    problemsSub: "che potrebbero dare una svolta al tuo business.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Dubbi, richieste e reclami che arrivano a ogni ora e restano senza risposta?",
        solutionTitle: "Supporto 24/7",
        solutionDesc:
          "L'assistente risponde da solo alla maggior parte dei casi su WhatsApp. L'operatore interviene solo quando serve, con un riassunto già pronto: sede, dettagli e problema.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Clienti stranieri che non capiscono le istruzioni né sanno come chiedere aiuto?",
        solutionTitle: "Traduzione in tempo reale",
        solutionDesc:
          "Il cliente scrive nella sua lingua, tu rispondi nella tua. La conversazione si traduce in entrambe le direzioni, all'istante. Zero barriere.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "Nessun modo per contattare i clienti e proporre una promozione?",
        solutionTitle: "Campagne e avvisi su WhatsApp",
        solutionDesc:
          "Invii offerte e promemoria per singola sede direttamente sul telefono del cliente. Lo stesso canale di supporto diventa un canale che genera vendite.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Ogni sede ha prezzi e orari propri e la gestione si complica?",
        solutionTitle: "Risposte personalizzate per sede",
        solutionDesc:
          "L'AI riconosce da quale sede scrive il cliente e risponde con i dati corretti: prezzi, orari e informazioni di quel locale.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Troppe cose da orchestrare insieme: rispondere, tradurre, fatturare, avvisare?",
        solutionTitle: "Un'AI che orchestra tutto",
        solutionDesc:
          "Non è solo un chatbot: è un'AI su misura che risponde, invia fatture, audio e video, traduce, scala a un operatore e, soprattutto, si connette ai tuoi sistemi.",
      },
    ],
    problemsBanner: "Una sola soluzione: meno lavoro, clienti seguiti, più vendite.",
    langBadge: "Traduzione in tempo reale",
    langTitle: "Senza barriere",
    langTitleAccent: "linguistiche.",
    langDesc:
      "I tuoi clienti scrivono nella loro lingua, i tuoi operatori rispondono nella propria. Ogni messaggio si traduce in entrambe le direzioni, in tempo reale — la stessa AI multilingue su tutte le sedi, dal turista alla clientela locale.",
    actsTitle: "Non risponde soltanto:",
    actsTitleAccent: "agisce e vende.",
    actsDesc:
      "Il cliente segnala un problema. L'AI si connette al sistema, lo risolve e conferma. E nella stessa conversazione presenta la carta fedeltà.",
    campaignsTitle: "Trasforma gli avvisi",
    campaignsTitleAccent: "in vendite.",
    campaignsDesc:
      "Con un clic invii una campagna a tutti i clienti su WhatsApp: una promo per le ore vuote, una novità o la carta fedeltà. Il canale di supporto diventa il tuo miglior strumento di marketing.",
    dataTitle: "I tuoi dati,",
    dataTitleAccent: "sotto il tuo controllo.",
    dataCards: [
      {
        icon: "shield",
        title: "Sicurezza dei dati",
        desc:
          "L'AI dialoga in modo naturale, ma non è sempre attiva. Quando si devono raccogliere dati personali, il sistema passa automaticamente da modalità AI a un flusso controllato da regole predefinite. I dati sensibili non vengono mai inviati a servizi AI esterni.",
      },
      {
        icon: "server",
        title: "On-premise: tutto in casa tua",
        desc:
          "Il sistema si installa sui tuoi server. Tutto il software gira dentro l'azienda, che mantiene il controllo totale di conversazioni e informazioni, senza che i dati passino da terzi.",
      },
      {
        icon: "expand",
        title: "Ampliabile alle tue esigenze",
        desc:
          "Le funzionalità crescono con te: nuove integrazioni, connessione ai tuoi sistemi e funzioni autonome, in base a ciò che il business richiede in ogni momento.",
      },
      {
        icon: "together",
        title: "Un progetto costruito insieme",
        desc:
          "Non ti adatti a un prodotto rigido: costruiamo il sistema attorno alla tua realtà. Addestriamo l'AI sui tuoi casi reali e la affiniamo nel tempo, sull'esperienza con i clienti.",
      },
    ],
    dataBanner: "Su misura. Sicuro, tuo, pensato per il tuo business.",
    langEvery: "Parla ogni lingua del mondo, in automatico.",
    zones: ["Centro", "Nord", "Sud", "Ovest"],
    storeTitle: "Carica i dati giusti,",
    storeAccent: "per ogni sede.",
    storeSub:
      "L'AI riconosce da quale sede scrive il cliente e carica al volo i suoi dati: orari, listino e indirizzo di quel locale. Niente più risposte sbagliate.",
    storeLoading: "Carico i dati della sede…",
    storeHoursLabel: "Orari",
    storePricesLabel: "Listino",
    storeAddressLabel: "Indirizzo",
    svcWash: "Lavaggio",
    svcDry: "Asciugatura",
    mockOperator: "OPERATORE",
    mockReply: "Ciao! La zona Centro apre 8:00–21:00, tutti i giorni.",
    mockQ1Local: "A che ora apre la sede in zona Centro?",
    mockQ2Local: "Grazie! Avete la consegna?",
    mockLiveLang: "IT",
    actsBot: "EcoWash Bot",
    actsCustomer1: "La lavatrice non si apre e dentro ho i miei vestiti.",
    actsAi1: "Capito. Sto controllando la lavatrice 4. Un momento, per favore.",
    actsAi2:
      "Buone notizie! La lavatrice 4 è stata sbloccata e lo sportello è aperto. Puoi ritirare i tuoi vestiti.",
    actsCustomer2: "Ok, grazie! Risolto! 🙌",
    actsPromoTitle: "🎉 NOVITÀ PER TE!",
    actsPromoText:
      "Scopri la nostra carta fedeltà e approfitta di vantaggi esclusivi a ogni lavaggio.",
    actsPromoCard: "EcoWash · Carta fedeltà",
    pushDate: "Martedì, 14 maggio",
    pushText:
      "Fai contare ogni lavaggio! 💚 Scopri la carta fedeltà: sconti esclusivi, regali e altri vantaggi. Chiedi la tua alla prossima visita! ⭐",
    ctaTitle: "Ne parliamo?",
    ctaDesc:
      "Ti mostriamo come gestire tutta la rete di lavanderie con un'unica AI. Demo su misura per la tua catena, nessun impegno.",
  },

  en: {
    seoTitle: "WhatsApp Chatbot for Multi-Location Laundries - eChatbot",
    seoDesc:
      "One AI on WhatsApp for your whole laundry network. Answers 24/7, translates in real time, detects the location, unlocks machines and hands off to an operator. For self-service, full-service and dry-cleaning laundries.",
    seoKeys:
      "laundry chatbot, whatsapp laundry, self service laundry ai, laundromat chatbot, multi location laundry, laundromat assistant",
    breadcrumb: "Laundries",
    badge: "For Laundry Networks",
    heroTitleTop: "One AI for your entire laundry network.",
    heroTitleAccent: "Every location, the right answer.",
    heroSub:
      "One AI on WhatsApp for your whole laundry network: answers 24/7, translates in real time, detects which location the customer is writing from, unlocks machines and hands off to an operator when needed. You run everything from a single panel.",
    cta: "Let's Talk",
    ctaSub: "Tailored demo, no commitment",
    industriesTitle: "One solution, every kind of laundry",
    industriesSub:
      "The example you see is DemoWash, a self-service laundry network that also offers a dry-cleaning service. The same AI runs every location of your brand, whatever service it offers.",
    industries: [
      { icon: "🧺", label: "Self-service" },
      { icon: "👔", label: "Dry cleaning" },
      { icon: "🚚", label: "Pickup & delivery" },
      { icon: "🏭", label: "Industrial" },
      { icon: "🏨", label: "Hotel & B2B" },
      { icon: "🪙", label: "Coin-op" },
      { icon: "♻️", label: "Eco-friendly" },
      { icon: "🛏️", label: "Linen & textiles" },
    ],
    industriesNote: "…self-service, full-service or industrial: every laundry, one assistant.",
    problemsTitle: "We spotted a few details",
    problemsSub: "that could turn your business around.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Questions, issues and complaints arriving at any hour and going unanswered?",
        solutionTitle: "24/7 support",
        solutionDesc:
          "The assistant handles most cases on its own over WhatsApp. The operator steps in only when needed, with a ready-made summary: location, details and issue.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Foreign customers who don't understand the instructions or how to ask for help?",
        solutionTitle: "Real-time translation",
        solutionDesc:
          "The customer writes in their language, you reply in yours. The conversation is translated both ways, instantly. Zero barriers.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "No way to reach your customers and offer them a promotion?",
        solutionTitle: "WhatsApp campaigns & alerts",
        solutionDesc:
          "Send per-location offers and reminders straight to the customer's phone. The same support channel becomes a channel that generates sales.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Every location has its own prices and hours, and management gets complicated?",
        solutionTitle: "Per-location answers",
        solutionDesc:
          "The AI detects which location the customer is writing from and replies with the correct data: prices, hours and info for that store.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Too much to orchestrate at once: replying, translating, invoicing, alerting?",
        solutionTitle: "One AI that orchestrates it all",
        solutionDesc:
          "It's not just a chatbot: it's a tailored AI that answers, sends invoices, audio and video, translates, escalates to an operator and — above all — connects to your systems.",
      },
    ],
    problemsBanner: "One single solution: less work, customers cared for, more sales.",
    langBadge: "Real-time translation",
    langTitle: "No language",
    langTitleAccent: "barriers.",
    langDesc:
      "Your customers write in their language, your operators reply in theirs. Every message is translated both ways, in real time — the same multilingual AI across every location, from tourists to locals.",
    actsTitle: "It doesn't just reply:",
    actsTitleAccent: "it acts and sells.",
    actsDesc:
      "The customer reports a problem. The AI connects to the system, solves it and confirms. And in the same conversation it presents the loyalty card.",
    campaignsTitle: "Turn alerts",
    campaignsTitleAccent: "into sales.",
    campaignsDesc:
      "With one click you send a campaign to all your customers on WhatsApp: a promo for quiet hours, a new feature or the loyalty card. The support channel becomes your best marketing tool.",
    dataTitle: "Your data,",
    dataTitleAccent: "under your control.",
    dataCards: [
      {
        icon: "shield",
        title: "Data security",
        desc:
          "The AI talks naturally, but it's not always active. As soon as personal data has to be collected, the system automatically switches from AI mode to a flow controlled by predefined rules. Sensitive data is never sent to external AI services.",
      },
      {
        icon: "server",
        title: "On-premise: all in your house",
        desc:
          "The system installs on your servers. All software runs inside the company, which keeps full control of conversations and information, without data passing through third parties.",
      },
      {
        icon: "expand",
        title: "Scales to your needs",
        desc:
          "Features grow with you: new integrations, connection to your systems and autonomous functions, based on what the business needs at any moment.",
      },
      {
        icon: "together",
        title: "A project we build together",
        desc:
          "You don't adapt to a rigid product: we build the system around your reality. We train the AI on your real cases and refine it over time, based on experience with your customers.",
      },
    ],
    dataBanner: "Made to measure. Secure, yours, built for your business.",
    langEvery: "Speaks every language in the world, automatically.",
    zones: ["Downtown", "North", "South", "West"],
    storeTitle: "It loads the right data,",
    storeAccent: "for every location.",
    storeSub:
      "The AI detects which location the customer is writing from and loads its data on the fly: hours, price list and address of that store. No more wrong answers.",
    storeLoading: "Loading store data…",
    storeHoursLabel: "Hours",
    storePricesLabel: "Price list",
    storeAddressLabel: "Address",
    svcWash: "Wash",
    svcDry: "Dry",
    mockOperator: "OPERATOR",
    mockReply: "Hi! The Centro zone is open 8:00–21:00, every day.",
    mockQ1Local: "What time does the Centro store open?",
    mockQ2Local: "Thanks! Do you have delivery?",
    mockLiveLang: "EN",
    actsBot: "EcoWash Bot",
    actsCustomer1: "The washer won't open and my clothes are inside.",
    actsAi1: "Got it. I'm checking washer 4. One moment, please.",
    actsAi2:
      "Good news! Washer 4 has been unlocked and the door is open. You can collect your clothes.",
    actsCustomer2: "Ok, thanks! Sorted! 🙌",
    actsPromoTitle: "🎉 SOMETHING NEW FOR YOU!",
    actsPromoText:
      "Discover our loyalty card and enjoy exclusive perks with every wash.",
    actsPromoCard: "EcoWash · Loyalty card",
    pushDate: "Tuesday, May 14",
    pushText:
      "Make every wash count! 💚 Discover the loyalty card: exclusive discounts, gifts and more perks. Ask for yours on your next visit! ⭐",
    ctaTitle: "Shall we talk?",
    ctaDesc:
      "We'll show you how to run your whole laundry network with a single AI. Demo tailored to your chain, no commitment.",
  },

  es: {
    seoTitle: "Chatbot WhatsApp para Lavanderías Multi-Sede - eChatbot",
    seoDesc:
      "Una sola IA en WhatsApp para toda tu red de lavanderías. Responde 24/7, traduce en tiempo real, reconoce la sede, desbloquea las máquinas y pasa a un operador. Para lavanderías self-service, tintorerías e industriales.",
    seoKeys:
      "chatbot lavandería, whatsapp lavandería, lavandería self service ia, chatbot lavandería autoservicio, lavanderías multi sede, red lavanderías ia",
    breadcrumb: "Lavanderías",
    badge: "Para Redes de Lavanderías",
    heroTitleTop: "Una sola IA para toda tu red de lavanderías.",
    heroTitleAccent: "Cada lavandería, la respuesta correcta.",
    heroSub:
      "Una sola IA en WhatsApp para toda tu red de lavanderías: responde 24/7, traduce en tiempo real, reconoce desde qué sede escribe el cliente, desbloquea las máquinas y pasa a un operador cuando hace falta. Tú lo gobiernas todo desde un único panel.",
    cta: "Hablemos",
    ctaSub: "Demo a medida, sin compromiso",
    industriesTitle: "Una solución, cada tipo de lavandería",
    industriesSub:
      "El ejemplo que ves es DemoWash, una red de lavanderías self-service que también ofrece servicio de tintorería. La misma IA gestiona cada sede de tu marca, sea cual sea el servicio que ofrezca.",
    industries: [
      { icon: "🧺", label: "Autoservicio" },
      { icon: "👔", label: "Tintorería" },
      { icon: "🚚", label: "Recogida y entrega" },
      { icon: "🏭", label: "Industrial" },
      { icon: "🏨", label: "Hotel & B2B" },
      { icon: "🪙", label: "De monedas" },
      { icon: "♻️", label: "Eco-friendly" },
      { icon: "🛏️", label: "Ropa & textiles" },
    ],
    industriesNote: "…autoservicio, tradicional o industrial: cada lavandería, un solo asistente.",
    problemsTitle: "Hemos identificado algunos detalles",
    problemsSub: "que podrían dar una vuelta a tu negocio.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "¿Dudas, incidencias y quejas que llegan a cualquier hora y se quedan sin respuesta?",
        solutionTitle: "Soporte 24/7",
        solutionDesc:
          "El asistente responde solo a la mayoría de los casos en WhatsApp. El operador interviene únicamente cuando hace falta, con un resumen ya preparado: sede, detalles e incidencia.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "¿Clientes extranjeros que no entienden las instrucciones ni saben cómo pedir ayuda?",
        solutionTitle: "Traducción en tiempo real",
        solutionDesc:
          "El cliente escribe en su idioma, tú respondes en el tuyo. La conversación se traduce en ambas direcciones, al instante. Cero barreras.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "¿Sin forma de contactar a tus clientes para ofrecerles una promoción?",
        solutionTitle: "Campañas y avisos por WhatsApp",
        solutionDesc:
          "Envía ofertas y recordatorios por sede directamente al móvil del cliente. El mismo canal de soporte se convierte en un canal que genera ventas.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "¿Cada sede tiene sus propios precios y horarios y la gestión se vuelve complicada?",
        solutionTitle: "Respuestas personalizadas por sede",
        solutionDesc:
          "La IA identifica desde qué sede escribe el cliente y responde con los datos correctos: precios, horarios e información de ese local.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "¿Demasiadas cosas que orquestar a la vez: responder, traducir, facturar, avisar?",
        solutionTitle: "Una IA que lo orquesta todo",
        solutionDesc:
          "No es solo un chatbot: es una IA hecha a medida que contesta, envía facturas, audios y vídeos, traduce, escala a un operador y, sobre todo, se conecta a tus sistemas.",
      },
    ],
    problemsBanner: "Una sola solución: menos trabajo, clientes atendidos, más ventas.",
    langBadge: "Traducción en tiempo real",
    langTitle: "Sin barreras",
    langTitleAccent: "de idioma.",
    langDesc:
      "Tus clientes escriben en su idioma, tus operadores responden en el suyo. Cada mensaje se traduce en ambas direcciones, en tiempo real — la misma IA multilingüe en todas las sedes, del turista al cliente local.",
    actsTitle: "No solo responde:",
    actsTitleAccent: "actúa y vende.",
    actsDesc:
      "El cliente avisa de un problema. La IA se conecta al sistema, lo resuelve y confirma. Y en la misma conversación presenta la tarjeta de fidelización.",
    campaignsTitle: "Convierte los avisos",
    campaignsTitleAccent: "en ventas.",
    campaignsDesc:
      "Con un clic envías una campaña a todos tus clientes por WhatsApp: una promoción para las horas flojas, una novedad o la tarjeta de fidelización. El canal de soporte se convierte en tu mejor herramienta de marketing.",
    dataTitle: "Tus datos,",
    dataTitleAccent: "bajo tu control.",
    dataCards: [
      {
        icon: "shield",
        title: "Seguridad de los datos",
        desc:
          "La IA dialoga de forma natural, pero no está siempre activa. En cuanto hay que recoger datos personales, el sistema pasa automáticamente de modo IA a un flujo controlado por reglas predefinidas. Los datos sensibles nunca se envían a servicios de IA externos.",
      },
      {
        icon: "server",
        title: "On-premise: todo en tu casa",
        desc:
          "El sistema se instala en vuestros servidores. Todo el software corre dentro de la empresa, que mantiene el control total de las conversaciones y de la información, sin que los datos pasen por terceros.",
      },
      {
        icon: "expand",
        title: "Ampliable a tus necesidades",
        desc:
          "Las funcionalidades crecen contigo: nuevas integraciones, conexión con tus sistemas y funciones autónomas, según lo que el negocio necesite en cada momento.",
      },
      {
        icon: "together",
        title: "Un proyecto que construimos juntos",
        desc:
          "No te adaptas a un producto rígido: construimos el sistema en torno a vuestra realidad. Entrenamos la IA con vuestros casos reales y la afinamos con el tiempo, sobre la experiencia con los clientes.",
      },
    ],
    dataBanner: "Hecho a tu medida. Seguro, tuyo, y pensado para tu negocio.",
    langEvery: "Habla todos los idiomas del mundo, en automático.",
    zones: ["Centro", "Norte", "Sur", "Oeste"],
    storeTitle: "Carga los datos correctos,",
    storeAccent: "para cada sede.",
    storeSub:
      "La IA identifica desde qué sede escribe el cliente y carga al vuelo sus datos: horarios, tarifas y dirección de ese local. Se acabaron las respuestas equivocadas.",
    storeLoading: "Cargando los datos de la sede…",
    storeHoursLabel: "Horarios",
    storePricesLabel: "Tarifas",
    storeAddressLabel: "Dirección",
    svcWash: "Lavado",
    svcDry: "Secado",
    mockOperator: "OPERADOR",
    mockReply: "¡Hola! La zona Centro abre de 8:00 a 21:00, todos los días.",
    mockQ1Local: "¿A qué hora abre la sede de la zona Centro?",
    mockQ2Local: "¡Gracias! ¿Tenéis entrega a domicilio?",
    mockLiveLang: "ES",
    actsBot: "EcoWash Bot",
    actsCustomer1: "La lavadora no se abre y tengo la ropa dentro.",
    actsAi1: "Entendido. Estoy revisando la lavadora 4. Un momento, por favor.",
    actsAi2:
      "¡Buenas noticias! La lavadora 4 se ha desbloqueado y la puerta está abierta. Puedes recoger tu ropa.",
    actsCustomer2: "¡Ok, gracias! ¡Resuelto! 🙌",
    actsPromoTitle: "🎉 ¡NOVEDAD PARA TI!",
    actsPromoText:
      "Descubre nuestra tarjeta de fidelización y disfruta de ventajas exclusivas en cada lavado.",
    actsPromoCard: "EcoWash · Tarjeta de fidelización",
    pushDate: "Martes, 14 de mayo",
    pushText:
      "¡Haz que cada lavado cuente! 💚 Descubre la tarjeta de fidelización: descuentos exclusivos, regalos y más ventajas. ¡Pide la tuya en tu próxima visita! ⭐",
    ctaTitle: "¿Lo hablamos?",
    ctaDesc:
      "Te mostramos cómo gestionar toda tu red de lavanderías con una sola IA. Demo a medida para tu cadena, sin compromiso.",
  },

  de: {
    seoTitle: "WhatsApp-Chatbot für Multi-Standort-Wäschereien - eChatbot",
    seoDesc:
      "Eine einzige KI auf WhatsApp für dein gesamtes Wäscherei-Netzwerk. Antwortet 24/7, übersetzt in Echtzeit, erkennt den Standort, entriegelt die Maschinen und übergibt an einen Mitarbeiter. Für Self-Service-, Voll-Service- und Reinigungs-Wäschereien.",
    seoKeys:
      "wäscherei chatbot, whatsapp wäscherei, self service wäscherei ki, waschsalon chatbot, multi standort wäscherei, waschsalon assistent",
    breadcrumb: "Wäschereien",
    badge: "Für Wäscherei-Netzwerke",
    heroTitleTop: "Eine einzige KI für dein gesamtes Wäscherei-Netzwerk.",
    heroTitleAccent: "Jeder Standort, die richtige Antwort.",
    heroSub:
      "Eine einzige KI auf WhatsApp für dein gesamtes Wäscherei-Netzwerk: antwortet 24/7, übersetzt in Echtzeit, erkennt, von welchem Standort der Kunde schreibt, entriegelt die Maschinen und übergibt bei Bedarf an einen Mitarbeiter. Du steuerst alles über ein einziges Panel.",
    cta: "Sprechen wir darüber",
    ctaSub: "Maßgeschneiderte Demo, unverbindlich",
    industriesTitle: "Eine Lösung, jede Art von Wäscherei",
    industriesSub:
      "Das Beispiel, das du siehst, ist DemoWash, ein Self-Service-Wäscherei-Netzwerk, das auch eine Textilreinigung anbietet. Dieselbe KI steuert jeden Standort deiner Marke, welchen Service sie auch bietet.",
    industries: [
      { icon: "🧺", label: "Self-Service" },
      { icon: "👔", label: "Reinigung" },
      { icon: "🚚", label: "Abholung & Lieferung" },
      { icon: "🏭", label: "Industrie" },
      { icon: "🏨", label: "Hotel & B2B" },
      { icon: "🪙", label: "Münzbetrieb" },
      { icon: "♻️", label: "Umweltfreundlich" },
      { icon: "🛏️", label: "Wäsche & Textilien" },
    ],
    industriesNote: "…Self-Service, Voll-Service oder Industrie: jede Wäscherei, ein Assistent.",
    problemsTitle: "Wir haben ein paar Details entdeckt",
    problemsSub: "die deinem Business eine Wende geben könnten.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Fragen, Anliegen und Beschwerden, die zu jeder Stunde eintreffen und unbeantwortet bleiben?",
        solutionTitle: "Support 24/7",
        solutionDesc:
          "Der Assistent beantwortet die meisten Fälle auf WhatsApp von selbst. Der Mitarbeiter greift nur ein, wenn es nötig ist, mit einer fertigen Zusammenfassung: Standort, Details und Anliegen.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Ausländische Kunden, die weder die Anweisungen verstehen noch wissen, wie sie um Hilfe bitten?",
        solutionTitle: "Übersetzung in Echtzeit",
        solutionDesc:
          "Der Kunde schreibt in seiner Sprache, du antwortest in deiner. Das Gespräch wird in beide Richtungen übersetzt, sofort. Null Barrieren.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "Keine Möglichkeit, deine Kunden zu erreichen und ihnen eine Aktion anzubieten?",
        solutionTitle: "Kampagnen & Hinweise per WhatsApp",
        solutionDesc:
          "Sende Angebote und Erinnerungen pro Standort direkt auf das Handy des Kunden. Derselbe Support-Kanal wird zu einem Kanal, der Verkäufe generiert.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Jeder Standort hat eigene Preise und Öffnungszeiten und die Verwaltung wird kompliziert?",
        solutionTitle: "Standortbezogene Antworten",
        solutionDesc:
          "Die KI erkennt, von welchem Standort der Kunde schreibt, und antwortet mit den korrekten Daten: Preise, Öffnungszeiten und Infos zu diesem Standort.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Zu viel auf einmal zu orchestrieren: antworten, übersetzen, abrechnen, benachrichtigen?",
        solutionTitle: "Eine KI, die alles orchestriert",
        solutionDesc:
          "Es ist nicht nur ein Chatbot: Es ist eine maßgeschneiderte KI, die antwortet, Rechnungen, Audios und Videos verschickt, übersetzt, an einen Mitarbeiter eskaliert und sich vor allem mit deinen Systemen verbindet.",
      },
    ],
    problemsBanner: "Eine einzige Lösung: weniger Arbeit, betreute Kunden, mehr Verkäufe.",
    langBadge: "Übersetzung in Echtzeit",
    langTitle: "Ohne Sprach-",
    langTitleAccent: "barrieren.",
    langDesc:
      "Deine Kunden schreiben in ihrer Sprache, deine Mitarbeiter antworten in ihrer. Jede Nachricht wird in beide Richtungen übersetzt, in Echtzeit — dieselbe mehrsprachige KI an allen Standorten, vom Touristen bis zur lokalen Kundschaft.",
    actsTitle: "Sie antwortet nicht nur:",
    actsTitleAccent: "sie handelt und verkauft.",
    actsDesc:
      "Der Kunde meldet ein Problem. Die KI verbindet sich mit dem System, löst es und bestätigt. Und im selben Gespräch stellt sie die Treuekarte vor.",
    campaignsTitle: "Verwandle Hinweise",
    campaignsTitleAccent: "in Verkäufe.",
    campaignsDesc:
      "Mit einem Klick sendest du eine Kampagne an alle deine Kunden auf WhatsApp: eine Aktion für die ruhigen Stunden, eine Neuheit oder die Treuekarte. Der Support-Kanal wird zu deinem besten Marketing-Werkzeug.",
    dataTitle: "Deine Daten,",
    dataTitleAccent: "unter deiner Kontrolle.",
    dataCards: [
      {
        icon: "shield",
        title: "Datensicherheit",
        desc:
          "Die KI kommuniziert auf natürliche Weise, ist aber nicht immer aktiv. Sobald personenbezogene Daten erfasst werden müssen, wechselt das System automatisch vom KI-Modus zu einem durch vordefinierte Regeln gesteuerten Ablauf. Sensible Daten werden niemals an externe KI-Dienste gesendet.",
      },
      {
        icon: "server",
        title: "On-Premise: alles bei dir im Haus",
        desc:
          "Das System wird auf deinen Servern installiert. Die gesamte Software läuft innerhalb des Unternehmens, das die volle Kontrolle über Gespräche und Informationen behält, ohne dass Daten durch Dritte laufen.",
      },
      {
        icon: "expand",
        title: "Erweiterbar nach deinen Bedürfnissen",
        desc:
          "Die Funktionen wachsen mit dir: neue Integrationen, Anbindung an deine Systeme und autonome Funktionen, je nachdem, was das Business in jedem Moment braucht.",
      },
      {
        icon: "together",
        title: "Ein Projekt, das wir gemeinsam aufbauen",
        desc:
          "Du passt dich nicht an ein starres Produkt an: Wir bauen das System rund um deine Realität. Wir trainieren die KI mit deinen echten Fällen und verfeinern sie im Laufe der Zeit, basierend auf der Erfahrung mit deinen Kunden.",
      },
    ],
    dataBanner: "Maßgeschneidert. Sicher, deins, gemacht für dein Business.",
    langEvery: "Spricht jede Sprache der Welt, automatisch.",
    zones: ["Zentrum", "Nord", "Süd", "West"],
    storeTitle: "Sie lädt die richtigen Daten,",
    storeAccent: "für jeden Standort.",
    storeSub:
      "Die KI erkennt, von welchem Standort der Kunde schreibt, und lädt im Nu seine Daten: Öffnungszeiten, Preisliste und Adresse dieses Standorts. Schluss mit falschen Antworten.",
    storeLoading: "Lade die Standortdaten…",
    storeHoursLabel: "Öffnungszeiten",
    storePricesLabel: "Preisliste",
    storeAddressLabel: "Adresse",
    svcWash: "Waschen",
    svcDry: "Trocknen",
    mockOperator: "MITARBEITER",
    mockReply: "Hallo! Die Zone Zentrum ist täglich von 8:00 bis 21:00 Uhr geöffnet.",
    mockQ1Local: "Um wie viel Uhr öffnet der Standort in der Zone Zentrum?",
    mockQ2Local: "Danke! Habt ihr Lieferung?",
    mockLiveLang: "DE",
    actsBot: "EcoWash Bot",
    actsCustomer1: "Die Waschmaschine öffnet nicht und meine Wäsche ist drin.",
    actsAi1: "Verstanden. Ich prüfe gerade Waschmaschine 4. Einen Moment, bitte.",
    actsAi2:
      "Gute Nachrichten! Waschmaschine 4 wurde entriegelt und die Tür ist offen. Du kannst deine Wäsche abholen.",
    actsCustomer2: "Ok, danke! Gelöst! 🙌",
    actsPromoTitle: "🎉 NEU FÜR DICH!",
    actsPromoText:
      "Entdecke unsere Treuekarte und profitiere bei jedem Waschgang von exklusiven Vorteilen.",
    actsPromoCard: "EcoWash · Treuekarte",
    pushDate: "Dienstag, 14. Mai",
    pushText:
      "Lass jeden Waschgang zählen! 💚 Entdecke die Treuekarte: exklusive Rabatte, Geschenke und weitere Vorteile. Frag bei deinem nächsten Besuch nach deiner! ⭐",
    ctaTitle: "Sprechen wir darüber?",
    ctaDesc:
      "Wir zeigen dir, wie du dein gesamtes Wäscherei-Netzwerk mit einer einzigen KI steuerst. Maßgeschneiderte Demo für deine Kette, unverbindlich.",
  },
}
