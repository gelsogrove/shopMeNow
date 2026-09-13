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
  // Try it (scenario demo)
  tryTitle: string
  tryAccent: string
  trySub: string
  scenarios: Scenario[]
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
    heroTitleTop: "Il numero WhatsApp che",
    heroTitleAccent: "conosce la tua destinazione.",
    heroSub:
      "Eventi, alloggi, ristoranti, sentieri: i visitatori scrivono su WhatsApp e ricevono risposte prese dal tuo catalogo reale — non da un testo generico scritto una volta e mai aggiornato.",
    cta: "Richiedi una demo",
    ctaSub: "Demo su misura, nessun impegno",
    tryDemo: "Prova la conversazione ↓",
    heroProof1: "lingue gestite nella stessa chat",
    heroProof2: "nessun orario d'ufficio",
    heroProof3: "catalogo aggiornato, sempre coerente",
    heroCardTitle: "Ufficio del Turismo",
    heroCardStatus: "WhatsApp Business",
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
    howTitle: "Tre tappe,",
    howAccent: "non un progetto informatico.",
    howSub:
      "Non è un chatbot da configurare a regole. Il catalogo della destinazione resta l'unica fonte: lo aggiorni tu, il resto lo fa il bot.",
    howSteps: [
      {
        badge: "Tappa 1",
        title: "Carichi il catalogo",
        desc: "Eventi, alloggi, ristoranti, attività: ogni scheda che compili nel pannello diventa subito qualcosa che il bot sa rispondere.",
      },
      {
        badge: "Tappa 2",
        title: "Colleghi il numero WhatsApp",
        desc: "Il numero della Pro Loco o dell'ufficio IAT diventa il punto di contatto. Chi scrive riceve risposta subito, in qualunque lingua.",
      },
      {
        badge: "Tappa 3",
        title: "Il bot risponde dal catalogo",
        desc: "Ogni risposta è costruita sulle schede reali, non inventata. Se una cosa non è a catalogo, il bot lo dice — non improvvisa.",
      },
    ],
    whatTitle: "Le domande che",
    whatAccent: "oggi arrivano allo sportello.",
    whatSub:
      "Le stesse che il tuo ufficio riceve per telefono o al banco — solo che arrivano a qualsiasi ora, e in qualsiasi lingua.",
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
    pushTitle: "Non solo risponde.",
    pushAccent: "Sa anche quando scrivere per primo.",
    pushSub:
      "Oltre a rispondere a chi scrive, il sistema può avvisare i visitatori già in chat quando succede qualcosa che li riguarda — senza mai diventare la fonte di spam che fa disattivare le notifiche.",
    pushSteps: [
      {
        badge: "Quando parte",
        title: "Un evento nuovo, un posto che si libera",
        desc: "Un nuovo evento viene pubblicato, una data si avvicina, un alloggio segnalato come \"ultimi posti\": il messaggio parte da solo verso chi ha già chattato con voi ed è in target.",
      },
      {
        badge: "Cosa lo ferma",
        title: "Un controllo prima dell'invio",
        desc: "Prima di inviare, il sistema guarda cosa quel visitatore ha già ricevuto negli ultimi giorni. Se un'altra iniziativa gli ha già segnalato la stessa cosa, il secondo messaggio non parte.",
      },
      {
        badge: "Perché conta",
        title: "Zero fatica, zero fastidio",
        desc: "Nessuno in ufficio deve ricordarsi \"a questo l'abbiamo già scritto\": il controllo è automatico e chi riceve i messaggi non si sente mai inondato di doppioni.",
      },
    ],
    pushBoardTitle: "Ufficio del Turismo",
    pushBoardStatus: "Messaggio in uscita, non richiesto",
    pushFirstTag: "campagna: eventi del weekend",
    pushFirstText: "Ciao! Domenica c'è la Fiera d'Autunno in piazza, dalle 9:00 — pensavamo potesse interessarti.",
    pushGuardTag: "campagna: newsletter mercatini — bloccata",
    pushGuardText:
      "Stessa fiera già segnalata 3 giorni fa da un'altra iniziativa: invio annullato in automatico, il visitatore non riceve il doppione.",
    tryTitle: "Tre conversazioni vere,",
    tryAccent: "non uno slogan.",
    trySub:
      "Scegli una domanda tipo e guarda esattamente cosa risponderebbe il bot — lo stesso meccanismo che vedrebbero i tuoi visitatori.",
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
    ctaTitle: "Parliamo della tua destinazione",
    ctaDesc: "Una call di 20 minuti per capire cosa avete già e cosa serve per portarlo su WhatsApp.",
  },

  en: {
    seoTitle: "WhatsApp Chatbot for Tourism & Destinations - eChatbot",
    seoDesc:
      "The WhatsApp assistant for tourist boards, DMOs and visitor offices: answers on events, stays and restaurants from your real catalogue, in multiple languages, 24/7. It also knows when to write first, without ever duplicating messages.",
    seoKeys:
      "tourism chatbot, whatsapp tourist board, ai tourism assistant, destination chatbot, whatsapp visitor office, multilingual tourism ai",
    badge: "For tourist boards, DMOs and visitor offices",
    heroTitleTop: "The WhatsApp number that",
    heroTitleAccent: "knows your destination.",
    heroSub:
      "Events, stays, restaurants, trails: visitors write on WhatsApp and get answers pulled from your real catalogue — not a generic script written once and never updated.",
    cta: "Request a demo",
    ctaSub: "Tailored demo, no commitment",
    tryDemo: "Try the conversation ↓",
    heroProof1: "languages handled in the same chat",
    heroProof2: "no office hours",
    heroProof3: "one catalogue, always consistent",
    heroCardTitle: "Tourist Information",
    heroCardStatus: "WhatsApp Business",
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
    howTitle: "Three stops,",
    howAccent: "not an IT project.",
    howSub:
      "This isn't a chatbot you configure with rules. Your destination's catalogue stays the only source: you update it, the bot does the rest.",
    howSteps: [
      {
        badge: "Stop 1",
        title: "You load the catalogue",
        desc: "Events, stays, restaurants, activities: every entry you fill in the panel immediately becomes something the bot can answer with.",
      },
      {
        badge: "Stop 2",
        title: "You connect the WhatsApp number",
        desc: "Your tourist board's or visitor office's number becomes the contact point. Whoever writes gets an answer right away, in any language.",
      },
      {
        badge: "Stop 3",
        title: "The bot answers from the catalogue",
        desc: "Every answer is built from real entries, never invented. If something isn't in the catalogue, the bot says so — it doesn't improvise.",
      },
    ],
    whatTitle: "The questions that",
    whatAccent: "already reach your front desk.",
    whatSub:
      "The same ones your office gets by phone or at the counter — except they now arrive at any hour, in any language.",
    capabilities: [
      {
        icon: "🎪",
        title: "Events and happenings",
        desc: "Village fairs, patron saint festivals, local markets — with dates and times kept current, never a calendar two seasons old.",
      },
      {
        icon: "🏡",
        title: "Stays and availability",
        desc: "Apartments, B&Bs, mountain huts: features, capacity, contacts — whoever is looking for a place to sleep finds the right listing.",
      },
      {
        icon: "🍽️",
        title: "Restaurants and local specialities",
        desc: "Local dishes, allergens, who's open tonight — including specific questions, like \"is there a gluten-free option\".",
      },
      {
        icon: "🥾",
        title: "Trails and outdoor activities",
        desc: "Length, elevation gain, difficulty: information that today ends up on a leaflet becomes an instant answer.",
      },
      {
        icon: "🌍",
        title: "Multiple languages, no manual translation",
        desc: "A German visitor and a Spanish one can write in the same chat: each gets an answer in their own language, from the same catalogue.",
      },
      {
        icon: "✅",
        title: "It never makes things up",
        desc: "If a question falls outside the catalogue, the bot says so clearly — better \"I don't know\" than the wrong information given to a guest.",
      },
    ],
    pushTitle: "It doesn't just answer.",
    pushAccent: "It also knows when to write first.",
    pushSub:
      "Beyond replying to whoever writes, the system can notify visitors already in chat when something relevant happens — without ever becoming the reason someone mutes your notifications.",
    pushSteps: [
      {
        badge: "When it fires",
        title: "A new event, a spot opening up",
        desc: "A new event gets published, a date approaches, a stay is flagged \"last spots left\": the message goes out on its own to visitors who already chatted with you and match.",
      },
      {
        badge: "What stops it",
        title: "A check before it ever sends",
        desc: "Before sending, the system looks at what that visitor already received in recent days. If another initiative already flagged the same thing, the second message never goes out.",
      },
      {
        badge: "Why it matters",
        title: "Zero effort, zero annoyance",
        desc: "Nobody in the office has to remember \"we already told them this\": the check runs automatically and recipients never feel flooded with duplicates.",
      },
    ],
    pushBoardTitle: "Tourist Information",
    pushBoardStatus: "Outbound message, unprompted",
    pushFirstTag: "campaign: weekend events",
    pushFirstText: "Hi! On Sunday there's the Autumn Fair in the square, from 9am — thought this might interest you.",
    pushGuardTag: "campaign: markets newsletter — blocked",
    pushGuardText:
      "The same fair was already flagged 3 days ago by another initiative: send cancelled automatically, the visitor never receives the duplicate.",
    tryTitle: "Three real conversations,",
    tryAccent: "not a slogan.",
    trySub: "Pick a typical question and see exactly what the bot would answer — the same mechanism your visitors would see.",
    scenarios: [
      {
        title: "What's on this weekend",
        rule: "catalogue → events",
        script: [
          { role: "guest", text: "What is there to do this weekend?" },
          {
            role: "bot",
            tag: "from events catalogue",
            text: "This weekend: Saturday craft market (10am–7pm) and live music (8:30pm); Sunday guided walk to the mountain hut, meeting at 9am.",
          },
          { role: "guest", text: "Is the walk okay for kids?" },
          {
            role: "bot",
            tag: "from events catalogue",
            text: "Yes, it's an easy, family-friendly route: about 2 hours, gentle elevation gain, meeting at the hut car park.",
          },
        ],
      },
      {
        title: "A stay for 4 people",
        rule: "catalogue → stays",
        script: [
          { role: "guest", text: "We're looking for a place to stay, 4 of us" },
          {
            role: "bot",
            tag: "from stays catalogue",
            text: "I have a couple of options for 4 people: a central apartment with kitchen and balcony, or a B&B 5 minutes from the village. Prefer central?",
          },
          { role: "guest", text: "Central is better, and close to parking" },
          {
            role: "bot",
            tag: "from stays catalogue",
            text: "The central apartment includes a parking spot. I'll pass along the owner's direct contact to check date availability.",
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
            tag: "replies in German",
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
    ctaTitle: "Let's talk about your destination",
    ctaDesc: "A 20-minute call to understand what you already have and what it takes to bring it to WhatsApp.",
  },

  es: {
    seoTitle: "Chatbot de WhatsApp para Turismo y Destinos - eChatbot",
    seoDesc:
      "El asistente de WhatsApp para oficinas de turismo y destinos: responde sobre eventos, alojamientos y restaurantes desde tu catálogo real, en varios idiomas, 24/7. También sabe cuándo escribir primero, sin duplicar nunca los mensajes.",
    seoKeys:
      "chatbot turismo, whatsapp oficina de turismo, asistente turístico ia, chatbot destino turístico, ia multilingüe turismo",
    badge: "Para oficinas de turismo y destinos",
    heroTitleTop: "El número de WhatsApp que",
    heroTitleAccent: "conoce tu destino.",
    heroSub:
      "Eventos, alojamientos, restaurantes, senderos: los visitantes escriben por WhatsApp y reciben respuestas de tu catálogo real — no un texto genérico escrito una vez y nunca actualizado.",
    cta: "Solicita una demo",
    ctaSub: "Demo a medida, sin compromiso",
    tryDemo: "Prueba la conversación ↓",
    heroProof1: "idiomas gestionados en el mismo chat",
    heroProof2: "sin horario de oficina",
    heroProof3: "un catálogo, siempre coherente",
    heroCardTitle: "Oficina de Turismo",
    heroCardStatus: "WhatsApp Business",
    heroScript: [
      { role: "guest", text: "¡Hola! Somos una familia, ¿qué se puede hacer el sábado?" },
      {
        role: "bot",
        tag: "del catálogo de eventos",
        text: "El sábado a las 17:00 hay un mercadillo en la plaza, y a las 20:30 una noche de música — entrada libre en ambos.",
      },
      { role: "guest", text: "Perfecto, ¿dónde podemos comer algo típico después?" },
      {
        role: "bot",
        tag: "del catálogo de restaurantes",
        text: "A dos minutos a pie está la Locanda del Bosco, abierta hasta las 22:30, conocida por sus platos caseros.",
      },
    ],
    howTitle: "Tres etapas,",
    howAccent: "no un proyecto informático.",
    howSub:
      "No es un chatbot que se configura con reglas. El catálogo del destino sigue siendo la única fuente: tú lo actualizas, el bot hace el resto.",
    howSteps: [
      {
        badge: "Etapa 1",
        title: "Cargas el catálogo",
        desc: "Eventos, alojamientos, restaurantes, actividades: cada ficha que completas en el panel se convierte al instante en algo que el bot puede responder.",
      },
      {
        badge: "Etapa 2",
        title: "Conectas el número de WhatsApp",
        desc: "El número de tu oficina de turismo se convierte en el punto de contacto. Quien escribe recibe respuesta al momento, en cualquier idioma.",
      },
      {
        badge: "Etapa 3",
        title: "El bot responde desde el catálogo",
        desc: "Cada respuesta se construye a partir de fichas reales, nunca inventada. Si algo no está en el catálogo, el bot lo dice — no improvisa.",
      },
    ],
    whatTitle: "Las preguntas que",
    whatAccent: "hoy llegan a tu mostrador.",
    whatSub: "Las mismas que recibe tu oficina por teléfono o en el mostrador — solo que ahora llegan a cualquier hora, en cualquier idioma.",
    capabilities: [
      {
        icon: "🎪",
        title: "Eventos y celebraciones",
        desc: "Ferias del pueblo, fiestas patronales, mercadillos locales — con fechas y horarios actualizados, nunca un calendario de dos temporadas atrás.",
      },
      {
        icon: "🏡",
        title: "Alojamientos y disponibilidad",
        desc: "Apartamentos, B&B, refugios: características, capacidad, contactos — quien busca dónde dormir encuentra la ficha correcta, no un listado.",
      },
      {
        icon: "🍽️",
        title: "Restaurantes y especialidades locales",
        desc: "Platos típicos, alérgenos, quién está abierto esta noche — incluidas preguntas específicas, como \"hay algún sitio sin gluten\".",
      },
      {
        icon: "🥾",
        title: "Senderos y actividades al aire libre",
        desc: "Longitud, desnivel, dificultad: información que hoy termina impresa en un folleto se convierte en una respuesta inmediata.",
      },
      {
        icon: "🌍",
        title: "Varios idiomas, sin traducciones manuales",
        desc: "Un visitante alemán y uno español pueden escribir en el mismo chat: cada uno recibe respuesta en su propio idioma, del mismo catálogo.",
      },
      {
        icon: "✅",
        title: "Nunca inventa lo que no sabe",
        desc: "Si una pregunta queda fuera del catálogo, el bot lo dice claramente — mejor \"no lo sé\" que dar información incorrecta a un huésped.",
      },
    ],
    pushTitle: "No solo responde.",
    pushAccent: "También sabe cuándo escribir primero.",
    pushSub:
      "Además de responder a quien escribe, el sistema puede avisar a los visitantes ya en el chat cuando ocurre algo que les interesa — sin convertirse nunca en la razón por la que alguien silencia tus notificaciones.",
    pushSteps: [
      {
        badge: "Cuándo se activa",
        title: "Un evento nuevo, una plaza que se libera",
        desc: "Se publica un evento nuevo, se acerca una fecha, un alojamiento se marca como \"últimas plazas\": el mensaje sale solo hacia quienes ya han chateado contigo y encajan.",
      },
      {
        badge: "Qué lo detiene",
        title: "Una comprobación antes de enviar",
        desc: "Antes de enviar, el sistema revisa qué ha recibido ya ese visitante en los últimos días. Si otra iniciativa ya señaló lo mismo, el segundo mensaje no se envía.",
      },
      {
        badge: "Por qué importa",
        title: "Cero esfuerzo, cero molestia",
        desc: "Nadie en la oficina tiene que recordar \"esto ya se lo dijimos\": la comprobación es automática y quien recibe los mensajes nunca se siente inundado de duplicados.",
      },
    ],
    pushBoardTitle: "Oficina de Turismo",
    pushBoardStatus: "Mensaje saliente, no solicitado",
    pushFirstTag: "campaña: eventos del fin de semana",
    pushFirstText: "¡Hola! El domingo hay la Feria de Otoño en la plaza, desde las 9:00 — pensamos que te podría interesar.",
    pushGuardTag: "campaña: newsletter de mercadillos — bloqueada",
    pushGuardText:
      "La misma feria ya fue señalada hace 3 días por otra iniciativa: envío cancelado automáticamente, el visitante no recibe el duplicado.",
    tryTitle: "Tres conversaciones reales,",
    tryAccent: "no un eslogan.",
    trySub: "Elige una pregunta típica y mira exactamente qué respondería el bot — el mismo mecanismo que verían tus visitantes.",
    scenarios: [
      {
        title: "Qué hay este fin de semana",
        rule: "catálogo → eventos",
        script: [
          { role: "guest", text: "¿Qué se puede hacer este fin de semana?" },
          {
            role: "bot",
            tag: "del catálogo de eventos",
            text: "Este fin de semana: sábado mercadillo artesanal (10:00–19:00) y noche de música (20:30); domingo caminata guiada al refugio, encuentro a las 9:00.",
          },
          { role: "guest", text: "¿La caminata es apta para niños?" },
          {
            role: "bot",
            tag: "del catálogo de eventos",
            text: "Sí, es una ruta fácil y familiar: unas 2 horas, desnivel suave, encuentro en el aparcamiento del refugio.",
          },
        ],
      },
      {
        title: "Dónde dormir 4 personas",
        rule: "catálogo → alojamientos",
        script: [
          { role: "guest", text: "Buscamos un sitio para dormir, somos 4" },
          {
            role: "bot",
            tag: "del catálogo de alojamientos",
            text: "Tengo un par de opciones para 4 personas: un apartamento céntrico con cocina y balcón, o un B&B a 5 minutos del pueblo. ¿Prefieres el centro?",
          },
          { role: "guest", text: "Mejor en el centro, y cerca de aparcamiento" },
          {
            role: "bot",
            tag: "del catálogo de alojamientos",
            text: "El apartamento céntrico incluye una plaza de aparcamiento. Te paso el contacto directo de la propietaria para confirmar fechas.",
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
    ctaTitle: "Hablemos de tu destino",
    ctaDesc: "Una llamada de 20 minutos para entender qué tenéis ya y qué hace falta para llevarlo a WhatsApp.",
  },

  de: {
    seoTitle: "WhatsApp-Chatbot für Tourismus & Destinationen - eChatbot",
    seoDesc:
      "Der WhatsApp-Assistent für Tourismusbüros und Destinationen: beantwortet Fragen zu Veranstaltungen, Unterkünften und Restaurants aus eurem echten Katalog, mehrsprachig, rund um die Uhr. Er weiß auch, wann er zuerst schreiben soll, ohne je doppelte Nachrichten zu senden.",
    seoKeys:
      "tourismus chatbot, whatsapp tourismusbüro, ki tourismus assistent, destination chatbot, mehrsprachige tourismus ki",
    badge: "Für Tourismusbüros und Destinationen",
    heroTitleTop: "Die WhatsApp-Nummer, die",
    heroTitleAccent: "eure Destination kennt.",
    heroSub:
      "Veranstaltungen, Unterkünfte, Restaurants, Wanderwege: Gäste schreiben auf WhatsApp und erhalten Antworten aus eurem echten Katalog — nicht aus einem einmal geschriebenen und nie aktualisierten Standardtext.",
    cta: "Demo anfragen",
    ctaSub: "Maßgeschneiderte Demo, unverbindlich",
    tryDemo: "Konversation testen ↓",
    heroProof1: "Sprachen im selben Chat",
    heroProof2: "keine Bürozeiten",
    heroProof3: "ein Katalog, immer konsistent",
    heroCardTitle: "Tourismusbüro",
    heroCardStatus: "WhatsApp Business",
    heroScript: [
      { role: "guest", text: "Hallo! Wir sind eine Familie, was gibt's am Samstag?" },
      {
        role: "bot",
        tag: "aus dem Veranstaltungskatalog",
        text: "Am Samstag um 17:00 Uhr ist ein Markt auf dem Platz, und um 20:30 Uhr ein Musikabend — beides mit freiem Eintritt.",
      },
      { role: "guest", text: "Super, wo können wir danach etwas Typisches essen?" },
      {
        role: "bot",
        tag: "aus dem Restaurantkatalog",
        text: "Zwei Gehminuten entfernt liegt die Locanda del Bosco, bis 22:30 Uhr geöffnet, bekannt für hausgemachte Gerichte.",
      },
    ],
    howTitle: "Drei Etappen,",
    howAccent: "kein IT-Projekt.",
    howSub:
      "Das ist kein Chatbot, den man mit Regeln konfiguriert. Der Katalog der Destination bleibt die einzige Quelle: ihr aktualisiert ihn, der Bot erledigt den Rest.",
    howSteps: [
      {
        badge: "Etappe 1",
        title: "Ihr ladet den Katalog",
        desc: "Veranstaltungen, Unterkünfte, Restaurants, Aktivitäten: jeder Eintrag im Panel wird sofort zu etwas, das der Bot beantworten kann.",
      },
      {
        badge: "Etappe 2",
        title: "Ihr verbindet die WhatsApp-Nummer",
        desc: "Die Nummer eures Tourismusbüros wird zur Kontaktstelle. Wer schreibt, erhält sofort eine Antwort, in jeder Sprache.",
      },
      {
        badge: "Etappe 3",
        title: "Der Bot antwortet aus dem Katalog",
        desc: "Jede Antwort basiert auf echten Einträgen, nie erfunden. Fehlt etwas im Katalog, sagt der Bot das klar — er improvisiert nicht.",
      },
    ],
    whatTitle: "Die Fragen, die",
    whatAccent: "heute am Schalter ankommen.",
    whatSub: "Dieselben, die euer Büro per Telefon oder am Schalter erhält — nur dass sie jetzt zu jeder Zeit, in jeder Sprache ankommen.",
    capabilities: [
      {
        icon: "🎪",
        title: "Veranstaltungen und Feste",
        desc: "Dorffeste, Kirchweihfeste, lokale Märkte — mit aktuellen Daten und Zeiten, nie ein zwei Saisons alter Kalender.",
      },
      {
        icon: "🏡",
        title: "Unterkünfte und Verfügbarkeit",
        desc: "Wohnungen, B&Bs, Hütten: Merkmale, Kapazität, Kontakte — wer eine Unterkunft sucht, findet den richtigen Eintrag, keine bloße Liste.",
      },
      {
        icon: "🍽️",
        title: "Restaurants und lokale Spezialitäten",
        desc: "Typische Gerichte, Allergene, wer heute Abend offen hat — auch spezifischere Fragen wie \"gibt es glutenfreie Optionen\".",
      },
      {
        icon: "🥾",
        title: "Wanderwege und Outdoor-Aktivitäten",
        desc: "Länge, Höhenunterschied, Schwierigkeit: Informationen, die heute auf einem Flyer landen, werden zu einer sofortigen Antwort.",
      },
      {
        icon: "🌍",
        title: "Mehrere Sprachen, keine manuelle Übersetzung",
        desc: "Ein deutscher und ein spanischer Gast können im selben Chat schreiben: jeder erhält eine Antwort in seiner Sprache, aus demselben Katalog.",
      },
      {
        icon: "✅",
        title: "Erfindet nichts, was er nicht weiß",
        desc: "Fällt eine Frage außerhalb des Katalogs, sagt der Bot das klar — besser \"weiß ich nicht\" als eine falsche Information an einen Gast.",
      },
    ],
    pushTitle: "Er antwortet nicht nur.",
    pushAccent: "Er weiß auch, wann er zuerst schreiben soll.",
    pushSub:
      "Neben dem Antworten kann das System Gäste, die bereits im Chat sind, informieren, wenn etwas Relevantes passiert — ohne je der Grund zu sein, warum jemand eure Benachrichtigungen stummschaltet.",
    pushSteps: [
      {
        badge: "Wann es auslöst",
        title: "Eine neue Veranstaltung, ein frei werdender Platz",
        desc: "Eine neue Veranstaltung wird veröffentlicht, ein Termin rückt näher, eine Unterkunft wird als \"letzte Plätze\" markiert: die Nachricht geht automatisch an passende Gäste, die bereits mit euch gechattet haben.",
      },
      {
        badge: "Was es stoppt",
        title: "Eine Prüfung vor dem Versand",
        desc: "Vor dem Versand prüft das System, was dieser Gast in den letzten Tagen bereits erhalten hat. Hat eine andere Initiative dasselbe schon gemeldet, wird die zweite Nachricht nie verschickt.",
      },
      {
        badge: "Warum das zählt",
        title: "Null Aufwand, null Ärger",
        desc: "Niemand im Büro muss sich merken \"das haben wir schon geschrieben\": die Prüfung läuft automatisch, und niemand fühlt sich je mit Duplikaten überflutet.",
      },
    ],
    pushBoardTitle: "Tourismusbüro",
    pushBoardStatus: "Ausgehende Nachricht, unaufgefordert",
    pushFirstTag: "Kampagne: Wochenendveranstaltungen",
    pushFirstText: "Hallo! Am Sonntag ist das Herbstfest auf dem Platz, ab 9:00 Uhr — das könnte euch interessieren.",
    pushGuardTag: "Kampagne: Marktnewsletter — blockiert",
    pushGuardText:
      "Dasselbe Fest wurde bereits vor 3 Tagen von einer anderen Initiative gemeldet: Versand automatisch abgebrochen, der Gast erhält kein Duplikat.",
    tryTitle: "Drei echte Gespräche,",
    tryAccent: "kein Slogan.",
    trySub: "Wählt eine typische Frage und seht genau, was der Bot antworten würde — derselbe Mechanismus, den eure Gäste sehen würden.",
    scenarios: [
      {
        title: "Was ist dieses Wochenende los",
        rule: "Katalog → Veranstaltungen",
        script: [
          { role: "guest", text: "Was kann man dieses Wochenende unternehmen?" },
          {
            role: "bot",
            tag: "aus dem Veranstaltungskatalog",
            text: "Dieses Wochenende: Samstag Handwerksmarkt (10–19 Uhr) und Musikabend (20:30 Uhr); Sonntag geführte Wanderung zur Hütte, Treffpunkt 9 Uhr.",
          },
          { role: "guest", text: "Ist die Wanderung für Kinder geeignet?" },
          {
            role: "bot",
            tag: "aus dem Veranstaltungskatalog",
            text: "Ja, sie ist als leichte, familienfreundliche Route markiert: ca. 2 Stunden, geringer Höhenunterschied, Treffpunkt am Hüttenparkplatz.",
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
            text: "Ich habe zwei Optionen für 4 Personen: eine zentrale Wohnung mit Küche und Balkon, oder ein B&B 5 Minuten vom Dorf entfernt. Lieber zentral?",
          },
          { role: "guest", text: "Lieber zentral, und in der Nähe eines Parkplatzes" },
          {
            role: "bot",
            tag: "aus dem Unterkunftskatalog",
            text: "Die zentrale Wohnung hat einen Parkplatz inklusive. Ich gebe euch den direkten Kontakt der Vermieterin für die Terminprüfung.",
          },
        ],
      },
      {
        title: "Ausländischer Gast, leichter Wanderweg",
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
    ctaTitle: "Lasst uns über eure Destination sprechen",
    ctaDesc: "Ein 20-minütiges Gespräch, um zu verstehen, was ihr schon habt und was es braucht, um es auf WhatsApp zu bringen.",
  },
}
