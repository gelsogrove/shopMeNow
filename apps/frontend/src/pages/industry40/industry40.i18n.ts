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

// Real-world example: how a detected defect is triaged and acted upon.
export interface DecisionScenario {
  severity: "critical" | "warning" | "low"
  tag: string
  title: string
  desc: string
  confidence: number // 0–100
}

export interface ActionStep {
  icon: string
  title: string
  desc: string
}

export interface ProcessCard {
  icon: string
  title: string
  items: string[]
}

export interface ProcessesCopy {
  title: string
  lead: string
  cards: ProcessCard[]
}

export interface ExampleCopy {
  eyebrow: string
  title: string
  intro: string
  cameraLabel: string
  decisionTitle: string
  scenarios: DecisionScenario[]
  thresholdNote: string
  actionsTitle: string
  actions: ActionStep[]
  chartTitle: string
  chartSubtitle: string
  chartInsight: string
  chartUnit: string
  chartLegendDay: string
  chartLegendNight: string
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
  // "Automate processes across your business" — use-case grid
  processes: ProcessesCopy
  // Real example (defect → decision → action) + chart
  example: ExampleCopy
  // "Our approach"
  approachEyebrow: string
  approachTitle: string
  approachParagraphs: string[]
  approachFactorsLabel: string
  approachFactors: string[]
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
    solutionsTitle: "Le due soluzioni che mettiamo al lavoro",
    solutionsLead:
      "Non teoria: due tecnologie AI già pronte per il tuo reparto produttivo.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Soluzione 01",
        title: "Custom Chatbots",
        lead: "L'assistente AI centralizzato: tutte le informazioni del reparto in un unico punto.",
        paragraph:
          "Un chatbot addestrato sui tuoi macchinari, manuali e procedure. Parla con gli operatori nella loro lingua, risponde sul campo in tempo reale e fa arrivare le informazioni giuste alle persone giuste. Ogni implementazione è diversa: il chatbot giusto nasce dalle scelte giuste su modello, prompt, validazione e integrazione con i tuoi sistemi.",
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
    approachTitle: "Non basta usare l'AI: va progettata bene",
    approachParagraphs: [
      "Ogni implementazione di AI è diversa. La soluzione ottimale dipende dal caso d'uso, dalla qualità dei dati, dai requisiti tecnici, dal livello di rischio, dalla compliance e dai risultati attesi.",
      "La vera sfida non è semplicemente usare l'AI, ma progettare una soluzione che produca risultati accurati, affidabili ed economicamente sostenibili. Per questo analizziamo le variabili in gioco, validiamo gli output su più modelli e costruiamo workflow ottimizzati che aumentano la precisione, riducono i costi e danno fiducia nei risultati generati dall'AI.",
    ],
    approachFactorsLabel: "Le variabili che valutiamo",
    approachFactors: [
      "Architettura LLM",
      "Scelta del modello",
      "Prompt engineering",
      "Metodi di validazione",
      "Strategie di caching",
      "Temperature settings",
      "Sicurezza",
      "Workflow di automazione",
      "Integrazione con i sistemi",
    ],
    example: {
      eyebrow: "Esempio reale",
      title: "Dal difetto all'azione, in tempo reale",
      intro:
        "Due telecamere sopra la linea coprono 180° e ispezionano ogni pezzo. Ma non tutti i difetti sono uguali: il sistema decide cosa fare in base a gravità, frequenza e livello di confidenza.",
      cameraLabel: "2 telecamere · copertura 180° sulla linea",
      decisionTitle: "Fermare la linea o solo segnalare?",
      scenarios: [
        {
          severity: "critical",
          tag: "Ferma la produzione",
          title: "3 difetti in 30 minuti",
          desc: "Difetto ricorrente e ad alta confidenza: è grave. La linea si ferma e si analizza il problema alla radice.",
          confidence: 98,
        },
        {
          severity: "warning",
          tag: "Segnala",
          title: "Difetto sporadico",
          desc: "Un errore ogni tanto, dentro la tolleranza: viene segnalato senza fermare la produzione.",
          confidence: 90,
        },
        {
          severity: "low",
          tag: "Solo log",
          title: "Confidenza bassa",
          desc: "Sotto la soglia impostata: registrato come dato, nessuno stop. Le soglie le decidi tu.",
          confidence: 54,
        },
      ],
      thresholdNote:
        "Le soglie di confidenza e frequenza sono configurabili: sei tu a decidere quando fermare e quando solo segnalare.",
      actionsTitle: "Quando c'è un difetto, in automatico:",
      actions: [
        {
          icon: "monitor",
          title: "Segnala a monitor",
          desc: "L'anomalia compare subito sul cruscotto di reparto.",
        },
        {
          icon: "stats",
          title: "Aggiorna le statistiche",
          desc: "Ogni difetto alimenta i dati e fa emergere i pattern nel tempo.",
        },
        {
          icon: "camera",
          title: "Salva lo scatto",
          desc: "Una foto del difetto viene archiviata per riaddestrare il modello.",
        },
        {
          icon: "database",
          title: "Registra nel database",
          desc: "L'ID del prodotto viene marcato come difettoso e tracciato.",
        },
        {
          icon: "robot",
          title: "Rimuove dalla linea",
          desc: "Operatore o robot ricevono l'ordine di scartare il pezzo.",
        },
      ],
      chartTitle: "I pattern che emergono dai dati",
      chartSubtitle:
        "Esempio: difetti per fascia oraria — il picco notturno salta all'occhio.",
      chartInsight:
        "Col tempo i dati rivelano il quando e il perché: turni di notte, un fornitore piuttosto che un altro, una macchina specifica.",
      chartUnit: "difetti",
      chartLegendDay: "Giorno",
      chartLegendNight: "Notte",
    },
    processes: {
      title: "Automatizza i processi in tutta l'azienda",
      lead: "Ottimizza l'intero processo produttivo: dalla classificazione delle materie prime alla prevenzione dei fermi non pianificati, fino al controllo dell'integrità degli imballaggi.",
      cards: [
        {
          icon: "material",
          title: "Ispezione materiali",
          items: [
            "Classifica la qualità delle materie prime",
            "Misura dimensioni e volume",
            "Conta e ordina i pezzi",
          ],
        },
        {
          icon: "production",
          title: "Produzione",
          items: [
            "Rileva inceppamenti e colli di bottiglia",
            "Misura i tempi ciclo",
            "Individua le anomalie di processo",
          ],
        },
        {
          icon: "quality",
          title: "Controllo qualità",
          items: [
            "Automatizza le ispezioni visive",
            "Analizza dimensioni, colore, texture",
            "Rileva componenti mancanti",
          ],
        },
        {
          icon: "packaging",
          title: "Imballaggio",
          items: [
            "Individua imballaggi danneggiati",
            "Conta i pezzi nei cartoni",
            "Trova etichette disallineate",
          ],
        },
        {
          icon: "distribution",
          title: "Distribuzione",
          items: [
            "Monitora i livelli di magazzino",
            "Scansiona e traccia le etichette",
            "Ottimizza l'uso del magazzino",
          ],
        },
        {
          icon: "maintenance",
          title: "Manutenzione",
          items: [
            "Prevede la manutenzione dei macchinari",
            "Automatizza i controlli di sicurezza",
            "Rileva oggetti nei macchinari",
          ],
        },
        {
          icon: "safety",
          title: "Sicurezza e compliance",
          items: [
            "Monitora i rischi per la salute",
            "Verifica le procedure di sicurezza",
            "Identifica le persone nelle zone",
          ],
        },
        {
          icon: "workforce",
          title: "Personale",
          items: [
            "Monitora picchi e aree di attività",
            "Ottimizza il layout dello stabilimento",
            "Controlla l'esecuzione dei processi",
          ],
        },
      ],
    },
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
    solutionsTitle: "The two solutions we put to work",
    solutionsLead:
      "Not theory: two AI technologies ready for your production floor.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solution 01",
        title: "Custom Chatbots",
        lead: "The centralized AI assistant: all your shop-floor information in one place.",
        paragraph:
          "A chatbot trained on your machines, manuals and procedures. It talks to operators in their own language, answers on the floor in real time and gets the right information to the right people. Every implementation is different: the right chatbot comes from the right choices on model, prompts, validation and integration with your systems.",
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
    approachTitle: "Using AI is not enough: it has to be designed well",
    approachParagraphs: [
      "Every AI implementation is different. The optimal solution depends on the use case, data quality, engineering requirements, risk level, compliance needs and expected outcomes.",
      "The challenge is not simply using AI, but designing a solution that delivers accurate, reliable and cost-effective results. That's why we analyze these variables, validate outputs across multiple AI models and build optimized workflows that improve accuracy, reduce operational costs and increase confidence in AI-generated results.",
    ],
    approachFactorsLabel: "The variables we evaluate",
    approachFactors: [
      "LLM architecture",
      "Model selection",
      "Prompt engineering",
      "Validation methods",
      "Caching strategies",
      "Temperature settings",
      "Security",
      "Automation workflows",
      "Systems integration",
    ],
    example: {
      eyebrow: "Real example",
      title: "From defect to action, in real time",
      intro:
        "Two cameras above the line cover 180° and inspect every part. But not all defects are equal: the system decides what to do based on severity, frequency and confidence level.",
      cameraLabel: "2 cameras · 180° coverage over the line",
      decisionTitle: "Stop the line or just flag it?",
      scenarios: [
        {
          severity: "critical",
          tag: "Stop production",
          title: "3 defects in 30 minutes",
          desc: "Recurring, high-confidence defect: this is serious. The line stops and the root cause is investigated.",
          confidence: 98,
        },
        {
          severity: "warning",
          tag: "Flag it",
          title: "Sporadic defect",
          desc: "An occasional error within tolerance: it's flagged without stopping production.",
          confidence: 90,
        },
        {
          severity: "low",
          tag: "Log only",
          title: "Low confidence",
          desc: "Below the set threshold: logged as data, no stop. You decide the thresholds.",
          confidence: 54,
        },
      ],
      thresholdNote:
        "Confidence and frequency thresholds are configurable: you decide when to stop and when to just flag.",
      actionsTitle: "When there's a defect, automatically:",
      actions: [
        {
          icon: "monitor",
          title: "Flag on the monitor",
          desc: "The anomaly appears instantly on the shop-floor dashboard.",
        },
        {
          icon: "stats",
          title: "Update the statistics",
          desc: "Every defect feeds the data and surfaces patterns over time.",
        },
        {
          icon: "camera",
          title: "Save the snapshot",
          desc: "A photo of the defect is stored to retrain and improve the model.",
        },
        {
          icon: "database",
          title: "Register in the database",
          desc: "The product ID is marked as defective and tracked.",
        },
        {
          icon: "robot",
          title: "Remove from the line",
          desc: "Operator or robot get the order to discard the part.",
        },
      ],
      chartTitle: "The patterns that emerge from the data",
      chartSubtitle:
        "Example: defects by time of day — the night spike jumps right out.",
      chartInsight:
        "Over time the data reveals the when and the why: night shifts, one supplier over another, a specific machine.",
      chartUnit: "defects",
      chartLegendDay: "Day",
      chartLegendNight: "Night",
    },
    processes: {
      title: "Automate processes across your business",
      lead: "Streamline your entire production process, whether it's grading raw materials, avoiding unplanned downtime, or verifying packaging integrity.",
      cards: [
        {
          icon: "material",
          title: "Material inspection",
          items: [
            "Grade raw material quality",
            "Measure size and volume",
            "Count and sort items",
          ],
        },
        {
          icon: "production",
          title: "Production",
          items: [
            "Detect jams and bottlenecks",
            "Measure cycle times",
            "Identify process anomalies",
          ],
        },
        {
          icon: "quality",
          title: "Quality control",
          items: [
            "Automate visual inspections",
            "Analyze size, color, textures",
            "Detect missing components",
          ],
        },
        {
          icon: "packaging",
          title: "Packaging",
          items: [
            "Identify packaging damage",
            "Count items in cartons",
            "Find misaligned labels",
          ],
        },
        {
          icon: "distribution",
          title: "Distribution",
          items: [
            "Track inventory levels",
            "Scan and trace labels",
            "Optimize warehouse usage",
          ],
        },
        {
          icon: "maintenance",
          title: "Maintenance",
          items: [
            "Predict equipment maintenance",
            "Automate safety checks",
            "Detect objects in machinery",
          ],
        },
        {
          icon: "safety",
          title: "Safety & compliance",
          items: [
            "Monitor health hazards",
            "Track safety procedures",
            "Identify people in zones",
          ],
        },
        {
          icon: "workforce",
          title: "Workforce",
          items: [
            "Track busy periods & areas",
            "Optimize facility layout",
            "Monitor process execution",
          ],
        },
      ],
    },
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
    solutionsTitle: "Las dos soluciones que ponemos a trabajar",
    solutionsLead:
      "Nada de teoría: dos tecnologías de IA listas para tu planta de producción.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solución 01",
        title: "Chatbots a Medida",
        lead: "El asistente IA centralizado: toda la información de la planta en un único lugar.",
        paragraph:
          "Un chatbot entrenado con tus máquinas, manuales y procedimientos. Habla con los operarios en su idioma, responde en planta en tiempo real y hace llegar la información correcta a las personas adecuadas. Cada implementación es diferente: el chatbot correcto nace de las decisiones correctas sobre modelo, prompts, validación e integración con tus sistemas.",
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
        title: "Visión por Computador",
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
    scanLabel: "Visión por Computador",
    scanStatus: "Defecto detectado",
    scanConfidence: "99,2% de confianza",
    chatName: "Asistente IA",
    chatMsg: "¿Cómo reinicio la máquina 3?",
    chatReply: "Mantén STOP 5s y reinicia desde el panel…",
    approachEyebrow: "Nuestro enfoque",
    approachTitle: "Usar la IA no basta: hay que diseñarla bien",
    approachParagraphs: [
      "Cada implementación de IA es diferente. La solución óptima depende del caso de uso, la calidad de los datos, los requisitos técnicos, el nivel de riesgo, las necesidades de cumplimiento y los resultados esperados.",
      "El reto no es simplemente usar la IA, sino diseñar una solución que ofrezca resultados precisos, fiables y rentables. Por eso analizamos estas variables, validamos las salidas en varios modelos de IA y construimos flujos de trabajo optimizados que mejoran la precisión, reducen los costes y aumentan la confianza en los resultados generados por la IA.",
    ],
    approachFactorsLabel: "Las variables que evaluamos",
    approachFactors: [
      "Arquitectura LLM",
      "Selección del modelo",
      "Prompt engineering",
      "Métodos de validación",
      "Estrategias de caché",
      "Temperature settings",
      "Seguridad",
      "Flujos de automatización",
      "Integración con sistemas",
    ],
    example: {
      eyebrow: "Ejemplo real",
      title: "Del defecto a la acción, en tiempo real",
      intro:
        "Dos cámaras sobre la línea cubren 180° e inspeccionan cada pieza. Pero no todos los defectos son iguales: el sistema decide qué hacer según la gravedad, la frecuencia y el nivel de confianza.",
      cameraLabel: "2 cámaras · cobertura de 180° sobre la línea",
      decisionTitle: "¿Parar la línea o solo señalar?",
      scenarios: [
        {
          severity: "critical",
          tag: "Parar la producción",
          title: "3 defectos en 30 minutos",
          desc: "Defecto recurrente y de alta confianza: es grave. La línea se detiene y se analiza la causa raíz.",
          confidence: 98,
        },
        {
          severity: "warning",
          tag: "Señalar",
          title: "Defecto esporádico",
          desc: "Un error de vez en cuando, dentro de la tolerancia: se señala sin parar la producción.",
          confidence: 90,
        },
        {
          severity: "low",
          tag: "Solo registro",
          title: "Confianza baja",
          desc: "Por debajo del umbral fijado: se registra como dato, sin parada. Tú decides los umbrales.",
          confidence: 54,
        },
      ],
      thresholdNote:
        "Los umbrales de confianza y frecuencia son configurables: tú decides cuándo parar y cuándo solo señalar.",
      actionsTitle: "Cuando hay un defecto, de forma automática:",
      actions: [
        {
          icon: "monitor",
          title: "Señala en el monitor",
          desc: "La anomalía aparece al instante en el panel de planta.",
        },
        {
          icon: "stats",
          title: "Actualiza las estadísticas",
          desc: "Cada defecto alimenta los datos y revela patrones con el tiempo.",
        },
        {
          icon: "camera",
          title: "Guarda la captura",
          desc: "Una foto del defecto se archiva para reentrenar y mejorar el modelo.",
        },
        {
          icon: "database",
          title: "Registra en la base de datos",
          desc: "El ID del producto se marca como defectuoso y se rastrea.",
        },
        {
          icon: "robot",
          title: "Retira de la línea",
          desc: "El operario o el robot reciben la orden de descartar la pieza.",
        },
      ],
      chartTitle: "Los patrones que emergen de los datos",
      chartSubtitle:
        "Ejemplo: defectos por franja horaria — el pico nocturno salta a la vista.",
      chartInsight:
        "Con el tiempo los datos revelan el cuándo y el porqué: turnos de noche, un proveedor frente a otro, una máquina concreta.",
      chartUnit: "defectos",
      chartLegendDay: "Día",
      chartLegendNight: "Noche",
    },
    processes: {
      title: "Automatiza los procesos en toda la empresa",
      lead: "Optimiza todo el proceso de producción: desde clasificar las materias primas hasta evitar paradas no planificadas o verificar la integridad del embalaje.",
      cards: [
        {
          icon: "material",
          title: "Inspección de materiales",
          items: [
            "Clasifica la calidad de las materias primas",
            "Mide tamaño y volumen",
            "Cuenta y ordena las piezas",
          ],
        },
        {
          icon: "production",
          title: "Producción",
          items: [
            "Detecta atascos y cuellos de botella",
            "Mide los tiempos de ciclo",
            "Identifica anomalías de proceso",
          ],
        },
        {
          icon: "quality",
          title: "Control de calidad",
          items: [
            "Automatiza las inspecciones visuales",
            "Analiza tamaño, color, texturas",
            "Detecta componentes faltantes",
          ],
        },
        {
          icon: "packaging",
          title: "Embalaje",
          items: [
            "Identifica daños en el embalaje",
            "Cuenta piezas en las cajas",
            "Encuentra etiquetas desalineadas",
          ],
        },
        {
          icon: "distribution",
          title: "Distribución",
          items: [
            "Controla los niveles de inventario",
            "Escanea y rastrea etiquetas",
            "Optimiza el uso del almacén",
          ],
        },
        {
          icon: "maintenance",
          title: "Mantenimiento",
          items: [
            "Predice el mantenimiento de equipos",
            "Automatiza los controles de seguridad",
            "Detecta objetos en la maquinaria",
          ],
        },
        {
          icon: "safety",
          title: "Seguridad y cumplimiento",
          items: [
            "Monitorea los riesgos para la salud",
            "Verifica los procedimientos de seguridad",
            "Identifica personas en las zonas",
          ],
        },
        {
          icon: "workforce",
          title: "Personal",
          items: [
            "Monitorea picos y áreas de actividad",
            "Optimiza la distribución de la planta",
            "Controla la ejecución de procesos",
          ],
        },
      ],
    },
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
        title: "Custom Chatbots",
        lead: "Der zentrale KI-Assistent: alle Informationen der Produktion an einem Ort.",
        paragraph:
          "Ein Chatbot, trainiert auf deine Maschinen, Handbücher und Abläufe. Er spricht mit den Mitarbeitern in ihrer Sprache, antwortet in Echtzeit vor Ort und bringt die richtigen Informationen zu den richtigen Personen. Jede Umsetzung ist anders: Der richtige Chatbot entsteht aus den richtigen Entscheidungen zu Modell, Prompts, Validierung und Integration in deine Systeme.",
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
    approachTitle: "KI zu nutzen reicht nicht: Sie muss gut entworfen sein",
    approachParagraphs: [
      "Jede KI-Umsetzung ist anders. Die optimale Lösung hängt vom Anwendungsfall, der Datenqualität, den technischen Anforderungen, dem Risikoniveau, den Compliance-Anforderungen und den erwarteten Ergebnissen ab.",
      "Die Herausforderung ist nicht, KI einfach zu nutzen, sondern eine Lösung zu entwerfen, die genaue, zuverlässige und kosteneffiziente Ergebnisse liefert. Deshalb analysieren wir diese Variablen, validieren Ausgaben über mehrere KI-Modelle und bauen optimierte Workflows, die die Genauigkeit erhöhen, Kosten senken und das Vertrauen in KI-Ergebnisse stärken.",
    ],
    approachFactorsLabel: "Die Variablen, die wir bewerten",
    approachFactors: [
      "LLM-Architektur",
      "Modellauswahl",
      "Prompt Engineering",
      "Validierungsmethoden",
      "Caching-Strategien",
      "Temperature-Einstellungen",
      "Sicherheit",
      "Automatisierungs-Workflows",
      "Systemintegration",
    ],
    example: {
      eyebrow: "Echtes Beispiel",
      title: "Vom Defekt zur Aktion, in Echtzeit",
      intro:
        "Zwei Kameras über der Linie decken 180° ab und prüfen jedes Teil. Doch nicht jeder Defekt ist gleich: Das System entscheidet anhand von Schwere, Häufigkeit und Konfidenzniveau, was zu tun ist.",
      cameraLabel: "2 Kameras · 180°-Abdeckung über der Linie",
      decisionTitle: "Linie stoppen oder nur melden?",
      scenarios: [
        {
          severity: "critical",
          tag: "Produktion stoppen",
          title: "3 Defekte in 30 Minuten",
          desc: "Wiederkehrender Defekt mit hoher Konfidenz: das ist ernst. Die Linie stoppt und die Ursache wird analysiert.",
          confidence: 98,
        },
        {
          severity: "warning",
          tag: "Melden",
          title: "Sporadischer Defekt",
          desc: "Ein gelegentlicher Fehler innerhalb der Toleranz: wird gemeldet, ohne die Produktion zu stoppen.",
          confidence: 90,
        },
        {
          severity: "low",
          tag: "Nur protokollieren",
          title: "Niedrige Konfidenz",
          desc: "Unter dem festgelegten Schwellenwert: als Datum protokolliert, kein Stopp. Du legst die Schwellen fest.",
          confidence: 54,
        },
      ],
      thresholdNote:
        "Konfidenz- und Häufigkeitsschwellen sind konfigurierbar: Du entscheidest, wann gestoppt und wann nur gemeldet wird.",
      actionsTitle: "Bei einem Defekt automatisch:",
      actions: [
        {
          icon: "monitor",
          title: "Auf dem Monitor melden",
          desc: "Die Anomalie erscheint sofort auf dem Shopfloor-Dashboard.",
        },
        {
          icon: "stats",
          title: "Statistiken aktualisieren",
          desc: "Jeder Defekt speist die Daten und legt mit der Zeit Muster offen.",
        },
        {
          icon: "camera",
          title: "Aufnahme speichern",
          desc: "Ein Foto des Defekts wird gespeichert, um das Modell neu zu trainieren.",
        },
        {
          icon: "database",
          title: "In der Datenbank erfassen",
          desc: "Die Produkt-ID wird als defekt markiert und nachverfolgt.",
        },
        {
          icon: "robot",
          title: "Von der Linie entfernen",
          desc: "Mitarbeiter oder Roboter erhalten den Auftrag, das Teil auszusortieren.",
        },
      ],
      chartTitle: "Die Muster, die aus den Daten entstehen",
      chartSubtitle:
        "Beispiel: Defekte nach Tageszeit — der Nachtgipfel sticht sofort hervor.",
      chartInsight:
        "Mit der Zeit zeigen die Daten das Wann und Warum: Nachtschichten, ein Lieferant statt eines anderen, eine bestimmte Maschine.",
      chartUnit: "Defekte",
      chartLegendDay: "Tag",
      chartLegendNight: "Nacht",
    },
    processes: {
      title: "Automatisiere Prozesse im gesamten Unternehmen",
      lead: "Optimiere den gesamten Produktionsprozess: vom Sortieren der Rohstoffe über das Vermeiden ungeplanter Stillstände bis zur Prüfung der Verpackungsintegrität.",
      cards: [
        {
          icon: "material",
          title: "Materialprüfung",
          items: [
            "Rohstoffqualität bewerten",
            "Größe und Volumen messen",
            "Teile zählen und sortieren",
          ],
        },
        {
          icon: "production",
          title: "Produktion",
          items: [
            "Staus und Engpässe erkennen",
            "Zykluszeiten messen",
            "Prozessanomalien identifizieren",
          ],
        },
        {
          icon: "quality",
          title: "Qualitätskontrolle",
          items: [
            "Sichtprüfungen automatisieren",
            "Größe, Farbe, Texturen analysieren",
            "Fehlende Komponenten erkennen",
          ],
        },
        {
          icon: "packaging",
          title: "Verpackung",
          items: [
            "Verpackungsschäden erkennen",
            "Teile in Kartons zählen",
            "Verrutschte Etiketten finden",
          ],
        },
        {
          icon: "distribution",
          title: "Distribution",
          items: [
            "Lagerbestände verfolgen",
            "Etiketten scannen und nachverfolgen",
            "Lagernutzung optimieren",
          ],
        },
        {
          icon: "maintenance",
          title: "Wartung",
          items: [
            "Gerätewartung vorhersagen",
            "Sicherheitsprüfungen automatisieren",
            "Objekte in Maschinen erkennen",
          ],
        },
        {
          icon: "safety",
          title: "Sicherheit & Compliance",
          items: [
            "Gesundheitsrisiken überwachen",
            "Sicherheitsabläufe prüfen",
            "Personen in Zonen identifizieren",
          ],
        },
        {
          icon: "workforce",
          title: "Personal",
          items: [
            "Stoßzeiten und Bereiche verfolgen",
            "Anlagen-Layout optimieren",
            "Prozessausführung überwachen",
          ],
        },
      ],
    },
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
    solutionsTitle: "Les deux solutions que nous mettons au travail",
    solutionsLead:
      "Pas de théorie : deux technologies d'IA prêtes pour ton atelier de production.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solution 01",
        title: "Chatbots sur Mesure",
        lead: "L'assistant IA centralisé : toutes les informations de l'atelier au même endroit.",
        paragraph:
          "Un chatbot entraîné sur tes machines, tes manuels et tes procédures. Il parle aux opérateurs dans leur langue, répond sur le terrain en temps réel et achemine la bonne information aux bonnes personnes. Chaque mise en œuvre est différente : le bon chatbot naît des bons choix sur le modèle, les prompts, la validation et l'intégration avec tes systèmes.",
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
        title: "Vision par Ordinateur",
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
    scanLabel: "Vision par Ordinateur",
    scanStatus: "Défaut détecté",
    scanConfidence: "99,2 % de fiabilité",
    chatName: "Assistant IA",
    chatMsg: "Comment réinitialiser la machine 3 ?",
    chatReply: "Maintiens STOP 5s, puis redémarre depuis le panneau…",
    approachEyebrow: "Notre approche",
    approachTitle: "Utiliser l'IA ne suffit pas : il faut bien la concevoir",
    approachParagraphs: [
      "Chaque mise en œuvre d'IA est différente. La solution optimale dépend du cas d'usage, de la qualité des données, des exigences techniques, du niveau de risque, des besoins de conformité et des résultats attendus.",
      "Le défi n'est pas simplement d'utiliser l'IA, mais de concevoir une solution qui produit des résultats précis, fiables et rentables. C'est pourquoi nous analysons ces variables, validons les sorties sur plusieurs modèles d'IA et construisons des workflows optimisés qui améliorent la précision, réduisent les coûts et renforcent la confiance dans les résultats générés par l'IA.",
    ],
    approachFactorsLabel: "Les variables que nous évaluons",
    approachFactors: [
      "Architecture LLM",
      "Choix du modèle",
      "Prompt engineering",
      "Méthodes de validation",
      "Stratégies de cache",
      "Temperature settings",
      "Sécurité",
      "Workflows d'automatisation",
      "Intégration aux systèmes",
    ],
    example: {
      eyebrow: "Exemple réel",
      title: "Du défaut à l'action, en temps réel",
      intro:
        "Deux caméras au-dessus de la ligne couvrent 180° et inspectent chaque pièce. Mais tous les défauts ne se valent pas : le système décide quoi faire selon la gravité, la fréquence et le niveau de confiance.",
      cameraLabel: "2 caméras · couverture 180° au-dessus de la ligne",
      decisionTitle: "Arrêter la ligne ou seulement signaler ?",
      scenarios: [
        {
          severity: "critical",
          tag: "Arrêter la production",
          title: "3 défauts en 30 minutes",
          desc: "Défaut récurrent et à haute confiance : c'est grave. La ligne s'arrête et la cause racine est analysée.",
          confidence: 98,
        },
        {
          severity: "warning",
          tag: "Signaler",
          title: "Défaut sporadique",
          desc: "Une erreur de temps en temps, dans la tolérance : elle est signalée sans arrêter la production.",
          confidence: 90,
        },
        {
          severity: "low",
          tag: "Journal seulement",
          title: "Confiance faible",
          desc: "Sous le seuil défini : enregistré comme donnée, pas d'arrêt. Tu fixes les seuils.",
          confidence: 54,
        },
      ],
      thresholdNote:
        "Les seuils de confiance et de fréquence sont configurables : c'est toi qui décides quand arrêter et quand seulement signaler.",
      actionsTitle: "Quand il y a un défaut, automatiquement :",
      actions: [
        {
          icon: "monitor",
          title: "Signale sur le moniteur",
          desc: "L'anomalie apparaît aussitôt sur le tableau de bord de l'atelier.",
        },
        {
          icon: "stats",
          title: "Met à jour les statistiques",
          desc: "Chaque défaut alimente les données et fait émerger les schémas dans le temps.",
        },
        {
          icon: "camera",
          title: "Enregistre le cliché",
          desc: "Une photo du défaut est archivée pour réentraîner et améliorer le modèle.",
        },
        {
          icon: "database",
          title: "Enregistre dans la base",
          desc: "L'ID du produit est marqué comme défectueux et suivi.",
        },
        {
          icon: "robot",
          title: "Retire de la ligne",
          desc: "L'opérateur ou le robot reçoit l'ordre d'écarter la pièce.",
        },
      ],
      chartTitle: "Les schémas qui émergent des données",
      chartSubtitle:
        "Exemple : défauts par tranche horaire — le pic de nuit saute aux yeux.",
      chartInsight:
        "Avec le temps, les données révèlent le quand et le pourquoi : équipes de nuit, un fournisseur plutôt qu'un autre, une machine précise.",
      chartUnit: "défauts",
      chartLegendDay: "Jour",
      chartLegendNight: "Nuit",
    },
    processes: {
      title: "Automatise les processus dans toute l'entreprise",
      lead: "Optimise tout le processus de production : du tri des matières premières à la prévention des arrêts imprévus, jusqu'à la vérification de l'intégrité des emballages.",
      cards: [
        {
          icon: "material",
          title: "Inspection des matériaux",
          items: [
            "Évaluer la qualité des matières premières",
            "Mesurer taille et volume",
            "Compter et trier les pièces",
          ],
        },
        {
          icon: "production",
          title: "Production",
          items: [
            "Détecter blocages et goulots d'étranglement",
            "Mesurer les temps de cycle",
            "Identifier les anomalies de processus",
          ],
        },
        {
          icon: "quality",
          title: "Contrôle qualité",
          items: [
            "Automatiser les inspections visuelles",
            "Analyser taille, couleur, textures",
            "Détecter les composants manquants",
          ],
        },
        {
          icon: "packaging",
          title: "Emballage",
          items: [
            "Identifier les emballages endommagés",
            "Compter les pièces dans les cartons",
            "Repérer les étiquettes mal alignées",
          ],
        },
        {
          icon: "distribution",
          title: "Distribution",
          items: [
            "Suivre les niveaux de stock",
            "Scanner et tracer les étiquettes",
            "Optimiser l'usage de l'entrepôt",
          ],
        },
        {
          icon: "maintenance",
          title: "Maintenance",
          items: [
            "Prédire la maintenance des équipements",
            "Automatiser les contrôles de sécurité",
            "Détecter des objets dans les machines",
          ],
        },
        {
          icon: "safety",
          title: "Sécurité & conformité",
          items: [
            "Surveiller les risques sanitaires",
            "Suivre les procédures de sécurité",
            "Identifier les personnes dans les zones",
          ],
        },
        {
          icon: "workforce",
          title: "Personnel",
          items: [
            "Suivre les pics et zones d'activité",
            "Optimiser l'agencement du site",
            "Surveiller l'exécution des processus",
          ],
        },
      ],
    },
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
    solutionsTitle: "Les dues solucions que posem a treballar",
    solutionsLead:
      "Res de teoria: dues tecnologies d'IA a punt per a la teva planta de producció.",
    solutions: [
      {
        icon: "bot",
        eyebrow: "Solució 01",
        title: "Chatbots a Mida",
        lead: "L'assistent IA centralitzat: tota la informació de la planta en un únic lloc.",
        paragraph:
          "Un chatbot entrenat amb les teves màquines, manuals i procediments. Parla amb els operaris en la seva llengua, respon a planta en temps real i fa arribar la informació correcta a les persones adequades. Cada implementació és diferent: el chatbot adequat neix de les decisions correctes sobre model, prompts, validació i integració amb els teus sistemes.",
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
        title: "Visió per Computador",
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
    scanLabel: "Visió per Computador",
    scanStatus: "Defecte detectat",
    scanConfidence: "99,2 % de fiabilitat",
    chatName: "Assistent IA",
    chatMsg: "Com reinicio la màquina 3?",
    chatReply: "Mantén STOP 5s i reinicia des del panell…",
    approachEyebrow: "El nostre enfocament",
    approachTitle: "Usar la IA no n'hi ha prou: cal dissenyar-la bé",
    approachParagraphs: [
      "Cada implementació d'IA és diferent. La solució òptima depèn del cas d'ús, la qualitat de les dades, els requisits tècnics, el nivell de risc, les necessitats de compliment i els resultats esperats.",
      "El repte no és simplement usar la IA, sinó dissenyar una solució que ofereixi resultats precisos, fiables i rendibles. Per això analitzem aquestes variables, validem les sortides en diversos models d'IA i construïm fluxos de treball optimitzats que milloren la precisió, redueixen els costos i augmenten la confiança en els resultats generats per la IA.",
    ],
    approachFactorsLabel: "Les variables que avaluem",
    approachFactors: [
      "Arquitectura LLM",
      "Selecció del model",
      "Prompt engineering",
      "Mètodes de validació",
      "Estratègies de cau",
      "Temperature settings",
      "Seguretat",
      "Fluxos d'automatització",
      "Integració amb sistemes",
    ],
    example: {
      eyebrow: "Exemple real",
      title: "Del defecte a l'acció, en temps real",
      intro:
        "Dues càmeres sobre la línia cobreixen 180° i inspeccionen cada peça. Però no tots els defectes són iguals: el sistema decideix què fer segons la gravetat, la freqüència i el nivell de confiança.",
      cameraLabel: "2 càmeres · cobertura de 180° sobre la línia",
      decisionTitle: "Aturar la línia o només senyalar?",
      scenarios: [
        {
          severity: "critical",
          tag: "Atura la producció",
          title: "3 defectes en 30 minuts",
          desc: "Defecte recurrent i d'alta confiança: és greu. La línia s'atura i s'analitza la causa arrel.",
          confidence: 98,
        },
        {
          severity: "warning",
          tag: "Senyala",
          title: "Defecte esporàdic",
          desc: "Un error de tant en tant, dins la tolerància: es senyala sense aturar la producció.",
          confidence: 90,
        },
        {
          severity: "low",
          tag: "Només registre",
          title: "Confiança baixa",
          desc: "Per sota del llindar fixat: registrat com a dada, sense aturada. Tu decideixes els llindars.",
          confidence: 54,
        },
      ],
      thresholdNote:
        "Els llindars de confiança i freqüència són configurables: tu decideixes quan aturar i quan només senyalar.",
      actionsTitle: "Quan hi ha un defecte, automàticament:",
      actions: [
        {
          icon: "monitor",
          title: "Senyala al monitor",
          desc: "L'anomalia apareix a l'instant al tauler de planta.",
        },
        {
          icon: "stats",
          title: "Actualitza les estadístiques",
          desc: "Cada defecte alimenta les dades i fa emergir els patrons amb el temps.",
        },
        {
          icon: "camera",
          title: "Desa la captura",
          desc: "Una foto del defecte s'arxiva per reentrenar i millorar el model.",
        },
        {
          icon: "database",
          title: "Registra a la base de dades",
          desc: "L'ID del producte es marca com a defectuós i es fa el seguiment.",
        },
        {
          icon: "robot",
          title: "Retira de la línia",
          desc: "L'operari o el robot reben l'ordre de descartar la peça.",
        },
      ],
      chartTitle: "Els patrons que emergeixen de les dades",
      chartSubtitle:
        "Exemple: defectes per franja horària — el pic nocturn salta a la vista.",
      chartInsight:
        "Amb el temps les dades revelen el quan i el perquè: torns de nit, un proveïdor en lloc d'un altre, una màquina concreta.",
      chartUnit: "defectes",
      chartLegendDay: "Dia",
      chartLegendNight: "Nit",
    },
    processes: {
      title: "Automatitza els processos a tota l'empresa",
      lead: "Optimitza tot el procés de producció: des de classificar les matèries primeres fins a evitar aturades no planificades o verificar la integritat de l'embalatge.",
      cards: [
        {
          icon: "material",
          title: "Inspecció de materials",
          items: [
            "Classifica la qualitat de les matèries primeres",
            "Mesura mida i volum",
            "Compta i ordena les peces",
          ],
        },
        {
          icon: "production",
          title: "Producció",
          items: [
            "Detecta embussos i colls d'ampolla",
            "Mesura els temps de cicle",
            "Identifica anomalies de procés",
          ],
        },
        {
          icon: "quality",
          title: "Control de qualitat",
          items: [
            "Automatitza les inspeccions visuals",
            "Analitza mida, color, textures",
            "Detecta components que falten",
          ],
        },
        {
          icon: "packaging",
          title: "Embalatge",
          items: [
            "Identifica embalatges malmesos",
            "Compta peces a les caixes",
            "Troba etiquetes desalineades",
          ],
        },
        {
          icon: "distribution",
          title: "Distribució",
          items: [
            "Controla els nivells d'inventari",
            "Escaneja i traça les etiquetes",
            "Optimitza l'ús del magatzem",
          ],
        },
        {
          icon: "maintenance",
          title: "Manteniment",
          items: [
            "Prediu el manteniment dels equips",
            "Automatitza els controls de seguretat",
            "Detecta objectes a la maquinària",
          ],
        },
        {
          icon: "safety",
          title: "Seguretat i compliment",
          items: [
            "Monitora els riscos per a la salut",
            "Verifica els procediments de seguretat",
            "Identifica persones a les zones",
          ],
        },
        {
          icon: "workforce",
          title: "Personal",
          items: [
            "Monitora pics i àrees d'activitat",
            "Optimitza la distribució de la planta",
            "Controla l'execució dels processos",
          ],
        },
      ],
    },
    cta: "Contacta'ns",
    ctaSub: "Et mostrem què és possible amb les teves dades.",
    ctaTitle: "Contacta'ns per a més informació",
    ctaDesc:
      "Parlem-ne. Analitzem el teu cas i et mostrem què és possible amb les teves dades i màquines.",
  },
}
