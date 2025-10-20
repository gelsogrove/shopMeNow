#!/usr/bin/env node

/**
 * Script to automatically remove console.log/error/warn statements
 * and replace them with proper logger calls
 *
 * Usage: node backend/scripts/remove-console-logs.js <file-path>
 */

const fs = require("fs")
const path = require("path")

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8")
  let modified = content
  let changeCount = 0

  // Pattern 1: Single-line console.log/error/warn
  const singleLinePattern = /^(\s*)console\.(log|error|warn)\((.*)\);?\s*$/gm
  modified = modified.replace(
    singleLinePattern,
    (match, indent, type, args) => {
      changeCount++
      const loggerMethod = type === "log" ? "info" : type
      return `${indent}logger.${loggerMethod}(${args})`
    }
  )

  // Pattern 2: Multi-line console statements
  const multiLinePattern = /^(\s*)console\.(log|error|warn)\(\s*$/gm
  modified = modified.replace(multiLinePattern, (match, indent, type) => {
    changeCount++
    const loggerMethod = type === "log" ? "info" : type
    return `${indent}logger.${loggerMethod}(`
  })

  // Pattern 3: Remove commented console statements
  const commentedPattern = /^(\s*)\/\/\s*console\.(log|error|warn)\(.*$/gm
  const commentedCount = (content.match(commentedPattern) || []).length
  modified = modified.replace(commentedPattern, "")
  changeCount += commentedCount

  if (changeCount > 0) {
    fs.writeFileSync(filePath, modified, "utf8")
    console.log(
      `✅ ${path.basename(filePath)}: Removed/replaced ${changeCount} console statements`
    )
    return changeCount
  } else {
    console.log(`ℹ️  ${path.basename(filePath)}: No console statements found`)
    return 0
  }
}

// Main execution
const filePath = process.argv[2]
if (!filePath) {
  console.error("❌ Usage: node remove-console-logs.js <file-path>")
  process.exit(1)
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`)
  process.exit(1)
}

try {
  const count = processFile(filePath)
  process.exit(0)
} catch (error) {
  console.error("❌ Error processing file:", error.message)
  process.exit(1)
}
