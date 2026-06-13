export interface DataflowLabels {
  /** Customer node title, e.g. "WhatsApp customer" */
  customer: string
  /** End-to-end encryption badge, keep short (e.g. "E2E encryption") */
  e2e: string
  /** Tiny label over the inbound arrow, e.g. "encrypted channel" */
  channel: string
  /** Central instance title, e.g. "Your dedicated instance" */
  instanceTitle: string
  /** Central instance subtitle, e.g. "on-premise · data stays here" */
  instanceSub: string
  database: string
  knowledgeBase: string
  /** RAG pill, e.g. "RAG search on your systems" */
  rag: string
  /** Isolation badge, e.g. "Per-workspace isolation" */
  isolation: string
  /** Label over the outbound arrow, e.g. "only necessary context" */
  contextOut: string
  /** Label under the return arrow, e.g. "reply" */
  reply: string
  /** External LLM provider title (auto-wrapped to two lines) */
  llmTitle: string
  /** Highlight under the LLM node, e.g. "no training" */
  noTraining: string
}

/**
 * PrivacyDataflowDiagram — sober, dark-themed SVG that replaces the watercolor
 * mascot in the privacy-by-design hero. Shows how a customer message stays
 * protected: encrypted in transit, data kept on the dedicated instance isolated
 * per workspace, only the necessary context sent to an external LLM that does
 * not train on it. All labels come from props so the page stays multilingual.
 */
