import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MessageRendererProps {
  content: string
  className?: string
  variant?: "chat" | "compact"
}

export function MessageRenderer({
  content,
  className = "",
  variant = "chat",
}: MessageRendererProps) {
  // Base classes for consistent formatting
  const baseClasses = "break-words text-sm text-left"

  // Variant-specific classes
  const variantClasses = {
    chat: "leading-tight",
    compact: "leading-normal",
  }

  // SOLUZIONE BRUTALE: Spacca il testo e trova tutti gli URL
  const renderWithLinks = (text: string) => {
    // Regex SEMPLICE per trovare URL
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)

    return parts.map((part, index) => {
      // Se inizia con http:// o https:// è un link
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline cursor-pointer"
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

      return (
        <span key={index} dangerouslySetInnerHTML={{ __html: formatted }} />
      )
    })
  }

  // Se è chat, splitta e renderizza con link
  if (variant === "chat") {
    return (
      <div
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        style={{ whiteSpace: "pre-wrap" }}
      >
        {renderWithLinks(content)}
      </div>
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
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
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
