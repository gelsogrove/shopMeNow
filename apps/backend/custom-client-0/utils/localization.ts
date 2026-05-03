// Localised strings for system-generated questions and deterministic replies.
//
// PRINCIPLE: every string the bot can possibly send to the customer is keyed
// here, with a translation per supported language. Code calls `t(key, lang)`
// instead of inlining text. Adding a language = adding a column.
//
// IMPORTANT: keep all keys synchronised across languages. If a translation is
// missing, the helper falls back to Spanish (the project's base language).

import type { SessionState } from './state.js'

type Lang = SessionState['language']

const TRANSLATIONS = {
  // ── Location gathering ─────────────────────────────────────────────────────
  location: {
    es: '¿Dónde está la lavandería?',
    it: 'Dove si trova la lavanderia?',
    ca: 'On està la bugaderia?',
    en: 'Where is the laundry?',
    pt: 'Onde está a lavandaria?',
    fr: 'Où se trouve la laverie ?',
  },
  locationClarification: {
    es: 'Perdona, ¿me puedes decir dónde está la lavandería?',
    it: 'Scusa, mi puoi dire dove si trova la lavanderia?',
    ca: 'Disculpa, em pots dir on està la bugaderia?',
    en: 'Sorry, can you tell me where the laundry is?',
    pt: 'Desculpa, podes dizer-me onde está a lavandaria?',
    fr: 'Excuse-moi, peux-tu me dire où se trouve la laverie ?',
  },
  locationInsist: {
    es: 'Necesito saber dónde estás para poder ayudarte. ¿Dónde está la lavandería?',
    it: 'Ho bisogno di sapere dove sei per poterti aiutare. Dove si trova la lavanderia?',
    ca: 'Necessito saber on estàs per poder ajudar-te. On està la bugaderia?',
    en: 'I need to know where you are to help. Where is the laundry?',
    pt: 'Preciso de saber onde estás para te poder ajudar. Onde está a lavandaria?',
    fr: 'J\'ai besoin de savoir où tu es pour pouvoir t\'aider. Où se trouve la laverie ?',
  },
  mataroStreet: {
    es: '¿En qué calle de Mataró está la lavandería?',
    it: 'In quale via di Mataró si trova la lavanderia?',
    ca: 'A quin carrer de Mataró està la bugaderia?',
    en: 'On which street in Mataró is the laundry?',
    pt: 'Em que rua de Mataró está a lavandaria?',
    fr: 'Dans quelle rue de Mataró se trouve la laverie ?',
  },

  // ── Machine identification ─────────────────────────────────────────────────
  machineType: {
    es: '¿Es una lavadora o una secadora?',
    it: 'È una lavatrice o un\'asciugatrice?',
    ca: 'És una rentadora o una assecadora?',
    en: 'Is it a washer or a dryer?',
    pt: 'É uma máquina de lavar ou de secar?',
    fr: 'Est-ce un lave-linge ou un sèche-linge ?',
  },
  machineNumberWasher: {
    es: '¿Cuál es el número de la lavadora?',
    it: 'Qual è il numero della lavatrice?',
    ca: 'Quin és el número de la rentadora?',
    en: 'What is the washer number?',
    pt: 'Qual é o número da máquina de lavar?',
    fr: 'Quel est le numéro du lave-linge ?',
  },
  machineNumberDryer: {
    es: '¿Cuál es el número de la secadora?',
    it: 'Qual è il numero dell\'asciugatrice?',
    ca: 'Quin és el número de l\'assecadora?',
    en: 'What is the dryer number?',
    pt: 'Qual é o número da máquina de secar?',
    fr: 'Quel est le numéro du sèche-linge ?',
  },

  // ── Display state ──────────────────────────────────────────────────────────
  displayWasher: {
    es: '¿Qué aparece exactamente en la pantalla de la lavadora?',
    it: 'Cosa appare esattamente sullo schermo della lavatrice?',
    ca: 'Què apareix exactament a la pantalla de la rentadora?',
    en: 'What exactly appears on the washer screen?',
    pt: 'O que aparece exatamente no ecrã da máquina de lavar?',
    fr: 'Qu\'apparaît-il exactement sur l\'écran du lave-linge ?',
  },
  displayDryer: {
    es: '¿Qué aparece exactamente en la pantalla de la secadora?',
    it: 'Cosa appare esattamente sullo schermo dell\'asciugatrice?',
    ca: 'Què apareix exactament a la pantalla de l\'assecadora?',
    en: 'What exactly appears on the dryer screen?',
    pt: 'O que aparece exatamente no ecrã da máquina de secar?',
    fr: 'Qu\'apparaît-il exactement sur l\'écran du sèche-linge ?',
  },
  displayMachine: {
    es: '¿Qué aparece exactamente en la pantalla de la máquina? Si no aparece nada, dímelo así lo sabemos.',
    it: 'Cosa appare esattamente sullo schermo della macchina? Se non appare nulla, dimmelo così lo sappiamo.',
    ca: 'Què apareix exactament a la pantalla de la màquina? Si no apareix res, digues-m\'ho així ho sabem.',
    en: 'What exactly appears on the machine screen? If nothing shows up, just tell me so we know.',
    pt: 'O que aparece exatamente no ecrã da máquina? Se não aparecer nada, diz-me assim sabemos.',
    fr: 'Qu\'apparaît-il exactement sur l\'écran de la machine ? Si rien ne s\'affiche, dis-le moi.',
  },

  // ── Payment / central ──────────────────────────────────────────────────────
  centralReturnedChange: {
    es: '¿La central ha devuelto el cambio?',
    it: 'La centralina ha restituito il resto?',
    ca: 'La central ha tornat el canvi?',
    en: 'Did the central return your change?',
    pt: 'A central devolveu o troco?',
    fr: 'La centrale a-t-elle rendu la monnaie ?',
  },
  centralRetryAfterReview: {
    es: 'Es posible que se haya marcado mal el número de máquina. Revisa, por favor, el saldo en la central y prueba otra vez con el número correcto. Dime si la máquina ya se ha activado.',
    it: 'È possibile che sia stato selezionato male il numero della macchina. Controlla, per favore, il saldo nella centralina e riprova con il numero corretto. Dimmi se la macchina si è attivata.',
    ca: 'És possible que s\'hagi marcat malament el número de màquina. Revisa, si us plau, el saldo a la central i prova-ho un altre cop amb el número correcte. Digue\'m si la màquina ja s\'ha activat.',
    en: 'You may have entered the wrong machine number. Please check the balance on the central and try again with the correct number. Tell me if the machine has now activated.',
    pt: 'Pode ter selecionado mal o número da máquina. Por favor, verifica o saldo na central e tenta de novo com o número correto. Diz-me se a máquina já se ativou.',
    fr: 'Tu as peut-être saisi le mauvais numéro de machine. Vérifie le solde sur la centrale et réessaie avec le bon numéro. Dis-moi si la machine s\'est activée.',
  },

  // ── Closure ────────────────────────────────────────────────────────────────
  resolvedWasher: {
    es: '✅ Perfecto. La lavadora ha comenzado correctamente.',
    it: '✅ Perfetto. La lavatrice è partita correttamente.',
    ca: '✅ Perfecte. La rentadora ha començat correctament.',
    en: '✅ Perfect. The washer has started correctly.',
    pt: '✅ Perfeito. A máquina de lavar começou corretamente.',
    fr: '✅ Parfait. Le lave-linge a démarré correctement.',
  },
  resolvedMachine: {
    es: '✅ Perfecto. La máquina ha arrancado correctamente.',
    it: '✅ Perfetto. La macchina è partita correttamente.',
    ca: '✅ Perfecte. La màquina ha arrencat correctament.',
    en: '✅ Perfect. The machine has started correctly.',
    pt: '✅ Perfeito. A máquina arrancou corretamente.',
    fr: '✅ Parfait. La machine a démarré correctement.',
  },

  // ── Empathy / pacing ───────────────────────────────────────────────────────
  empathyAngry: {
    es: 'Entendido, lamento la situación y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?',
    it: 'Capisco, mi dispiace per la situazione e voglio aiutarti. Lo controlleremo al più presto. In quale lavanderia sei?',
    ca: 'Entès, lamento la situació i vull ajudar-te. Ho revisarem com més aviat millor. A quina bugaderia ets?',
    en: 'Understood, I\'m sorry for the situation and I want to help. We\'ll look into it as soon as possible. Which laundry are you at?',
    pt: 'Entendido, lamento a situação e quero ajudar-te. Vamos verificar o mais rápido possível. Em que lavandaria estás?',
    fr: 'Compris, je suis désolé de la situation et je veux t\'aider. Nous allons vérifier au plus vite. Dans quelle laverie es-tu ?',
  },
  mixedIncidentSlowDown: {
    es: 'Entiendo, vamos paso a paso para ayudarte. ¿En qué lavandería estás?',
    it: 'Capisco, andiamo passo dopo passo per aiutarti. In quale lavanderia sei?',
    ca: 'Entenc, anem pas a pas per ajudar-te. A quina bugaderia ets?',
    en: 'I understand, let\'s go step by step to help you. Which laundry are you at?',
    pt: 'Entendo, vamos passo a passo para ajudar-te. Em que lavandaria estás?',
    fr: 'Je comprends, allons étape par étape pour t\'aider. Dans quelle laverie es-tu ?',
  },

  // ── Escalation paths ───────────────────────────────────────────────────────
  reassurance: {
    es: '⚠️ Vamos a revisar tu caso manualmente.',
    it: '⚠️ Controlleremo il tuo caso manualmente.',
    ca: '⚠️ Revisarem el teu cas manualment.',
    en: '⚠️ We will review your case manually.',
    pt: '⚠️ Vamos rever o teu caso manualmente.',
    fr: '⚠️ Nous allons examiner ton cas manuellement.',
  },
  doubleChargeReview: {
    es: '⚠️ Necesitamos derivar tu caso a un operador para revisarlo.',
    it: '⚠️ Dobbiamo passare il tuo caso a un operatore per controllarlo.',
    ca: '⚠️ Hem de derivar el teu cas a un operador per revisar-lo.',
    en: '⚠️ We need to escalate your case to an operator for review.',
    pt: '⚠️ Precisamos de encaminhar o teu caso a um operador para revisão.',
    fr: '⚠️ Nous devons transférer ton cas à un opérateur pour examen.',
  },
  doubleChargeAllReceived: {
    es: 'Hemos recibido toda la información necesaria, vamos a revisar tu caso.',
    it: 'Abbiamo ricevuto tutte le informazioni necessarie, controlleremo il tuo caso.',
    ca: 'Hem rebut tota la informació necessària, revisarem el teu cas.',
    en: 'We have received all the information we need, we will review your case.',
    pt: 'Recebemos todas as informações necessárias, vamos rever o teu caso.',
    fr: 'Nous avons reçu toutes les informations nécessaires, nous allons examiner ton cas.',
  },
  photoRequest: {
    es: '¿Puedes mandarme una foto de la pantalla de la máquina? Si no es posible, lo derivamos a un operador.',
    it: 'Puoi mandarmi una foto dello schermo della macchina? Se non è possibile, lo passiamo a un operatore.',
    ca: 'Pots enviar-me una foto de la pantalla de la màquina? Si no és possible, ho derivem a un operador.',
    en: 'Can you send me a photo of the machine screen? If not possible, we\'ll escalate to an operator.',
    pt: 'Podes enviar-me uma foto do ecrã da máquina? Se não for possível, encaminhamos para um operador.',
    fr: 'Peux-tu m\'envoyer une photo de l\'écran de la machine ? Si ce n\'est pas possible, nous transférons à un opérateur.',
  },
  noPhotoEscalate: {
    es: '⚠️ Sin información del display ni foto, vamos a revisar tu caso manualmente.',
    it: '⚠️ Senza informazioni sul display né foto, controlleremo il tuo caso manualmente.',
    ca: '⚠️ Sense informació del display ni foto, revisarem el teu cas manualment.',
    en: '⚠️ Without display info or photo, we\'ll review your case manually.',
    pt: '⚠️ Sem informações do ecrã nem foto, vamos rever o teu caso manualmente.',
    fr: '⚠️ Sans information de l\'écran ni photo, nous examinerons ton cas manuellement.',
  },
  reaffirmEscalate: {
    es: 'Vamos a revisar tu caso manualmente. ¿Cómo te llamas?',
    it: 'Controlleremo il tuo caso manualmente. Come ti chiami?',
    ca: 'Revisarem el teu cas manualment. Com et dius?',
    en: 'We will review your case manually. What is your name?',
    pt: 'Vamos rever o teu caso manualmente. Como te chamas?',
    fr: 'Nous allons examiner ton cas manuellement. Comment t\'appelles-tu ?',
  },

  // ── Display question (generic, no "if nothing shows up") ───────────────────
  displayShort: {
    es: '¿Qué aparece exactamente en la pantalla?',
    it: 'Cosa appare esattamente sullo schermo?',
    ca: 'Què apareix exactament a la pantalla?',
    en: 'What exactly appears on the screen?',
    pt: 'O que aparece exatamente no ecrã?',
    fr: 'Qu\'apparaît-il exactement sur l\'écran ?',
  },

  // ── Caso 18 — codice solo numerico ─────────────────────────────────────────
  numericCodeAskLetters: {
    es: 'Gracias. ¿Ves alguna letra delante de los números?',
    it: 'Grazie. Vedi qualche lettera davanti ai numeri?',
    ca: 'Gràcies. Veus alguna lletra davant dels números?',
    en: 'Thanks. Do you see any letter before the numbers?',
    pt: 'Obrigado. Vês alguma letra à frente dos números?',
    fr: 'Merci. Vois-tu une lettre devant les chiffres ?',
  },
  numericCodeIncoherence: {
    es: 'De acuerdo. Hay una información que necesitamos revisar manualmente antes de continuar.',
    it: 'Va bene. C\'è un\'informazione che dobbiamo verificare manualmente prima di continuare.',
    ca: 'D\'acord. Hi ha una informació que necessitem revisar manualment abans de continuar.',
    en: 'Got it. There\'s some information we need to review manually before continuing.',
    pt: 'De acordo. Há uma informação que precisamos rever manualmente antes de continuar.',
    fr: 'D\'accord. Il y a une information que nous devons vérifier manuellement avant de continuer.',
  },

  // ── Caso 14 — ALM DOOR ─────────────────────────────────────────────────────
  caso14AlmDoor: {
    es: 'Ese mensaje puede indicar un problema de cierre o que hay alguna prenda atrapada. Abre la puerta con cuidado, revisa si hay alguna prenda atrapada y vuelve a cerrarla bien. Dime, por favor, si el mensaje ha desaparecido.',
    it: 'Questo messaggio può indicare un problema di chiusura o un capo incastrato. Apri lo sportello con attenzione, controlla se c\'è qualche capo incastrato e richiudilo bene. Dimmi, per favore, se il messaggio è sparito.',
    ca: 'Aquest missatge pot indicar un problema de tancament o que hi ha alguna peça atrapada. Obre la porta amb compte, revisa si hi ha alguna peça atrapada i torna a tancar-la bé. Digue\'m, si us plau, si el missatge ha desaparegut.',
    en: 'That message may indicate a closing issue or a garment caught in the door. Carefully open the door, check for any caught garment and close it firmly again. Please tell me if the message has disappeared.',
    pt: 'Essa mensagem pode indicar um problema de fecho ou que há uma peça presa. Abre a porta com cuidado, verifica se há alguma peça presa e fecha-a bem. Diz-me, por favor, se a mensagem desapareceu.',
    fr: 'Ce message peut indiquer un problème de fermeture ou un vêtement coincé. Ouvre la porte avec précaution, vérifie s\'il y a un vêtement coincé et referme-la bien. Dis-moi, s\'il te plaît, si le message a disparu.',
  },

  // ── Caso 17 — cliente non sa qué pone en pantalla ──────────────────────────
  caso17AskPhoto: {
    es: 'Si puedes, envíame una foto de la pantalla. Si no, lo pasamos a revisión.',
    it: 'Se puoi, mandami una foto dello schermo. Se no, lo passiamo a revisione.',
    ca: 'Si pots, envia\'m una foto de la pantalla. Si no, ho passem a revisió.',
    en: 'If you can, send me a photo of the screen. If not, we\'ll pass it to review.',
    pt: 'Se puderes, envia-me uma foto do ecrã. Senão, passamos para revisão.',
    fr: 'Si tu peux, envoie-moi une photo de l\'écran. Sinon, nous le passons en révision.',
  },
  caso17NoPhotoEscalate: {
    es: 'De acuerdo. Vamos a revisarlo manualmente para poder ayudarte.',
    it: 'D\'accordo. Lo controlleremo manualmente per poterti aiutare.',
    ca: 'D\'acord. Ho revisarem manualment per poder ajudar-te.',
    en: 'Got it. We\'ll review it manually to help you.',
    pt: 'De acordo. Vamos rever manualmente para te ajudar.',
    fr: 'D\'accord. Nous allons le vérifier manuellement pour t\'aider.',
  },

  // ── Caso 6 — doble cobro flow ──────────────────────────────────────────────
  caso6AskPodidoLavar: {
    es: 'Gracias. ¿Has podido lavar o secar la ropa?',
    it: 'Grazie. Sei riuscito a lavare o asciugare i vestiti?',
    ca: 'Gràcies. Has pogut rentar o assecar la roba?',
    en: 'Thanks. Were you able to wash or dry the clothes?',
    pt: 'Obrigado. Conseguiste lavar ou secar a roupa?',
    fr: 'Merci. As-tu pu laver ou sécher le linge ?',
  },
  caso6AskRelato: {
    es: 'De acuerdo. Explícame, por favor, paso a paso qué has hecho desde que has entrado.',
    it: 'D\'accordo. Spiegami, per favore, passo dopo passo cosa hai fatto da quando sei entrato.',
    ca: 'D\'acord. Explica\'m, si us plau, pas a pas què has fet des que has entrat.',
    en: 'Got it. Please explain step by step what you have done since you came in.',
    pt: 'De acordo. Explica-me, por favor, passo a passo o que fizeste desde que entraste.',
    fr: 'D\'accord. Explique-moi, s\'il te plaît, étape par étape ce que tu as fait depuis ton arrivée.',
  },
  caso6Ask4Digitos: {
    es: 'Gracias. Para revisarlo bien, necesito los últimos 4 dígitos de la tarjeta.',
    it: 'Grazie. Per controllarlo bene, mi servono le ultime 4 cifre della carta.',
    ca: 'Gràcies. Per revisar-ho bé, necessito els últims 4 dígits de la targeta.',
    en: 'Thanks. To review it properly, I need the last 4 digits of the card.',
    pt: 'Obrigado. Para rever bem, preciso dos últimos 4 dígitos do cartão.',
    fr: 'Merci. Pour bien vérifier, j\'ai besoin des 4 derniers chiffres de la carte.',
  },
  caso6AskCaptura: {
    es: 'Perfecto. Ahora necesito una captura del pago.',
    it: 'Perfetto. Ora mi serve uno screenshot del pagamento.',
    ca: 'Perfecte. Ara necessito una captura del pagament.',
    en: 'Perfect. Now I need a screenshot of the payment.',
    pt: 'Perfeito. Agora preciso de uma captura do pagamento.',
    fr: 'Parfait. Maintenant j\'ai besoin d\'une capture du paiement.',
  },
  caso6Closure: {
    es: 'Gracias. Con esos datos podremos revisarlo y enviarte el formulario de devolución. La próxima vez, antes de volver a pagar, contacta con nosotros y te ayudaremos al momento.',
    it: 'Grazie. Con quei dati potremo controllarlo e inviarti il modulo di rimborso. La prossima volta, prima di pagare di nuovo, contattaci e ti aiuteremo subito.',
    ca: 'Gràcies. Amb aquestes dades podrem revisar-ho i enviar-te el formulari de devolució. La pròxima vegada, abans de tornar a pagar, contacta\'ns i t\'ajudarem al moment.',
    en: 'Thanks. With that data we will review it and send you the refund form. Next time, before paying again, contact us and we will help you right away.',
    pt: 'Obrigado. Com esses dados poderemos rever e enviar-te o formulário de devolução. Da próxima vez, antes de voltar a pagar, contacta-nos e ajudamos-te logo.',
    fr: 'Merci. Avec ces données nous allons vérifier et t\'envoyer le formulaire de remboursement. La prochaine fois, avant de repayer, contacte-nous et nous t\'aiderons tout de suite.',
  },

  // ── Customer name handover ─────────────────────────────────────────────────
  customerNameAsk: {
    es: '¿Cómo te llamas?',
    it: 'Come ti chiami?',
    ca: 'Com et dius?',
    en: 'What is your name?',
    pt: 'Como te chamas?',
    fr: "Comment t'appelles-tu ?",
  },

  // ── Unknown display code escalation ────────────────────────────────────────
  // Note: contains the {display} placeholder. Use tt(key, lang, { display })
  // to substitute it.
  unknownDisplayEscalate: {
    es: 'El código {display} requiere revisión manual. Pasaremos tu caso a revisión para ayudarte de la manera más adecuada.',
    it: 'Il codice {display} richiede una revisione manuale. Passeremo il tuo caso in revisione per aiutarti al meglio.',
    ca: 'El codi {display} requereix revisió manual. Passarem el teu cas a revisió per ajudar-te de la millor manera.',
    en: 'Code {display} requires manual review. We\'ll pass your case for review to help you properly.',
    pt: 'O código {display} requer revisão manual. Vamos passar o teu caso para revisão para te ajudar da melhor forma.',
    fr: 'Le code {display} nécessite une révision manuelle. Nous transmettrons ton cas en révision pour t\'aider au mieux.',
  },

  // ── Caso 25 cliente enfadado: empatia + chiede location ───────────────────
  caso25Empathic: {
    es: 'Entiendo tu malestar y quiero ayudarte. Vamos a revisarlo lo antes posible. ¿En qué lavandería estás?',
    it: 'Capisco il tuo disagio e voglio aiutarti. Lo verifichiamo il prima possibile. In quale lavanderia ti trovi?',
    ca: 'Entenc el teu malestar i vull ajudar-te. Ho revisarem com més aviat millor. A quina bugaderia ets?',
    en: 'I understand your frustration and want to help. We will review it as soon as possible. Which laundry are you at?',
    pt: 'Entendo o teu desconforto e quero ajudar-te. Vamos rever o quanto antes. Em que lavandaria estás?',
    fr: 'Je comprends ton mécontentement et je veux t\'aider. Nous allons vérifier dès que possible. Dans quelle laverie es-tu ?',
  },

  // ── Caso 26 cliente esige devolución: raccogliere dati senza promettere ────
  caso26AskRefundData: {
    es: 'Vamos a revisarlo contigo. Para tramitarlo, necesito los últimos 4 dígitos de la tarjeta, una captura del pago y un breve resumen de lo ocurrido.',
    it: 'Lo verifichiamo insieme. Per gestirlo, ho bisogno delle ultime 4 cifre della carta, una schermata del pagamento e un breve riassunto.',
    ca: 'Ho revisarem amb tu. Per tramitar-ho, necessito els últims 4 dígits de la targeta, una captura del pagament i un breu resum.',
    en: 'We\'ll review it with you. To process it, I need the last 4 digits of the card, a screenshot of the payment, and a brief summary.',
    pt: 'Vamos rever contigo. Para tratar disso, preciso dos últimos 4 dígitos do cartão, uma captura do pagamento e um breve resumo.',
    fr: 'Nous allons le vérifier avec toi. Pour le traiter, j\'ai besoin des 4 derniers chiffres de la carte, d\'une capture du paiement et d\'un bref résumé.',
  },

  // ── Caso 26 cliente insiste con devolución: escalare senza prometterla ─────
  caso26EscalateNoPromise: {
    es: 'Entiendo lo que me indicas. Vamos a pasar el caso a revisión para aplicar la solución más adecuada.',
    it: 'Capisco quello che mi dici. Passeremo il caso in revisione per trovare la soluzione più adatta.',
    ca: 'Entenc el que em dius. Passarem el cas a revisió per aplicar la solució més adequada.',
    en: 'I understand. We will pass the case for review to apply the most appropriate solution.',
    pt: 'Entendo o que me dizes. Vamos passar o caso para revisão para aplicar a solução mais adequada.',
    fr: 'Je comprends ce que tu me dis. Nous allons transmettre le cas en révision pour appliquer la solution la plus appropriée.',
  },

  // ── Caso 31 cliente non sa il local: insistere ─────────────────────────────
  caso31InsistLocation: {
    es: 'Para poder ayudarte, necesito saber primero en qué lavandería estás exactamente.',
    it: 'Per poterti aiutare, devo sapere prima in quale lavanderia ti trovi esattamente.',
    ca: 'Per poder ajudar-te, necessito saber primer a quina bugaderia ets exactament.',
    en: 'To help you, I first need to know exactly which laundry you are at.',
    pt: 'Para te poder ajudar, preciso de saber primeiro em que lavandaria estás exatamente.',
    fr: 'Pour pouvoir t\'aider, j\'ai besoin de savoir d\'abord dans quelle laverie tu te trouves exactement.',
  },

  // ── Caso 5 AL001 cause-tracking ────────────────────────────────────────────
  caso5Al001AskBefore: {
    es: 'De acuerdo. Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. ¿Qué has hecho justo antes de que apareciera el mensaje?',
    it: 'Va bene. Questo avviso compare di solito quando il processo non è stato fatto nell\'ordine giusto. Cosa hai fatto subito prima che apparisse il messaggio?',
    ca: 'D\'acord. Aquest avís sol aparèixer quan el procés no s\'ha fet en l\'ordre correcte. Què has fet just abans que aparegués el missatge?',
    en: 'Got it. This notice usually appears when the process was not done in the correct order. What did you do just before the message appeared?',
    pt: 'De acordo. Este aviso costuma aparecer quando o processo não foi feito na ordem correta. O que fizeste mesmo antes de aparecer a mensagem?',
    fr: 'D\'accord. Cet avis apparaît généralement quand le processus n\'a pas été fait dans le bon ordre. Qu\'as-tu fait juste avant que le message apparaisse ?',
  },

  // ── Misc ───────────────────────────────────────────────────────────────────
  defaultHelp: {
    es: 'Dime el siguiente detalle útil y te ayudaré paso a paso.',
    it: 'Dimmi il prossimo dettaglio utile e ti aiuterò passo dopo passo.',
    ca: 'Digue\'m el següent detall útil i t\'ajudaré pas a pas.',
    en: 'Tell me the next useful detail and I\'ll help step by step.',
    pt: 'Diz-me o próximo detalhe útil e ajudo-te passo a passo.',
    fr: 'Dis-moi le détail utile suivant et je t\'aiderai pas à pas.',
  },
} as const