export function PrivacyDataflowDiagram({ labels }: { labels: DataflowLabels }) {
  // Split the LLM title across two centered lines (last word on its own line),
  // which keeps it readable across it/en/es/de without overflowing the card.
  const words = labels.llmTitle.trim().split(/\s+/)
  const llmLine1 = words.length > 1 ? words.slice(0, -1).join(" ") : labels.llmTitle
  const llmLine2 = words.length > 1 ? words[words.length - 1] : ""

  // The space between the instance and the LLM node is narrow, so wrap the
  // outbound label onto two lines (last word below) to avoid overlapping either.
  const ctxWords = labels.contextOut.trim().split(/\s+/)
  const ctxLine1 = ctxWords.length > 1 ? ctxWords.slice(0, -1).join(" ") : labels.contextOut
  const ctxLine2 = ctxWords.length > 1 ? ctxWords[ctxWords.length - 1] : ""

  return (
    <svg
      viewBox="0 0 900 430"
      className="w-full h-auto"
      role="img"
      aria-label={`${labels.customer} → ${labels.instanceTitle} → ${labels.llmTitle}`}
      fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    >
      <defs>
        <marker id="pdf-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#25D366" />
        </marker>
        <marker id="pdf-ar-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#64748b" />
        </marker>
      </defs>

      {/* Customer */}
      <g>
        <rect x="44" y="135" width="176" height="160" rx="16" fill="#131c2e" stroke="rgba(255,255,255,0.10)" />
        <rect x="116" y="170" width="32" height="50" rx="6" fill="none" stroke="#25D366" strokeWidth="2.5" />
        <line x1="126" y1="178" x2="138" y2="178" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" />
        <text x="132" y="244" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="600">{labels.customer}</text>
        <rect x="48" y="258" width="168" height="26" rx="13" fill="rgba(37,211,102,0.12)" />
        <g transform="translate(62,264)">
          <rect x="0" y="5" width="10" height="8" rx="1.5" fill="none" stroke="#34d399" strokeWidth="1.6" />
          <path d="M2.5 5 V3 a2.5 2.5 0 0 1 5 0 V5" fill="none" stroke="#34d399" strokeWidth="1.6" />
        </g>
        <text x="80" y="275" fill="#34d399" fontSize="11.5" fontWeight="600">{labels.e2e}</text>
      </g>

      {/* inbound arrow */}
      <line x1="220" y1="215" x2="306" y2="215" stroke="#25D366" strokeWidth="2.5" markerEnd="url(#pdf-ar)" />
      <text x="263" y="205" textAnchor="middle" fill="#94a3b8" fontSize="11.5">{labels.channel}</text>

      {/* Your instance */}
      <g>
        <rect x="312" y="78" width="300" height="274" rx="18" fill="rgba(37,211,102,0.05)" stroke="rgba(37,211,102,0.35)" />
        <rect x="336" y="100" width="26" height="26" rx="4" fill="none" stroke="#25D366" strokeWidth="2.2" />
        <line x1="342" y1="108" x2="356" y2="108" stroke="#25D366" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="342" y1="118" x2="356" y2="118" stroke="#25D366" strokeWidth="2.2" strokeLinecap="round" />
        <text x="374" y="111" fill="#ffffff" fontSize="15.5" fontWeight="600">{labels.instanceTitle}</text>
        <text x="374" y="126" fill="#94a3b8" fontSize="11.5">{labels.instanceSub}</text>

        {/* database pill */}
        <rect x="334" y="146" width="256" height="38" rx="9" fill="#131c2e" stroke="rgba(255,255,255,0.08)" />
        <g transform="translate(350,158)" stroke="#25D366" strokeWidth="1.6" fill="none">
          <ellipse cx="6.5" cy="2" rx="6.5" ry="2.5" />
          <path d="M0 2 V11 a6.5 2.5 0 0 0 13 0 V2" />
        </g>
        <text x="374" y="170" fill="#e2e8f0" fontSize="13">{labels.database}</text>

        {/* knowledge base pill */}
        <rect x="334" y="192" width="256" height="38" rx="9" fill="#131c2e" stroke="rgba(255,255,255,0.08)" />
        <g transform="translate(350,205)" stroke="#25D366" strokeWidth="1.6" fill="none">
          <rect x="0" y="0" width="13" height="11" rx="1.5" />
          <line x1="6.5" y1="0" x2="6.5" y2="11" />
        </g>
        <text x="374" y="216" fill="#e2e8f0" fontSize="13">{labels.knowledgeBase}</text>

        {/* RAG pill */}
        <rect x="334" y="238" width="256" height="38" rx="9" fill="#131c2e" stroke="rgba(255,255,255,0.08)" />
        <g transform="translate(350,251)" stroke="#25D366" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <circle cx="5" cy="5" r="4.5" />
          <line x1="8.5" y1="8.5" x2="12" y2="12" />
        </g>
        <text x="374" y="262" fill="#e2e8f0" fontSize="13">{labels.rag}</text>

        {/* isolation badge */}
        <rect x="334" y="300" width="256" height="32" rx="16" fill="rgba(37,211,102,0.12)" />
        <g transform="translate(352,308)" fill="none" stroke="#34d399" strokeWidth="1.6">
          <path d="M6 0 L12 3 V8 Q12 13 6 15 Q0 13 0 8 V3 Z" />
        </g>
        <text x="378" y="320" fill="#34d399" fontSize="12" fontWeight="600">{labels.isolation}</text>
      </g>

      {/* outbound + return arrows */}
      <line x1="612" y1="166" x2="700" y2="166" stroke="#25D366" strokeWidth="2.5" markerEnd="url(#pdf-ar)" />
      <text x="656" y="140" textAnchor="middle" fill="#94a3b8" fontSize="11">{ctxLine1}</text>
      {ctxLine2 && <text x="656" y="153" textAnchor="middle" fill="#94a3b8" fontSize="11">{ctxLine2}</text>}
      <line x1="700" y1="250" x2="612" y2="250" stroke="#64748b" strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#pdf-ar-muted)" />
      <text x="656" y="270" textAnchor="middle" fill="#64748b" fontSize="11">{labels.reply}</text>

      {/* External LLM */}
      <g>
        <rect x="702" y="135" width="152" height="140" rx="16" fill="#131c2e" stroke="rgba(255,255,255,0.10)" />
        <g transform="translate(762,165)" stroke="#25D366" strokeWidth="2.2" fill="none">
          <rect x="0" y="0" width="32" height="32" rx="5" />
          <rect x="9" y="9" width="14" height="14" rx="2" fill="#25D366" stroke="none" />
          <line x1="8" y1="-4" x2="8" y2="0" />
          <line x1="24" y1="-4" x2="24" y2="0" />
          <line x1="8" y1="32" x2="8" y2="36" />
          <line x1="24" y1="32" x2="24" y2="36" />
        </g>
        <text x="778" y="222" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="600">{llmLine1}</text>
        {llmLine2 && (
          <text x="778" y="239" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="600">{llmLine2}</text>
        )}
        <text x="778" y="259" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="600">{labels.noTraining}</text>
      </g>
    </svg>
  )
}
