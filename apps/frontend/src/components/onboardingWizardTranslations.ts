/**
 * Translations for OnboardingWizardModal
 * Supports: it, en, es, pt
 */

export const INDUSTRIES = [
  'retail', 'restaurant', 'healthcare', 'beauty', 'education',
  'tourism', 'fashion', 'fitness', 'transport', 'technology',
  'realestate', 'finance', 'legal', 'other',
] as const

export type Industry = (typeof INDUSTRIES)[number]

export const INDUSTRY_EMOJI: Record<Industry, string> = {
  retail: '🛍️', restaurant: '🍕', healthcare: '🏥', beauty: '💄',
  education: '📚', tourism: '✈️', fashion: '👗', fitness: '💪',
  transport: '🚚', technology: '💻', realestate: '🏠', finance: '💰',
  legal: '⚖️', other: '🏢',
}

export const WORKSPACE_TYPES = ['ecommerce', 'info', 'flow'] as const
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number]

export const WORKSPACE_TYPE_EMOJI: Record<WorkspaceType, string> = {
  ecommerce: '🛒', info: '💬', flow: '⚡',
}

export type ChannelTone = 'friendly' | 'professional' | 'formal' | 'casual'

export const TONE_OPTIONS: ChannelTone[] = ['friendly', 'professional', 'formal', 'casual']

