import { IMG_BASE_URL } from "@/config"
import { containsYouTubeLink, extractYouTubeLinks } from "@/utils/youtubeUtils"
import DOMPurify from "dompurify"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { YouTubePlayerModal } from "./YouTubePlayerModal"
import { YouTubePreview } from "./YouTubePreview"

/**
 * Resolve image URL - if relative path, prepend IMG_BASE_URL (backend 3001)
 */
function resolveImageUrl(src: string): string {
  if (!src) return ""
  // Already absolute URL
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src
  }
  // Relative path - prepend backend base URL
  const path = src.startsWith("/") ? src : `/${src}`
  return `${IMG_BASE_URL}${path}`
}

/**
 * Opens a URL in a mobile-sized popup window
 * This ensures consistent behavior across "new tab" and "new window"
 */
function openInMobilePopup(url: string) {
  // Mobile phone dimensions (iPhone 14 Pro size)
  const width = 390
  const height = 844
  
  // Center the popup on screen
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2
  
  // Open popup with mobile dimensions
  const popup = window.open(
    url,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  )
  
  // Focus the popup
  if (popup) {
    popup.focus()
  }
  
  return popup
}

interface MessageRendererProps {
  content: string
  className?: string
  variant?: "chat" | "compact"
  onLinkClick?: (url: string, e: React.MouseEvent) => void
}

