interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  minHeight?: string
}

export function MarkdownEditor({
  value,
  onChange,
  minHeight = "400px",
}: MarkdownEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        minHeight,
        padding: '16px',
        fontFamily: 'monospace',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        outline: 'none'
      }}
      placeholder="Inserisci il contenuto..."
    />
  )
}

interface MarkdownViewProps {
  content: string
}

export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '6px'
    }}>
      {content}
    </div>
  )
} 