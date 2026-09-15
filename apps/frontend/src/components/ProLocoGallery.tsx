/**
 * What the assistant can answer about, as drawn marks rather than photographs.
 *
 * It used to be real photos from public/sappada/ — a specific hotel, a
 * specific restaurant's sign with its phone number on it. They looked good and
 * meant nothing here (Andrea, 2026-09-15: "le foto mi piacciono ma non
 * c'entrano nulla"): this page is sold to ANY tourist office, and one valley's
 * cheese counter is not their subject. The real photos belong in the product,
 * attached to the entries the tenant loads.
 *
 * Drawn in the page's own green on a tinted ground, so nine categories read as
 * one system instead of nine unrelated pictures.
 */

interface Category {
  label: string
  /** Line art on a 24-unit grid, inheriting currentColor. */
  path: React.ReactNode
}

/** Shared stroke settings — one hand across every icon. */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

const CATEGORIES: Category[] = [
  {
    label: "Hotel e B&B",
    path: (
      <>
        <path d="M3 21h18M5 21V8l7-4 7 4v13" />
        <path d="M9 21v-5h6v5" />
        <path d="M9 11h.01M15 11h.01" />
      </>
    ),
  },
  {
    label: "Ristoranti",
    path: (
      <>
        <path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10" />
        <path d="M17 3c-1.6 0-2.5 2-2.5 4.5S15.4 12 17 12v9" />
      </>
    ),
  },
  {
    label: "Escursioni e rifugi",
    path: (
      <>
        <path d="M2 20h20L14 6l-4 7-2-3-6 10Z" />
        <path d="m12 11 2-3 1.8 3.1" />
      </>
    ),
  },
  {
    label: "Sagre ed eventi",
    path: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <path d="M8 15h3M8 18h6" />
      </>
    ),
  },
  {
    label: "Prodotti tipici",
    path: (
      <>
        <path d="M5 10h14l-1.2 10a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 10Z" />
        <path d="M9 10V6a3 3 0 0 1 6 0v4" />
      </>
    ),
  },
  {
    label: "Borghi e panorami",
    path: (
      <>
        <path d="M3 21V9l5-3 5 3v12" />
        <path d="M13 21V13l4-2 4 2v8" />
        <path d="M7 12h2M7 16h2M17 16h1" />
      </>
    ),
  },
  {
    label: "Castelli e chiese",
    path: (
      <>
        <path d="M4 21V8l2 2 2-3 2 3 2-2v13" />
        <path d="M16 21V11l3-3 3 3v10" />
        <path d="M8 21v-4h2v4" />
      </>
    ),
  },
  {
    label: "Cenni storici",
    path: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z" />
        <path d="M8 8h7M8 12h5" />
      </>
    ),
  },
  {
    label: "Numeri utili",
    path: (
      <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6.5 3Z" />
    ),
  },
]

interface ProLocoGalleryProps {
  title: string
  subtitle: string
}

export function ProLocoGallery({ title, subtitle }: ProLocoGalleryProps) {
  return (
    <div>
      <h2 className="font-display text-center text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
        {subtitle}
      </p>

      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.label}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-7 text-center transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-colors duration-300 group-hover:bg-emerald-600 group-hover:text-white">
              <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                {(() => {
                  const { fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin } = STROKE
                  return (
                    <g
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap={strokeLinecap}
                      strokeLinejoin={strokeLinejoin}
                    >
                      {cat.path}
                    </g>
                  )
                })()}
              </svg>
            </span>
            <span className="text-sm font-medium text-slate-700">
              {cat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
