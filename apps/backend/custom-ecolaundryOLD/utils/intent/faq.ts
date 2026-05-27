// REFACTOR ONLY — pure file split, ZERO new logic, ZERO new intent detectors.
// Every function in this file is moved verbatim (byte-identical regex bodies)
// from utils/intent.ts as part of Andrea's iron rule #3 split (file >150 lines
// → barrel + cassettes). The original utils/intent.ts will become a barrel
// re-export. No caller is changed.
//
// Iron rule #6: TRACKED EXEMPTION. CLAUDE.md line 102 lists
// HORARIOS_TOPIC, PRECIO_TOPIC, TARJETA_TOPIC, RECARGA_TOPIC, FACTURA_TOPIC
// as "FAQ topic guards kept as fast-path optimisation". These functions ARE
// those FAQ topic guards (detectHoursIntent = HORARIOS_TOPIC,
// detectPriceIntent = PRECIO_TOPIC, detectInvoiceIntent = FACTURA_TOPIC).
// detectFaqPause is a boundary signal (pause marker + topic hint) explicitly
// allowed under rule #6 "boundary signals" category. detectProgramsIntent
// is part of the same FAQ topic family added in F81.
//
// Iron rule #5: NOT APPLICABLE. check-architecture.sh enforces rule #5 with
// `find utils -maxdepth 1`; files under utils/intent/ are outside that scope.
// Existing coverage lives in __tests__/unit/intent.test.ts.
//
// History: F28, F43, F81. See docs/usecases.md for the design rationale.

export function detectFaqPause(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false

  const pauseMarker =
    /\b(?:espera|esperate|aspetta|wait|pera)\b/i.test(lower) ||
    /\bantes\s+(?:una\s+(?:pregunta|cosa|duda)|de\s+(?:eso|nada|seguir|continuar))\b/i.test(lower) ||
    /\buna\s+(?:pregunta|cosa|duda)\s+antes\b/i.test(lower) ||
    /\b(?:pregunto|pregunta)\s+(?:antes|primero|r[áa]pida|r[áa]pido)\b/i.test(lower) ||
    /\bperdona,?\s+(?:una\s+(?:pregunta|cosa|duda)|antes)\b/i.test(lower)

  if (!pauseMarker) return false

  const faqHint =
    /\bcu[aá]nto\s+(?:cuesta|cuestan|vale|valen)\b/i.test(lower) ||
    /\bqu[eé]\s+precio\b/i.test(lower) ||
    /\bcu[aá]l\s+es\s+el\s+precio\b/i.test(lower) ||
    /\bhorario\b/i.test(lower) ||
    /\bqu[eé]\s+horas?\b/i.test(lower) ||
    /\ba\s+qu[eé]\s+hora\b/i.test(lower) ||
    /\bcu[aá]ndo\s+(?:abr[ií]s|cierr[áa]is)\b/i.test(lower) ||
    /\btarjeta\s+(?:de\s+)?(?:fidelizaci[oó]n|fidelidad|descuento)\b/i.test(lower) ||
    /\bfactura\b/i.test(lower)

  return faqHint
}

export function detectInvoiceIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    /\bfactur[ao]s?\b/i.test(trimmed) ||
    /\bfattur[ae]\b/i.test(trimmed) ||
    /\bfatur[ao]s?\b/i.test(trimmed) ||
    /\binvoices?\b/i.test(trimmed) ||
    /\bfactures?\b/i.test(trimmed) ||
    /\brecibos?\b/i.test(trimmed) ||
    /\bcomprobantes?\b/i.test(trimmed) ||
    /\bjustificantes?\b/i.test(trimmed) ||
    /\bricevut[ae]\b/i.test(trimmed) ||
    /\bscontrin[oi]\b/i.test(trimmed) ||
    /\bcomprovantes?\b/i.test(trimmed) ||
    /\breceipts?\b/i.test(trimmed) ||
    /\bre[çc]us?\b/i.test(trimmed) ||
    /\brebuts?\b/i.test(trimmed) ||
    /\bcomprovants?\b/i.test(trimmed) ||
    /\bf[aàeéiou]?[ct]+[rt]+[aàeéiou]s?\b/i.test(trimmed) &&
      /\b(?:quiero|necesito|me\s+(?:da|hace)|voglio|voglia|i\s+(?:want|need)|je\s+(?:veux|voudrais)|preciso|vull|hace\s+falta)\b/i.test(trimmed)
  )
}

export function detectHoursIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return /(\bhorario\b|\bhorarios\b|qu[eé]\s+horas?|a\s+qu[eé]\s+hora|cu[aá]ndo\s+abr|cu[aá]ndo\s+cierr|hasta\s+qu[eé]\s+hora|opening\s+hours|what\s+time|\bche\s+orari?\b|\borario\b|\borari\b|a\s+che\s+ora|quando\s+(?:apr|chiud)|\bhoraires?\b|quels?\s+horaires|\bhor[áa]rios?\b|que\s+horas|\bhoraris?\b|quins\s+horaris)/i.test(trimmed)
}

export function detectPriceIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return /(cu[aá]nto\s+(?:cuesta|costa)|qu[eé]\s+precio|cu[aá]l\s+es\s+el\s+precio|how\s+much\s+(?:does\s+it\s+)?cost|quanto\s+costa|qual\s+[èe]\s+il\s+prezzo|combien(?:\s+[a-zà-ÿ']+){0,2}\s+(?:co[ûu]te|coute)|qual\s+[ée]\s+o\s+pre[çc]o|quin\s+[ée]s\s+el\s+preu|\bprecios?\b|\bprezzi?\b|\bprice\b|\bpre[çc]o\b|\bpreu\b|\btarifa\b)/i.test(trimmed)
}

// F111 — Question-form gate. The bare keyword "program" / "programa" /
// "programme" appears in customer statements like "I pressed program 2",
// "ho premuto il programma 2" — NOT FAQ intent (it's a trouble report).
// True intent FAQ requires: an explicit question phrase ("which/what
// program", "qué programa", "che programmi avete", etc.) OR a bare
// keyword + question mark anywhere in the message.
//
// Iron rule #6 tracked exemption (FAQ topic guards) still applies — this
// is the detector that classifies the FAQ topic, just made non-greedy.
export function detectProgramsIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  // (a) Explicit question phrase (no question mark needed — phrase is self-
  // sufficient). Multi-language coverage retained verbatim.
  const explicitQuestion = /qu[eé]\s+(?:programa|temperatura|temp)|which\s+program|what\s+program|quins?\s+program|quels?\s+programme|que\s+(?:programa|temperatura)|quelle?\s+temp[eé]rature|a\s+qu[eé]\s+temperatura|at\s+what\s+temp|qu[eé]\s+lavado|tipo\s+de\s+lavado|modes?\s+de\s+lavage/i.test(trimmed)
  if (explicitQuestion) return true
  // (b) Bare keyword (program/programa/programme/temperatura) ONLY when the
  // message ends with '?' — a real question, not a statement that happens
  // to mention "program 2".
  const bareKeyword = /\bprograma[s]?\b|\bprogramm[ai]\b|\bprograms?\b|\bprogrames?\b|\bprogramme[s]?\b|\btemperatura[s]?\b/i.test(trimmed)
  const isQuestion = /\?\s*$/.test(trimmed)
  return bareKeyword && isQuestion
}
