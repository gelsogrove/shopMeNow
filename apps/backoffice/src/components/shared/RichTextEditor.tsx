import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  disabled?: boolean
}

/**
 * RichTextEditor - WYSIWYG editor for support tickets and other rich text content
 * 
 * Features:
 * - Bold, Italic, Underline, Strikethrough
 * - Text colors and background colors
 * - Lists (ordered, bullet)
 * - Links
 * - Clean paste from Word/Google Docs
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type your message...',
  className = '',
  minHeight = '150px',
  disabled = false,
}: RichTextEditorProps) {
  // Toolbar configuration - bold, italic, colors, lists
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
    clipboard: {
      matchVisual: false, // Clean paste
    },
  }

  const formats = [
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'list',
    'link',
  ]

  return (
    <div className={`rich-text-editor ${className}`}>
      <style>{`
        .rich-text-editor .ql-container {
          min-height: ${minHeight};
          font-size: 14px;
          font-family: inherit;
        }
        .rich-text-editor .ql-editor {
          min-height: ${minHeight};
        }
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
          background: #f8f9fa;
          border-color: #e5e7eb;
        }
        .rich-text-editor .ql-container {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
          border-color: #e5e7eb;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
        .rich-text-editor .ql-snow .ql-picker {
          color: #374151;
        }
        .rich-text-editor .ql-snow .ql-stroke {
          stroke: #374151;
        }
        .rich-text-editor .ql-snow .ql-fill {
          fill: #374151;
        }
        .rich-text-editor .ql-snow.ql-toolbar button:hover,
        .rich-text-editor .ql-snow .ql-toolbar button:hover {
          color: #7c3aed;
        }
        .rich-text-editor .ql-snow.ql-toolbar button:hover .ql-stroke,
        .rich-text-editor .ql-snow .ql-toolbar button:hover .ql-stroke {
          stroke: #7c3aed;
        }
        .rich-text-editor .ql-snow.ql-toolbar button.ql-active,
        .rich-text-editor .ql-snow .ql-toolbar button.ql-active {
          color: #7c3aed;
        }
        .rich-text-editor .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .rich-text-editor .ql-snow .ql-toolbar button.ql-active .ql-stroke {
          stroke: #7c3aed;
        }
        .dark .rich-text-editor .ql-toolbar {
          background: #1f2937;
          border-color: #374151;
        }
        .dark .rich-text-editor .ql-container {
          background: #111827;
          border-color: #374151;
          color: #f3f4f6;
        }
        .dark .rich-text-editor .ql-editor.ql-blank::before {
          color: #6b7280;
        }
        .dark .rich-text-editor .ql-snow .ql-picker {
          color: #d1d5db;
        }
        .dark .rich-text-editor .ql-snow .ql-stroke {
          stroke: #d1d5db;
        }
        .dark .rich-text-editor .ql-snow .ql-fill {
          fill: #d1d5db;
        }
      `}</style>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
      />
    </div>
  )
}

/**
 * Strip HTML tags and return plain text (for previews)
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

/**
 * Check if content is empty (handles Quill's empty state)
 */
export function isRichTextEmpty(html: string): boolean {
  if (!html) return true
  const stripped = stripHtml(html).trim()
  return stripped.length === 0
}
