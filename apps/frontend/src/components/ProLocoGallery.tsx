/**
 * A strip of real places, not stock photography.
 *
 * Every image is one already in the repo under `public/sappada/` — actual
 * hotels, restaurants and mountain huts from the Sappada workspace (Andrea,
 * 2026-09-14: "avevamo delle immagini, possiamo adottarne qualcuna?"). Stock
 * mountain photos would read as filler on a page sold to people who know what
 * their own valley looks like.
 *
 * The caption is the point: it names the CATEGORY the picture stands for, so
 * the strip says "this is the kind of thing the assistant answers about"
 * rather than being decoration.
 */

interface GalleryItem {
  src: string
  /** The content category this picture stands for. */
  label: string
  /** Alt text — describes the picture, not the category. */
  alt: string
}

const ITEMS: GalleryItem[] = [
  {
    src: "/sappada/bach-boutique-hotel.jpg",
    label: "Hotel e B&B",
    alt: "Hotel in legno e vetro con le montagne sullo sfondo",
  },
  {
    src: "/sappada/laite.jpg",
    label: "Ristoranti",
    alt: "Sala da pranzo rivestita in legno antico, tavoli apparecchiati",
  },
  {
    src: "/sappada/pista-nera.jpg",
    label: "Rifugi e baite",
    alt: "Interno di una baita in legno con il fuoco acceso nel camino",
  },
  {
    src: "/sappada/latteria-plodarkelder.jpg",
    label: "Prodotti tipici",
    alt: "Latteria con i formaggi di produzione locale",
  },
  {
    src: "/sappada/mondschein.jpg",
    label: "Dove dormire",
    alt: "Albergo di montagna nel centro del paese",
  },
  {
    src: "/sappada/karl-keller.jpg",
    label: "Locali",
    alt: "Locale tradizionale sappadino",
  },
]

interface ProLocoGalleryProps {
  title: string
  subtitle: string
}

export function ProLocoGallery({ title, subtitle }: ProLocoGalleryProps) {
  return (
    <div>
      <h2 className="text-center text-3xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
        {subtitle}
      </p>

      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <figure
            key={item.src}
            className="group relative overflow-hidden rounded-xl bg-slate-100"
          >
            <img
              src={item.src}
              alt={item.alt}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Gradient only at the foot of the image, so the picture stays
                readable and the label always has contrast to sit on. */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
              <figcaption className="text-sm font-medium text-white">
                {item.label}
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}
