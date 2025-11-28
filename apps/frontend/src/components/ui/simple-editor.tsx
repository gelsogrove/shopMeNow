import { type ChangeEvent } from 'react'

interface SimpleEditorProps {
  value: string
  onChange: (value: string) => void
  minHeight?: string
}

export default function SimpleEditor({ value, onChange, minHeight = "400px" }: SimpleEditorProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <textarea
      value={value}
      onChange={handleChange}
      style={{
        width: '100%',
        minHeight,
        padding: '1rem',
        fontFamily: 'monospace',
        fontSize: '14px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}
    />
  )
} 