export function MessageRenderer({
  content,
  className = "",
  variant = "chat",
  onLinkClick,
}: MessageRendererProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  // Base classes for consistent formatting
  const baseClasses = "break-words text-sm text-left"

  // Variant-specific classes
  const variantClasses = {
    chat: "leading-tight",
    compact: "leading-normal",
  }

  // YouTube Preview - Detect and render YouTube links as previews
  const hasYouTubeLink = containsYouTubeLink(content)

  // SOLUZIONE BRUTALE: Spacca il testo e trova tutti gli URL
  const renderWithLinks = (text: string) => {
    console.log("MessageRenderer INPUT:", text)
    
    // FIX: Handle malformed img tags ONLY if NOT already correct
    // Check if text already has correct <img src="URL" - if so, DON'T apply fix!
    const hasCorrectImg = /<img\s+src="https?:\/\//.test(text)
    let fixedText = text
    
    if (!hasCorrectImg) {
      // Only fix truly malformed tags (URL" alt=... without <img src=")
      const malformedImgPattern = /(https?:\/\/[^\s"]+)"(\s*alt="[^"]*"\s*\/>)/g
      fixedText = text.replace(malformedImgPattern, '<img src="$1"$2')
      console.log("Applied malformed img fix")
    } else {
      console.log("Img tag already correct, skipping fix")
    }
    
    console.log("After fix check:", fixedText)
    
    // Check if this is a product detail message (has img tag)
    const imgMatch = fixedText.match(/<img\s+src="([^"]+)"\s*alt="([^"]*)"\s*\/>/)
    
    if (imgMatch) {
      // Product detail layout: image left, text right, title top
      const imgUrl = resolveImageUrl(imgMatch[1]) // Resolve relative path to full URL
      const imgAlt = imgMatch[2]
      
      // Split content: before img = title/description, after img = details
      const parts = fixedText.split(/<img[^>]+>/)
      const titlePart = parts[0]?.trim() || ''
      const detailsPart = parts[1]?.trim() || ''

      // Extract title and description respecting explicit line breaks first
      const normalizedTitlePart = titlePart.trim()
      const [rawTitleLine = "", ...restDescription] = normalizedTitlePart.split(/\r?\n+/)

      const stripMarkdown = (text: string) => text.replace(/\*\*/g, "").trim()

      // Display title prefers original product name (img alt) but falls back to text line
      let title = stripMarkdown(imgAlt || rawTitleLine || "")
      if (!title) {
        title = "Prodotto"
      }

      let description = stripMarkdown(restDescription.join("\n").trim())

      // Fallback to colon-based split if translation merged everything
      if (!description && rawTitleLine.includes(":")) {
        const [beforeColon, ...afterColon] = rawTitleLine.split(":")
        description = stripMarkdown(afterColon.join(":").trim())
      }

      // Final fallback: remove first line text from the block and treat the rest as description
      if (!description && rawTitleLine) {
        const remaining = normalizedTitlePart.slice(rawTitleLine.length).trim()
        description = stripMarkdown(remaining)
      }

      // If translation removed line breaks from bullet list, restore them
      let normalizedDetails = detailsPart
      const hasExplicitBreaks = /\r?\n/.test(normalizedDetails)
      if (!hasExplicitBreaks) {
        const bulletSplit = normalizedDetails.split(/\s+(?=-\s)/)
        if (bulletSplit.length > 1) {
          normalizedDetails = bulletSplit.join("\n")
        }
      }

      // Force CTA and link to start on new paragraphs
      normalizedDetails = normalizedDetails.replace(/\s*(🔐)/g, "\n\n$1")
      normalizedDetails = normalizedDetails.replace(/\s*(https?:\/\/[^\s<]+)/g, "\n\n$1")
      normalizedDetails = normalizedDetails.replace(/\s*(\[LINK_[^\]]+\])/g, "\n\n$1")

      const urlRegex = /(https?:\/\/[^\s<]+)/g
      const detailsHtml = normalizedDetails
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(urlRegex, (url) => {
          const safeUrl = DOMPurify.sanitize(url, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${safeUrl}</a>`
        })
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
      
      return (
        <div className={`flex gap-3 p-2 ${baseClasses} ${variantClasses[variant]}`} style={{ whiteSpace: "pre-wrap" }}>
          {/* Image on left */}
          <div className="flex-shrink-0">
            <img 
              src={imgUrl} 
              alt={imgAlt}
              className="w-24 h-24 object-cover rounded-lg shadow-sm"
            />
          </div>
          {/* Content on right */}
          <div className="flex-1 min-w-0">
            {/* Title on top */}
            <div className="font-semibold">{title}</div>
            <div className="h-2" />
            {/* Description */}
            {description && (
              <div className="mb-2 whitespace-pre-line">{description}</div>
            )}
            {/* Details */}
            <div 
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(
                  detailsHtml,
                  { ALLOWED_TAGS: ["strong", "em", "br", "b", "a"], ALLOWED_ATTR: ["href", "target", "rel", "class"] }
                )
              }}
            />
          </div>
        </div>
      )
    }
    
    // Normal message (no product image)
    // Now split preserving img tags
    // First extract and protect img tags
    const imgPlaceholders: string[] = []
    fixedText = fixedText.replace(/<img([^>]+)>/g, (match, attrs) => {
      console.log("Found img tag:", match)
      // Add max-width style to make image smaller (1/3 size)
      const styledImg = `<img${attrs} style="max-width: 120px; height: auto; border-radius: 8px;">`
      imgPlaceholders.push(styledImg)
      return `__IMG_PLACEHOLDER_${imgPlaceholders.length - 1}__`
    })
    
    console.log("After placeholder:", fixedText)
    console.log("Placeholders:", imgPlaceholders)
    
    // Regex SEMPLICE per trovare URL
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = fixedText.split(urlRegex)

    return parts.map((part, index) => {
      // Se inizia con http:// o https:// e un link
      if (part.match(/^https?:\/\//)) {
        // CHECK: E un link YouTube?
        const youtubeLinks = extractYouTubeLinks(part)
        if (youtubeLinks.length > 0) {
          // Renderizza YouTube Preview invece del link normale
          return (
            <div key={index} className="my-2">
              <YouTubePreview
                url={part}
                onClick={(videoId) => setSelectedVideoId(videoId)}
                className="max-w-md"
              />
            </div>
          )
        }

        // Link normale (non YouTube)
        // FIX: For short URLs (/s/), open in mobile popup for consistent behavior
        const isShortUrl = part.includes('/s/') && part.includes('localhost:3000')
        
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              // Short URLs: Open in mobile-sized popup for preview
              if (isShortUrl) {
                e.preventDefault()
                openInMobilePopup(part)
                return
              }
              
              if (onLinkClick) {
                e.preventDefault()
                onLinkClick(part, e)
              }
              // Se non c'e onLinkClick, lascia il comportamento default (apre il link)
            }}
          >
            {part}
          </a>
        )
      }
      // Altrimenti e testo normale - gestisci formattazione
      // FIX: Remove markdown code blocks (```json, ```, etc.)
      let formatted = part
        .replace(/```json\s*/g, "") // Remove ```json opening
        .replace(/```\s*/g, "") // Remove ``` opening/closing
        .replace(/\n/g, "<br>") // FIX: Convert newlines to <br> for proper rendering
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
          /~~(.*?)~~/g,
          "<s style='text-decoration: line-through;'>$1</s>"
        ) // Markdown strikethrough (double tilde)
        .replace(/~(.*?)~/g, "<s style='text-decoration: line-through;'>$1</s>") // WhatsApp strikethrough (single tilde)
        .replace(/→\s*(€[\d.,]+)/g, "→ <strong>$1</strong>")

      // Restore img placeholders
      formatted = formatted.replace(/__IMG_PLACEHOLDER_(\d+)__/g, (_, idx) => {
        return imgPlaceholders[parseInt(idx)] || ''
      })

      // SECURITY: Sanitize HTML to prevent XSS attacks
      const sanitized = DOMPurify.sanitize(formatted, {
        ALLOWED_TAGS: ["strong", "em", "s", "br", "img", "b"],
        ALLOWED_ATTR: ["style", "src", "alt", "width", "height", "class"],
        KEEP_CONTENT: true,
      })

      return (
        <span key={index} dangerouslySetInnerHTML={{ __html: sanitized }} />
      )
    })
  }

  // Se e chat, splitta e renderizza con link
  if (variant === "chat") {
    return (
      <>
        <div
          className={`${baseClasses} ${variantClasses[variant]} ${className}`}
          style={{ whiteSpace: "pre-wrap" }}
        >
          {renderWithLinks(content)}
        </div>

        {/* YouTube Player Modal */}
        <YouTubePlayerModal
          videoId={selectedVideoId}
          onClose={() => setSelectedVideoId(null)}
        />
      </>
    )
  }

  // Per altre varianti, usa ReactMarkdown
  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml={false}
        components={{
          // Consistent link styling
          a: ({ node, href, ...props }) => {
            // FIX: For short URLs (/s/), force full page navigation
            const isShortUrl = href && href.includes('/s/') && href.includes('localhost:3000')
            
            return (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                onClick={(e) => {
                  if (isShortUrl && href) {
                    e.preventDefault()
                    window.location.href = href
                    return
                  }
                  
                  if (onLinkClick && href) {
                    onLinkClick(href, e)
                  }
                }}
              />
            )
          },
          // Clean paragraph rendering
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          // Text formatting
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          // Strikethrough support for ~~text~~
          del: ({ children }) => (
            <s style={{ textDecoration: "line-through" }}>{children}</s>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
