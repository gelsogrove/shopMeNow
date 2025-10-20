import { containsYouTubeLink, extractYouTubeLinks } from "@/utils/youtubeUtils"
import DOMPurify from "dompurify"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { YouTubePlayerModal } from "./YouTubePlayerModal"
import { YouTubePreview } from "./YouTubePreview"

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

  // 🎥 FEATURE: YouTube Preview - Detect and render YouTube links as previews
  const hasYouTubeLink = containsYouTubeLink(content)

  // SOLUZIONE BRUTALE: Spacca il testo e trova tutti gli URL
  const renderWithLinks = (text: string) => {
    // Regex SEMPLICE per trovare URL
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)

    return parts.map((part, index) => {
      // Se inizia con http:// o https:// è un link
      if (part.match(/^https?:\/\//)) {
        // 🎥 CHECK: È un link YouTube?
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
        return (
          <a
            key={index}
            href="#"
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              if (onLinkClick) {
                onLinkClick(part, e)
              }
            }}
          >
            {part}
          </a>
        )
      }
      // Altrimenti è testo normale - gestisci formattazione
      const formatted = part
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
          /~~(.*?)~~/g,
          "<s style='text-decoration: line-through;'>$1</s>"
        ) // Markdown strikethrough (double tilde)
        .replace(/~(.*?)~/g, "<s style='text-decoration: line-through;'>$1</s>") // WhatsApp strikethrough (single tilde)
        .replace(/→\s*(€[\d.,]+)/g, "→ <strong>$1</strong>")

      // ✅ SECURITY: Sanitize HTML to prevent XSS attacks
      const sanitized = DOMPurify.sanitize(formatted, {
        ALLOWED_TAGS: ["strong", "em", "s", "br"],
        ALLOWED_ATTR: ["style"],
        KEEP_CONTENT: true,
      })

      return (
        <span key={index} dangerouslySetInnerHTML={{ __html: sanitized }} />
      )
    })
  }

  // Se è chat, splitta e renderizza con link
  if (variant === "chat") {
    return (
      <>
        <div
          className={`${baseClasses} ${variantClasses[variant]} ${className}`}
          style={{ whiteSpace: "pre-wrap" }}
        >
          {renderWithLinks(content)}
        </div>

        {/* 🎥 YouTube Player Modal */}
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
          a: ({ node, href, ...props }) => (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                if (onLinkClick && href) {
                  onLinkClick(href, e)
                }
              }}
            />
          ),
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
