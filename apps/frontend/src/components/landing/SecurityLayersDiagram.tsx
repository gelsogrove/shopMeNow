export interface SecurityLayer {
  /** Layer title, e.g. "Encrypted transport" */
  title: string
  /** Short supporting line, e.g. "WhatsApp end-to-end" */
  sub: string
  /** Icon key drawn inline (no external assets) */
  icon: "lock" | "server" | "key" | "cpu"
}

export interface SecurityLayersLabels {
  /** Caption above the stack, e.g. "Defense in depth" */
  heading: string
  /** Exactly four layers, outermost (transport) to innermost (AI) */
  layers: [SecurityLayer, SecurityLayer, SecurityLayer, SecurityLayer]
}

function LayerIcon({ icon }: { icon: SecurityLayer["icon"] }) {
  const common = { stroke: "#25D366", strokeWidth: 1.9, fill: "none" as const, strokeLinecap: "round" as const }
  switch (icon) {
    case "lock":
      return (
        <g {...common}>
          <rect x="3" y="8" width="16" height="11" rx="2" />
          <path d="M6 8 V5 a5 5 0 0 1 10 0 V8" />
        </g>
      )
    case "server":
      return (
        <g {...common}>
          <rect x="2" y="3" width="18" height="7" rx="2" />
          <rect x="2" y="13" width="18" height="7" rx="2" />
          <line x1="6" y1="6.5" x2="6" y2="6.5" />
          <line x1="6" y1="16.5" x2="6" y2="16.5" />
        </g>
      )
    case "key":
      return (
        <g {...common}>
          <circle cx="7" cy="14" r="4.5" />
          <line x1="10" y1="11" x2="20" y2="3" />
          <line x1="17" y1="6" x2="20" y2="9" />
        </g>
      )
    case "cpu":
      return (
        <g {...common}>
          <rect x="5" y="5" width="12" height="12" rx="2" />
          <line x1="9" y1="2" x2="9" y2="5" />
          <line x1="13" y1="2" x2="13" y2="5" />
          <line x1="9" y1="17" x2="9" y2="20" />
          <line x1="13" y1="17" x2="13" y2="20" />
        </g>
      )
  }
}

/**
 * SecurityLayersDiagram — companion SVG for the "concrete security measures"
 * section, replacing the duplicated watercolor mascot. Renders a defense-in-depth
 * stack (transport → infrastructure → access → AI), distinct from the hero
 * dataflow diagram so the page never repeats the same visual. Labels are passed
 * in so every language stays correct.
 */
export function SecurityLayersDiagram({ labels }: { labels: SecurityLayersLabels }) {
  const rowH = 74
  const gap = 14
  const top = 64
  return (
    <svg
      viewBox="0 0 480 430"
      className="w-full h-auto"
      role="img"
      aria-label={labels.heading}
      fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    >
      <rect x="6" y="6" width="468" height="418" rx="22" fill="#0b1322" stroke="rgba(255,255,255,0.08)" />
      <text x="240" y="40" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="600">{labels.heading}</text>

      {labels.layers.map((layer, i) => {
        const y = top + i * (rowH + gap)
        return (
          <g key={i}>
            <rect x="40" y={y} width="400" height={rowH} rx="14" fill="#131c2e" stroke="rgba(37,211,102,0.22)" />
            <rect x="40" y={y} width="4" height={rowH} rx="2" fill="#25D366" />
            <g transform={`translate(68,${y + rowH / 2 - 11})`}>
              <LayerIcon icon={layer.icon} />
            </g>
            <text x="112" y={y + 31} fill="#ffffff" fontSize="14.5" fontWeight="600">{layer.title}</text>
            <text x="112" y={y + 51} fill="#94a3b8" fontSize="12">{layer.sub}</text>
          </g>
        )
      })}
    </svg>
  )
}
