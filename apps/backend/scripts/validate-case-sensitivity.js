#!/usr/bin/env node
/**
 * Case Sensitivity Validator for Imports
 * 
 * Scans all TypeScript test files for imports that reference calling-functions
 * and verifies the filenames match the actual files on disk (case-sensitive).
 * 
 * This catches case mismatch errors on macOS (case-insensitive filesystem)
 * before they fail on Linux CI/CD (case-sensitive filesystem).
 * 
 * Usage: node scripts/validate-case-sensitivity.js
 */

const fs = require('fs');
const path = require('path');

// Get the absolute path to calling-functions directory
const CALLING_FUNCTIONS_DIR = path.join(__dirname, '../src/domain/calling-functions');

function getFilesWithCase() {
  if (!fs.existsSync(CALLING_FUNCTIONS_DIR)) {
    console.error(`❌ calling-functions directory not found: ${CALLING_FUNCTIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CALLING_FUNCTIONS_DIR);
  const map = new Map();
  
  files.forEach(file => {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      return;
    }
    
    // Store without .ts extension for import matching
    const nameWithoutExt = file.replace(/\.ts$/, '');
    const lower = nameWithoutExt.toLowerCase();
    map.set(lower, nameWithoutExt); // Maps lowercase to actual case (without .ts)
  });
  
  return map;
}

function findImportsInDirectory(dir) {
  const imports = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!item.includes('node_modules') && !item.includes('dist')) {
          scan(fullPath);
        }
      } else if (item.endsWith('.spec.ts') || item.endsWith('.spec.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Look for calling-functions imports
        const regex = /from\s+["'].*calling-functions\/([^"']+)["']/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          imports.push({
            file: fullPath,
            importName: match[1],
            line: content.substring(0, match.index).split('\n').length,
          });
        }
      }
    });
  }
  
  scan(dir);
  return imports;
}

function validate() {
  const caseMap = getFilesWithCase();
  const testDir = path.join(__dirname, '..');
  const imports = findImportsInDirectory(testDir);
  
  let hasErrors = false;
  const errors = [];
  
  imports.forEach(({ file, importName, line }) => {
    const importLower = importName.toLowerCase();
    
    if (!caseMap.has(importLower)) {
      errors.push({
        type: 'NOT_FOUND',
        file: path.relative(process.cwd(), file),
        line,
        importName,
      });
      hasErrors = true;
      return;
    }
    
    const actualName = caseMap.get(importLower);
    
    // Compare the import name with actual file name (both without .ts)
    if (importName !== actualName) {
      errors.push({
        type: 'CASE_MISMATCH',
        file: path.relative(process.cwd(), file),
        line,
        expected: importName,
        actual: actualName,
      });
      hasErrors = true;
    }
  });
  
  if (hasErrors) {
    console.error('\n❌ CASE SENSITIVITY VALIDATION FAILED\n');
    
    errors.forEach(error => {
      if (error.type === 'NOT_FOUND') {
        console.error(`${error.file}:${error.line}`);
        console.error(`  ❌ File not found: ${error.importName}`);
      } else if (error.type === 'CASE_MISMATCH') {
        console.error(`${error.file}:${error.line}`);
        console.error(`  ❌ Case mismatch in import`);
        console.error(`     Expected: ${error.expected}`);
        console.error(`     Actual: ${error.actual}`);
      }
    });
    
    console.error('\n💡 This error would also appear on GitHub Actions (Linux)');
    console.error('   Fix by updating the import to match the actual filename case.\n');
    
    process.exit(1);
  }
  
  console.log('✅ Case sensitivity validation passed!');
  process.exit(0);
}

validate();
