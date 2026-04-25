// CLI output and formatting utilities
export const CLI_WIDTH = 78
export const CLI_RULE = '='.repeat(78)
export const CLI_SUBRULE = '-'.repeat(78)
export const BOT_MESSAGE_SEPARATOR = '\n<<<BOT_SPLIT>>>\n'

export function wrapPlainText(text: string, width = CLI_WIDTH - 4): string[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const wrapped: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      wrapped.push('')
      continue
    }

    const words = line.split(/\s+/)
    let current = ''

    for (const word of words) {
      if (!current) {
        current = word
        continue
      }

      const candidate = `${current} ${word}`
      if (candidate.length <= width) {
        current = candidate
      } else {
        wrapped.push(current)
        current = word
      }
    }

    if (current) wrapped.push(current)
  }

  return wrapped.length ? wrapped : ['']
}

export function printCliBanner(title: string, subtitle?: string): void {
  console.log(`\n${CLI_RULE}`)
  console.log(title)
  if (subtitle) {
    console.log(CLI_SUBRULE)
    console.log(subtitle)
  }
  console.log(CLI_RULE)
}

export function printCliMessage(label: 'You' | 'Bot' | 'Info' | 'Error', message: string): void {
  if (label === 'Bot' && message.includes(BOT_MESSAGE_SEPARATOR)) {
    for (const chunk of message.split(BOT_MESSAGE_SEPARATOR).filter(Boolean)) {
      printCliMessage(label, chunk)
    }
    return
  }

  const header = `[${label.toUpperCase()}]`
  const lines = wrapPlainText(message)

  console.log(`\n${header}`)
  for (const line of lines) {
    console.log(line ? `  ${line}` : '')
  }
}

export function printDebug(debug: string[]): void {
  if (!debug.length) return
  console.log('\n[DEBUG]')
  for (const line of debug) {
    console.log(`  ${line}`)
  }
}
