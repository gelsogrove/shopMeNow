#!/usr/bin/env ts-node

/**
 * 🔍 DEAD CODE ANALYZER
 *
 * Analizza il codebase per trovare:
 * 1. File non importati da nessuno
 * 2. Export non utilizzati
 * 3. Commenti TODO/FIXME vecchi
 * 4. Import duplicati
 * 5. Funzioni non referenziate
 */

import * as fs from "fs"
import * as path from "path"

interface AnalysisResult {
  unusedFiles: string[]
  unusedExports: Array<{ file: string; export: string }>
  oldTodos: Array<{ file: string; line: number; comment: string }>
  duplicateImports: Array<{ file: string; imports: string[] }>
  suspiciousFiles: Array<{ file: string; reason: string }>
}

const EXCLUDED_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  "logs",
  "uploads",
  "temp",
]
const EXCLUDED_FILES = [".test.ts", ".spec.ts", "jest.config", "jest.setup"]

class DeadCodeAnalyzer {
  private allFiles: string[] = []
  private fileImports: Map<string, Set<string>> = new Map()
  private fileExports: Map<string, string[]> = new Map()

  constructor(private rootDir: string) {}

  async analyze(): Promise<AnalysisResult> {
    console.log("🔍 Starting dead code analysis...\n")

    // Step 1: Scan all TypeScript files
    console.log("📂 Step 1: Scanning TypeScript files...")
    this.allFiles = this.scanFiles(this.rootDir)
    console.log(`   Found ${this.allFiles.length} TypeScript files\n`)

    // Step 2: Analyze imports
    console.log("📥 Step 2: Analyzing imports...")
    this.analyzeImports()
    console.log(`   Analyzed imports in ${this.fileImports.size} files\n`)

    // Step 3: Find unused files
    console.log("🗑️  Step 3: Finding unused files...")
    const unusedFiles = this.findUnusedFiles()
    console.log(`   Found ${unusedFiles.length} potentially unused files\n`)

    // Step 4: Find unused exports
    console.log("📤 Step 4: Finding unused exports...")
    const unusedExports = this.findUnusedExports()
    console.log(`   Found ${unusedExports.length} unused exports\n`)

    // Step 5: Find old TODOs
    console.log("📝 Step 5: Finding old TODOs/FIXMEs...")
    const oldTodos = this.findOldTodos()
    console.log(`   Found ${oldTodos.length} TODO/FIXME comments\n`)

    // Step 6: Find duplicate imports
    console.log("🔁 Step 6: Finding duplicate imports...")
    const duplicateImports = this.findDuplicateImports()
    console.log(
      `   Found ${duplicateImports.length} files with duplicate imports\n`
    )

    // Step 7: Find suspicious files
    console.log("⚠️  Step 7: Finding suspicious files...")
    const suspiciousFiles = this.findSuspiciousFiles()
    console.log(`   Found ${suspiciousFiles.length} suspicious files\n`)

    return {
      unusedFiles,
      unusedExports,
      oldTodos,
      duplicateImports,
      suspiciousFiles,
    }
  }

