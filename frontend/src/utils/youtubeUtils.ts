/**
 * YouTube Utilities
 * 
 * Funzioni helper per gestire link YouTube nei messaggi WhatsApp:
 * - Estrazione videoId da vari formati URL
 * - Generazione URL thumbnail
 * - Generazione URL embed player
 */

/**
 * Estrae il videoId da un URL YouTube
 * 
 * Supporta formati:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * 
 * @param url - URL YouTube completo
 * @returns videoId o null se URL non valido
 * 
 * @example
 * extractYouTubeVideoId("https://www.youtube.com/watch?v=Sy-K9HuZgYA")
 * // Returns: "Sy-K9HuZgYA"
 * 
 * extractYouTubeVideoId("https://youtu.be/Sy-K9HuZgYA")
 * // Returns: "Sy-K9HuZgYA"
 */
export function extractYouTubeVideoId(url: string): string | null {
  // Pattern 1: youtube.com/watch?v=VIDEO_ID
  const watchPattern = /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
  const watchMatch = url.match(watchPattern)
  if (watchMatch) return watchMatch[1]

  // Pattern 2: youtu.be/VIDEO_ID
  const shortPattern = /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const shortMatch = url.match(shortPattern)
  if (shortMatch) return shortMatch[1]

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedPattern = /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  const embedMatch = url.match(embedPattern)
  if (embedMatch) return embedMatch[1]

  return null
}

/**
 * Genera URL per il thumbnail del video YouTube
 * 
 * Usa maxresdefault per massima qualità, con fallback a hqdefault
 * 
 * @param videoId - ID del video YouTube
 * @param quality - Qualità thumbnail: "maxres" | "hq" | "mq" | "sd"
 * @returns URL completo del thumbnail
 * 
 * @example
 * getYouTubeThumbnailUrl("Sy-K9HuZgYA")
 * // Returns: "https://img.youtube.com/vi/Sy-K9HuZgYA/maxresdefault.jpg"
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: "maxres" | "hq" | "mq" | "sd" = "maxres"
): string {
  const qualityMap = {
    maxres: "maxresdefault", // 1920x1080 (fallback se non disponibile)
    hq: "hqdefault", // 480x360
    mq: "mqdefault", // 320x180
    sd: "sddefault", // 640x480
  }

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`
}

/**
 * Genera URL per l'embed player YouTube
 * 
 * Include parametri per autoplay, controls, ecc.
 * 
 * @param videoId - ID del video YouTube
 * @param autoplay - Autoplay quando si apre (default: true)
 * @returns URL completo per iframe embed
 * 
 * @example
 * getYouTubeEmbedUrl("Sy-K9HuZgYA", true)
 * // Returns: "https://www.youtube.com/embed/Sy-K9HuZgYA?autoplay=1&rel=0"
 */
export function getYouTubeEmbedUrl(
  videoId: string,
  autoplay: boolean = true
): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    rel: "0", // Non mostrare video correlati
    modestbranding: "1", // Logo YouTube minimale
    fs: "1", // Fullscreen disponibile
  })

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * Rileva se una stringa contiene un link YouTube
 * 
 * @param text - Testo da analizzare
 * @returns true se contiene link YouTube valido
 * 
 * @example
 * containsYouTubeLink("Guarda questo video: https://youtu.be/Sy-K9HuZgYA")
 * // Returns: true
 */
export function containsYouTubeLink(text: string): boolean {
  const youtubePattern =
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  return youtubePattern.test(text)
}

/**
 * Estrae tutti i link YouTube da un testo
 * 
 * @param text - Testo da analizzare
 * @returns Array di URL YouTube trovati
 * 
 * @example
 * extractYouTubeLinks("Video 1: https://youtu.be/ABC123 e Video 2: https://youtube.com/watch?v=XYZ789")
 * // Returns: ["https://youtu.be/ABC123", "https://youtube.com/watch?v=XYZ789"]
 */
export function extractYouTubeLinks(text: string): string[] {
  const youtubePattern =
    /(https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
  const links: string[] = []
  let match

  while ((match = youtubePattern.exec(text)) !== null) {
    links.push(match[0])
  }

  return links
}
