// Centralized regex patterns for intent detection, topic classification, and validators.
// Single source of truth for all regex patterns in the codebase.
// All patterns are multi-language (es, ca, en, it, pt, fr) where applicable.
//
// ⚠️ TODO (technical debt — Andrea, 2026-05-25):
// Some regex were extracted from their original detector files (force-gather.ts,
// loyalty-card-recharge.ts, faq-detergent.ts intent, etc.) during the iron-rule
// #3 barrel-split refactor. This central file now serves as their home, but
// pin tests in __tests__/unit/f-log-regression.test.ts still grep the original
// per-detector files for the regex literals (F59, F68, F92, F93, F96, F99, F100)
// — those pins are currently skipped with a reason ("regex centralized in
// utils/patterns.ts"). To re-enable them: move each affected regex BACK INTO
// its detector file (defined inline or imported from a small detector-local
// constants block) and remove the corresponding `skip:` markers in the test.
// Plan: do this in a dedicated refactor pass with full test re-validation.

// ── FAQ Topic Classifiers (Iron Rule #6 tracked exemption) ──────────────────────────

/** Detect opening hours / schedule intent (Caso 12.1) */
export const HORARIOS_TOPIC = /horari|ore|hora|heure|opening|oras|schedule|horários|orari|heures/i

/** Detect pricing intent (Caso 12.2) */
export const PRECIO_TOPIC = /precio|price|preu|costo|preço|prix|quanto\s+costa|quanto\s+é|how\s+much|qual\s+è|quel\s+est/i

/** Detect loyalty card intent (Caso 10) */
export const TARJETA_TOPIC =
  /(tar[gj]eta\s+(?:de\s+)?(?:fidelizaci[oó]n|fidelitzaci[oó]|fidelidad|descuento)|tessera\s+(?:di\s+)?(?:fidelizzazione|fedelt[aà]|fidelizaci[oó]ne)|loyalty\s+card|carta\s+fedelt[aà]|carta\s+de\s+fidelidade|carte\s+de\s+fid[ée]lit[ée]|c[oó]mo\s+(?:consigo|comprar|recargar|saco|adquiero|tengo)\s+(?:la\s+|una\s+)?tarjeta|com\s+(?:aconsegueixo|comprar|adquirir|tinc)\s+(?:la\s+|una\s+)?tar[gj]eta|how\s+(?:do\s+i\s+)?(?:get|buy|obtain)\s+(?:the\s+|a\s+)?loyalty\s+card|(?:quiero|necesito|me\s+gustar[ií]a|quisiera|vull|voldria|necessito|i\s+want|i\s+need|i'd\s+like)\s+(?:comprar\s+|tener\s+|conseguir\s+|sacar\s+|adquirir\s+|to\s+(?:buy|get|obtain)\s+)?(?:una?\s+|la\s+|el\s+|mi\s+|otra\s+|the\s+|a\s+)?(?:nueva\s+|nuevita\s+|new\s+)?(?:tar[gj]eta|loyalty\s+card)|(?:tengo|tiene|tienen|tinc|té|j'ai|ho(?:\s+(?:comprato|preso))?|comprei|compré|i\s+(?:have|bought|got))\s+(?:una?\s+|la\s+|mi\s+|the\s+|ma\s+|une?\s+|o\s+)?(?:tar[gj]eta|tessera|targeta|loyalty\s+card|carte?\s+(?:de\s+fid[ée]lit[ée]|fedelt[aà]|fidelidade)?|cart[aã]o))/i

