// i18n strings for the Industry 4.0 manufacturing BLOG-style landing page.
// Base language is Italian; every supported UI language is provided in full
// (it, en, es, de, fr, ca). The page falls back to English when a key is
// missing.
//
// Editorial angle (mixes Explitia's "AI & Industry 4.0" thesis with Andrea's
// brief): AI + Industry 4.0 is a duo that changes the rules — more quality,
// efficiency and sustainability. Two concrete solutions are featured:
//   1) Custom Chatbots — keep the shop floor synchronized
//   2) Computer Vision — automatic quality control on 100% of production
// Plus an "our approach" section: every AI implementation is different, so we
// validate across models and build optimized, cost-effective workflows.

export type Industry40Lang = "it" | "en" | "es" | "de" | "fr" | "ca"

export interface SolutionBlock {
  icon: string
  eyebrow: string
  title: string
  lead: string
  paragraph: string
  bullets: string[]
}

export interface FlowStep {
  icon: string
  title: string
  desc: string
}

export interface FlowCopy {
  eyebrow: string
  title: string
  lead: string
  steps: FlowStep[]
}

export interface EdgePoint {
  icon: string
  title: string
  desc: string
}

export interface CVBox {
  x: number   // % from left
  y: number   // % from top
  w: number   // % width
  h: number   // % height
  label: string
  conf: number  // 0-100
  color?: "green" | "red" | "amber"
}

export interface IndustryCase {
  image: string
  industry: string
  title: string
  desc?: string
  tags: string[]
  boxes?: CVBox[]
}

export interface ImpactStat {
  value: string
  label: string
  sub: string
}

export interface EdgeAICopy {
  eyebrow: string
  title: string
  lead: string
  points: EdgePoint[]
}

export interface Industry40Copy {
  // SEO
  seoTitle: string
  seoDesc: string
  seoKeys: string
  // Article header
  badge: string
  heroTitle: string
  heroLead: string
  heroImageAlt: string
  // "A duo that changes the rules"
  duoTitle: string
  duoParagraphs: string[]
  // Solutions
  solutionsTitle: string
  solutionsLead: string
  solutions: SolutionBlock[]
  // Mockup labels (chat + scan)
  scanLabel: string
  scanStatus: string
  scanConfidence: string
  chatName: string
  chatMsg: string
  chatReply: string
  // "From data to action" — ML pipeline flow
  flow: FlowCopy
  // Edge AI — a look to the future
  edgeai: EdgeAICopy
  // "Our approach"
  approachEyebrow: string
  approachTitle: string
  approachParagraphs: string[]
  // Impact stats band
  impactStats: ImpactStat[]
  // Industry cases
  casesSectionEyebrow: string
  casesSectionTitle: string
  casesSectionLead: string
  cases: IndustryCase[]
  // CTA
  cta: string
  ctaSub: string
  ctaTitle: string
  ctaDesc: string
}

