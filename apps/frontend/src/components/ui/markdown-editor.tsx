import { Edit2, LayoutTemplate } from 'lucide-react'
import { logger } from "@/lib/logger"
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  minHeight?: string
  name?: string
  hidePlayground?: boolean
}

export default function MarkdownEditor({ 
  value, 
  onChange, 
  minHeight = "400px", 
  name,
  hidePlayground = false 
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);
  
  // Aggiungiamo un log per tracciare il valore iniziale
  useEffect(() => {
    logger.info("MarkdownEditor initial value:", value ? (value.length > 30 ? value.substring(0, 30) + "..." : value) : "(empty)");
    logger.info("hidePlayground value:", hidePlayground);
  }, []);
  
  // Update local value when prop value changes
  useEffect(() => {
    logger.info("MarkdownEditor value changed:", value ? (value.length > 30 ? value.substring(0, 30) + "..." : value) : "(empty)");
    setLocalValue(value);
  }, [value]);
  
  // When the component mounts or value changes, update the textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = localValue;
      logger.info("Updated textarea with localValue:", localValue ? (localValue.length > 30 ? localValue.substring(0, 30) + "..." : localValue) : "(empty)");
    }
  }, [localValue]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    logger.info("MarkdownEditor handleChange:", newValue ? (newValue.length > 30 ? newValue.substring(0, 30) + "..." : newValue) : "(empty)");
    setLocalValue(newValue);
    onChange(newValue);
  }

  // Calculate editor height
  const getEditorHeight = () => {
    if (typeof minHeight === 'string' && minHeight.endsWith('px')) {
      const heightValue = parseInt(minHeight.slice(0, -2)) - 20;
      return `${heightValue}px`;
    }
    return 'calc(' + minHeight + ' - 20px)';
  };

  const editorHeight = getEditorHeight();

  return (
    <div className="border rounded-md shadow-sm overflow-hidden bg-white h-full flex flex-col w-full" style={{ maxHeight: 'calc(100vh - 180px)' }}>
      <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
        {/* Editor Panel */}
        <div className="w-full flex flex-col overflow-hidden">
          <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 text-xs text-gray-600">
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
            <span>Editor</span>
          </div>
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={handleChange}
            className="w-full p-3 font-mono text-xs focus:outline-none border-0 resize-none bg-gray-50 text-gray-800 flex-grow"
            style={{ 
              minHeight: editorHeight,
              boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.05)"
            }}
            placeholder="Enter Markdown text here..."
          />
        </div>

        {/* Preview Panel - hidden if hidePlayground is true */}
        {!hidePlayground && (
          <div className="w-full md:w-1/2 flex flex-col overflow-hidden border-l border-gray-300">
            <div className="flex items-center px-3 py-1.5 bg-gray-100 border-b border-gray-300 text-xs text-gray-600">
              <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" />
              <span>Preview</span>
            </div>
            <div 
              className="prose prose-xs max-w-none p-3 overflow-y-auto bg-white flex-grow markdown-preview"
              style={{ 
                minHeight: editorHeight,
                overflowX: 'auto',
                fontSize: '0.75rem'
              }}
            >
              {localValue ? (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]} 
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    // Personalizzazione dei componenti renderizzati
                    h1: ({node, ...props}) => <h1 className="text-xl font-bold my-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-lg font-bold my-3" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-base font-bold my-2" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                    em: ({node, ...props}) => <em className="italic" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2" {...props} />,
                    li: ({node, ...props}) => <li className="my-1" {...props} />,
                    a: ({node, ...props}) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2" {...props} />,
                    code: ({node, inline, ...props}: {node: any, inline?: boolean, [key: string]: any}) => 
                      inline 
                        ? <code className="bg-gray-100 px-1 rounded text-sm font-mono" {...props} />
                        : <code className="block bg-gray-100 p-2 rounded text-sm font-mono my-2 overflow-x-auto" {...props} />
                  }}
                >
                  {localValue}
                </ReactMarkdown>
              ) : (
                <div className="text-gray-400 italic">Preview will appear here when you write Markdown content...</div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden input field for form submission */}
      {name && (
        <input 
          type="hidden" 
          name={name} 
          value={localValue} 
          id={`${name}-hidden-input`}
          onChange={() => logger.info(`Hidden input for ${name} changed to:`, localValue ? (localValue.length > 30 ? localValue.substring(0, 30) + "..." : localValue) : "(empty)")}
        />
      )}
    </div>
  )
} 
