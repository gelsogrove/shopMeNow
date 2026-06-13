import { Helmet } from "react-helmet-async"

interface SEOProps {
  title: string
  description: string
  keywords?: string
  image?: string
  url?: string
  type?: "website" | "article"
  lang?: "it" | "en" | "es" | "de" | "fr" | "ca"
  robots?: string
  hreflangs?: Array<{ lang: string; url: string }>
  /**
   * When set, emits a schema.org `Service` JSON-LD block for this page so
   * Google can surface it as a distinct service offering. Pass a short
   * service category, e.g. "Appointment Booking" or "CRM Integration".
   */
  serviceType?: string
}

export function SEO({
  title,
  description,
  keywords,
  image = "https://www.echatbot.ai/og-image.png",
  url,
  type = "website",
  lang = "en",
  robots = "index, follow",
  hreflangs = [],
  serviceType,
}: SEOProps) {
  const siteUrl = "https://www.echatbot.ai"
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl
  const cleanTitle = title.replace(/\s*\|\s*eChatbot.*$/i, "").trim()
  const fullTitle = `${cleanTitle} | eChatbot - AI WhatsApp Chatbot`

  // Per-page Service structured data. Truthful, derived from the page's own
  // title/description — no invented ratings, prices, or review counts.
  const serviceJsonLd = serviceType
    ? {
        "@context": "https://schema.org",
        "@type": "Service",
        name: cleanTitle,
        serviceType,
        description,
        url: fullUrl,
        provider: {
          "@type": "Organization",
          name: "eChatbot",
          url: siteUrl,
        },
        areaServed: { "@type": "Place", name: "Worldwide" },
      }
    : null

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={fullUrl} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="eChatbot" />
      <meta property="og:locale" content={lang === "it" ? "it_IT" : lang === "es" ? "es_ES" : lang === "de" ? "de_DE" : lang === "fr" ? "fr_FR" : lang === "ca" ? "ca_ES" : "en_US"} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Additional Meta Tags */}
      <meta name="author" content="eChatbot" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {/* Hreflang alternates */}
      {hreflangs.map((alt) => {
        const href = alt.url.startsWith("http")
          ? alt.url
          : `${siteUrl}${alt.url}`
        return (
          <link
            key={`${alt.lang}-${href}`}
            rel="alternate"
            hrefLang={alt.lang}
            href={href}
          />
        )
      })}

      {/* Per-page Service structured data */}
      {serviceJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(serviceJsonLd)}
        </script>
      )}
    </Helmet>
  )
}
