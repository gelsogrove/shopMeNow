// Strip leading/trailing HTML-like tags from a customer reply. Defence in
// depth — the L1 input-sanitiser already runs upstream, but tools that
// echo customer text back (e.g. issueSummary, escalation summary) call
// this to be sure no markup leaks.

export function sanitizeCustomerReply(message: string): string {
  return message
    .replace(/^<[^>]+>/g, '')
    .replace(/<[^>]+>$/g, '')
    .trim()
}
