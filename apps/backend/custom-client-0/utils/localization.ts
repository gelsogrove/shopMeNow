// Localised strings for system-generated questions and deterministic replies.
//
// PRINCIPLE: every string the bot can possibly send to the customer is keyed
// here, with a translation per supported language. Code calls `t(key, lang)`
// instead of inlining text. Adding a language = adding a column.
//
// IMPORTANT: keep all keys synchronised across languages. If a translation is
// missing, the helper falls back to Spanish (the project's base language).

import type { SessionState } from '../models/index.js'

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
    es: 'En Mataró tenemos dos lavanderías: C/ Francisco de Goya 117 y C/ Alemanya 17. ¿En cuál estás?',
    it: 'A Mataró abbiamo due lavanderie: C/ Francisco de Goya 117 e C/ Alemanya 17. In quale ti trovi?',
    ca: 'A Mataró tenim dues bugaderies: C/ Francisco de Goya 117 i C/ Alemanya 17. A quina estàs?',
    en: 'We have two laundromats in Mataró: C/ Francisco de Goya 117 and C/ Alemanya 17. Which one are you at?',
    pt: 'Em Mataró temos duas lavandarias: C/ Francisco de Goya 117 e C/ Alemanya 17. Em qual estás?',
    fr: 'À Mataró, nous avons deux laveries : C/ Francisco de Goya 117 et C/ Alemanya 17. Dans laquelle es-tu ?',
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
  paymentAsk: {
    es: '¿Has podido realizar el pago?',
    it: 'Sei riuscito a effettuare il pagamento?',
    ca: 'Has pogut fer el pagament?',
    en: 'Were you able to make the payment?',
    pt: 'Conseguiste efetuar o pagamento?',
    fr: 'As-tu pu effectuer le paiement ?',
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
    es: 'Entendido. Lo paso a revisión manual.',
    it: 'Capito. Lo passo a una revisione manuale.',
    ca: 'Entès. Ho passo a revisió manual.',
    en: 'Got it. I\'m passing this to a manual review.',
    pt: 'Entendido. Passo isto para revisão manual.',
    fr: 'Entendu. Je le transmets en révision manuelle.',
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

  // ── Caso 15 cliente vede 001 in pantalla (step 1 spiegazione, step 2 escalation) ──
  caso15Explain: {
    es: 'De acuerdo. Ese mensaje puede aparecer cuando el programa se ha seleccionado antes del pago y el estado no se ha reiniciado correctamente.',
    it: 'Va bene. Questo messaggio può apparire quando il programma è stato selezionato prima del pagamento e lo stato non si è reimpostato correttamente.',
    ca: 'D\'acord. Aquest missatge pot aparèixer quan el programa s\'ha seleccionat abans del pagament i l\'estat no s\'ha reiniciat correctament.',
    en: 'Got it. This message can appear when the program was selected before payment and the state didn\'t reset properly.',
    pt: 'De acordo. Esta mensagem pode aparecer quando o programa foi selecionado antes do pagamento e o estado não se reiniciou corretamente.',
    fr: 'D\'accord. Ce message peut apparaître quand le programme a été sélectionné avant le paiement et l\'état ne s\'est pas réinitialisé correctement.',
  },
  caso15Escalate: {
    es: 'Vamos a revisarlo manualmente para ayudarte de la mejor manera posible.',
    it: 'Verifichiamo manualmente per aiutarti al meglio.',
    ca: 'Ho revisarem manualment per ajudar-te de la millor manera possible.',
    en: 'We\'ll review it manually to help you in the best way possible.',
    pt: 'Vamos rever manualmente para te ajudar da melhor forma possível.',
    fr: 'Nous allons le vérifier manuellement pour t\'aider au mieux.',
  },

  // ── Caso 8 cliente ha codice ma non sa come usarlo ─────────────────────────
  caso8AskCode: {
    es: 'Te ayudo. Dime el código exacto tal como lo ves, incluyendo letras si las hay.',
    it: 'Ti aiuto. Dimmi il codice esatto come lo vedi, comprese le lettere se ci sono.',
    ca: 'T\'ajudo. Digue\'m el codi exacte tal com el veus, incloent les lletres si n\'hi ha.',
    en: 'I\'ll help you. Tell me the exact code as you see it, including any letters.',
    pt: 'Ajudo-te. Diz-me o código exato tal como o vês, incluindo letras se as houver.',
    fr: 'Je t\'aide. Dis-moi le code exact tel que tu le vois, lettres comprises s\'il y en a.',
  },
  caso8AskAmount: {
    es: 'Perfecto. ¿Te falta una pequeña parte para completar el importe o el código cubre un importe mayor?',
    it: 'Perfetto. Ti manca una piccola parte per completare l\'importo o il codice copre un importo maggiore?',
    ca: 'Perfecte. Et falta una petita part per completar l\'import o el codi cobreix un import més gran?',
    en: 'Got it. Do you need to add a small amount to complete the price, or does the code cover a larger amount?',
    pt: 'Perfeito. Falta-te uma pequena parte para completar o valor ou o código cobre um valor maior?',
    fr: 'Parfait. Il te manque une petite partie pour compléter le montant ou le code couvre-t-il un montant plus grand ?',
  },
  caso8Instruction: {
    es: 'De acuerdo. Introduce en la central el importe que falta y no toques nada más. Después ponte delante de la máquina y dime si ya puedes continuar.',
    it: 'Va bene. Inserisci nella centralina l\'importo che manca e non toccare altro. Poi mettiti davanti alla macchina e dimmi se puoi continuare.',
    ca: 'D\'acord. Introdueix a la central l\'import que falta i no toquis res més. Després posa\'t davant de la màquina i digue\'m si ja pots continuar.',
    en: 'Got it. Add the missing amount on the central unit and don\'t touch anything else. Then go to the machine and tell me if you can continue.',
    pt: 'De acordo. Introduz na central o valor em falta e não toques em mais nada. Depois vai à máquina e diz-me se já podes continuar.',
    fr: 'D\'accord. Saisis sur la centrale le montant manquant et ne touche rien d\'autre. Puis va à la machine et dis-moi si tu peux continuer.',
  },
  caso5GuideRetry: {
    es: 'Ese aviso suele aparecer cuando el proceso no se ha hecho en el orden correcto. Antes de avisar a asistencia, vamos a verificar juntos la secuencia. Por favor sigue estos pasos en este orden:\n\n1. Carga la lavadora\n2. Cierra la puerta\n3. Dirígete a la central de pago y paga\n4. Selecciona el número de máquina y recoge el cambio si toca\n5. Dirígete a la máquina seleccionada y elige el programa\n6. Avísame si funciona',
    it: 'Questo avviso di solito appare quando il processo non è stato fatto nell\'ordine corretto. Prima di avvisare l\'assistenza, verifichiamo insieme la sequenza. Per favore segui questi passi in questo ordine:\n\n1. Carica la lavatrice\n2. Chiudi lo sportello\n3. Vai alla centralina di pagamento e paga\n4. Seleziona il numero della macchina e ritira il resto se serve\n5. Vai alla macchina selezionata e scegli il programma\n6. Fammi sapere se funziona',
    ca: 'Aquest avís sol aparèixer quan el procés no s\'ha fet en l\'ordre correcte. Abans d\'avisar l\'assistència, verifiquem junts la seqüència. Si us plau segueix aquests passos en aquest ordre:\n\n1. Carrega la rentadora\n2. Tanca la porta\n3. Dirigeix-te a la central de pagament i paga\n4. Selecciona el número de màquina i recull el canvi si cal\n5. Dirigeix-te a la màquina seleccionada i tria el programa\n6. Avisa\'m si funciona',
    en: 'This message usually appears when the process was not done in the correct order. Before contacting support, let\'s verify the sequence together. Please follow these steps in this order:\n\n1. Load the washer\n2. Close the door\n3. Go to the payment central and pay\n4. Select the machine number and pick up the change if any\n5. Go to the selected machine and choose the program\n6. Let me know if it works',
    pt: 'Este aviso costuma aparecer quando o processo não foi feito na ordem correta. Antes de avisar a assistência, vamos verificar juntos a sequência. Por favor segue estes passos nesta ordem:\n\n1. Carrega a máquina de lavar\n2. Fecha a porta\n3. Dirige-te à central de pagamento e paga\n4. Seleciona o número da máquina e recolhe o troco se houver\n5. Dirige-te à máquina selecionada e escolhe o programa\n6. Avisa-me se funciona',
    fr: 'Ce message apparaît généralement quand le processus n\'a pas été fait dans le bon ordre. Avant de prévenir l\'assistance, vérifions ensemble la séquence. Suis ces étapes dans cet ordre :\n\n1. Charge le lave-linge\n2. Ferme la porte\n3. Va à la centrale de paiement et paie\n4. Sélectionne le numéro de machine et récupère la monnaie si besoin\n5. Va à la machine sélectionnée et choisis le programme\n6. Préviens-moi si ça fonctionne',
  },
  caso5Resolved: {
    es: 'Perfecto, incidencia resuelta. ¿Necesitas algo más?',
    it: 'Perfetto, problema risolto. Ti serve altro?',
    ca: 'Perfecte, incidència resolta. Necessites res més?',
    en: 'Great, issue resolved. Anything else you need?',
    pt: 'Perfeito, incidência resolvida. Precisas de mais alguma coisa?',
    fr: 'Parfait, problème résolu. As-tu besoin d\'autre chose ?',
  },
  caso4Resolved: {
    es: 'Perfecto, ya estaría resuelto. ¿Necesitas algo más?',
    it: 'Perfetto, problema risolto. Ti serve altro?',
    ca: 'Perfecte, ja estaria resolt. Necessites res més?',
    en: 'Great, all sorted. Anything else you need?',
    pt: 'Perfeito, já estaria resolvido. Precisas de mais alguma coisa?',
    fr: 'Parfait, c\'est résolu. As-tu besoin d\'autre chose ?',
  },
  caso8ConfirmLocation: {
    es: 'No reconozco esa lavandería. ¿Puedes confirmar el nombre? Tenemos: Goya, Pineda, L\'Escala, Alemanya, Hortes, Mataró.',
    it: 'Non riconosco questa lavanderia. Puoi confermare il nome? Abbiamo: Goya, Pineda, L\'Escala, Alemanya, Hortes, Mataró.',
    ca: 'No reconec aquesta bugaderia. Pots confirmar el nom? Tenim: Goya, Pineda, L\'Escala, Alemanya, Hortes, Mataró.',
    en: 'I don\'t recognize that laundry. Can you confirm the name? We have: Goya, Pineda, L\'Escala, Alemanya, Hortes, Mataró.',
    pt: 'Não reconheço essa lavandaria. Podes confirmar o nome? Temos: Goya, Pineda, L\'Escala, Alemanya, Hortes, Mataró.',
    fr: 'Je ne reconnais pas cette laverie. Peux-tu confirmer le nom ? Nous avons : Goya, Pineda, L\'Escala, Alemanya, Hortes, Mataró.',
  },
  caso8Resolved: {
    es: 'Perfecto, incidencia resuelta. ¿Necesitas algo más?',
    it: 'Perfetto, problema risolto. Ti serve altro?',
    ca: 'Perfecte, incidència resolta. Necessites res més?',
    en: 'Great, issue resolved. Anything else you need?',
    pt: 'Perfeito, incidência resolvida. Precisas de mais alguma coisa?',
    fr: 'Parfait, problème résolu. As-tu besoin d\'autre chose ?',
  },

  // ── Caso 11 cliente pide ricarga tarjeta ───────────────────────────────────
  caso11Recarga: {
    es: 'Introduce la tarjeta y sigue las instrucciones de la central. Si al hacerlo aparece algún mensaje extraño, dímelo y lo revisamos.',
    it: 'Inserisci la tessera e segui le istruzioni della centralina. Se compare un messaggio strano, dimmelo e lo verifichiamo.',
    ca: 'Introdueix la targeta i segueix les instruccions de la central. Si apareix algun missatge estrany, digue\'m-ho i ho revisem.',
    en: 'Insert the card and follow the instructions on the central unit. If you see anything unusual, tell me and we\'ll check it.',
    pt: 'Introduz o cartão e segue as instruções da central. Se aparecer alguma mensagem estranha, diz-me e verificamos.',
    fr: 'Insère la carte et suis les instructions de la centrale. Si un message inhabituel apparaît, dis-le-moi et nous le vérifions.',
  },

  // ── Caso 10 step 1 cliente pide tarjeta (no location yet) ──────────────────
  caso10TarjetaBase: {
    es: 'La tarjeta de fidelización se compra con 20€ en efectivo y solo funciona en la tienda donde se ha comprado. ¿En qué lavandería estás?',
    it: 'La tessera fedeltà si compra a 20€ in contanti e funziona solo nel locale dove l\'hai comprata. In quale lavanderia ti trovi?',
    ca: 'La targeta de fidelització es compra amb 20€ en efectiu i només funciona a la botiga on s\'ha comprat. A quina bugaderia ets?',
    en: 'The loyalty card costs 20€ in cash and only works in the store where it was bought. Which laundry are you at?',
    pt: 'O cartão de fidelização compra-se com 20€ em dinheiro e só funciona na loja onde foi comprado. Em que lavandaria estás?',
    fr: 'La carte de fidélité s\'achète avec 20€ en espèces et ne fonctionne que dans le magasin où elle a été achetée. Dans quelle laverie es-tu ?',
  },

  // ── FAQ closure — after a non-troubleshooting FAQ has been answered, the
  // customer typically says "gracias / entendido / perfecto / vale". The bot
  // must NOT switch to machine gather questions; just close politely.
  faqClosure: {
    es: 'Perfecto. Si necesitas algo más, dímelo.',
    it: 'Perfetto. Se hai bisogno di altro, dimmelo.',
    ca: 'Perfecte. Si necessites res més, digue-m\'ho.',
    en: 'Great. If you need anything else, just let me know.',
    pt: 'Perfeito. Se precisares de mais alguma coisa, diz-me.',
    fr: 'Parfait. Si tu as besoin d\'autre chose, dis-le-moi.',
  },

  // ── Caso 9 cliente pide factura ─────────────────────────────────────────────
  caso9Factura: {
    es: 'Para obtenerla, debes enviar un correo a olga@alberwaz.net con esta información: razón social, email, lavandería utilizada, CIF/NIF, dirección, fecha de uso, máquinas utilizadas y observaciones.',
    it: 'Per ottenerla, scrivi a olga@alberwaz.net indicando: ragione sociale, email, lavanderia utilizzata, codice fiscale/P.IVA, indirizzo, data d\'uso, macchine utilizzate e osservazioni.',
    ca: 'Per obtenir-la, envia un correu a olga@alberwaz.net amb aquesta informació: raó social, email, bugaderia utilitzada, CIF/NIF, adreça, data d\'ús, màquines utilitzades i observacions.',
    en: 'To get it, please email olga@alberwaz.net with: company name, email, laundry used, tax ID, address, date of use, machines used and notes.',
    pt: 'Para obtê-la, envia um e-mail para olga@alberwaz.net com: razão social, e-mail, lavandaria utilizada, NIF, morada, data de uso, máquinas utilizadas e observações.',
    fr: 'Pour l\'obtenir, envoie un e-mail à olga@alberwaz.net avec : raison sociale, e-mail, laverie utilisée, numéro fiscal, adresse, date d\'utilisation, machines utilisées et observations.',
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

  // ── Caso 21-24 cliente reporta un problema NON documentato per la sua location ──
  caso2124NotDocHere: {
    es: 'No tenemos registrado este tipo de incidencia en {location}. Vamos a revisarlo manualmente para poder ayudarte.',
    it: 'Non abbiamo registrato questo tipo di incidente a {location}. Lo verifichiamo manualmente per poterti aiutare.',
    ca: 'No tenim registrat aquest tipus d\'incidència a {location}. Ho revisarem manualment per poder ajudar-te.',
    en: 'We don\'t have this type of issue documented at {location}. We\'ll review it manually to help you.',
    pt: 'Não temos registado este tipo de incidente em {location}. Vamos rever manualmente para te ajudar.',
    fr: 'Nous n\'avons pas enregistré ce type d\'incident à {location}. Nous allons le vérifier manuellement pour t\'aider.',
  },

  // ── Caso 27 cliente pide compensación concreta (secadora gratis, ecc.) ─────
  caso27Review: {
    es: 'Vamos a revisar tu caso para ayudarte con la solución más adecuada.',
    it: 'Verifichiamo il tuo caso per aiutarti con la soluzione più adatta.',
    ca: 'Revisarem el teu cas per ajudar-te amb la solució més adequada.',
    en: 'We\'ll review your case to help you with the most appropriate solution.',
    pt: 'Vamos rever o teu caso para te ajudar com a solução mais adequada.',
    fr: 'Nous allons examiner ton cas pour t\'aider avec la solution la plus appropriée.',
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