  private scanFiles(dir: string): string[] {
    const files: string[] = []

    const scan = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        // Skip excluded directories
        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRS.includes(entry.name)) {
            scan(fullPath)
          }
          continue
        }

        // Only TypeScript files
        if (entry.isFile() && entry.name.endsWith(".ts")) {
          // Skip test files and config
          if (
            !EXCLUDED_FILES.some((excluded) => entry.name.includes(excluded))
          ) {
            files.push(fullPath)
          }
        }
      }
    }

    scan(dir)
    return files
  }

  private analyzeImports() {
    for (const file of this.allFiles) {
      const content = fs.readFileSync(file, "utf-8")
      const imports = new Set<string>()

      // Match: import ... from './path' or "../path" or "@/path"
      const importRegex =
        /import\s+.*?\s+from\s+['"](\.\.?\/[^'"]+|@\/[^'"]+)['"]/g
      const matches = content.matchAll(importRegex)

      for (const match of matches) {
        const importPath = match[1]
        // Resolve relative path
        const resolvedPath = this.resolveImportPath(file, importPath)
        if (resolvedPath) {
          imports.add(resolvedPath)
        }
      }

      this.fileImports.set(file, imports)

      // Find exports
      const exports: string[] = []
      const exportRegex =
        /export\s+(const|function|class|interface|type|enum)\s+(\w+)/g
      const exportMatches = content.matchAll(exportRegex)

      for (const match of exportMatches) {
        exports.push(match[2])
      }

      this.fileExports.set(file, exports)
    }
  }

  private resolveImportPath(
    fromFile: string,
    importPath: string
  ): string | null {
    const fromDir = path.dirname(fromFile)

    // Handle @/ alias
    if (importPath.startsWith("@/")) {
      const srcPath = importPath.replace("@/", "src/")
      importPath = srcPath
    }

    let resolved = path.resolve(fromDir, importPath)

    // Try adding .ts extension
    if (fs.existsSync(resolved + ".ts")) {
      return resolved + ".ts"
    }

    // Try index.ts
    if (fs.existsSync(path.join(resolved, "index.ts"))) {
      return path.join(resolved, "index.ts")
    }

    // Try as-is
    if (fs.existsSync(resolved)) {
      return resolved
    }

    return null
  }

  private findUnusedFiles(): string[] {
    const unused: string[] = []
    const imported = new Set<string>()

    // Collect all imported files
    for (const imports of this.fileImports.values()) {
      for (const importedFile of imports) {
        imported.add(importedFile)
      }
    }

    // Find files never imported
    for (const file of this.allFiles) {
      // Skip entry points
      if (
        file.includes("index.ts") ||
        file.includes("server.ts") ||
        file.includes("app.ts") ||
        file.includes("main.ts") ||
        file.includes("routes/index.ts")
      ) {
        continue
      }

      if (!imported.has(file)) {
        unused.push(file)
      }
    }

    return unused
  }

  private findUnusedExports(): Array<{ file: string; export: string }> {
    const unused: Array<{ file: string; export: string }> = []

    for (const [file, exports] of this.fileExports.entries()) {
      for (const exportName of exports) {
        let isUsed = false

        // Check if exported name is imported anywhere
        for (const otherFile of this.allFiles) {
          if (otherFile === file) continue

          const content = fs.readFileSync(otherFile, "utf-8")

          // Check for: import { ExportName } or import ExportName
          if (content.includes(exportName)) {
            isUsed = true
            break
          }
        }

        if (!isUsed) {
          unused.push({ file, export: exportName })
        }
      }
    }

    return unused
  }

  private findOldTodos(): Array<{
    file: string
    line: number
    comment: string
  }> {
    const todos: Array<{ file: string; line: number; comment: string }> = []

    for (const file of this.allFiles) {
      const content = fs.readFileSync(file, "utf-8")
      const lines = content.split("\n")

      lines.forEach((line, index) => {
        const todoMatch = line.match(/\/\/\s*(TODO|FIXME|XXX|HACK)[\s:]+(.+)/i)
        if (todoMatch) {
          todos.push({
            file,
            line: index + 1,
            comment: todoMatch[0].trim(),
          })
        }
      })
    }

    return todos
  }

  private findDuplicateImports(): Array<{ file: string; imports: string[] }> {
    const duplicates: Array<{ file: string; imports: string[] }> = []

    for (const file of this.allFiles) {
      const content = fs.readFileSync(file, "utf-8")
      const importMap = new Map<string, number>()

      // Find all imports
      const importRegex =
        /import\s+.*?\s+from\s+['"](\.\.?\/[^'"]+|@\/[^'"]+|[^'"]+)['"]/g
      const matches = content.matchAll(importRegex)

      for (const match of matches) {
        const importPath = match[1]
        importMap.set(importPath, (importMap.get(importPath) || 0) + 1)
      }

      // Find duplicates
      const dupes: string[] = []
      for (const [importPath, count] of importMap.entries()) {
        if (count > 1) {
          dupes.push(`${importPath} (${count} times)`)
        }
      }

      if (dupes.length > 0) {
        duplicates.push({ file, imports: dupes })
      }
    }

    return duplicates
  }

  private findSuspiciousFiles(): Array<{ file: string; reason: string }> {
    const suspicious: Array<{ file: string; reason: string }> = []

    for (const file of this.allFiles) {
      const content = fs.readFileSync(file, "utf-8")
      const stats = fs.statSync(file)

      // Empty or very small files
      if (stats.size < 50) {
        suspicious.push({ file, reason: "File too small (< 50 bytes)" })
        continue
      }

      // Files with only imports
      const codeLines = content.split("\n").filter((line) => {
        const trimmed = line.trim()
        return (
          trimmed &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*") &&
          !trimmed.startsWith("*")
        )
      })

      const importLines = codeLines.filter((line) => line.includes("import"))

      if (importLines.length > 0 && importLines.length === codeLines.length) {
        suspicious.push({ file, reason: "Only contains imports" })
        continue
      }

      // Files with "OLD" or "DEPRECATED" in name
      if (
        file.toLowerCase().includes("old") ||
        file.toLowerCase().includes("deprecated")
      ) {
        suspicious.push({ file, reason: "Filename contains OLD/DEPRECATED" })
      }
    }

    return suspicious
  }

  generateReport(result: AnalysisResult): string {
    let report = "\n" + "=".repeat(80) + "\n"
    report += "📊 DEAD CODE ANALYSIS REPORT\n"
    report += "=".repeat(80) + "\n\n"

    // Summary
    report += "📈 SUMMARY\n"
    report += "─".repeat(80) + "\n"
    report += `Total Files Analyzed: ${this.allFiles.length}\n`
    report += `Unused Files: ${result.unusedFiles.length}\n`
    report += `Unused Exports: ${result.unusedExports.length}\n`
    report += `TODO/FIXME Comments: ${result.oldTodos.length}\n`
    report += `Duplicate Imports: ${result.duplicateImports.length}\n`
    report += `Suspicious Files: ${result.suspiciousFiles.length}\n\n`

    // Unused Files
    if (result.unusedFiles.length > 0) {
      report += "🗑️  UNUSED FILES (not imported anywhere)\n"
      report += "─".repeat(80) + "\n"
      result.unusedFiles.slice(0, 20).forEach((file) => {
        report += `❌ ${this.relativePath(file)}\n`
      })
      if (result.unusedFiles.length > 20) {
        report += `... and ${result.unusedFiles.length - 20} more\n`
      }
      report += "\n"
    }

    // Suspicious Files
    if (result.suspiciousFiles.length > 0) {
      report += "⚠️  SUSPICIOUS FILES\n"
      report += "─".repeat(80) + "\n"
      result.suspiciousFiles.forEach(({ file, reason }) => {
        report += `⚠️  ${this.relativePath(file)}\n`
        report += `   Reason: ${reason}\n`
      })
      report += "\n"
    }

    // TODOs
    if (result.oldTodos.length > 0) {
      report += "📝 TODO/FIXME COMMENTS\n"
      report += "─".repeat(80) + "\n"
      result.oldTodos.slice(0, 15).forEach(({ file, line, comment }) => {
        report += `📝 ${this.relativePath(file)}:${line}\n`
        report += `   ${comment}\n`
      })
      if (result.oldTodos.length > 15) {
        report += `... and ${result.oldTodos.length - 15} more\n`
      }
      report += "\n"
    }

    // Duplicate Imports
    if (result.duplicateImports.length > 0) {
      report += "🔁 DUPLICATE IMPORTS\n"
      report += "─".repeat(80) + "\n"
      result.duplicateImports.forEach(({ file, imports }) => {
        report += `🔁 ${this.relativePath(file)}\n`
        imports.forEach((imp) => (report += `   ${imp}\n`))
      })
      report += "\n"
    }

    report += "=".repeat(80) + "\n"
    report += "✅ Analysis Complete!\n"
    report += "=".repeat(80) + "\n"

    return report
  }

  private relativePath(file: string): string {
    return path.relative(this.rootDir, file)
  }
}

// Run analysis
async function main() {
  const backendDir = path.join(__dirname, "..")
  const analyzer = new DeadCodeAnalyzer(backendDir)

  try {
    const result = await analyzer.analyze()
    const report = analyzer.generateReport(result)

    console.log(report)

    // Save report
    const reportPath = path.join(__dirname, "../docs/dead-code-analysis.txt")
    fs.writeFileSync(reportPath, report)
    console.log(`\n📄 Report saved to: ${reportPath}`)
  } catch (error) {
    console.error("❌ Analysis failed:", error)
    process.exit(1)
  }
}

main()
