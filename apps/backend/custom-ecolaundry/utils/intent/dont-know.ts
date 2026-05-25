// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Body moved verbatim. detectIDontKnowReply is a boundary
// signal (allowed under rule #6 "boundary signals" — gather guards
// short-circuit on explicit don't-know answers). Test in intent.test.ts.

export function detectIDontKnowReply(message: string): boolean {
  const trimmed = message.trim().toLowerCase()
  if (!trimmed) return false
  return (
    /\bno\s+lo\s+s[eé](?=[\s,.!?]|$)|\bno\s+s[eé](?=[\s,.!?]|$)|\bno\s+me\s+acuerdo\b|\bni\s+idea\b|\bno\s+tengo\s+idea\b/i.test(trimmed) ||
    /\bno\s+(?:lo|la|los|las)\s+he\s+(?:seleccionad[oa]|elegid[oa]|cogid[oa]|usad[oa])/i.test(trimmed) ||
    /\b(?:todav[ií]a|a[uú]n)\s+no\b/i.test(trimmed) ||
    /\bno\s+he\s+(?:elegid[oa]|seleccionad[oa]|cogid[oa])/i.test(trimmed) ||
    /\bnon\s+lo\s+so\b|\bnon\s+l[''’]ho\b|\bnon\s+ricordo\b|\bnon\s+ancora\b/i.test(trimmed) ||
    /\bi\s+don'?t\s+know\b|\bi\s+haven'?t\s+(?:yet|done)\b|\bnot\s+(?:yet|sure)\b|\bno\s+idea\b/i.test(trimmed) ||
    /\bn[ãa]o\s+sei\b|\bainda\s+n[ãa]o\b|\bn[ãa]o\s+me\s+lembro\b/i.test(trimmed) ||
    /\bje\s+ne\s+sais\s+pas\b|\bpas\s+encore\b|\baucune\s+id[ée]e\b/i.test(trimmed) ||
    /\bno\s+ho\s+s[eé](?=[\s,.!?]|$)|\bencara\s+no\b/i.test(trimmed)
  )
}
