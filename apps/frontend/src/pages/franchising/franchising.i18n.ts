// i18n strings for the Franchising landing page.
// Base language is Italian; the others mirror it 1:1.
// Positioning: ONE AI for any multi-location franchise network.
// DemoWash (laundry) is only the running EXAMPLE — the product fits
// gyms, hotels, clinics, car washes, restaurants, retail, etc.

export type FranchisingLang = "it" | "en" | "es" | "pt"

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

export interface FranchisingCopy {
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

export const FRANCHISING_I18N: Record<FranchisingLang, FranchisingCopy> = {
  it: {
    seoTitle: "Chatbot WhatsApp per Franchising e Catene Multi-Sede - eChatbot",
    seoDesc:
      "Un'unica AI su WhatsApp per tutta la tua rete in franchising. Risponde 24/7, traduce in tempo reale, riconosce la sede e passa all'operatore. Per lavanderie, palestre, hotel, cliniche, autolavaggi e qualsiasi catena multi-sede.",
    seoKeys:
      "chatbot franchising, whatsapp multi sede, catene franchising, assistente ia franchising, chatbot palestre hotel cliniche, gestione sedi whatsapp",
    breadcrumb: "Franchising Multi-Sede",
    badge: "Per Franchising & Catene",
    heroTitleTop: "I tuoi clienti scrivono a ogni ora.",
    heroTitleAccent: "Chi risponde, per ogni sede?",
    heroSub:
      "Un'unica AI su WhatsApp per tutta la tua rete in franchising: risponde 24/7, traduce in tempo reale, riconosce da quale sede scrive il cliente e passa all'operatore quando serve. Tu governi tutto da un solo pannello.",
    cta: "Parliamone",
    ctaSub: "Demo su misura, nessun impegno",
    industriesTitle: "Una soluzione, ogni rete in franchising",
    industriesSub:
      "L'esempio che vedi è DemoWash, una rete di lavanderie. Ma la stessa AI lavora per qualunque catena multi-sede.",
    industries: [
      { icon: "🧺", label: "Lavanderie" },
      { icon: "🏋️", label: "Palestre" },
      { icon: "🏨", label: "Hotel" },
      { icon: "🏥", label: "Cliniche" },
      { icon: "🚗", label: "Autolavaggi" },
      { icon: "🍽️", label: "Ristoranti" },
      { icon: "💆", label: "Beauty & SPA" },
      { icon: "🛍️", label: "Retail" },
    ],
    industriesNote: "…e ogni altra attività con più sedi.",
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
    mockReply: "Ciao! Milano Centro apre 8:00–21:00, tutti i giorni.",
    mockQ1Local: "A che ora apre la sede di Milano?",
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
      "Ti mostriamo come gestire tutta la rete con un'unica AI. Demo su misura per la tua catena, nessun impegno.",
  },

  en: {
    seoTitle: "WhatsApp Chatbot for Franchises & Multi-Location Chains - eChatbot",
    seoDesc:
      "One AI on WhatsApp for your whole franchise network. Answers 24/7, translates in real time, detects the location and hands off to an operator. For laundries, gyms, hotels, clinics, car washes and any multi-location chain.",
    seoKeys:
      "franchise chatbot, multi location whatsapp, franchise chains, franchise ai assistant, gym hotel clinic chatbot, location management whatsapp",
    breadcrumb: "Multi-Location Franchises",
    badge: "For Franchises & Chains",
    heroTitleTop: "Your customers write at every hour.",
    heroTitleAccent: "Who answers, for every location?",
    heroSub:
      "One AI on WhatsApp for your whole franchise network: answers 24/7, translates in real time, detects which location the customer is writing from and hands off to an operator when needed. You run everything from a single panel.",
    cta: "Let's Talk",
    ctaSub: "Tailored demo, no commitment",
    industriesTitle: "One solution, every franchise network",
    industriesSub:
      "The example you see is DemoWash, a laundry network. But the same AI works for any multi-location chain.",
    industries: [
      { icon: "🧺", label: "Laundries" },
      { icon: "🏋️", label: "Gyms" },
      { icon: "🏨", label: "Hotels" },
      { icon: "🏥", label: "Clinics" },
      { icon: "🚗", label: "Car Washes" },
      { icon: "🍽️", label: "Restaurants" },
      { icon: "💆", label: "Beauty & SPA" },
      { icon: "🛍️", label: "Retail" },
    ],
    industriesNote: "…and any other business with multiple locations.",
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
    mockReply: "Hi! Milano Centro is open 8:00–21:00, every day.",
    mockQ1Local: "What time does the Milano store open?",
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
      "We'll show you how to run the whole network with a single AI. Demo tailored to your chain, no commitment.",
  },

  es: {
    seoTitle: "Chatbot WhatsApp para Franquicias y Cadenas Multi-Sede - eChatbot",
    seoDesc:
      "Una sola IA en WhatsApp para toda tu red de franquicias. Responde 24/7, traduce en tiempo real, reconoce la sede y pasa a un operador. Para lavanderías, gimnasios, hoteles, clínicas, autolavados y cualquier cadena multi-sede.",
    seoKeys:
      "chatbot franquicias, whatsapp multi sede, cadenas franquicia, asistente ia franquicia, chatbot gimnasios hoteles clinicas, gestion sedes whatsapp",
    breadcrumb: "Franquicias Multi-Sede",
    badge: "Para Franquicias y Cadenas",
    heroTitleTop: "Tus clientes escriben a todas horas.",
    heroTitleAccent: "¿Quién responde, en cada sede?",
    heroSub:
      "Una sola IA en WhatsApp para toda tu red de franquicias: responde 24/7, traduce en tiempo real, reconoce desde qué sede escribe el cliente y pasa a un operador cuando hace falta. Tú lo gobiernas todo desde un único panel.",
    cta: "Hablemos",
    ctaSub: "Demo a medida, sin compromiso",
    industriesTitle: "Una solución, cada red de franquicias",
    industriesSub:
      "El ejemplo que ves es DemoWash, una red de lavanderías. Pero la misma IA funciona para cualquier cadena multi-sede.",
    industries: [
      { icon: "🧺", label: "Lavanderías" },
      { icon: "🏋️", label: "Gimnasios" },
      { icon: "🏨", label: "Hoteles" },
      { icon: "🏥", label: "Clínicas" },
      { icon: "🚗", label: "Autolavados" },
      { icon: "🍽️", label: "Restaurantes" },
      { icon: "💆", label: "Belleza & SPA" },
      { icon: "🛍️", label: "Retail" },
    ],
    industriesNote: "…y cualquier otro negocio con varias sedes.",
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
    mockReply: "¡Hola! Milano Centro abre de 8:00 a 21:00, todos los días.",
    mockQ1Local: "¿A qué hora abre la sede de Milán?",
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
      "Te mostramos cómo gestionar toda la red con una sola IA. Demo a medida para tu cadena, sin compromiso.",
  },

  pt: {
    seoTitle: "Chatbot WhatsApp para Franquias e Redes Multi-Sede - eChatbot",
    seoDesc:
      "Uma única IA no WhatsApp para toda a tua rede de franquias. Responde 24/7, traduz em tempo real, reconhece a unidade e passa para um operador. Para lavandarias, ginásios, hotéis, clínicas, lavagens de carros e qualquer rede multi-sede.",
    seoKeys:
      "chatbot franquias, whatsapp multi sede, redes franquia, assistente ia franquia, chatbot ginasios hoteis clinicas, gestao unidades whatsapp",
    breadcrumb: "Franquias Multi-Sede",
    badge: "Para Franquias e Redes",
    heroTitleTop: "Os teus clientes escrevem a toda a hora.",
    heroTitleAccent: "Quem responde, em cada unidade?",
    heroSub:
      "Uma única IA no WhatsApp para toda a tua rede de franquias: responde 24/7, traduz em tempo real, reconhece de que unidade escreve o cliente e passa para um operador quando é preciso. Tu geres tudo a partir de um único painel.",
    cta: "Vamos falar",
    ctaSub: "Demo à medida, sem compromisso",
    industriesTitle: "Uma solução, cada rede de franquias",
    industriesSub:
      "O exemplo que vês é a DemoWash, uma rede de lavandarias. Mas a mesma IA funciona para qualquer rede multi-sede.",
    industries: [
      { icon: "🧺", label: "Lavandarias" },
      { icon: "🏋️", label: "Ginásios" },
      { icon: "🏨", label: "Hotéis" },
      { icon: "🏥", label: "Clínicas" },
      { icon: "🚗", label: "Lavagens" },
      { icon: "🍽️", label: "Restaurantes" },
      { icon: "💆", label: "Beleza & SPA" },
      { icon: "🛍️", label: "Retalho" },
    ],
    industriesNote: "…e qualquer outro negócio com várias unidades.",
    problemsTitle: "Identificámos alguns detalhes",
    problemsSub: "que podem dar a volta ao teu negócio.",
    problems: [
      {
        num: "1",
        icon: "whatsapp",
        problem: "Dúvidas, ocorrências e queixas que chegam a qualquer hora e ficam sem resposta?",
        solutionTitle: "Suporte 24/7",
        solutionDesc:
          "O assistente responde sozinho à maioria dos casos no WhatsApp. O operador intervém apenas quando é preciso, com um resumo já preparado: unidade, detalhes e ocorrência.",
      },
      {
        num: "2",
        icon: "translate",
        problem: "Clientes estrangeiros que não entendem as instruções nem sabem como pedir ajuda?",
        solutionTitle: "Tradução em tempo real",
        solutionDesc:
          "O cliente escreve na sua língua, tu respondes na tua. A conversa é traduzida em ambas as direções, ao instante. Zero barreiras.",
      },
      {
        num: "3",
        icon: "megaphone",
        problem: "Sem forma de contactar os clientes para lhes oferecer uma promoção?",
        solutionTitle: "Campanhas e avisos por WhatsApp",
        solutionDesc:
          "Envias ofertas e lembretes por unidade diretamente para o telemóvel do cliente. O mesmo canal de suporte torna-se um canal que gera vendas.",
      },
      {
        num: "4",
        icon: "pin",
        problem: "Cada unidade tem os seus próprios preços e horários e a gestão complica-se?",
        solutionTitle: "Respostas personalizadas por unidade",
        solutionDesc:
          "A IA identifica de que unidade escreve o cliente e responde com os dados corretos: preços, horários e informação dessa loja.",
      },
      {
        num: "5",
        icon: "bot",
        problem: "Demasiadas coisas para orquestrar ao mesmo tempo: responder, traduzir, faturar, avisar?",
        solutionTitle: "Uma IA que orquestra tudo",
        solutionDesc:
          "Não é só um chatbot: é uma IA à medida que responde, envia faturas, áudios e vídeos, traduz, escala para um operador e, sobretudo, liga-se aos teus sistemas.",
      },
    ],
    problemsBanner: "Uma só solução: menos trabalho, clientes acompanhados, mais vendas.",
    langBadge: "Tradução em tempo real",
    langTitle: "Sem barreiras",
    langTitleAccent: "linguísticas.",
    langDesc:
      "Os teus clientes escrevem na sua língua, os teus operadores respondem na deles. Cada mensagem é traduzida em ambas as direções, em tempo real — a mesma IA multilíngue em todas as unidades, do turista ao cliente local.",
    actsTitle: "Não só responde:",
    actsTitleAccent: "age e vende.",
    actsDesc:
      "O cliente avisa de um problema. A IA liga-se ao sistema, resolve-o e confirma. E na mesma conversa apresenta o cartão de fidelização.",
    campaignsTitle: "Transforma os avisos",
    campaignsTitleAccent: "em vendas.",
    campaignsDesc:
      "Com um clique envias uma campanha a todos os clientes por WhatsApp: uma promoção para as horas vazias, uma novidade ou o cartão de fidelização. O canal de suporte torna-se a tua melhor ferramenta de marketing.",
    dataTitle: "Os teus dados,",
    dataTitleAccent: "sob o teu controlo.",
    dataCards: [
      {
        icon: "shield",
        title: "Segurança dos dados",
        desc:
          "A IA dialoga de forma natural, mas não está sempre ativa. Assim que há que recolher dados pessoais, o sistema passa automaticamente de modo IA para um fluxo controlado por regras predefinidas. Os dados sensíveis nunca são enviados a serviços de IA externos.",
      },
      {
        icon: "server",
        title: "On-premise: tudo em tua casa",
        desc:
          "O sistema instala-se nos vossos servidores. Todo o software corre dentro da empresa, que mantém o controlo total das conversas e da informação, sem que os dados passem por terceiros.",
      },
      {
        icon: "expand",
        title: "Ampliável às tuas necessidades",
        desc:
          "As funcionalidades crescem contigo: novas integrações, ligação aos teus sistemas e funções autónomas, conforme o negócio precisa em cada momento.",
      },
      {
        icon: "together",
        title: "Um projeto que construímos juntos",
        desc:
          "Não te adaptas a um produto rígido: construímos o sistema à volta da tua realidade. Treinamos a IA com os teus casos reais e afinamo-la ao longo do tempo, com base na experiência com os clientes.",
      },
    ],
    dataBanner: "Feito à tua medida. Seguro, teu, pensado para o teu negócio.",
    storeTitle: "Carrega os dados certos,",
    storeAccent: "para cada unidade.",
    storeSub:
      "A IA identifica de que unidade escreve o cliente e carrega na hora os seus dados: horários, tabela de preços e morada dessa loja. Acabaram as respostas erradas.",
    storeLoading: "A carregar os dados da unidade…",
    storeHoursLabel: "Horários",
    storePricesLabel: "Preços",
    storeAddressLabel: "Morada",
    svcWash: "Lavagem",
    svcDry: "Secagem",
    mockOperator: "OPERADOR",
    mockReply: "Olá! A Milano Centro abre das 8:00 às 21:00, todos os dias.",
    mockQ1Local: "A que horas abre a unidade de Milão?",
    mockQ2Local: "Obrigado! Têm entrega ao domicílio?",
    mockLiveLang: "PT",
    actsBot: "EcoWash Bot",
    actsCustomer1: "A máquina não abre e tenho a roupa lá dentro.",
    actsAi1: "Entendido. Estou a verificar a máquina 4. Um momento, por favor.",
    actsAi2:
      "Boas notícias! A máquina 4 foi desbloqueada e a porta está aberta. Podes recolher a tua roupa.",
    actsCustomer2: "Ok, obrigado! Resolvido! 🙌",
    actsPromoTitle: "🎉 NOVIDADE PARA TI!",
    actsPromoText:
      "Descobre o nosso cartão de fidelização e aproveita vantagens exclusivas em cada lavagem.",
    actsPromoCard: "EcoWash · Cartão de fidelização",
    pushDate: "Terça-feira, 14 de maio",
    pushText:
      "Faz cada lavagem contar! 💚 Descobre o cartão de fidelização: descontos exclusivos, presentes e mais vantagens. Pede o teu na próxima visita! ⭐",
    ctaTitle: "Vamos falar?",
    ctaDesc:
      "Mostramos-te como gerir toda a rede com uma única IA. Demo à medida da tua rede, sem compromisso.",
  },
}