export const OWT = {
  it: {
    back: 'Indietro',
    next: 'Avanti',
    intro: {
      title: 'Benvenuto in eChatbot',
      subtitle: 'Configura il tuo assistente WhatsApp\nin meno di 3 minuti',
      benefits: ['✅ Setup in 3 minuti', '✅ 14 giorni gratis', '✅ Nessuna carta richiesta'],
      cta: 'Inizia la configurazione →',
    },
    industry: {
      title: 'Qual è il tuo settore?',
      subtitle: 'Scegliamo le funzionalità più adatte\nalla tua attività',
    },
    business: {
      title: 'Come si chiama il tuo canale?',
      subtitle: 'I tuoi clienti vedranno questo nome',
      name: 'Nome del canale',
      namePh: 'es. Pizzeria Roma',
    },
    channelPersonality: {
      title: 'Personalità del canale',
      subtitle: 'Definisci come si presenta il tuo assistente AI',
      botName: 'Nome dell\'assistente AI',
      botNamePh: 'es. Sofia, Marco, Assistente...',
      tone: 'Tono di voce',
      tones: {
        friendly:     { label: 'Amichevole',    desc: 'Caldo, vicino, empatico',             emoji: '😊' },
        professional: { label: 'Professionale', desc: 'Chiaro, competente, affidabile',      emoji: '👔' },
        formal:       { label: 'Formale',       desc: 'Preciso, autorevole, istituzionale',  emoji: '🎩' },
        casual:       { label: 'Informale',     desc: 'Rilassato, diretto, colloquiale',     emoji: '😎' },
      },
    },
    workspaceType: {
      title: 'Come vuoi usare eChatbot?',
      subtitle: 'Configuriamo le funzionalità giuste per te',
      options: {
        ecommerce: { label: 'Vendo prodotti', desc: 'Catalogo prodotti, carrello e ordini online' },
        info: { label: 'Condivido informazioni', desc: 'Supporto clienti, FAQ e informazioni' },
        flow: { label: 'Custom chatbot', desc: 'Chatbot personalizzato: widget, WhatsApp, provider AI e messaggio WIP' },
      },
    },
    channelType: {
      title: 'Come vuoi ricevere i messaggi?',
      subtitle: 'Scegli dove il chatbot interagirà con i tuoi clienti',
      options: {
        whatsapp: { label: 'Solo WhatsApp', desc: 'Il chatbot risponde su WhatsApp', emoji: '💬' },
        widget: { label: 'Solo Widget web', desc: 'Chat integrata nel tuo sito web', emoji: '🌐' },
        both: { label: 'Entrambi', desc: 'WhatsApp + Widget sul sito web', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Supporto umano',
      subtitle: 'Una delle caratteristiche di eChatbot è il passaggio intelligente dal chatbot a un operatore umano, senza perdere il contesto della conversazione. Quando un cliente ha un problema complesso, il chatbot trasferisce la chat a un operatore che riceve una notifica WhatsApp con tutta la cronologia. Vuoi questa funzionalità?',
      yes: { label: 'Sì, voglio il passaggio a operatore umano', emoji: '✅' },
      no: { label: 'No, la gestione automatica va bene', emoji: '🤖' },
    },
    auth: {
      title: 'Crea il tuo account',
      subtitle: 'Quasi fatto — registrati per iniziare',
      fname: 'Nome', lname: 'Cognome',
      email: 'Email', pass: 'Password',
      gdpr: 'Accetto i Termini di Servizio e la Privacy Policy',
      register: 'Crea Account', or: 'oppure',
    },
    totp: {
      title: 'Proteggi il tuo account',
      setupSubtitle: 'Scansiona il QR con Google Authenticator o Authy',
      setupInstructions: "Apri l'app → Aggiungi account → Scansiona QR",
      verifySubtitle: "Inserisci il codice dall'app di autenticazione",
      code: 'Codice (6 cifre)', verify: 'Verifica e continua',
    },
    creating: {
      title: 'Configurazione in corso...',
      phasesWhatsapp: ['Creo il tuo workspace...', 'Configuro il canale WhatsApp...', 'Quasi pronto...'],
      phasesWidget: ['Creo il tuo workspace...', 'Configuro il widget...', 'Quasi pronto...'],
      phasesBoth: ['Creo il tuo workspace...', 'Configuro WhatsApp e widget...', 'Quasi pronto...'],
    },
    qr: {
      title: 'Collega WhatsApp',
      subtitle: 'WhatsApp → Dispositivi collegati → Collega dispositivo → Scansiona',
      expired: 'QR scaduto', newQr: 'Nuovo QR', wait: 's',
    },
    done: {
      title: 'Tutto pronto!',
      subtitleWhatsapp: 'Il tuo workspace è configurato e WhatsApp è connesso.',
      subtitleWidget: 'Il tuo workspace è configurato. Trovi il codice widget nelle impostazioni.',
      subtitleBoth: 'Il tuo workspace è configurato. WhatsApp connesso e widget pronto.',
      cta: 'Vai alla Dashboard',
    },
    industries: {
      retail: 'Retail', restaurant: 'Ristorazione', healthcare: 'Sanità',
      beauty: 'Beauty', education: 'Educazione', tourism: 'Turismo',
      fashion: 'Moda', fitness: 'Fitness', transport: 'Trasporti',
      technology: 'Tecnologia', realestate: 'Immobiliare', finance: 'Finanza',
      legal: 'Legale', other: 'Altro',
    },
    errors: {
      required: 'Campo obbligatorio',
      phoneFormat: 'Usa il formato internazionale, es. +393331234567',
      emailRequired: 'Email obbligatoria', passwordRequired: 'Password obbligatoria',
      gdprRequired: 'Devi accettare i termini', invalidCode: 'Inserisci 6 cifre',
    },
  },
  en: {
    back: 'Back',
    next: 'Next',
    intro: {
      title: 'Welcome to eChatbot',
      subtitle: 'Set up your WhatsApp assistant\nin less than 3 minutes',
      benefits: ['✅ 3-minute setup', '✅ 14 days free', '✅ No credit card required'],
      cta: 'Start setup →',
    },
    industry: {
      title: 'What industry are you in?',
      subtitle: 'We\'ll pick the best features\nfor your business',
    },
    business: {
      title: 'What\'s your channel name?',
      subtitle: 'Your customers will see this name',
      name: 'Channel name',
      namePh: 'e.g. Roma Pizza',
    },
    channelPersonality: {
      title: 'Channel personality',
      subtitle: 'Define how your AI assistant presents itself',
      botName: 'AI assistant name',
      botNamePh: 'e.g. Sofia, Alex, Assistant...',
      tone: 'Tone of voice',
      tones: {
        friendly:     { label: 'Friendly',      desc: 'Warm, approachable, empathetic',   emoji: '😊' },
        professional: { label: 'Professional',  desc: 'Clear, competent, trustworthy',    emoji: '👔' },
        formal:       { label: 'Formal',        desc: 'Precise, authoritative, corporate',emoji: '🎩' },
        casual:       { label: 'Casual',        desc: 'Relaxed, direct, conversational',  emoji: '😎' },
      },
    },
    workspaceType: {
      title: 'How will you use eChatbot?',
      subtitle: 'We\'ll configure the right features for you',
      options: {
        ecommerce: { label: 'Sell products', desc: 'Product catalog, cart and online orders' },
        info: { label: 'Share information', desc: 'Customer support, FAQ and information' },
        flow: { label: 'Custom chatbot', desc: 'Custom chatbot: widget, WhatsApp, AI provider and WIP message' },
      },
    },
    channelType: {
      title: 'How do you want to receive messages?',
      subtitle: 'Choose where your chatbot will interact with customers',
      options: {
        whatsapp: { label: 'WhatsApp only', desc: 'Chatbot replies on WhatsApp', emoji: '💬' },
        widget: { label: 'Web widget only', desc: 'Chat integrated in your website', emoji: '🌐' },
        both: { label: 'Both', desc: 'WhatsApp + website widget', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Human Support',
      subtitle: 'One of eChatbot\'s strengths is the intelligent handoff from AI to a human agent, without losing conversation context. When a customer has a complex issue, the AI agent instantly transfers the chat to an operator who receives a WhatsApp notification with the full conversation history. Would you like this capability integrated into your chatbot?',
      yes: { label: 'Yes, I want human handoff capability', emoji: '✅' },
      no: { label: 'Full automation works for me', emoji: '🤖' },
    },
    auth: {
      title: 'Create your account',
      subtitle: 'Almost done — register to get started',
      fname: 'First name', lname: 'Last name',
      email: 'Email', pass: 'Password',
      gdpr: 'I agree to the Terms of Service and Privacy Policy',
      register: 'Create Account', or: 'or',
    },
    totp: {
      title: 'Secure your account',
      setupSubtitle: 'Scan the QR with Google Authenticator or Authy',
      setupInstructions: 'Open app → Add account → Scan QR',
      verifySubtitle: 'Enter the code from your authenticator app',
      code: 'Code (6 digits)', verify: 'Verify and continue',
    },
    creating: {
      title: 'Setting everything up...',
      phasesWhatsapp: ['Creating your workspace...', 'Configuring WhatsApp channel...', 'Almost ready...'],
      phasesWidget: ['Creating your workspace...', 'Configuring web widget...', 'Almost ready...'],
      phasesBoth: ['Creating your workspace...', 'Configuring WhatsApp and widget...', 'Almost ready...'],
    },
    qr: {
      title: 'Connect WhatsApp',
      subtitle: 'WhatsApp → Linked Devices → Link a Device → Scan',
      expired: 'QR expired', newQr: 'New QR', wait: 's',
    },
    done: {
      title: 'All set!',
      subtitleWhatsapp: 'Your workspace is configured and WhatsApp is connected.',
      subtitleWidget: 'Your workspace is configured. Find the widget code in settings.',
      subtitleBoth: 'Your workspace is configured. WhatsApp connected and widget ready.',
      cta: 'Go to Dashboard',
    },
    industries: {
      retail: 'Retail', restaurant: 'Restaurant', healthcare: 'Healthcare',
      beauty: 'Beauty', education: 'Education', tourism: 'Tourism',
      fashion: 'Fashion', fitness: 'Fitness', transport: 'Transport',
      technology: 'Technology', realestate: 'Real Estate', finance: 'Finance',
      legal: 'Legal', other: 'Other',
    },
    errors: {
      required: 'Required field',
      phoneFormat: 'Use international format, e.g. +393331234567',
      emailRequired: 'Email required', passwordRequired: 'Password required',
      gdprRequired: 'You must accept the terms', invalidCode: 'Enter 6 digits',
    },
  },
  es: {
    back: 'Atrás',
    next: 'Siguiente',
    intro: {
      title: 'Bienvenido a eChatbot',
      subtitle: 'Configura tu asistente WhatsApp\nen menos de 3 minutos',
      benefits: ['✅ Setup en 3 minutos', '✅ 14 días gratis', '✅ Sin tarjeta de crédito'],
      cta: 'Comenzar configuración →',
    },
    industry: {
      title: '¿En qué sector operas?',
      subtitle: 'Elegiremos las funciones más adecuadas\npara tu negocio',
    },
    business: {
      title: '¿Cómo se llama tu canal?',
      subtitle: 'Tus clientes verán este nombre',
      name: 'Nombre del canal',
      namePh: 'ej. Pizzería Roma',
    },
    channelPersonality: {
      title: 'Personalidad del canal',
      subtitle: 'Define cómo se presenta tu asistente AI',
      botName: 'Nombre del asistente AI',
      botNamePh: 'ej. Sofia, Carlos, Asistente...',
      tone: 'Tono de voz',
      tones: {
        friendly:     { label: 'Amigable',      desc: 'Cálido, cercano, empático',           emoji: '😊' },
        professional: { label: 'Profesional',   desc: 'Claro, competente, confiable',        emoji: '👔' },
        formal:       { label: 'Formal',        desc: 'Preciso, autoritativo, corporativo',  emoji: '🎩' },
        casual:       { label: 'Informal',      desc: 'Relajado, directo, coloquial',        emoji: '😎' },
      },
    },
    workspaceType: {
      title: '¿Cómo usarás eChatbot?',
      subtitle: 'Configuraremos las funciones adecuadas para ti',
      options: {
        ecommerce: { label: 'Vendo productos', desc: 'Catálogo, carrito y pedidos online' },
        info: { label: 'Comparto información', desc: 'Soporte al cliente, FAQ e información' },
        flow: { label: 'Custom chatbot', desc: 'Chatbot personalizado: widget, WhatsApp, proveedor AI y mensaje WIP' },
      },
    },
    channelType: {
      title: '¿Cómo quieres recibir mensajes?',
      subtitle: 'Elige dónde interactuará el chatbot con tus clientes',
      options: {
        whatsapp: { label: 'Solo WhatsApp', desc: 'El chatbot responde en WhatsApp', emoji: '💬' },
        widget: { label: 'Solo widget web', desc: 'Chat integrado en tu sitio web', emoji: '🌐' },
        both: { label: 'Ambos', desc: 'WhatsApp + widget en el sitio web', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Soporte humano',
      subtitle: 'Una de las fortalezas de eChatbot es la transferencia inteligente del chatbot a un agente humano, sin perder el contexto. ¿Quieres esta capacidad integrada?',
      yes: { label: 'Sí, quiero transferencia a agente humano', emoji: '✅' },
      no: { label: 'La automatización completa me sirve', emoji: '🤖' },
    },
    auth: {
      title: 'Crea tu cuenta',
      subtitle: 'Casi listo — regístrate para comenzar',
      fname: 'Nombre', lname: 'Apellido',
      email: 'Correo electrónico', pass: 'Contraseña',
      gdpr: 'Acepto los Términos de Servicio y la Política de Privacidad',
      register: 'Crear Cuenta', or: 'o',
    },
    totp: {
      title: 'Protege tu cuenta',
      setupSubtitle: 'Escanea el QR con Google Authenticator o Authy',
      setupInstructions: 'Abrir app → Agregar cuenta → Escanear QR',
      verifySubtitle: 'Ingresa el código de tu app de autenticación',
      code: 'Código (6 dígitos)', verify: 'Verificar y continuar',
    },
    creating: {
      title: 'Configurando todo...',
      phasesWhatsapp: ['Creando tu workspace...', 'Configurando canal WhatsApp...', '¡Casi listo!'],
      phasesWidget: ['Creando tu workspace...', 'Configurando el widget...', '¡Casi listo!'],
      phasesBoth: ['Creando tu workspace...', 'Configurando WhatsApp y widget...', '¡Casi listo!'],
    },
    qr: {
      title: 'Conectar WhatsApp',
      subtitle: 'WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanear',
      expired: 'QR expirado', newQr: 'Nuevo QR', wait: 's',
    },
    done: {
      title: '¡Todo listo!',
      subtitleWhatsapp: 'Tu workspace está configurado y WhatsApp está conectado.',
      subtitleWidget: 'Tu workspace está configurado. Encuentra el código del widget en ajustes.',
      subtitleBoth: 'Tu workspace está configurado. WhatsApp conectado y widget listo.',
      cta: 'Ir al Panel',
    },
    industries: {
      retail: 'Retail', restaurant: 'Restauración', healthcare: 'Salud',
      beauty: 'Belleza', education: 'Educación', tourism: 'Turismo',
      fashion: 'Moda', fitness: 'Fitness', transport: 'Transporte',
      technology: 'Tecnología', realestate: 'Inmobiliario', finance: 'Finanzas',
      legal: 'Legal', other: 'Otro',
    },
    errors: {
      required: 'Campo requerido',
      phoneFormat: 'Usa el formato internacional, ej. +34612345678',
      emailRequired: 'Email requerido', passwordRequired: 'Contraseña requerida',
      gdprRequired: 'Debes aceptar los términos', invalidCode: 'Ingresa 6 dígitos',
    },
  },
  de: {
    back: 'Zurück',
    next: 'Weiter',
    intro: {
      title: 'Willkommen bei eChatbot',
      subtitle: 'Richte deinen WhatsApp-Assistenten\nin weniger als 3 Minuten ein',
      benefits: ['✅ Einrichtung in 3 Minuten', '✅ 14 Tage gratis', '✅ Keine Kreditkarte nötig'],
      cta: 'Einrichtung starten →',
    },
    industry: {
      title: 'In welcher Branche bist du tätig?',
      subtitle: 'Wir wählen die besten Funktionen\nfür dein Unternehmen aus',
    },
    business: {
      title: 'Wie heißt dein Kanal?',
      subtitle: 'Deine Kunden sehen diesen Namen',
      name: 'Kanalname',
      namePh: 'z.B. Pizzeria Roma',
    },
    channelPersonality: {
      title: 'Persönlichkeit des Kanals',
      subtitle: 'Lege fest, wie sich dein KI-Assistent präsentiert',
      botName: 'Name des KI-Assistenten',
      botNamePh: 'z.B. Sofia, Alex, Assistent...',
      tone: 'Tonfall',
      tones: {
        friendly:     { label: 'Freundlich',    desc: 'Warm, nahbar, empathisch',              emoji: '😊' },
        professional: { label: 'Professionell', desc: 'Klar, kompetent, vertrauenswürdig',     emoji: '👔' },
        formal:       { label: 'Formell',       desc: 'Präzise, souverän, korporativ',         emoji: '🎩' },
        casual:       { label: 'Locker',        desc: 'Entspannt, direkt, umgangssprachlich',  emoji: '😎' },
      },
    },
    workspaceType: {
      title: 'Wie wirst du eChatbot nutzen?',
      subtitle: 'Wir konfigurieren die passenden Funktionen für dich',
      options: {
        ecommerce: { label: 'Produkte verkaufen', desc: 'Produktkatalog, Warenkorb und Online-Bestellungen' },
        info: { label: 'Informationen teilen', desc: 'Kundensupport, FAQ und Informationen' },
        flow: { label: 'Custom chatbot', desc: 'Individueller Chatbot: Widget, WhatsApp, KI-Provider und WIP-Nachricht' },
      },
    },
    channelType: {
      title: 'Wie möchtest du Nachrichten empfangen?',
      subtitle: 'Wähle, wo dein Chatbot mit Kunden interagiert',
      options: {
        whatsapp: { label: 'Nur WhatsApp', desc: 'Der Chatbot antwortet auf WhatsApp', emoji: '💬' },
        widget: { label: 'Nur Web-Widget', desc: 'Chat integriert in deine Website', emoji: '🌐' },
        both: { label: 'Beides', desc: 'WhatsApp + Widget auf der Website', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Menschlicher Support',
      subtitle: 'Eine der Stärken von eChatbot ist die intelligente Übergabe von der KI an einen menschlichen Mitarbeiter, ohne den Gesprächskontext zu verlieren. Möchtest du diese Funktion integriert haben?',
      yes: { label: 'Ja, ich möchte die Übergabe an Mitarbeiter', emoji: '✅' },
      no: { label: 'Volle Automatisierung reicht mir', emoji: '🤖' },
    },
    auth: {
      title: 'Erstelle dein Konto',
      subtitle: 'Fast geschafft — registriere dich, um loszulegen',
      fname: 'Vorname', lname: 'Nachname',
      email: 'E-Mail', pass: 'Passwort',
      gdpr: 'Ich akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung',
      register: 'Konto erstellen', or: 'oder',
    },
    totp: {
      title: 'Sichere dein Konto',
      setupSubtitle: 'Scanne den QR-Code mit Google Authenticator oder Authy',
      setupInstructions: 'App öffnen → Konto hinzufügen → QR scannen',
      verifySubtitle: 'Gib den Code aus deiner Authenticator-App ein',
      code: 'Code (6 Ziffern)', verify: 'Bestätigen und weiter',
    },
    creating: {
      title: 'Alles wird eingerichtet...',
      phasesWhatsapp: ['Workspace wird erstellt...', 'WhatsApp-Kanal wird konfiguriert...', 'Fast fertig...'],
      phasesWidget: ['Workspace wird erstellt...', 'Web-Widget wird konfiguriert...', 'Fast fertig...'],
      phasesBoth: ['Workspace wird erstellt...', 'WhatsApp und Widget werden konfiguriert...', 'Fast fertig...'],
    },
    qr: {
      title: 'WhatsApp verbinden',
      subtitle: 'WhatsApp → Verknüpfte Geräte → Gerät verknüpfen → Scannen',
      expired: 'QR abgelaufen', newQr: 'Neuer QR', wait: 's',
    },
    done: {
      title: 'Alles bereit!',
      subtitleWhatsapp: 'Dein Workspace ist konfiguriert und WhatsApp ist verbunden.',
      subtitleWidget: 'Dein Workspace ist konfiguriert. Den Widget-Code findest du in den Einstellungen.',
      subtitleBoth: 'Dein Workspace ist konfiguriert. WhatsApp verbunden und Widget bereit.',
      cta: 'Zum Dashboard',
    },
    industries: {
      retail: 'Einzelhandel', restaurant: 'Restaurant', healthcare: 'Gesundheit',
      beauty: 'Beauty', education: 'Bildung', tourism: 'Tourismus',
      fashion: 'Mode', fitness: 'Fitness', transport: 'Transport',
      technology: 'Technologie', realestate: 'Immobilien', finance: 'Finanzen',
      legal: 'Recht', other: 'Sonstiges',
    },
    errors: {
      required: 'Pflichtfeld',
      phoneFormat: 'Internationales Format verwenden, z.B. +491701234567',
      emailRequired: 'E-Mail erforderlich', passwordRequired: 'Passwort erforderlich',
      gdprRequired: 'Du musst die Bedingungen akzeptieren', invalidCode: 'Gib 6 Ziffern ein',
    },
  },
  fr: {
    back: 'Retour',
    next: 'Suivant',
    intro: {
      title: 'Bienvenue sur eChatbot',
      subtitle: 'Configurez votre assistant WhatsApp\nen moins de 3 minutes',
      benefits: ['✅ Configuration en 3 minutes', '✅ 14 jours gratuits', '✅ Aucune carte requise'],
      cta: 'Commencer la configuration →',
    },
    industry: {
      title: 'Dans quel secteur travaillez-vous ?',
      subtitle: 'Nous choisirons les meilleures fonctionnalités\npour votre activité',
    },
    business: {
      title: 'Quel est le nom de votre canal ?',
      subtitle: 'Vos clients verront ce nom',
      name: 'Nom du canal',
      namePh: 'ex. Pizzeria Roma',
    },
    channelPersonality: {
      title: 'Personnalité du canal',
      subtitle: 'Définissez comment votre assistant AI se présente',
      botName: "Nom de l'assistant AI",
      botNamePh: 'ex. Sofia, Alex, Assistant...',
      tone: 'Ton de voix',
      tones: {
        friendly:     { label: 'Amical',         desc: 'Chaleureux, accessible, empathique',   emoji: '😊' },
        professional: { label: 'Professionnel',  desc: 'Clair, compétent, fiable',             emoji: '👔' },
        formal:       { label: 'Formel',         desc: 'Précis, autoritaire, institutionnel',  emoji: '🎩' },
        casual:       { label: 'Informel',       desc: 'Détendu, direct, conversationnel',     emoji: '😎' },
      },
    },
    workspaceType: {
      title: 'Comment utiliserez-vous eChatbot ?',
      subtitle: 'Nous configurerons les bonnes fonctionnalités pour vous',
      options: {
        ecommerce: { label: 'Je vends des produits', desc: 'Catalogue, panier et commandes en ligne' },
        info: { label: 'Je partage des informations', desc: 'Support client, FAQ et informations' },
        flow: { label: 'Custom chatbot', desc: 'Chatbot personnalisé : widget, WhatsApp, fournisseur AI et message WIP' },
      },
    },
    channelType: {
      title: 'Comment voulez-vous recevoir les messages ?',
      subtitle: 'Choisissez où votre chatbot interagira avec vos clients',
      options: {
        whatsapp: { label: 'WhatsApp seulement', desc: 'Le chatbot répond sur WhatsApp', emoji: '💬' },
        widget: { label: 'Widget web seulement', desc: 'Chat intégré dans votre site web', emoji: '🌐' },
        both: { label: 'Les deux', desc: 'WhatsApp + widget sur le site web', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Support humain',
      subtitle: "L'un des atouts d'eChatbot est le transfert intelligent du chatbot à un agent humain, sans perdre le contexte. Voulez-vous cette fonctionnalité ?",
      yes: { label: 'Oui, je veux le transfert vers un agent humain', emoji: '✅' },
      no: { label: "L'automatisation complète me convient", emoji: '🤖' },
    },
    auth: {
      title: 'Créez votre compte',
      subtitle: 'Presque terminé — inscrivez-vous pour commencer',
      fname: 'Prénom', lname: 'Nom',
      email: 'Email', pass: 'Mot de passe',
      gdpr: "J'accepte les Conditions d'utilisation et la Politique de confidentialité",
      register: 'Créer un compte', or: 'ou',
    },
    totp: {
      title: 'Sécurisez votre compte',
      setupSubtitle: 'Scannez le QR avec Google Authenticator ou Authy',
      setupInstructions: 'Ouvrir app → Ajouter compte → Scanner QR',
      verifySubtitle: "Entrez le code de votre app d'authentification",
      code: 'Code (6 chiffres)', verify: 'Vérifier et continuer',
    },
    creating: {
      title: 'Configuration en cours...',
      phasesWhatsapp: ['Création de votre workspace...', 'Configuration du canal WhatsApp...', 'Presque prêt...'],
      phasesWidget: ['Création de votre workspace...', 'Configuration du widget...', 'Presque prêt...'],
      phasesBoth: ['Création de votre workspace...', 'Configuration WhatsApp et widget...', 'Presque prêt...'],
    },
    qr: {
      title: 'Connecter WhatsApp',
      subtitle: 'WhatsApp → Appareils liés → Lier un appareil → Scanner',
      expired: 'QR expiré', newQr: 'Nouveau QR', wait: 's',
    },
    done: {
      title: 'Tout est prêt !',
      subtitleWhatsapp: 'Votre workspace est configuré et WhatsApp est connecté.',
      subtitleWidget: 'Votre workspace est configuré. Trouvez le code du widget dans les paramètres.',
      subtitleBoth: 'Votre workspace est configuré. WhatsApp connecté et widget prêt.',
      cta: 'Aller au tableau de bord',
    },
    industries: {
      retail: 'Commerce', restaurant: 'Restauration', healthcare: 'Santé',
      beauty: 'Beauté', education: 'Éducation', tourism: 'Tourisme',
      fashion: 'Mode', fitness: 'Fitness', transport: 'Transport',
      technology: 'Technologie', realestate: 'Immobilier', finance: 'Finance',
      legal: 'Juridique', other: 'Autre',
    },
    errors: {
      required: 'Champ obligatoire',
      phoneFormat: 'Utilisez le format international, ex. +33612345678',
      emailRequired: 'Email obligatoire', passwordRequired: 'Mot de passe obligatoire',
      gdprRequired: 'Vous devez accepter les conditions', invalidCode: 'Entrez 6 chiffres',
    },
  },
  ca: {
    back: 'Enrere',
    next: 'Següent',
    intro: {
      title: 'Benvingut a eChatbot',
      subtitle: "Configura el teu assistent WhatsApp\nen menys de 3 minuts",
      benefits: ['✅ Configuració en 3 minuts', '✅ 14 dies gratis', '✅ Sense targeta de crèdit'],
      cta: 'Iniciar la configuració →',
    },
    industry: {
      title: 'En quin sector treballes?',
      subtitle: 'Triarem les millors funcionalitats\nper al teu negoci',
    },
    business: {
      title: 'Com es diu el teu canal?',
      subtitle: 'Els teus clients veuran aquest nom',
      name: 'Nom del canal',
      namePh: 'ex. Pizzeria Roma',
    },
    channelPersonality: {
      title: 'Personalitat del canal',
      subtitle: 'Defineix com es presenta el teu assistent AI',
      botName: "Nom de l'assistent AI",
      botNamePh: 'ex. Sofia, Àlex, Assistent...',
      tone: 'To de veu',
      tones: {
        friendly:     { label: 'Amigable',      desc: 'Càlid, proper, empàtic',               emoji: '😊' },
        professional: { label: 'Professional',  desc: 'Clar, competent, de confiança',        emoji: '👔' },
        formal:       { label: 'Formal',        desc: 'Precís, autoritatiu, institucional',   emoji: '🎩' },
        casual:       { label: 'Informal',      desc: 'Relaxat, directe, col·loquial',        emoji: '😎' },
      },
    },
    workspaceType: {
      title: 'Com faràs servir eChatbot?',
      subtitle: 'Configurarem les funcionalitats adequades per a tu',
      options: {
        ecommerce: { label: 'Venc productes', desc: 'Catàleg, cistella i comandes en línia' },
        info: { label: 'Comparteixo informació', desc: 'Suport al client, FAQ i informació' },
        flow: { label: 'Custom chatbot', desc: 'Chatbot personalitzat: widget, WhatsApp, proveïdor AI i missatge WIP' },
      },
    },
    channelType: {
      title: 'Com vols rebre missatges?',
      subtitle: 'Tria on el chatbot interactuarà amb els teus clients',
      options: {
        whatsapp: { label: 'Només WhatsApp', desc: 'El chatbot respon a WhatsApp', emoji: '💬' },
        widget: { label: 'Només widget web', desc: 'Xat integrat al teu lloc web', emoji: '🌐' },
        both: { label: 'Tots dos', desc: 'WhatsApp + widget al lloc web', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Suport humà',
      subtitle: "Un dels punts forts d'eChatbot és el traspàs intel·ligent del chatbot a un agent humà, sense perdre el context. Vols aquesta funcionalitat integrada?",
      yes: { label: 'Sí, vull el traspàs a agent humà', emoji: '✅' },
      no: { label: "L'automatització completa em va bé", emoji: '🤖' },
    },
    auth: {
      title: 'Crea el teu compte',
      subtitle: 'Gairebé llest — registra\'t per començar',
      fname: 'Nom', lname: 'Cognoms',
      email: 'Correu electrònic', pass: 'Contrasenya',
      gdpr: 'Accepto els Termes de Servei i la Política de Privacitat',
      register: 'Crear compte', or: 'o',
    },
    totp: {
      title: 'Protegeix el teu compte',
      setupSubtitle: 'Escaneja el QR amb Google Authenticator o Authy',
      setupInstructions: 'Obrir app → Afegir compte → Escanejar QR',
      verifySubtitle: "Introdueix el codi de la teva app d'autenticació",
      code: 'Codi (6 xifres)', verify: 'Verificar i continuar',
    },
    creating: {
      title: 'Configurant-ho tot...',
      phasesWhatsapp: ['Creant el teu workspace...', 'Configurant el canal WhatsApp...', 'Gairebé llest...'],
      phasesWidget: ['Creant el teu workspace...', 'Configurant el widget...', 'Gairebé llest...'],
      phasesBoth: ['Creant el teu workspace...', 'Configurant WhatsApp i widget...', 'Gairebé llest...'],
    },
    qr: {
      title: 'Connectar WhatsApp',
      subtitle: 'WhatsApp → Dispositius vinculats → Vincular dispositiu → Escanejar',
      expired: 'QR caducat', newQr: 'Nou QR', wait: 's',
    },
    done: {
      title: 'Tot llest!',
      subtitleWhatsapp: 'El teu workspace està configurat i WhatsApp està connectat.',
      subtitleWidget: 'El teu workspace està configurat. Troba el codi del widget als ajustos.',
      subtitleBoth: 'El teu workspace està configurat. WhatsApp connectat i widget llest.',
      cta: 'Anar al tauler',
    },
    industries: {
      retail: 'Comerç', restaurant: 'Restauració', healthcare: 'Salut',
      beauty: 'Bellesa', education: 'Educació', tourism: 'Turisme',
      fashion: 'Moda', fitness: 'Fitness', transport: 'Transport',
      technology: 'Tecnologia', realestate: 'Immobiliària', finance: 'Finances',
      legal: 'Jurídic', other: 'Altre',
    },
    errors: {
      required: 'Camp obligatori',
      phoneFormat: 'Usa el format internacional, ex. +34612345678',
      emailRequired: 'Correu electrònic obligatori', passwordRequired: 'Contrasenya obligatòria',
      gdprRequired: 'Has d\'acceptar els termes', invalidCode: 'Introdueix 6 xifres',
    },
  },
} as const

export type OWTLang = keyof typeof OWT
