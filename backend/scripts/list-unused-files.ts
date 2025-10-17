#!/usr/bin/env ts-node

/**
 * 📋 LIST UNUSED FILES
 * Lista completa di tutti i file inutilizzati identificati dall'analisi
 */

import * as fs from 'fs'
import * as path from 'path'

const EXCLUDED_DIRS = ['node_modules', 'dist', 'build', '.git', 'logs', 'uploads', 'temp']
const EXCLUDED_FILES = ['.test.ts', '.spec.ts', 'jest.config', 'jest.setup']

class FileScanner {
  private allFiles: string[] = []
  private fileImports: Map<string, Set<string>> = new Map()
  
  constructor(private rootDir: string) {}

  scanFiles(dir: string): string[] {
    const files: string[] = []

    const scan = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRS.includes(entry.name)) {
            scan(fullPath)
          }
          continue
        }

        if (entry.isFile() && entry.name.endsWith('.ts')) {
          if (!EXCLUDED_FILES.some(excluded => entry.name.includes(excluded))) {
            files.push(fullPath)
          }
        }
      }
    }

    scan(dir)
    return files
  }

  analyzeImports(files: string[]) {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')
      const imports = new Set<string>()

      const importRegex = /import\s+.*?\s+from\s+['"](\.\.?\/[^'"]+|@\/[^'"]+)['"]/g
      const matches = content.matchAll(importRegex)

      for (const match of matches) {
        const importPath = match[1]
        const resolvedPath = this.resolveImportPath(file, importPath)
        if (resolvedPath) {
          imports.add(resolvedPath)
        }
      }

      this.fileImports.set(file, imports)
    }
  }

  resolveImportPath(fromFile: string, importPath: string): string | null {
    const fromDir = path.dirname(fromFile)
    
    if (importPath.startsWith('@/')) {
      const srcPath = importPath.replace('@/', 'src/')
      importPath = srcPath
    }

    let resolved = path.resolve(fromDir, importPath)

    if (fs.existsSync(resolved + '.ts')) {
      return resolved + '.ts'
    }

    if (fs.existsSync(path.join(resolved, 'index.ts'))) {
      return path.join(resolved, 'index.ts')
    }

    if (fs.existsSync(resolved)) {
      return resolved
    }

    return null
  }

  findUnusedFiles(files: string[]): string[] {
    const unused: string[] = []
    const imported = new Set<string>()

    for (const imports of this.fileImports.values()) {
      for (const importedFile of imports) {
        imported.add(importedFile)
      }
    }

    for (const file of files) {
      // Skip entry points
      if (file.includes('index.ts') || 
          file.includes('server.ts') || 
          file.includes('app.ts') ||
          file.includes('main.ts') ||
          file.includes('routes/index.ts')) {
        continue
      }

      if (!imported.has(file)) {
        // Make path relative to rootDir for readability
        const relativePath = path.relative(this.rootDir, file)
        unused.push(relativePath)
      }
    }

    return unused.sort()
  }

  async run() {
    console.log('🔍 Scanning files...\n')
    
    this.allFiles = this.scanFiles(this.rootDir)
    console.log(`Found ${this.allFiles.length} TypeScript files\n`)
    
    console.log('📥 Analyzing imports...\n')
    this.analyzeImports(this.allFiles)
    
    console.log('🗑️  Finding unused files...\n')
    const unusedFiles = this.findUnusedFiles(this.allFiles)
    
    console.log(`\n📋 UNUSED FILES (${unusedFiles.length} total):\n`)
    console.log('=' .repeat(80))
    
    // Group by folder
    const grouped = new Map<string, string[]>()
    
    for (const file of unusedFiles) {
      const dir = path.dirname(file)
      if (!grouped.has(dir)) {
        grouped.set(dir, [])
      }
      grouped.get(dir)!.push(path.basename(file))
    }
    
    // Print grouped
    for (const [dir, files] of Array.from(grouped.entries()).sort()) {
      console.log(`\n📁 ${dir}/`)
      for (const file of files.sort()) {
        console.log(`   ❌ ${file}`)
      }
    }
    
    console.log('\n' + '='.repeat(80))
    console.log(`\n✅ Total unused files: ${unusedFiles.length}`)
    
    // Save to file
    const outputPath = path.join(this.rootDir, 'docs', 'unused-files-list.txt')
    fs.writeFileSync(outputPath, unusedFiles.join('\n'))
    console.log(`\n📄 List saved to: ${outputPath}\n`)
  }
}

// Run
const rootDir = path.resolve(__dirname, '..')
const scanner = new FileScanner(rootDir)
scanner.run().catch(console.error)
