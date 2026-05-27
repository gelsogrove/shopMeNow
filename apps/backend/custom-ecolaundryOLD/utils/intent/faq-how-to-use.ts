// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3 (>150 lines). Zero behavioural change. Every regex below is
// moved BYTE-IDENTICAL from utils/intent.ts:detectHowToUseIntent. The new
// file location does not change rule #6 status: the original function was
// already a tracked-exemption FAQ topic guard — same status applies
// post-move. Tests (intent.test.ts) verify zero diff.

export function detectHowToUseIntent(message: string): boolean {
  const trimmed = message.toLowerCase().trim()
  if (!trimmed) return false

  // Cluster A — how to use / how it works
  if (/(c[oó]mo\s+(?:se\s+)?(?:usa|funciona|lava|lavarse|lavar\s+la\s+ropa|utiliza)|come\s+(?:si\s+)?(?:usa|funziona|si\s+lava|lavare)|how\s+(?:do\s+i\s+|does\s+it\s+|to\s+)?(?:use|work|wash)|como\s+(?:se\s+)?(?:usa|funciona|lavar)|com\s+(?:s'usa|funciona|es\s+renta|es\s+lava|rentar)|comment\s+(?:utiliser|[çc]a\s+march|fonctionne|laver|on\s+fait))/i.test(trimmed)) return true

  // Cluster B — what do I do / steps / instructions
  if (/(qu[eé]\s+(?:hago|pasos|tengo\s+que\s+hacer|debo\s+hacer|se\s+hace)|instrucciones\s+(?:para\s+lavar|de\s+uso|del?\s+lavado)|cosa\s+(?:faccio|devo\s+fare)|quali\s+(?:passi|sono\s+i\s+passi)|istruzioni\s+per\s+(?:lavare|usare)|what\s+(?:do\s+i\s+do|are\s+the\s+steps|should\s+i\s+do)|instructions?\s+(?:for\s+washing|to\s+use|to\s+wash)|steps?\s+(?:to\s+use|to\s+wash|for\s+using)|o\s+que\s+(?:fa[çc]o|devo\s+fazer)|quais\s+(?:os\s+passos|s[ãa]o\s+os\s+passos)|instru[çc][õo]es\s+para\s+(?:lavar|usar)|qu[eè]\s+(?:faig|he\s+de\s+fer)|quins\s+passos|instruccions\s+per\s+(?:rentar|usar)|que\s+dois[-\s]je\s+faire|quelles?\s+[eé]tapes|mode\s+d['']emploi|comment\s+(?:je\s+dois\s+proc[eé]der|utiliser\s+la))/i.test(trimmed)) return true

  // Cluster C — first time / never used / don't know how
  if (/(es\s+mi\s+primera\s+vez|nunca\s+he\s+(?:usado|lavado|venido)|no\s+s[eé]\s+(?:c[oó]mo\s+)?(?:usar|funciona|lavarlo?|usarlo?)|[eè]\s+la\s+(?:prima|mia\s+prima)\s+volta|non\s+ho\s+mai\s+(?:usato|lavato)|non\s+so\s+come\s+(?:usare|funziona)|(?:it'?s\s+my\s+)?first\s+time|never\s+used|don'?t\s+know\s+how\s+to\s+(?:use|wash)|[eé]\s+a\s+primeira\s+vez|nunca\s+(?:usei|lavei)|n[ãa]o\s+sei\s+como\s+(?:usar|funciona)|[eé]s\s+la\s+primera\s+vegada|mai\s+he\s+(?:usat|rentat)|no\s+s[eé]\s+com\s+(?:usar|funciona)|(?:c'est\s+la\s+)?premi[eè]re\s+fois|jamais\s+utilis[eé]|(?:je\s+)?ne\s+sais\s+pas\s+comment\s+(?:utiliser|[çc]a\s+marche))/i.test(trimmed)) return true

  return false
}