/** Detect loyalty card recharge intent (Caso 10.1) */
export const RECARGA_TOPIC =
  /(c[oó]mo\s+(?:puedo\s+|se\s+)?recarg[ao]|(?:puedo|quiero|necesito|quisiera)\s+recargar|(?:re)?cargar(?:la|lo)?\s+(?:la\s+)?tar[gj]eta|recarga(?:r|rla|rlo)?\s+(?:de\s+)?(?:la\s+)?tar[gj]eta|recargarla|recargarlo|no\s+s[eé]\s+(?:c[oó]mo\s+)?recargar(?:la|lo)?|how\s+(?:(?:do|can|to)\s+(?:i\s+)?|to\s+)?(?:re)?charge\s+(?:(?:my|the|a)\s+)?(?:loyalty\s+)?card|recharge\s+(?:(?:my|the|a)\s+)?(?:loyalty\s+)?card|(?:i\s+(?:want|need)|i'd\s+like)\s+to\s+recharge|com\s+(?:puc\s+|vull\s+|necessito\s+|voldria\s+)?recarregar|recarreg(?:ar|o|a|ar-la|ar-lo)\s+(?:la\s+)?tar[gj]eta|no\s+s[ée]\s+com\s+recarregar|ricaric(?:are|o|a|hi)\s+(?:(?:la|il|una?)\s+)?(?:tess?era|carta(?:\s+fedelt[aà])?)|come\s+(?:posso|si\s+)?ricaric(?:are|a)|voglio\s+ricaricare|ho\s+bisogno\s+di\s+ricaricare|recarregar\s+(?:(?:o|a|meu|minha)\s+)?cart[aã]o|como\s+(?:posso\s+)?recarregar|recharg(?:er|ez|e)\s+(?:(?:ma|la|une?)\s+)?carte)/i

/** Detect invoice/receipt intent (Caso 9) */
export const FACTURA_TOPIC =
  /factura|invoice|receipt|fattura|recibo|justificant|comprovante|justificatif|quittance|scontrino|ticket/i

/** Detect discount code intent (Caso 8) */
export const DESCUENTO_TOPIC =
  /descuento|discount|code|c[oó]digo|code\s+promo|promo|promocion|coupon|voucher|sconto|codice\s+promo|cupón|código|promoção/i

// ── Yes/No Confirmation (multi-language) ──────────────────────────────────────────

/** Affirmative response (Caso 12.2 prices confirmation) */
export const AFFIRMATIVE_RE = /^(yes|y|si|sì|sí|sim|oui|és|d'accord|claro|vale|ok|adelante|certo)(?=\s|[!?.,;]|$)/i

/** Negative response (Caso 12.2 prices decline) */
export const NEGATIVE_RE =
  /^(no|nope|non|não|nein|nee|na|nah|pas|jamais|nul|no\s+gracias|no\s+gràcies|no\s+grazie|no\s+obrigado|no\s+merci)(?=\s|[!?.,;]|$)/i

// ── Signal Detection (Mixed Intent) ──────────────────────────────────────────────
//
// Used by `utils/mixed-signal.ts` to detect "yes-but-X" replies where the
// customer acknowledges progress AND reports a new concern in the same turn.
// Pattern: CONNECTOR_RE then COMPLAINT_RE in the tail after the connector.
//
// Unicode-aware boundaries: `\b` is ASCII-only, so accented connectors
// like "però" (IT/CA) need lookarounds against `\p{L}` (any Unicode letter).
// Coverage: es, it, en, ca, pt, fr — kept in lock-step with the test suite
// at `__tests__/unit/mixed-signal.test.ts`.

const CONTRAST_CONNECTORS = [
  'pero',  // ES
  'però',  // IT, CA
  'ma',    // IT
  'mas',   // PT
  'mais',  // FR, PT
  'but',   // EN
] as const

const COMPLAINT_KEYWORDS = [
  // ES
  'raro', 'ruido', 'sonido', 'huele', 'olor', 'humo',
  'no funciona', 'sigue', 'todavía', 'aún', 'problema',
  // IT
  'strano', 'rumore', 'odore', 'fumo', 'puzza',
  'non funziona', 'ancora', 'continua',
  // EN
  'weird', 'strange', 'noise', 'smell', 'smoke',
  "doesn't work", 'not working', 'still', 'issue',
  // CA
  'estrany', 'soroll', 'fum',
  // PT
  'estranho', 'barulho', 'cheiro', 'não funciona', 'ainda',
  // FR
  'bizarre', 'bruit', 'odeur', 'fumée',
  'ne marche pas', 'encore', 'toujours',
] as const

const escapeForAlt = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Contrast connectors with Unicode-aware boundaries (pero, però, ma, mas, mais, but). */
export const CONNECTOR_RE = new RegExp(
  `(?<!\\p{L})(?:${CONTRAST_CONNECTORS.map(escapeForAlt).join('|')})(?!\\p{L})`,
  'iu'
)

/** Complaint indicators in 6 languages (raro, ruido, strano, weird, soroll, ...). */
export const COMPLAINT_RE = new RegExp(
  `(?<!\\p{L})(?:${COMPLAINT_KEYWORDS.map(escapeForAlt).join('|')})(?!\\p{L})`,
  'iu'
)

// ── Format Validators ────────────────────────────────────────────────────────────

/** Email validation */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Discount code format: PROMO + 8 digits */
export function buildDiscountCodeRegex(): RegExp {
  const prefix = 'PROMO'
  return new RegExp(`^(${prefix})(\\d{2})(\\d{2})(\\d{2})(\\d{1,2})$`)
}

/** Confirmation words (Yes/No/OK variants) */
export const CONFIRMATION_WORDS = new RegExp(
  '(sí|sì|si|yes|vale|ok|d\'accord|oui|sim|certo|está bien|d\'accord|va bene)',
  'i'
)

// ── Display State Detection ──────────────────────────────────────────────────────

/** AL001 family alarm code */
export const ALARM_AL001_RE = /\b(?:AL\s*|ALM\s*|ALARMA?\s+)0*01\b/i

/** Bare 001/01 code (C001 case) */
export const CODE_BARE_01_RE = /(?:^|\D)0*01(?:\D|$)/

/** Specific alarm sub-codes (ALM/A, ALM/E, ALM/DOOR, etc.) */
export const ALARM_SPECIFIC_RE = /\b(ALM\/?A|ALM\/?E|ALM[\/ ]?DOOR|ALM\/?V(?:AR|Ar))\b/i

/** ALN alarm family */
export const ALARM_ALN_RE = /\bALN(?:\s*[AN])?\b/i

/** Generic ERR/ERROR codes */
export const ERROR_CODE_RE = /\b(ERR(?:OR)?[\s\-]?\d{1,3})\b/i

/** Generic display states (SEL, PUSH, DOOR, etc.) */
export const DISPLAY_GENERIC_RE = /\b(SEL|PUSH|PR|DOOR|ALM|AL001|END|ON|FILTRO|FALLO DE ROTACION|FALLO DE ASPIRACION|STOP|water)\b/i

/** Countdown display (120, 119, etc.) */
export const DISPLAY_COUNTDOWN_RE = /\b120\b/

/** Price display pattern (e.g., "1.50", "2,00") */
export const DISPLAY_PRICE_RE = /\b\d{1,2}[.,]\d{2}\b/

/** Door open display */
export const DISPLAY_DOOR_RE = /puerta abierta|dibujo de la puerta|icono de puerta|door open|open door icon/i

/** END + BAL (balance) display */
export const DISPLAY_END_BAL_RE = /END.*bAL|bAL.*END/i

/** PUSH PROG instruction message (not an error) — user must select & press a program button */
export const DISPLAY_PUSH_PROG_RE = /push\s+prog|puls(?:a|e)\s+un\s+programa|premere\s+un\s+programma|appuyer\s+sur\s+un\s+programme|prémer\s+un\s+programa|appuya\s+a\s+un\s+programa/i

/** Payment method question (HOW to pay, which methods, do you accept cards, etc.) */
/**
 * Customer is asking HOW TO PAY (which methods are accepted).
 *
 * Caller uses `detectPaymentMethodQuestion` which combines:
 *   1. `LOYALTY_CARD_MENTION_RE` (negative gate — Caso 10 owns loyalty card)
 *   2. `PAYMENT_METHOD_QUESTION_RE` (positive — payment phrase OR instrument
 *      in payment-context like "do you accept tarjeta")
 *
 * Without the negative gate, plain "card"/"cash" in non-payment context
 * (e.g. "loyalty card", "cash desk") false-triggers `lastFaqKey='paymentMethods'`
 * over the real intent.
 */
export const LOYALTY_CARD_MENTION_RE = /\b(?:loyalty|fidelizaci[oó]n|fidelitzaci[oó]|fidelidad|fid[ée]lit[ée]|fedelt[aà]|fidelidade)\s+card|tarjeta\s+(?:de\s+)?(?:fidelizaci[oó]n|fidelidad|club)|targeta\s+(?:de\s+)?fidelitzaci[oó]|carta\s+(?:di\s+)?fedelt[aà]|cart[ãa]o\s+(?:de\s+)?fidelidade|carte\s+(?:de\s+)?fid[ée]lit[ée]\b/i
export const PAYMENT_METHOD_QUESTION_RE = /c[óo]mo\s+(?:\w+\s+){0,2}pag|cóm\s+pag|come\s+pag|com\s+pag|comment\s+pay|how\s+(?:do\s+i\s+|can\s+i\s+)?pay|pag[ao]\s+(?:de|con|per|com)|m[eé]todo.*pag|formas?\s+de\s+pag|forma.*pag|payment\s+method|qu[eé]\s+(?:formas?|m[eé]todos?)\s+de\s+pag|(?:acept[ao]n?|accept|recib[ei]|do\s+you\s+take|puedo\s+(?:pagar|usar))\s+\w*\s*(?:tarjeta|carta|card|efectivo|cash|dinero|monedas|coins|contant|esp[eè]ci)|(?:pay|pag(?:o|ar|ado)|pagar)\s+\w*\s*(?:con|with|per|amb|en)\s+(?:tarjeta|card|efectivo|cash|monedas|coins)/i

// ── Location/Boundary Matching ──────────────────────────────────────────────────

/**
 * Build a word-boundary regex for location matching.
 * Prevents false matches in words like "Goyathea" or "operario" → "aria" (Aria location)
 * Pattern: (?:^|[^a-z0-9'])...(?:$|[^a-z0-9'])
 */
export function buildLocationBoundaryRegex(location: string): RegExp {
  const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9'])${escaped}(?:$|[^a-z0-9'])`, 'i')
}

// ── Greeting Detection ──────────────────────────────────────────────────────────

/**
 * Pure greeting in 6 supported languages (es, it, en, ca, pt, fr).
 * Matches a salutation that is the ENTIRE message (optionally with leading
 * "¡¿" and trailing "!?.,"). Used by `utils/greeting.ts:isPureGreeting`
 * — boundary signal, not intent (rule #6 exempt).
 *
 * Coverage parity with `utils/intent/greeting.ts:hasGreetingIntent`:
 * - ES: hola, buenos días, buenas tardes/noches, buenas (alone)
 * - IT: ciao, salve, buongiorno, buonasera
 * - EN: hi, hello, hey, good morning/afternoon/evening
 * - CA: hola (same as ES), bon dia, bona tarda/nit
 * - PT: olá, ola (no accent), oi, bom dia, boa tarde/noite
 * - FR: bonjour, bonsoir, bonne nuit, salut, coucou
 */
export const PURE_GREETING_RE =
  /^\s*[¡¿]*\s*(?:hola|hi|hello|hey|ciao|salve|buongiorno|buonasera|bonjour|bonsoir|bonne\s+nuit|salut|coucou|oi|ol[áa]|good\s+(?:morning|afternoon|evening)|buen[oa]s\s+(?:d[ií]as|tardes|noches|nits)|buenas|bom\s+dia|boa\s+(?:tarde|noite)|bon\s+dia|bona\s+(?:tarda|tarde|nit))\s*[!?.,]*\s*$/i

// ── Misc Detectors ──────────────────────────────────────────────────────────────

/** Report verb for display updates (e.g., "now showing", "me aparece") */
export const REPORT_VERB_RE =
  /\b(me\s+sale|me\s+aparece|me\s+da|ahora\s+me\s+sale|aparece|mi\s+da|ora\s+mi\s+da|ora\s+me\s+sale|now\s+(?:showing|shows|displays)|shows|i\s+see|sale\s+(?:el|la|en\s+la\s+pantalla))\b/i

/**
 * Trouble/problem signal — boundary phrase that flips FAQ context to
 * trouble-machine. Used by `force-gather.ts:isInFaqContext` to clear the
 * `lastResolvedIntent='faq'` marker when the customer pivots ("no funciona").
 *
 * Coverage parity with the 6 supported languages (es/it/en/ca/pt/fr).
 * Iron rule #6 exception: BOUNDARY signal (topic switch), not intent
 * classification. Tested in `__tests__/unit/force-gather-faq-gate.test.ts`
 * (F59 — must accept all 6 languages).
 */
export const TROUBLE_SIGNAL_RE =
  /\b(?:no\s+funciona|no\s+arranca|no\s+va\b|est[áa]\s+rot[ao]|non\s+funziona|non\s+parte|non\s+va\b|non\s+arranca|doesn'?t\s+work|isn'?t\s+working|doesn'?t\s+start|broken|n[aã]o\s+funciona|n[aã]o\s+arranca|ne\s+fonctionne\s+pas|ne\s+marche\s+pas|ne\s+d[ée]marre\s+pas)/i

/**
 * F82 — "I don't know which Mataró laundromat" reply, 6 languages.
 * Used by `guardMataroStreet` to detect when the customer has been asked
 * which Mataró branch and replies "non lo so / no lo sé / je ne sais pas / ..."
 * — the guard then shows Goya-specific landmarks (Mercadona, Biblioteca)
 * so the customer can self-identify.
 *
 * Anchored to start-of-message (^) so the entire reply must be a "don't
 * know" — partial mentions inside larger sentences are not enough.
 */
export const MATARO_DONT_KNOW_RE =
  /^(?:no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea|non\s+lo\s+s[eo]|non\s+s[eo]|non\s+ricordo|non\s+mi\s+ricordo|i\s+don'?t\s+know|no\s+idea|not\s+sure|no\s+ho\s+s[eé]|no\s+ho\s+idea|no\s+sap|je\s+(?:ne\s+)?sais\s+pas|j'?en\s+sais\s+pas|pas\s+s[uû]r|n[ãa]o\s+sei|n[ãa]o\s+me\s+lembro|n[ãa]o\s+tenho\s+ideia)(?:\s|$|[.,!?])/i

// ── Machine Type Detection (intent.ts) ──────────────────────────────────

/** Washer machine: nouns + verb stems across 6 languages */
export const WASHER_NOUNS_RE = /\b(?:lavadora[s]?|lavatric[ie]s?|washer|washing[-\s]?machine|m[aá]quina[s]?\s+de\s+lavar|rentadora|lave[-\s]?linge)\b/i

/** Washer machine: verb forms (lavar, lavare, wash, laver) */
export const WASHER_VERBS_RE = /\b(?:lavar(?:la|lo|los|las|me|se)?|lavare|to\s+wash|washing|laver)\b/i

/** Dryer machine: nouns + verb stems across 6 languages */
export const DRYER_NOUNS_RE = /\b(?:secador[ae]s?|asciugat(?:rice|rici|ore|ori)|dryers?|sechag[eo]s?|s[eè]che[-\s]?linge|m[aá]quina[s]?\s+de\s+secar|assecadora|estenedor)\b/i

/** Dryer machine: verb forms (secar, asciugare, dry, sécher) with typo tolerance */
export const DRYER_VERBS_RE = /\b(?:asciu(?:g|r)ar[eio]?|secar(?:la|lo|los|las|me|se)?|to\s+dry|drying|s[eé]cher|s[eé]chage|ass?ecar(?:la|lo)?|secar)\b/i

// ── Detergent FAQ Intent Detection (intent.ts) ──────────────────────────────────

/** Negative markers for detergent presence (can't see, no soap, etc.) — 6 languages */
export const DETERGENT_NEGATIVE_MARKER_RE = /no\s+(?:veo|hay|encuentro|aparece|veig|hi\s+ha)|non\s+(?:vedo|trovo)|non\s+c['\s][eè]|n[aã]o\s+(?:vejo|tem|encontro)|pas\s+de|je\s+ne\s+(?:vois|trouve)\s+pas|can'?t\s+(?:see|find)\s+(?:the\s+)?|\b(?:mi\s+)?manca\b|\bfalta\b|\bmissing\b|\blacks?\b|\bil\s+manque\b|\bmanque\s+de\b/i

/** Detergent product words (soap, detergent, softener, etc.) — 6 languages with F92 typo tolerance */
export const DETERGENT_WORD_RE = /jab[oó]n|detergente?|suavizante|suavitzant|sapone|\bsapo\b|detersivo|ammorbidente?|soap|detergent|softener|sab[aã]o|sab[oó]|savon|lessive|assouplissant/i

/** Post-cycle foam complaint exclusion: "no foam after wash" belongs to flow engine, not FAQ */
export const POST_CYCLE_FOAM_RE = /despu[eé]s\s+del?\s+lavado|dopo\s+il\s+lavaggio|after\s+(?:the\s+)?wash|apr[eè]s\s+le\s+lavage/i

/** Foam/espuma product word (used with post-cycle exclusion) */
export const FOAM_WORD_RE = /espuma|schiuma|foam|mousse/i

// ── Language Detection (detectLanguageHeuristic in intent.ts) ─────────────────────

/** Spanish markers: accented punctuation ¿¡ */
export const LANG_ES_PUNCT_RE = /(¿|¡)/

/** Spanish vocab scoring — common words and phrases across 6 languages */
export const LANG_ES_VOCAB_RE = /(secadora|lavadora|lavander[ií]a|arranc|otra vez|pantalla|centrifug|ropa|mojad|dinero|he pulsado|he premudo|como lo|autoservicio|cobrado|doble cobro|paso a paso|lavar|secar|captura|tarjeta|local|me sale|aparece en|sale en|no arranca|no funciona|no se activa|he pagado|he puesto|teneis|tenéis|ten[eé]is|qu[eé] horario|qu[eé] precio|cu[aá]nto cuesta|hola|estoy en|sí|por favor|\bgracias\b|\bc[oó]mo\s+est[aá]s\b|\bqu[eé]\s+tal\b|\btodav[ií]a\s+no\b|\bya\s+est[eá]\b|\bvale\b|\bperd[oó]n\b|\blo\s+siento\b|\bd[oó]nde\b|\bcu[aá]ndo\b|\bpor\s+qu[eé]\b|\bqu[eé]\s+(es|hago|hacer)\b)/i

/** Spanish distinguisher: context-specific phrases */
export const LANG_ES_DISTINGUISHER_RE = /\bno\s+sé\b|\bcómo\s+lo\b|\bqu[eé]\s+aparece\b/i

/**
 * Catalan strong markers: words that exist in CA but NOT in ES.
 * Each match adds +20 to caScore, dominant over generic vocab overlaps
 * (rentadora/targeta/horari are CA but shared lexically with ES context).
 * - amb / ès → prepositions/copula unique to CA
 * - tinc / tens / té / tenim / teniu / tenen → "tenir" conjugations (ES uses tengo/tienes)
 * - vull / vols / vol / volem / voleu / volen → "voler" conjugations (ES uses quiero)
 * - sóc / som / sou → "ser" conjugations (ES uses soy/somos)
 * - faig / fas / fa / fem / feu → "fer" conjugations (ES uses hago/haces)
 * - aquí / allà / això / aquí (CA spellings — ES uses aquí/allí/eso/esto)
 *   note: aquí is shared with ES; left out to avoid false positives.
 */
export const LANG_CA_STRONG_RE = /\b(?:amb|ès|tinc|tens|tenim|teniu|tenen|vull|vols|volem|voleu|volen|sóc|som|sou|faig|fas|fem|feu|això|allà)\b/i

/** Catalan interrogative: quina (which) with boundary check */
export const LANG_CA_QUINA_RE = /^quina|[,.\s!?]quina/i

/** Catalan vocab: words unique to Catalan */
export const LANG_CA_VOCAB_RE = /(bon\s+dia|bona\s+(?:tarda|nit)|rentadora|assecadora|targeta|he\s+pagat|he\s+posat|no\s+veig|no\s+funciona|no\s+arrenca|per\s+favor|gràcies|com\s+(està|estàs|estais|estam)|on\s+est|a\s+on|talons|curs|horari|obrir|tancar|ha\s+cobrat|em\s+van\s+cobrar|dinars|diners|monedes|codi|cotxe|carrer|localitat|districte|provincia|preu|cost|mercat|catalan|català)/i

/** English markers: washer, dryer, common English phrases */
export const LANG_EN_MARKERS_RE = /(washer|dryer|laundromat|display\s+shows|charged\s+twice|double\s+charge|step\s+by\s+step|card\s+digits|screenshot|payment\s+proof|did\s+not\s+start|does\s+not\s+start|doesn'?t\s+work|doesn'?t\s+start|not\s+working|i\s+can'?t|my\s+(washer|dryer|machine)|don'?t\s+(know|see|understand)|\bi\s+paid\b|\bi\s+paid\s+twice\b|\bthe\s+machine\b|\bwashing\s+machine\b|\bhi\b|\bhello\b|\bhey\b|\bthe\s+laund|\blaundry\b|\bhow\s+(are|do)\s+you\b|\bwhat'?s\s+up\b|\bthank\s+(you|s)\b|\bthanks\b|\bplease\b|\bsorry\b|\bi\s+need\b|\bcan\s+you\b|\bcould\s+you\b|\bwhere\b|\bwhen\b|\bwhy\b|\bhow\b|\bi\s+(inserted|put|dropped|added)\s+(coins|money)\b)/i

/** Italian markers: ciao, grazie, come stai, etc. */
export const LANG_IT_MARKERS_RE = /(ciao|buongiorno|buonasera|grazie|prego|dimmi|come stai|cosa devo fare|lavarice|asciugatrice|lavatrice|macchina|ho pagato|due volte|mi hanno addebitato|il display|schermo|codice|numero|saldo|crediti|portafoglio)/i

/**
 * Portuguese markers: words/phrases distinctive of PT vs ES.
 * - olá / oi / bom dia / boa tarde / boa noite — saluti PT
 * - não / são / coração / informação — `ão/âo` ending unique to PT
 * - quero / tenho / preciso — verbi comuni (3p sing/1p sing diversi da ES)
 * - cartão / máquina / lavandaria / secadora — vocab macchine
 * - obrigado / por favor / desculpa — cortesia
 * - você / vocês — pronoun unique
 */
export const LANG_PT_MARKERS_RE = /(\bol[áa]\b|\boi\b|bom\s+dia|boa\s+(?:tarde|noite)|\bn[ãâ]o\b|[a-zçãâê]+[ãâ]o\b|\bquero\b|\btenho\b|\bpreciso\b|\bvocê\b|\bvoces?\b|\bobrigad[oa]\b|por\s+favor|desculpa|lavandaria|m[áa]quina\s+de\s+(?:lavar|secar)|cart[ãa]o|j[áa]\s+paguei|comprovante|estou\s+em|aqui\s+está|fidelidade)/i

/**
 * French markers: words/phrases distinctive of FR.
 * - bonjour / salut / bonsoir / coucou — saluti
 * - je veux / je voudrais / j'aimerais — verbi modali
 * - acheter / utiliser / fonctionne — verbi comuni
 * - carte / fidélité / machine à laver / lave-linge / sèche-linge — vocab
 * - une / des / les / mes — articoli e determiners
 * - n'ai / n'est / ne...pas — negazione FR
 */
export const LANG_FR_MARKERS_RE = /(\bbonjour\b|\bsalut\b|\bbonsoir\b|\bcoucou\b|\bje\s+(?:veux|voudrais|peux|paye|paie|suis)\b|\bj[''’]\s*(?:ai|aimerais)\b|\bn[''’]?(?:ai|est|arrive)\b|\bne\s+\w+\s+pas\b|\bvouloir\b|acheter|utiliser|fonctionne|payer|carte\s+de\s+fid[ée]lit[ée]|machine\s+[àa]\s+laver|lave-linge|s[èe]che-linge|laverie|merci|s['']il\s+(?:vous|te)\s+pla[îi]t|je\s+suis\s+[àa]|d[ée]j[àa]\s+pay[ée])/i

// ── Customer Name Validation (agent-extract.ts) ─────────────────────────────────

/** Confirmation words / filler answers (not a real name) */
export const NAME_LOOKS_LIKE_ANSWER_RE = /^(no|si|sí|s[íi]|yes|ok|okay|vale|claro|gracias|grazie|thanks|perfecto|perfect|perfetto|entendido|capito|got|nope|nada)$/i

/** Pure number token (not a name) */
export const NAME_IS_PURE_NUMBER_RE = /^\d+$/

/** Valid name pattern: starts with letter/accent, contains letters/accents/apostrophes/dashes */
export const NAME_IS_LIKELY_NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ'][A-Za-zÀ-ÖØ-öø-ÿ'-]+$/

// ── Input Sanitization (input-sanitize.ts) ──────────────────────────────────

/** Phone number: keep only digits, +, spaces, (), and dash */
export const PHONE_DISALLOWED_RE = /[^0-9+\s()\-.]/g

/** Markdown special characters to strip before LLM to prevent injection */
export const MARKDOWN_SPECIALS_RE = /[\\`*_{}[\]()#+\-!<>|]/g

/** Normalize strip: remove spaces, dots, commas, dashes, punctuation for comparison */
export const NORMALIZE_STRIP_RE = /[\s.,!?¿¡-]/g

/** Detergent enquiry shorthand: "no soap" / "no detergent" merged in one phrase */
export const DETERGENT_NO_SHORTHAND_RE = /\bno\s+(?:soap|detergent|softener)\b/i