export const INDUSTRY40_I18N: Record<Industry40Lang, Industry40Copy> = {
  // ─────────────────────────────────────────────────────────── IT (base) ──
  it: {
    seoTitle: "AI e Industry 4.0: il duo che cambia le regole",
    seoDesc:
      "AI e Industry 4.0, un duo che cambia le regole del gioco: custom chatbot per gli operatori e computer vision per il controllo qualità. Più efficienza, più qualità, meno fermi macchina.",
    seoKeys:
      "industry 4.0, intelligenza artificiale, manufacturing, computer vision, chatbot industriale, manutenzione predittiva, fabbrica intelligente, IoT",
    badge: "Industry 4.0 · AI · Insight",
    heroTitle: "AI e Industry 4.0 – un duo che cambia le regole del gioco",
    heroLead:
      "L'unione tra Industry 4.0 e intelligenza artificiale non è una moda: è un'opportunità concreta per produrre con più qualità, più efficienza e in modo più sostenibile. Vediamo come, e con quali strumenti.",
    heroImageAlt: "AI e robotica nel manufacturing Industry 4.0",
    duoTitle: "Quando l'AI incontra la fabbrica 4.0",
    duoParagraphs: [
      "Industry 4.0 ha riempito la fabbrica di sensori, macchine connesse e dati. L'intelligenza artificiale è il pezzo che trasforma quei dati in decisioni: legge ciò che accade in tempo reale, riconosce gli schemi e suggerisce — o esegue — l'azione giusta.",
      "Il punto non è sostituire le persone, ma toglierle dai compiti ripetitivi e metterle dove contano davvero: analisi, controllo, miglioramento. L'AI diventa uno strumento per decidere meglio, non un rimpiazzo.",
    ],
    solutionsTitle: "Le due soluzioni che mettiamo in campo",
    solutionsLead:
      "Non teoria: due tecnologie AI già pronte per il tuo reparto produttivo.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Soluzione 01",
        title: "Custom WhatsApp Chatbots",
        lead: "L'assistente AI centralizzato: tutte le informazioni del reparto in un unico punto.",
        paragraph:
          "Il punto di riferimento per tutta l'azienda: parla la lingua di ogni operatore, risponde sul campo in tempo reale e porta l'informazione giusta, alla persona giusta, nel momento giusto.",
        bullets: [
          "Risponde a domande degli operatori su macchinari e procedure",
          "Segnala guasti e anomalie aprendo ticket automatici",
          "Traccia spedizioni e materiali in entrata e uscita",
          "Gestisce e comunica i turni del personale",
          "Invia alert e notifiche push quando serve un intervento",
          "Indica l'ultima manutenzione effettuata e le procedure da seguire",
          "Tutto centralizzato: un'unica fonte di verità per l'intero reparto",
        ],
      },
      {
        icon: "vision",
        eyebrow: "Soluzione 02",
        title: "Computer Vision",
        lead: "Controllo qualità automatico sul 100% della produzione.",
        paragraph:
          "Modelli di visione artificiale che ispezionano ogni pezzo in tempo reale sulla linea e individuano difetti e anomalie che l'occhio umano non coglie — senza rallentare la produzione. Lo scarto viene intercettato subito, prima che arrivi a valle.",
        bullets: [
          "Rileva difetti e anomalie di produzione in tempo reale",
          "Ispeziona il 100% dei pezzi, non più a campione",
          "Intercetta lo scarto prima che arrivi a valle",
          "Garantisce uno standard qualitativo costante, 24/7",
          "Conta e classifica i pezzi sulla linea in tempo reale",
          "Raccoglie statistiche sui difetti più frequenti",
        ],
      },
    ],
    scanLabel: "Computer Vision",
    scanStatus: "Difetto rilevato",
    scanConfidence: "affidabilità 99,2%",
    chatName: "AI Assistant",
    chatMsg: "Come resetto la macchina 3?",
    chatReply: "Tieni premuto STOP per 5s, poi riavvia dal pannello…",
    approachEyebrow: "Il nostro approccio",
    approachTitle: "Progettiamo su misura",
    approachParagraphs: [
      "Ogni implementazione di AI è diversa. La soluzione ottimale dipende dal caso d'uso, dalla qualità dei dati, dai requisiti tecnici, dal livello di rischio, dalla compliance e dai risultati attesi.",
      "La vera sfida non è semplicemente usare l'AI, ma progettare una soluzione che produca risultati accurati, affidabili ed economicamente sostenibili. Per questo analizziamo le variabili in gioco, validiamo gli output su più modelli e costruiamo workflow ottimizzati che aumentano la precisione, riducono i costi e danno fiducia nei risultati generati dall'AI.",
    ],
    flow: {
      eyebrow: "Come funziona",
      title: "Dal dato all'azione",
      lead: "Ogni soluzione di Computer Vision nasce da un percorso chiaro: dai tuoi dati fino all'azione automatica sulla linea.",
      steps: [
        { icon: "dataset", title: "Dataset", desc: "Raccogliamo le immagini dei tuoi pezzi, prodotti e processi." },
        { icon: "labelling", title: "Labelling", desc: "Etichettiamo difetti e oggetti per insegnare al modello cosa cercare." },
        { icon: "training", title: "Training", desc: "Addestriamo il modello sui tuoi casi reali fino alla precisione richiesta." },
        { icon: "inference", title: "Inference", desc: "Il modello gira a bordo linea e rileva in tempo reale." },
        { icon: "actions", title: "Actions", desc: "Scatta l'azione: alert, scarto del pezzo, registrazione nel database." },
      ],
    },
    edgeai: {
      eyebrow: "Uno sguardo al futuro",
      title: "Edge AI: la tecnologia che guida l'Industry 4.0",
      lead: "I modelli di Computer Vision non girano nel cloud, ma direttamente su un piccolo dispositivo a bordo linea, accanto alla telecamera. Questo è l'Edge AI: l'inferenza accade dove nascono i dati, in tempo reale.",
      points: [
        {
          icon: "latency",
          title: "Latenza minima",
          desc: "Inferenza in pochi millisecondi sul dispositivo: la linea reagisce all'istante, senza il viaggio andata e ritorno verso il cloud.",
        },
        {
          icon: "offline",
          title: "Funziona offline",
          desc: "Nessuna dipendenza da internet: se la connessione cade, il sistema continua a ispezionare e decidere.",
        },
        {
          icon: "privacy",
          title: "I dati restano in fabbrica",
          desc: "Le immagini vengono elaborate sul posto: privacy e know-how non escono mai dallo stabilimento.",
        },
        {
          icon: "cost",
          title: "Costi e banda ridotti",
          desc: "Niente streaming video continuo verso il cloud; gira su hardware da poche decine di euro.",
        },
      ],
    },
    impactStats: [
      { value: "−40%", label: "Costi di rilavorazione", sub: "Media su linee di produzione con Computer Vision attiva" },
      { value: "100%", label: "Copertura ispezione", sub: "Ogni pezzo ispezionato — nessuno sfugge al controllo qualità" },
      { value: "< 15 ms", label: "Tempo di inferenza", sub: "Decisioni in tempo reale direttamente sul bordo linea" },
    ],
    casesSectionEyebrow: "Casi d'uso per settore",
    casesSectionTitle: "Computer Vision: già al lavoro nel manufacturing",
    casesSectionLead:
      "Dalla catena di montaggio al frigorifero della grande distribuzione: ecco come le aziende usano computer vision e chatbot AI per tagliare i costi e aumentare la qualità.",
    cases: [
      { image: "/industry40/cases/defect-line.png", industry: "Quality Control", title: "Rilevamento difetti su linea di produzione", desc: "Rileva automaticamente crepe, inclusioni e difetti su componenti in uscita dalla linea, a ogni ciclo.", tags: ["Defect Detection", "Computer Vision", "Manufacturing"] },
      { image: "/industry40/cases/dimension-defect.png", industry: "Precision Parts", title: "Analisi difetti dimensionali su componenti di precisione", desc: "Rileva imperfezioni geometriche e difetti superficiali su cuscinetti, flange e componenti torniti in pochi millisecondi.", tags: ["Dimensional Analysis", "Defect Detection", "Precision Parts"] },
      { image: "/industry40/cases/scratch-detection.png", industry: "Surface Inspection", title: "Rilevamento graffi, ammaccature e imperfezioni su superfici", desc: "Identifica graffi e imperfezioni sulla carrozzeria con precisione sub-millimetrica, a qualsiasi velocità.", tags: ["Scratch Detection", "Paint Inspection", "Automotive"] },
      { image: "/industry40/cases/weld-inspection.png", industry: "Welding", title: "Ispezione di saldature e giunture", desc: "Analizza porosità, cricche e discontinuità di saldatura prima che il pezzo avanzi sulla linea.", tags: ["Weld Inspection", "Computer Vision", "Quality"] },
      { image: "/industry40/cases/label-warning.webp", industry: "Automotive", title: "Verifica etichette di sicurezza e marcature su componenti", desc: "Rileva etichette mancanti, illeggibili o non conformi su veicoli, macchinari e componenti.", tags: ["Label Verification", "Safety Labels", "Automotive"] },
      { image: "/industry40/cases/unit-counting.jpg", industry: "Automotive", title: "Conteggio automatico", desc: "Verifica la presenza e la posizione di ogni componente sul prodotto finito, a 60 fps.", tags: ["Unit Counting", "Bolt Detection", "Automotive"] },
      { image: "/industry40/cases/ocr-reading.png", industry: "OCR", title: "Lettura automatica di codici, seriali e ID su qualsiasi superficie", desc: "Legge VIN, seriali, targhe e QR code su qualsiasi superficie, anche in condizioni di illuminazione difficile.", tags: ["OCR", "Barcode", "Serial Reading"] },
      { image: "/industry40/cases/safety-monitoring.jpg", industry: "Safety", title: "Monitoraggio e accessi in zona pericolosa del personale", desc: "Monitora in tempo reale la presenza di personale in zone a rischio e verifica il corretto uso dei DPI.", tags: ["Safety Monitoring", "PPE", "Access Control"],
        boxes: [
          { x: 46, y: 5, w: 48, h: 82, label: "Person 2 ⚠", conf: 97, color: "red" },
        ],
      },
      { image: "/industry40/cases/warehouse-logistics.webp", industry: "Logistics", title: "Tracciamento merci, pallet e mezzi in magazzino", desc: "Traccia merci, pallet e mezzi di movimentazione nel magazzino e aggiorna l'inventario in automatico.", tags: ["Warehouse", "Forklift Detection", "Logistics"] },
    ],
    cta: "Contattaci",
    ctaSub: "Ti mostriamo cosa è possibile con i tuoi dati.",
    ctaTitle: "Contattaci per maggiori informazioni",
    ctaDesc:
      "Parliamone. Analizziamo il tuo caso e ti mostriamo cosa è possibile fare con i tuoi dati e i tuoi macchinari.",
  },

  // ───────────────────────────────────────────────────────────────── EN ──
  en: {
    seoTitle: "AI and Industry 4.0: the duo that changes the rules",
    seoDesc:
      "AI and Industry 4.0, a duo that changes the rules of the game: custom chatbots for operators and computer vision for quality control. More efficiency, more quality, less downtime.",
    seoKeys:
      "industry 4.0, artificial intelligence, manufacturing, computer vision, industrial chatbot, predictive maintenance, smart factory, IoT",
    badge: "Industry 4.0 · AI · Insight",
    heroTitle: "AI and Industry 4.0 – a duo that changes the rules of the game",
    heroLead:
      "Pairing Industry 4.0 with artificial intelligence is not a trend: it's a real opportunity to produce with higher quality, greater efficiency and more sustainability. Let's see how — and with which tools.",
    heroImageAlt: "AI and robotics in Industry 4.0 manufacturing",
    duoTitle: "When AI meets the 4.0 factory",
    duoParagraphs: [
      "Industry 4.0 filled the factory with sensors, connected machines and data. Artificial intelligence is the piece that turns that data into decisions: it reads what's happening in real time, recognizes patterns and suggests — or executes — the right action.",
      "The point is not to replace people, but to free them from repetitive tasks and put them where they matter most: analysis, control, improvement. AI becomes a tool to decide better, not a replacement.",
    ],
    solutionsTitle: "The two solutions we deploy",
    solutionsLead:
      "Not theory: two AI technologies ready for your production floor.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solution 01",
        title: "Custom WhatsApp Chatbots",
        lead: "The centralized AI assistant: all your shop-floor information in one place.",
        paragraph:
          "The single point of reference for the whole company: it speaks every operator's language, answers on the floor in real time, and brings the right information, to the right person, at the right moment.",
        bullets: [
          "Answers operator questions about machines and procedures",
          "Reports faults and anomalies, opening tickets automatically",
          "Tracks incoming and outgoing shipments and materials",
          "Manages and communicates staff shifts",
          "Sends alerts and push notifications when action is needed",
          "Shows the last maintenance performed and the procedures to follow",
          "Everything centralized: a single source of truth for the whole floor",
        ],
      },
      {
        icon: "vision",
        eyebrow: "Solution 02",
        title: "Computer Vision",
        lead: "Automatic quality control on 100% of production.",
        paragraph:
          "Computer vision models that inspect every part on the line in real time and spot defects and anomalies the human eye misses — without slowing production down. Scrap is caught immediately, before it moves downstream.",
        bullets: [
          "Detects production defects and anomalies in real time",
          "Inspects 100% of parts, no more spot checks",
          "Catches scrap before it moves downstream",
          "Guarantees a constant quality standard, 24/7",
          "Counts and classifies parts on the line in real time",
          "Collects statistics on the most frequent defects",
        ],
      },
    ],
    scanLabel: "Computer Vision",
    scanStatus: "Defect detected",
    scanConfidence: "99.2% confidence",
    chatName: "AI Assistant",
    chatMsg: "How do I reset machine 3?",
    chatReply: "Hold STOP for 5s, then restart from the panel…",
    approachEyebrow: "Our approach",
    approachTitle: "We design to measure",
    approachParagraphs: [
      "Every AI implementation is different. The optimal solution depends on the use case, data quality, engineering requirements, risk level, compliance needs and expected outcomes.",
      "The challenge is not simply using AI, but designing a solution that delivers accurate, reliable and cost-effective results. That's why we analyze these variables, validate outputs across multiple AI models and build optimized workflows that improve accuracy, reduce operational costs and increase confidence in AI-generated results.",
    ],
    flow: {
      eyebrow: "How it works",
      title: "From data to action",
      lead: "Every computer vision solution follows a clear path: from your data to automatic action on the line.",
      steps: [
        { icon: "dataset", title: "Dataset", desc: "We collect images of your parts, products and processes." },
        { icon: "labelling", title: "Labelling", desc: "We label defects and objects to teach the model what to look for." },
        { icon: "training", title: "Training", desc: "We train the model on your real cases up to the required accuracy." },
        { icon: "inference", title: "Inference", desc: "The model runs on the line and detects in real time." },
        { icon: "actions", title: "Actions", desc: "The action fires: alert, scrap the part, register in the database." },
      ],
    },
    edgeai: {
      eyebrow: "A look ahead",
      title: "Edge AI technology: driving Industry 4.0",
      lead: "Computer vision models don't run in the cloud — they run directly on a small device right on the line, next to the camera. That's Edge AI: inference happens where the data is born, in real time.",
      points: [
        {
          icon: "latency",
          title: "Minimal latency",
          desc: "Inference in a few milliseconds on the device: the line reacts instantly, with no round-trip to the cloud.",
        },
        {
          icon: "offline",
          title: "Works offline",
          desc: "No internet dependency: if the connection drops, the system keeps inspecting and deciding.",
        },
        {
          icon: "privacy",
          title: "Data stays in the factory",
          desc: "Images are processed on-site: privacy and know-how never leave the plant.",
        },
        {
          icon: "cost",
          title: "Lower cost and bandwidth",
          desc: "No continuous video streaming to the cloud; runs on hardware costing a few tens of euros.",
        },
      ],
    },
    impactStats: [
      { value: "−40%", label: "Rework Costs", sub: "Average across production lines running Computer Vision" },
      { value: "100%", label: "Inspection Coverage", sub: "Every part inspected — nothing escapes quality control" },
      { value: "< 15 ms", label: "Inference Time", sub: "Real-time decisions directly at the line edge" },
    ],
    casesSectionEyebrow: "Use Cases by Industry",
    casesSectionTitle: "Computer Vision: already at work in manufacturing",
    casesSectionLead:
      "From assembly lines to distribution center fridges: see how companies are using computer vision and AI chatbots to cut costs and boost quality.",
    cases: [
      { image: "/industry40/cases/defect-line.png", industry: "Quality Control", title: "Defect detection on production line", desc: "Automatically detects cracks, inclusions and defects on components as they leave the line, every cycle.", tags: ["Defect Detection", "Computer Vision", "Manufacturing"] },
      { image: "/industry40/cases/dimension-defect.png", industry: "Precision Parts", title: "Dimensional defect analysis on precision components", desc: "Detects geometric imperfections and surface defects on bearings, flanges and machined parts in milliseconds.", tags: ["Dimensional Analysis", "Defect Detection", "Precision Parts"] },
      { image: "/industry40/cases/scratch-detection.png", industry: "Surface Inspection", title: "Scratch, dent and surface imperfection detection", desc: "Identifies scratches and imperfections on painted surfaces to sub-millimetre precision, at any line speed.", tags: ["Scratch Detection", "Paint Inspection", "Automotive"] },
      { image: "/industry40/cases/weld-inspection.png", industry: "Welding", title: "Weld and joint inspection", desc: "Analyses weld porosity, cracks and discontinuities before the part moves downstream.", tags: ["Weld Inspection", "Computer Vision", "Quality"] },
      { image: "/industry40/cases/label-warning.webp", industry: "Automotive", title: "Safety label and marking verification on components", desc: "Detects missing, illegible or non-compliant labels on vehicles, machinery and components.", tags: ["Label Verification", "Safety Labels", "Automotive"] },
      { image: "/industry40/cases/unit-counting.jpg", industry: "Automotive", title: "Automatic counting", desc: "Verifies the presence and position of every bolt and component on the finished product, at 60 fps.", tags: ["Unit Counting", "Bolt Detection", "Automotive"] },
      { image: "/industry40/cases/ocr-reading.png", industry: "OCR", title: "Automatic reading of codes, serials and IDs on any surface", desc: "Reads VINs, serial numbers, plates and QR codes on any surface — even under poor lighting conditions.", tags: ["OCR", "Barcode", "Serial Reading"] },
      { image: "/industry40/cases/safety-monitoring.jpg", industry: "Safety", title: "Personnel monitoring and access in hazardous zones", desc: "Monitors personnel presence in hazardous zones and verifies correct use of PPE in real time.", tags: ["Safety Monitoring", "PPE", "Access Control"], boxes: [{ x: 46, y: 5, w: 48, h: 82, label: "Person 2 ⚠", conf: 97, color: "red" }] },
      { image: "/industry40/cases/warehouse-logistics.webp", industry: "Logistics", title: "Tracking goods, pallets and vehicles in warehouse", desc: "Tracks goods, pallets and handling vehicles across the warehouse and updates inventory automatically.", tags: ["Warehouse", "Forklift Detection", "Logistics"] },
    ],
    cta: "Contact us",
    ctaSub: "We'll show you what's possible with your data.",
    ctaTitle: "Contact us for more information",
    ctaDesc:
      "Let's talk. We analyze your case and show you what's possible with your data and your machines.",
  },

  // ───────────────────────────────────────────────────────────────── ES ──
  es: {
    seoTitle: "IA e Industria 4.0: el dúo que cambia las reglas",
    seoDesc:
      "IA e Industria 4.0, un dúo que cambia las reglas del juego: chatbots a medida para operarios y visión por computador para el control de calidad. Más eficiencia, más calidad, menos paradas.",
    seoKeys:
      "industria 4.0, inteligencia artificial, manufactura, visión por computador, chatbot industrial, mantenimiento predictivo, fábrica inteligente, IoT",
    badge: "Industria 4.0 · IA · Insight",
    heroTitle: "IA e Industria 4.0 – un dúo que cambia las reglas del juego",
    heroLead:
      "Unir la Industria 4.0 con la inteligencia artificial no es una moda: es una oportunidad real para producir con más calidad, más eficiencia y de forma más sostenible. Veamos cómo y con qué herramientas.",
    heroImageAlt: "IA y robótica en la manufactura Industria 4.0",
    duoTitle: "Cuando la IA se encuentra con la fábrica 4.0",
    duoParagraphs: [
      "La Industria 4.0 llenó la fábrica de sensores, máquinas conectadas y datos. La inteligencia artificial es la pieza que convierte esos datos en decisiones: lee lo que ocurre en tiempo real, reconoce patrones y sugiere — o ejecuta — la acción correcta.",
      "La cuestión no es sustituir a las personas, sino liberarlas de las tareas repetitivas y situarlas donde más valen: análisis, control, mejora. La IA se convierte en una herramienta para decidir mejor, no en un reemplazo.",
    ],
    solutionsTitle: "Las dos soluciones que ponemos en marcha",
    solutionsLead:
      "Nada de teoría: dos tecnologías de IA listas para tu planta de producción.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solución 01",
        title: "Chatbots de WhatsApp a Medida",
        lead: "El asistente IA centralizado: toda la información de la planta en un único lugar.",
        paragraph:
          "El punto de referencia para toda la empresa: habla el idioma de cada operario, responde en planta en tiempo real y lleva la información correcta, a la persona correcta, en el momento correcto.",
        bullets: [
          "Responde a las dudas de los operarios sobre máquinas y procedimientos",
          "Señala averías y anomalías abriendo tickets automáticos",
          "Rastrea envíos y materiales de entrada y salida",
          "Gestiona y comunica los turnos del personal",
          "Envía alertas y notificaciones push cuando hace falta actuar",
          "Indica el último mantenimiento realizado y los procedimientos a seguir",
          "Todo centralizado: una única fuente de verdad para toda la planta",
        ],
      },
      {
        icon: "vision",
        eyebrow: "Solución 02",
        title: "Computer Vision",
        lead: "Control de calidad automático en el 100% de la producción.",
        paragraph:
          "Modelos de visión artificial que inspeccionan cada pieza en la línea en tiempo real y detectan defectos y anomalías que el ojo humano no ve — sin frenar la producción. El descarte se intercepta de inmediato, antes de que avance en la línea.",
        bullets: [
          "Detecta defectos y anomalías de producción en tiempo real",
          "Inspecciona el 100% de las piezas, no por muestreo",
          "Intercepta el descarte antes de que avance en la línea",
          "Garantiza un estándar de calidad constante, 24/7",
          "Cuenta y clasifica las piezas en la línea en tiempo real",
          "Recopila estadísticas sobre los defectos más frecuentes",
        ],
      },
    ],
    scanLabel: "Computer Vision",
    scanStatus: "Defecto detectado",
    scanConfidence: "99,2% de confianza",
    chatName: "Asistente IA",
    chatMsg: "¿Cómo reinicio la máquina 3?",
    chatReply: "Mantén STOP 5s y reinicia desde el panel…",
    approachEyebrow: "Nuestro enfoque",
    approachTitle: "Diseñamos a medida",
    approachParagraphs: [
      "Cada implementación de IA es diferente. La solución óptima depende del caso de uso, la calidad de los datos, los requisitos técnicos, el nivel de riesgo, las necesidades de cumplimiento y los resultados esperados.",
      "El reto no es simplemente usar la IA, sino diseñar una solución que ofrezca resultados precisos, fiables y rentables. Por eso analizamos estas variables, validamos las salidas en varios modelos de IA y construimos flujos de trabajo optimizados que mejoran la precisión, reducen los costes y aumentan la confianza en los resultados generados por la IA.",
    ],
    flow: {
      eyebrow: "Cómo funciona",
      title: "Del dato a la acción",
      lead: "Cada solución de visión por computador sigue un camino claro: de tus datos a la acción automática en la línea.",
      steps: [
        { icon: "dataset", title: "Dataset", desc: "Recopilamos imágenes de tus piezas, productos y procesos." },
        { icon: "labelling", title: "Labelling", desc: "Etiquetamos defectos y objetos para enseñar al modelo qué buscar." },
        { icon: "training", title: "Training", desc: "Entrenamos el modelo con tus casos reales hasta la precisión necesaria." },
        { icon: "inference", title: "Inference", desc: "El modelo se ejecuta en la línea y detecta en tiempo real." },
        { icon: "actions", title: "Actions", desc: "Se dispara la acción: alerta, descarte de la pieza, registro en la base de datos." },
      ],
    },
    edgeai: {
      eyebrow: "Una mirada al futuro",
      title: "Tecnología Edge AI: impulsando la Industria 4.0",
      lead: "Los modelos de visión por computador no se ejecutan en la nube, sino directamente en un pequeño dispositivo en la propia línea, junto a la cámara. Eso es Edge AI: la inferencia ocurre donde nacen los datos, en tiempo real.",
      points: [
        {
          icon: "latency",
          title: "Latencia mínima",
          desc: "Inferencia en pocos milisegundos en el dispositivo: la línea reacciona al instante, sin el viaje de ida y vuelta a la nube.",
        },
        {
          icon: "offline",
          title: "Funciona sin conexión",
          desc: "Sin dependencia de internet: si la conexión cae, el sistema sigue inspeccionando y decidiendo.",
        },
        {
          icon: "privacy",
          title: "Los datos se quedan en la fábrica",
          desc: "Las imágenes se procesan in situ: la privacidad y el know-how nunca salen de la planta.",
        },
        {
          icon: "cost",
          title: "Menos coste y ancho de banda",
          desc: "Sin streaming de vídeo continuo a la nube; funciona en hardware de pocas decenas de euros.",
        },
      ],
    },
    impactStats: [
      { value: "−40%", label: "Costos de retrabajo", sub: "Media en líneas de producción con Computer Vision activa" },
      { value: "100%", label: "Cobertura de inspección", sub: "Cada pieza inspeccionada — ninguna escapa al control de calidad" },
      { value: "< 15 ms", label: "Tiempo de inferencia", sub: "Decisiones en tiempo real directamente en el borde de línea" },
    ],
    casesSectionEyebrow: "Casos de uso por sector",
    casesSectionTitle: "Computer Vision: ya trabajando en la industria manufacturera",
    casesSectionLead:
      "Desde la cadena de montaje hasta el almacén: así usan las empresas la visión artificial y los chatbots AI para reducir costes y mejorar la calidad.",
    cases: [
      { image: "/industry40/cases/defect-line.png", industry: "Control de Calidad", title: "Detección de defectos en línea de producción", desc: "Detecta automáticamente grietas, inclusiones y defectos en los componentes al salir de la línea, en cada ciclo.", tags: ["Defect Detection", "Computer Vision", "Manufacturing"] },
      { image: "/industry40/cases/dimension-defect.png", industry: "Precision Parts", title: "Análisis de defectos dimensionales en componentes de precisión", desc: "Detecta imperfecciones geométricas y defectos superficiales en rodamientos, bridas y piezas mecanizadas en milisegundos.", tags: ["Dimensional Analysis", "Defect Detection", "Precision Parts"] },
      { image: "/industry40/cases/scratch-detection.png", industry: "Inspección de Superficie", title: "Detección de arañazos, abolladuras e imperfecciones en superficies", desc: "Identifica arañazos e imperfecciones en la carrocería con precisión sub-milimétrica, a cualquier velocidad.", tags: ["Scratch Detection", "Paint Inspection", "Automotive"] },
      { image: "/industry40/cases/weld-inspection.png", industry: "Soldadura", title: "Inspección de soldaduras y juntas", desc: "Analiza la porosidad, grietas y discontinuidades de la soldadura antes de que la pieza avance en la línea.", tags: ["Weld Inspection", "Computer Vision", "Quality"] },
      { image: "/industry40/cases/label-warning.webp", industry: "Automotriz", title: "Verificación de etiquetas de seguridad y marcas en componentes", desc: "Detecta etiquetas faltantes, ilegibles o no conformes en vehículos, maquinaria y componentes.", tags: ["Label Verification", "Safety Labels", "Automotive"] },
      { image: "/industry40/cases/unit-counting.jpg", industry: "Automotriz", title: "Conteo automático", desc: "Verifica la presencia y posición de cada tornillo y componente en el producto acabado, a 60 fps.", tags: ["Unit Counting", "Bolt Detection", "Automotive"] },
      { image: "/industry40/cases/ocr-reading.png", industry: "OCR", title: "Lectura automática de códigos, series e IDs en cualquier superficie", desc: "Lee VIN, números de serie, matrículas y códigos QR en cualquier superficie, incluso con iluminación difícil.", tags: ["OCR", "Barcode", "Serial Reading"] },
      { image: "/industry40/cases/safety-monitoring.jpg", industry: "Seguridad", title: "Monitoreo de personal y accesos en zonas peligrosas", desc: "Monitorea en tiempo real la presencia de personal en zonas de riesgo y verifica el uso correcto de los EPP.", tags: ["Safety Monitoring", "PPE", "Access Control"], boxes: [{ x: 46, y: 5, w: 48, h: 82, label: "Person 2 ⚠", conf: 97, color: "red" }] },
      { image: "/industry40/cases/warehouse-logistics.webp", industry: "Logística", title: "Seguimiento de mercancías, palés y vehículos en almacén", desc: "Rastrea mercancías, palés y vehículos de manutención en el almacén y actualiza el inventario automáticamente.", tags: ["Warehouse", "Forklift Detection", "Logistics"] },
    ],
    cta: "Contáctanos",
    ctaSub: "Te mostramos lo que es posible con tus datos.",
    ctaTitle: "Contáctanos para más información",
    ctaDesc:
      "Hablemos. Analizamos tu caso y te mostramos lo que es posible con tus datos y tus máquinas.",
  },

  // ───────────────────────────────────────────────────────────────── DE ──
  de: {
    seoTitle: "KI und Industrie 4.0: das Duo, das die Regeln ändert",
    seoDesc:
      "KI und Industrie 4.0, ein Duo, das die Spielregeln ändert: maßgeschneiderte Chatbots für Mitarbeiter und Computer Vision für die Qualitätskontrolle. Mehr Effizienz, mehr Qualität, weniger Stillstand.",
    seoKeys:
      "industrie 4.0, künstliche intelligenz, fertigung, computer vision, industrieller chatbot, vorausschauende wartung, smarte fabrik, IoT",
    badge: "Industrie 4.0 · KI · Insight",
    heroTitle: "KI und Industrie 4.0 – ein Duo, das die Spielregeln ändert",
    heroLead:
      "Industrie 4.0 mit künstlicher Intelligenz zu verbinden ist kein Trend: Es ist eine echte Chance, mit höherer Qualität, mehr Effizienz und nachhaltiger zu produzieren. Schauen wir uns an, wie — und mit welchen Werkzeugen.",
    heroImageAlt: "KI und Robotik in der Fertigung der Industrie 4.0",
    duoTitle: "Wenn KI auf die 4.0-Fabrik trifft",
    duoParagraphs: [
      "Industrie 4.0 hat die Fabrik mit Sensoren, vernetzten Maschinen und Daten gefüllt. Künstliche Intelligenz ist das Element, das diese Daten in Entscheidungen verwandelt: Sie liest in Echtzeit, was passiert, erkennt Muster und schlägt die richtige Aktion vor — oder führt sie aus.",
      "Es geht nicht darum, Menschen zu ersetzen, sondern sie von Routineaufgaben zu befreien und dort einzusetzen, wo sie am wichtigsten sind: Analyse, Kontrolle, Verbesserung. KI wird zum Werkzeug für bessere Entscheidungen, nicht zum Ersatz.",
    ],
    solutionsTitle: "Die zwei Lösungen, die wir einsetzen",
    solutionsLead:
      "Keine Theorie: zwei KI-Technologien, bereit für deine Produktion.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Lösung 01",
        title: "Custom WhatsApp Chatbots",
        lead: "Der zentrale KI-Assistent: alle Informationen der Produktion an einem Ort.",
        paragraph:
          "Der zentrale Bezugspunkt für das ganze Unternehmen: Er spricht die Sprache jedes Mitarbeiters, antwortet in Echtzeit vor Ort und bringt die richtige Information, zur richtigen Person, im richtigen Moment.",
        bullets: [
          "Beantwortet Fragen der Mitarbeiter zu Maschinen und Abläufen",
          "Meldet Störungen und Anomalien und öffnet automatisch Tickets",
          "Verfolgt ein- und ausgehende Lieferungen und Materialien",
          "Verwaltet und kommuniziert die Schichten des Personals",
          "Sendet Alerts und Push-Benachrichtigungen, wenn ein Eingriff nötig ist",
          "Zeigt die letzte durchgeführte Wartung und die einzuhaltenden Abläufe",
          "Alles zentralisiert: eine einzige Quelle der Wahrheit für die gesamte Produktion",
        ],
      },
      {
        icon: "vision",
        eyebrow: "Lösung 02",
        title: "Computer Vision",
        lead: "Automatische Qualitätskontrolle bei 100 % der Produktion.",
        paragraph:
          "Computer-Vision-Modelle, die jedes Teil an der Linie in Echtzeit prüfen und Defekte sowie Anomalien erkennen, die dem menschlichen Auge entgehen — ohne die Produktion zu bremsen. Ausschuss wird sofort abgefangen, bevor er weiterläuft.",
        bullets: [
          "Erkennt Produktionsfehler und Anomalien in Echtzeit",
          "Prüft 100 % der Teile, nicht mehr stichprobenartig",
          "Fängt Ausschuss ab, bevor er weiterläuft",
          "Garantiert einen konstanten Qualitätsstandard, 24/7",
          "Zählt und klassifiziert Teile an der Linie in Echtzeit",
          "Sammelt Statistiken zu den häufigsten Defekten",
        ],
      },
    ],
    scanLabel: "Computer Vision",
    scanStatus: "Defekt erkannt",
    scanConfidence: "99,2 % Zuverlässigkeit",
    chatName: "KI-Assistent",
    chatMsg: "Wie setze ich Maschine 3 zurück?",
    chatReply: "STOP 5s gedrückt halten, dann über das Panel neu starten…",
    approachEyebrow: "Unser Ansatz",
    approachTitle: "Wir entwerfen maßgeschneidert",
    approachParagraphs: [
      "Jede KI-Umsetzung ist anders. Die optimale Lösung hängt vom Anwendungsfall, der Datenqualität, den technischen Anforderungen, dem Risikoniveau, den Compliance-Anforderungen und den erwarteten Ergebnissen ab.",
      "Die Herausforderung ist nicht, KI einfach zu nutzen, sondern eine Lösung zu entwerfen, die genaue, zuverlässige und kosteneffiziente Ergebnisse liefert. Deshalb analysieren wir diese Variablen, validieren Ausgaben über mehrere KI-Modelle und bauen optimierte Workflows, die die Genauigkeit erhöhen, Kosten senken und das Vertrauen in KI-Ergebnisse stärken.",
    ],
    flow: {
      eyebrow: "So funktioniert es",
      title: "Vom Datum zur Aktion",
      lead: "Jede Computer-Vision-Lösung folgt einem klaren Weg: von deinen Daten bis zur automatischen Aktion an der Linie.",
      steps: [
        { icon: "dataset", title: "Dataset", desc: "Wir sammeln Bilder deiner Teile, Produkte und Prozesse." },
        { icon: "labelling", title: "Labelling", desc: "Wir labeln Defekte und Objekte, um dem Modell beizubringen, worauf es achten soll." },
        { icon: "training", title: "Training", desc: "Wir trainieren das Modell mit deinen realen Fällen bis zur geforderten Genauigkeit." },
        { icon: "inference", title: "Inference", desc: "Das Modell läuft an der Linie und erkennt in Echtzeit." },
        { icon: "actions", title: "Actions", desc: "Die Aktion wird ausgelöst: Alert, Teil aussortieren, in der Datenbank erfassen." },
      ],
    },
    edgeai: {
      eyebrow: "Ein Blick in die Zukunft",
      title: "Edge-AI-Technologie: Treiber der Industrie 4.0",
      lead: "Computer-Vision-Modelle laufen nicht in der Cloud, sondern direkt auf einem kleinen Gerät an der Linie, neben der Kamera. Das ist Edge AI: Die Inferenz passiert dort, wo die Daten entstehen, in Echtzeit.",
      points: [
        {
          icon: "latency",
          title: "Minimale Latenz",
          desc: "Inferenz in wenigen Millisekunden auf dem Gerät: Die Linie reagiert sofort, ohne den Weg in die Cloud und zurück.",
        },
        {
          icon: "offline",
          title: "Funktioniert offline",
          desc: "Keine Internetabhängigkeit: Fällt die Verbindung aus, prüft und entscheidet das System weiter.",
        },
        {
          icon: "privacy",
          title: "Daten bleiben in der Fabrik",
          desc: "Bilder werden vor Ort verarbeitet: Datenschutz und Know-how verlassen nie das Werk.",
        },
        {
          icon: "cost",
          title: "Weniger Kosten und Bandbreite",
          desc: "Kein kontinuierliches Video-Streaming in die Cloud; läuft auf Hardware für wenige Dutzend Euro.",
        },
      ],
    },
    impactStats: [
      { value: "−40%", label: "Nacharbeitskosten", sub: "Durchschnitt über Produktionslinien mit aktiver Computer Vision" },
      { value: "100%", label: "Inspektionsabdeckung", sub: "Jedes Teil geprüft — keines entgeht der Qualitätskontrolle" },
      { value: "< 15 ms", label: "Inferenzzeit", sub: "Echtzeit-Entscheidungen direkt an der Linienkante" },
    ],
    casesSectionEyebrow: "Anwendungsfälle nach Branche",
    casesSectionTitle: "Computer Vision: bereits im Einsatz in der Fertigungsindustrie",
    casesSectionLead:
      "Von der Montagelinie bis zum Lager: So nutzen Unternehmen Computer Vision und KI-Chatbots, um Kosten zu senken und Qualität zu steigern.",
    cases: [
      { image: "/industry40/cases/defect-line.png", industry: "Qualitätskontrolle", title: "Fehlererkennung an der Produktionslinie", desc: "Erkennt automatisch Risse, Einschlüsse und Fehler an Bauteilen am Linienausgang, bei jedem Zyklus.", tags: ["Defect Detection", "Computer Vision", "Manufacturing"] },
      { image: "/industry40/cases/dimension-defect.png", industry: "Precision Parts", title: "Dimensionsfehleranalyse an Präzisionsbauteilen", desc: "Erkennt geometrische Unvollkommenheiten und Oberflächenfehler an Lagern, Flanschen und gedrehten Teilen in Millisekunden.", tags: ["Dimensional Analysis", "Defect Detection", "Precision Parts"] },
      { image: "/industry40/cases/scratch-detection.png", industry: "Oberflächenprüfung", title: "Erkennung von Kratzern, Dellen und Oberflächenfehlern", desc: "Identifiziert Kratzer und Oberflächenfehler auf Karosserieteilen mit Sub-Millimeter-Präzision, bei jeder Liniengeschwindigkeit.", tags: ["Scratch Detection", "Paint Inspection", "Automotive"] },
      { image: "/industry40/cases/weld-inspection.png", industry: "Schweißen", title: "Inspektion von Schweißnähten und Verbindungen", desc: "Analysiert Porosität, Risse und Unstetigkeiten in Schweißnähten, bevor das Teil die Linie verlässt.", tags: ["Weld Inspection", "Computer Vision", "Quality"] },
      { image: "/industry40/cases/label-warning.webp", industry: "Automotive", title: "Prüfung von Sicherheitsetiketten und Kennzeichnungen an Bauteilen", desc: "Erkennt fehlende, unleserliche oder nicht konforme Etiketten an Fahrzeugen, Maschinen und Bauteilen.", tags: ["Label Verification", "Safety Labels", "Automotive"] },
      { image: "/industry40/cases/unit-counting.jpg", industry: "Automotive", title: "Automatisches Zählen", desc: "Prüft Vorhandensein und Position jeder Schraube und jedes Bauteils am Fertigprodukt, mit 60 fps.", tags: ["Unit Counting", "Bolt Detection", "Automotive"] },
      { image: "/industry40/cases/ocr-reading.png", industry: "OCR", title: "Automatisches Lesen von Codes, Seriennummern und IDs auf beliebigen Oberflächen", desc: "Liest VIN, Seriennummern, Kennzeichen und QR-Codes auf beliebigen Oberflächen — auch bei schlechten Lichtverhältnissen.", tags: ["OCR", "Barcode", "Serial Reading"] },
      { image: "/industry40/cases/safety-monitoring.jpg", industry: "Sicherheit", title: "Personalüberwachung und Zugangskontrolle in Gefahrenbereichen", desc: "Überwacht die Anwesenheit von Personal in Gefahrenbereichen und prüft den korrekten Einsatz von PSA in Echtzeit.", tags: ["Safety Monitoring", "PPE", "Access Control"], boxes: [{ x: 46, y: 5, w: 48, h: 82, label: "Person 2 ⚠", conf: 97, color: "red" }] },
      { image: "/industry40/cases/warehouse-logistics.webp", industry: "Logistik", title: "Verfolgung von Waren, Paletten und Fahrzeugen im Lager", desc: "Verfolgt Waren, Paletten und Flurförderfahrzeuge im Lager und aktualisiert den Bestand automatisch.", tags: ["Warehouse", "Forklift Detection", "Logistics"] },
    ],
    cta: "Kontaktiere uns",
    ctaSub: "Wir zeigen dir, was mit deinen Daten möglich ist.",
    ctaTitle: "Kontaktiere uns für mehr Informationen",
    ctaDesc:
      "Lass uns reden. Wir analysieren deinen Fall und zeigen dir, was mit deinen Daten und Maschinen möglich ist.",
  },

  // ───────────────────────────────────────────────────────────────── FR ──
  fr: {
    seoTitle: "IA et Industrie 4.0 : le duo qui change les règles",
    seoDesc:
      "IA et Industrie 4.0, un duo qui change les règles du jeu : chatbots sur mesure pour les opérateurs et vision par ordinateur pour le contrôle qualité. Plus d'efficacité, plus de qualité, moins d'arrêts.",
    seoKeys:
      "industrie 4.0, intelligence artificielle, production, vision par ordinateur, chatbot industriel, maintenance prédictive, usine intelligente, IoT",
    badge: "Industrie 4.0 · IA · Insight",
    heroTitle: "IA et Industrie 4.0 – un duo qui change les règles du jeu",
    heroLead:
      "Associer l'Industrie 4.0 à l'intelligence artificielle n'est pas une mode : c'est une opportunité réelle de produire avec plus de qualité, plus d'efficacité et plus de durabilité. Voyons comment — et avec quels outils.",
    heroImageAlt: "IA et robotique dans la production Industrie 4.0",
    duoTitle: "Quand l'IA rencontre l'usine 4.0",
    duoParagraphs: [
      "L'Industrie 4.0 a rempli l'usine de capteurs, de machines connectées et de données. L'intelligence artificielle est la pièce qui transforme ces données en décisions : elle lit ce qui se passe en temps réel, reconnaît les schémas et propose — ou exécute — la bonne action.",
      "Le but n'est pas de remplacer les personnes, mais de les libérer des tâches répétitives et de les placer là où elles comptent vraiment : analyse, contrôle, amélioration. L'IA devient un outil pour mieux décider, pas un remplaçant.",
    ],
    solutionsTitle: "Les deux solutions que nous déployons",
    solutionsLead:
      "Pas de théorie : deux technologies d'IA prêtes pour ton atelier de production.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solution 01",
        title: "Chatbots WhatsApp sur Mesure",
        lead: "L'assistant IA centralisé : toutes les informations de l'atelier au même endroit.",
        paragraph:
          "Le point de référence pour toute l'entreprise : il parle la langue de chaque opérateur, répond sur le terrain en temps réel et apporte la bonne information, à la bonne personne, au bon moment.",
        bullets: [
          "Répond aux questions des opérateurs sur les machines et les procédures",
          "Signale les pannes et anomalies en ouvrant des tickets automatiques",
          "Suit les expéditions et matières entrantes et sortantes",
          "Gère et communique les équipes du personnel",
          "Envoie des alertes et notifications push quand une action est nécessaire",
          "Indique la dernière maintenance effectuée et les procédures à suivre",
          "Tout centralisé : une seule source de vérité pour tout l'atelier",
        ],
      },
      {
        icon: "vision",
        eyebrow: "Solution 02",
        title: "Computer Vision",
        lead: "Contrôle qualité automatique sur 100 % de la production.",
        paragraph:
          "Des modèles de vision par ordinateur qui inspectent chaque pièce sur la ligne en temps réel et repèrent les défauts et anomalies que l'œil humain ne voit pas — sans ralentir la production. Le rebut est intercepté immédiatement, avant qu'il ne descende la ligne.",
        bullets: [
          "Détecte les défauts et anomalies de production en temps réel",
          "Inspecte 100 % des pièces, fini les contrôles par échantillon",
          "Intercepte le rebut avant qu'il ne descende la ligne",
          "Garantit un standard de qualité constant, 24/7",
          "Compte et classe les pièces sur la ligne en temps réel",
          "Collecte des statistiques sur les défauts les plus fréquents",
        ],
      },
    ],
    scanLabel: "Computer Vision",
    scanStatus: "Défaut détecté",
    scanConfidence: "99,2 % de fiabilité",
    chatName: "Assistant IA",
    chatMsg: "Comment réinitialiser la machine 3 ?",
    chatReply: "Maintiens STOP 5s, puis redémarre depuis le panneau…",
    approachEyebrow: "Notre approche",
    approachTitle: "Nous concevons sur mesure",
    approachParagraphs: [
      "Chaque mise en œuvre d'IA est différente. La solution optimale dépend du cas d'usage, de la qualité des données, des exigences techniques, du niveau de risque, des besoins de conformité et des résultats attendus.",
      "Le défi n'est pas simplement d'utiliser l'IA, mais de concevoir une solution qui produit des résultats précis, fiables et rentables. C'est pourquoi nous analysons ces variables, validons les sorties sur plusieurs modèles d'IA et construisons des workflows optimisés qui améliorent la précision, réduisent les coûts et renforcent la confiance dans les résultats générés par l'IA.",
    ],
    flow: {
      eyebrow: "Comment ça marche",
      title: "De la donnée à l'action",
      lead: "Chaque solution de vision par ordinateur suit un parcours clair : de tes données à l'action automatique sur la ligne.",
      steps: [
        { icon: "dataset", title: "Dataset", desc: "Nous collectons les images de tes pièces, produits et procédés." },
        { icon: "labelling", title: "Labelling", desc: "Nous étiquetons défauts et objets pour apprendre au modèle quoi chercher." },
        { icon: "training", title: "Training", desc: "Nous entraînons le modèle sur tes cas réels jusqu'à la précision requise." },
        { icon: "inference", title: "Inference", desc: "Le modèle tourne sur la ligne et détecte en temps réel." },
        { icon: "actions", title: "Actions", desc: "L'action se déclenche : alerte, rebut de la pièce, enregistrement en base." },
      ],
    },
    edgeai: {
      eyebrow: "Un regard vers l'avenir",
      title: "La technologie Edge AI : moteur de l'Industrie 4.0",
      lead: "Les modèles de vision par ordinateur ne tournent pas dans le cloud, mais directement sur un petit appareil sur la ligne, à côté de la caméra. C'est l'Edge AI : l'inférence se produit là où naissent les données, en temps réel.",
      points: [
        {
          icon: "latency",
          title: "Latence minimale",
          desc: "Inférence en quelques millisecondes sur l'appareil : la ligne réagit instantanément, sans aller-retour vers le cloud.",
        },
        {
          icon: "offline",
          title: "Fonctionne hors ligne",
          desc: "Aucune dépendance à internet : si la connexion tombe, le système continue d'inspecter et de décider.",
        },
        {
          icon: "privacy",
          title: "Les données restent à l'usine",
          desc: "Les images sont traitées sur place : la confidentialité et le savoir-faire ne quittent jamais le site.",
        },
        {
          icon: "cost",
          title: "Moins de coûts et de bande passante",
          desc: "Pas de streaming vidéo continu vers le cloud ; fonctionne sur du matériel à quelques dizaines d'euros.",
        },
      ],
    },
    impactStats: [
      { value: "−40%", label: "Coûts de retouche", sub: "Moyenne sur les lignes de production avec Computer Vision active" },
      { value: "100%", label: "Couverture d'inspection", sub: "Chaque pièce inspectée — aucune n'échappe au contrôle qualité" },
      { value: "< 15 ms", label: "Temps d'inférence", sub: "Décisions en temps réel directement en bord de ligne" },
    ],
    casesSectionEyebrow: "Cas d'usage par secteur",
    casesSectionTitle: "Computer Vision : déjà au travail dans l'industrie manufacturière",
    casesSectionLead:
      "De la chaîne de montage à l'entrepôt : comment les entreprises utilisent la vision par ordinateur et les chatbots IA pour réduire les coûts et améliorer la qualité.",
    cases: [
      { image: "/industry40/cases/defect-line.png", industry: "Contrôle Qualité", title: "Détection de défauts sur ligne de production", desc: "Détecte automatiquement fissures, inclusions et défauts sur les composants en sortie de ligne, à chaque cycle.", tags: ["Defect Detection", "Computer Vision", "Manufacturing"] },
      { image: "/industry40/cases/dimension-defect.png", industry: "Precision Parts", title: "Analyse des défauts dimensionnels sur composants de précision", desc: "Détecte les imperfections géométriques et défauts de surface sur roulements, brides et pièces usinées en quelques millisecondes.", tags: ["Dimensional Analysis", "Defect Detection", "Precision Parts"] },
      { image: "/industry40/cases/scratch-detection.png", industry: "Inspection Surface", title: "Détection de rayures, bosses et imperfections de surface", desc: "Identifie rayures et imperfections de carrosserie avec une précision sub-millimétrique, à toute vitesse de ligne.", tags: ["Scratch Detection", "Paint Inspection", "Automotive"] },
      { image: "/industry40/cases/weld-inspection.png", industry: "Soudure", title: "Inspection des soudures et assemblages", desc: "Analyse porosité, fissures et discontinuités de soudure avant que la pièce n'avance sur la ligne.", tags: ["Weld Inspection", "Computer Vision", "Quality"] },
      { image: "/industry40/cases/label-warning.webp", industry: "Automotive", title: "Vérification des étiquettes de sécurité et marquages sur composants", desc: "Détecte les étiquettes manquantes, illisibles ou non conformes sur véhicules, machines et composants.", tags: ["Label Verification", "Safety Labels", "Automotive"] },
      { image: "/industry40/cases/unit-counting.jpg", industry: "Automotive", title: "Comptage automatique", desc: "Vérifie la présence et la position de chaque vis et composant sur le produit fini, à 60 fps.", tags: ["Unit Counting", "Bolt Detection", "Automotive"] },
      { image: "/industry40/cases/ocr-reading.png", industry: "OCR", title: "Lecture automatique de codes, numéros de série et IDs sur toute surface", desc: "Lit VIN, numéros de série, plaques et QR codes sur toute surface — même en conditions d'éclairage difficiles.", tags: ["OCR", "Barcode", "Serial Reading"] },
      { image: "/industry40/cases/safety-monitoring.jpg", industry: "Sécurité", title: "Surveillance du personnel et accès en zones dangereuses", desc: "Surveille en temps réel la présence de personnel en zones à risque et vérifie le port correct des EPI.", tags: ["Safety Monitoring", "PPE", "Access Control"], boxes: [{ x: 46, y: 5, w: 48, h: 82, label: "Person 2 ⚠", conf: 97, color: "red" }] },
      { image: "/industry40/cases/warehouse-logistics.webp", industry: "Logistique", title: "Suivi des marchandises, palettes et véhicules en entrepôt", desc: "Suit marchandises, palettes et engins de manutention dans l'entrepôt et met l'inventaire à jour automatiquement.", tags: ["Warehouse", "Forklift Detection", "Logistics"] },
    ],
    cta: "Contactez-nous",
    ctaSub: "On te montre ce qui est possible avec tes données.",
    ctaTitle: "Contactez-nous pour plus d'informations",
    ctaDesc:
      "Parlons-en. Nous analysons ton cas et te montrons ce qui est possible avec tes données et tes machines.",
  },

  // ───────────────────────────────────────────────────────────────── CA ──
  ca: {
    seoTitle: "IA i Indústria 4.0: el duet que canvia les regles",
    seoDesc:
      "IA i Indústria 4.0, un duet que canvia les regles del joc: chatbots a mida per als operaris i visió per computador per al control de qualitat. Més eficiència, més qualitat, menys aturades.",
    seoKeys:
      "indústria 4.0, intel·ligència artificial, fabricació, visió per computador, chatbot industrial, manteniment predictiu, fàbrica intel·ligent, IoT",
    badge: "Indústria 4.0 · IA · Insight",
    heroTitle: "IA i Indústria 4.0 – un duet que canvia les regles del joc",
    heroLead:
      "Unir la Indústria 4.0 amb la intel·ligència artificial no és una moda: és una oportunitat real per produir amb més qualitat, més eficiència i de manera més sostenible. Vegem com i amb quines eines.",
    heroImageAlt: "IA i robòtica en la fabricació Indústria 4.0",
    duoTitle: "Quan la IA es troba amb la fàbrica 4.0",
    duoParagraphs: [
      "La Indústria 4.0 ha omplert la fàbrica de sensors, màquines connectades i dades. La intel·ligència artificial és la peça que converteix aquestes dades en decisions: llegeix què passa en temps real, reconeix patrons i suggereix — o executa — l'acció correcta.",
      "La qüestió no és substituir les persones, sinó alliberar-les de les tasques repetitives i situar-les on realment compten: anàlisi, control, millora. La IA es converteix en una eina per decidir millor, no en un reemplaçament.",
    ],
    solutionsTitle: "Les dues solucions que posem en marxa",
    solutionsLead:
      "Res de teoria: dues tecnologies d'IA a punt per a la teva planta de producció.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solució 01",
        title: "Chatbots de WhatsApp a Mida",
        lead: "L'assistent IA centralitzat: tota la informació de la planta en un únic lloc.",
        paragraph:
          "El punt de referència per a tota l'empresa: parla la llengua de cada operari, respon a planta en temps real i porta la informació correcta, a la persona correcta, en el moment correcte.",
        bullets: [
          "Respon les preguntes dels operaris sobre màquines i procediments",
          "Detecta avaries i anomalies obrint tiquets automàtics",
          "Fa el seguiment d'enviaments i materials d'entrada i sortida",
          "Gestiona i comunica els torns del personal",
          "Envia alertes i notificacions push quan cal actuar",
          "Indica l'últim manteniment fet i els procediments a seguir",
          "Tot centralitzat: una única font de veritat per a tota la planta",
        ],
      },
      {
        icon: "vision",
        eyebrow: "Solució 02",
        title: "Computer Vision",
        lead: "Control de qualitat automàtic al 100 % de la producció.",
        paragraph:
          "Models de visió artificial que inspeccionen cada peça a la línia en temps real i detecten defectes i anomalies que l'ull humà no veu — sense frenar la producció. El rebuig s'intercepta de seguida, abans que avanci per la línia.",
        bullets: [
          "Detecta defectes i anomalies de producció en temps real",
          "Inspecciona el 100 % de les peces, no per mostreig",
          "Intercepta el rebuig abans que avanci per la línia",
          "Garanteix un estàndard de qualitat constant, 24/7",
          "Compta i classifica les peces a la línia en temps real",
          "Recull estadístiques sobre els defectes més freqüents",
        ],
      },
    ],
    scanLabel: "Computer Vision",
    scanStatus: "Defecte detectat",
    scanConfidence: "99,2 % de fiabilitat",
    chatName: "Assistent IA",
    chatMsg: "Com reinicio la màquina 3?",
    chatReply: "Mantén STOP 5s i reinicia des del panell…",
    approachEyebrow: "El nostre enfocament",
    approachTitle: "Dissenyem a mida",
    approachParagraphs: [
      "Cada implementació d'IA és diferent. La solució òptima depèn del cas d'ús, la qualitat de les dades, els requisits tècnics, el nivell de risc, les necessitats de compliment i els resultats esperats.",
      "El repte no és simplement usar la IA, sinó dissenyar una solució que ofereixi resultats precisos, fiables i rendibles. Per això analitzem aquestes variables, validem les sortides en diversos models d'IA i construïm fluxos de treball optimitzats que milloren la precisió, redueixen els costos i augmenten la confiança en els resultats generats per la IA.",
    ],
    flow: {
      eyebrow: "Com funciona",
      title: "De la dada a l'acció",
      lead: "Cada solució de visió per computador segueix un camí clar: de les teves dades a l'acció automàtica a la línia.",
      steps: [
        { icon: "dataset", title: "Dataset", desc: "Recollim imatges de les teves peces, productes i processos." },
        { icon: "labelling", title: "Labelling", desc: "Etiquetem defectes i objectes per ensenyar al model què ha de buscar." },
        { icon: "training", title: "Training", desc: "Entrenem el model amb els teus casos reals fins a la precisió requerida." },
        { icon: "inference", title: "Inference", desc: "El model s'executa a la línia i detecta en temps real." },
        { icon: "actions", title: "Actions", desc: "Es dispara l'acció: alerta, descart de la peça, registre a la base de dades." },
      ],
    },
    edgeai: {
      eyebrow: "Una mirada al futur",
      title: "Tecnologia Edge AI: impulsant la Indústria 4.0",
      lead: "Els models de visió per computador no s'executen al núvol, sinó directament en un petit dispositiu a la mateixa línia, al costat de la càmera. Això és l'Edge AI: la inferència passa on neixen les dades, en temps real.",
      points: [
        {
          icon: "latency",
          title: "Latència mínima",
          desc: "Inferència en pocs mil·lisegons al dispositiu: la línia reacciona a l'instant, sense el viatge d'anada i tornada al núvol.",
        },
        {
          icon: "offline",
          title: "Funciona sense connexió",
          desc: "Sense dependència d'internet: si la connexió cau, el sistema continua inspeccionant i decidint.",
        },
        {
          icon: "privacy",
          title: "Les dades es queden a la fàbrica",
          desc: "Les imatges es processen in situ: la privacitat i el know-how mai no surten de la planta.",
        },
        {
          icon: "cost",
          title: "Menys cost i amplada de banda",
          desc: "Sense streaming de vídeo continu al núvol; funciona en maquinari de poques desenes d'euros.",
        },
      ],
    },
    impactStats: [
      { value: "−40%", label: "Costos de retreball", sub: "Mitjana en línies de producció amb Computer Vision activa" },
      { value: "100%", label: "Cobertura d'inspecció", sub: "Cada peça inspeccionada — cap escapa al control de qualitat" },
      { value: "< 15 ms", label: "Temps d'inferència", sub: "Decisions en temps real directament a la vora de línia" },
    ],
    casesSectionEyebrow: "Casos d'ús per sector",
    casesSectionTitle: "Computer Vision: ja treballant a la indústria manufacturera",
    casesSectionLead:
      "De la cadena de muntatge al magatzem: com les empreses utilitzen la visió artificial i els chatbots IA per reduir costos i millorar la qualitat.",
    cases: [
      { image: "/industry40/cases/defect-line.png", industry: "Control Qualitat", title: "Detecció de defectes en línia de producció", desc: "Detecta automàticament esquerdes, inclusions i defectes en components en sortir de la línia, a cada cicle.", tags: ["Defect Detection", "Computer Vision", "Manufacturing"] },
      { image: "/industry40/cases/dimension-defect.png", industry: "Precision Parts", title: "Anàlisi de defectes dimensionals en components de precisió", desc: "Detecta imperfeccions geomètriques i defectes de superfície en coixinets, brides i peces tornejades en mil·lisegons.", tags: ["Dimensional Analysis", "Defect Detection", "Precision Parts"] },
      { image: "/industry40/cases/scratch-detection.png", industry: "Inspecció Superfície", title: "Detecció de ratllades, bonys i imperfeccions en superfícies", desc: "Identifica ratllades i imperfeccions en la carrosseria amb precisió sub-mil·limètrica, a qualsevol velocitat.", tags: ["Scratch Detection", "Paint Inspection", "Automotive"] },
      { image: "/industry40/cases/weld-inspection.png", industry: "Soldadura", title: "Inspecció de soldadures i unions", desc: "Analitza la porositat, esquerdes i discontinuïtats de soldadura abans que la peça avanci per la línia.", tags: ["Weld Inspection", "Computer Vision", "Quality"] },
      { image: "/industry40/cases/label-warning.webp", industry: "Automotive", title: "Verificació d'etiquetes de seguretat i marcatures en components", desc: "Detecta etiquetes que falten, il·legibles o no conformes en vehicles, maquinària i components.", tags: ["Label Verification", "Safety Labels", "Automotive"] },
      { image: "/industry40/cases/unit-counting.jpg", industry: "Automotive", title: "Recompte automàtic", desc: "Verifica la presència i posició de cada cargol i component en el producte acabat, a 60 fps.", tags: ["Unit Counting", "Bolt Detection", "Automotive"] },
      { image: "/industry40/cases/ocr-reading.png", industry: "OCR", title: "Lectura automàtica de codis, números de sèrie i IDs en qualsevol superfície", desc: "Llegeix VIN, números de sèrie, matrícules i codis QR en qualsevol superfície, fins i tot amb il·luminació difícil.", tags: ["OCR", "Barcode", "Serial Reading"] },
      { image: "/industry40/cases/safety-monitoring.jpg", industry: "Seguretat", title: "Monitoratge de personal i accessos en zones perilloses", desc: "Monitora en temps real la presència de personal en zones de risc i verifica l'ús correcte dels EPI.", tags: ["Safety Monitoring", "PPE", "Access Control"], boxes: [{ x: 46, y: 5, w: 48, h: 82, label: "Person 2 ⚠", conf: 97, color: "red" }] },
      { image: "/industry40/cases/warehouse-logistics.webp", industry: "Logística", title: "Seguiment de mercaderies, palets i vehicles al magatzem", desc: "Fa el seguiment de mercaderies, palets i vehicles de manutenció al magatzem i actualitza l'inventari automàticament.", tags: ["Warehouse", "Forklift Detection", "Logistics"] },
    ],
    cta: "Contacta'ns",
    ctaSub: "Et mostrem què és possible amb les teves dades.",
    ctaTitle: "Contacta'ns per a més informació",
    ctaDesc:
      "Parlem-ne. Analitzem el teu cas i et mostrem què és possible amb les teves dades i màquines.",
  },
}