export type TranslationKey = keyof typeof TRANSLATIONS

/** Pick the localised string for the customer's current language. Falls back to Spanish. */
export function t(key: TranslationKey, lang: Lang | undefined): string {
  const entry = TRANSLATIONS[key]
  if (!entry) return ''
  const resolved = (lang && entry[lang as keyof typeof entry]) || entry.es
  return resolved
}

/** Same as t() but interpolates {placeholder} occurrences with the provided values. */
export function tt(
  key: TranslationKey,
  lang: Lang | undefined,
  vars: Record<string, string | number> = {},
): string {
  const text = t(key, lang)
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    text,
  )
}

// Backwards-compat alias used by older code paths.
export const QUESTIONS = {
  location: TRANSLATIONS.location.es,
  locationClarification: TRANSLATIONS.locationClarification.es,
  machineType: TRANSLATIONS.machineType.es,
  machineNumberWasher: TRANSLATIONS.machineNumberWasher.es,
  machineNumberDryer: TRANSLATIONS.machineNumberDryer.es,
  payment: '¿Has pagado?',
  dryerStarted: '¿La secadora arrancó?',
  dryerCycleContext:
    '¿Es el primer secado de esta ropa o añadiste minutos a un ciclo que ya estaba en marcha?',
  serviceCompleted: '¿Pudiste completar el lavado o secado?',
  doubleChargeNarrative:
    'Explícame, por favor, paso a paso qué has hecho desde que has entrado.',
  last4Digits: '¿Cuáles son los últimos 4 dígitos de la tarjeta con la que pagaste?',
  paymentProof: '¿Tienes una captura de pantalla del pago o comprobante?',
  displayWasher: TRANSLATIONS.displayWasher.es,
  displayDryer: TRANSLATIONS.displayDryer.es,
  defaultHelp: TRANSLATIONS.defaultHelp.es,
} as const
