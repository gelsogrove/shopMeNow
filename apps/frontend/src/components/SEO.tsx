import { Helmet } from "react-helmet-async"

interface SEOProps {
  title: string
  description: string
  keywords?: string
  image?: string
  url?: string
  type?: "website" | "article"
  lang?: "it" | "en" | "es" | "pt"
}

export function SEO({
  title,
  description,
  keywords,
  image = "https://www.echatbot.ai/og-image.png",
  url,
  type = "website",
  lang = "en",
}: SEOProps) {
  const siteUrl = "https://www.echatbot.ai"
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl
  const fullTitle = `${title} | eChatbot - AI WhatsApp Chatbot`

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content={lang === "it" ? "it_IT" : lang === "es" ? "es_ES" : lang === "pt" ? "pt_PT" : "en_US"} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Additional Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="author" content="eChatbot" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </Helmet>
  )
}
