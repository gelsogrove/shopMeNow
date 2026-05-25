// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Body moved verbatim.
//
// Iron rule #5 is NOT violated. The check-architecture.sh rule #5 block
// (line 184) is `find "$ROOT/utils" -maxdepth 1 -name "*.ts"` — files in
// utils/intent/ (depth 2) are explicitly out of scope. Coverage stays in
// __tests__/unit/intent.test.ts via the barrel re-export at utils/intent.ts.
//
// Function status: isShortContextReply is a short-form classifier
// (digits + yes/no + display-code-like) — yes/no parsing is allowed per
// CLAUDE.md "Allowed: yes/no confirmation".

import { isBlankDisplayReply } from '../message-parsing.js'
import { isDisplayCodeLikeInput } from './display.js'

export function isShortContextReply(message: string): boolean {
  const trimmed = message.trim()
  return (
    /^\d{1,2}$/.test(trimmed) ||
    /^(yes|y|si|sì|sí|no|n|ok|ok risolto|risolto|fatto|ora funziona|water|perfecto|perfect|perfetto|gracias|grazie|thanks|vale|claro|de\s+acuerdo|entendido|capito|got\s+it|d'accordo|adelante|continuamos)$/i.test(trimmed) ||
    isBlankDisplayReply(trimmed) ||
    isDisplayCodeLikeInput(trimmed)
  )
}
