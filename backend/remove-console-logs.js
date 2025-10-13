#!/usr/bin/env node
/**
 * Script to remove console.log/warn/error from test files
 * Usage: node remove-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'src/__tests__/security/secure-token.service.unit.test.ts',
  'src/__tests__/security/whatsapp-message-security.test.ts',
  'src/__tests__/security/hard-rate-limit-unit.test.ts',
  'src/__tests__/security/security-basic.test.ts',
  'src/__tests__/security/admin-session.service.unit.test.ts',
];

function removeConsoleLogs(filePath) {
  console.log(`\n📝 Processing: ${filePath}`);
  
  const fullPath = path.join(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf-8');
  const originalLength = content.length;
  
  // Count console statements before removal
  const consoleMatches = content.match(/console\.(log|warn|error)\([^)]*\)/g) || [];
  console.log(`   Found ${consoleMatches.length} console statements`);
  
  // Remove single-line console statements
  content = content.replace(/\s*console\.(log|warn|error)\([^)]*\);?\n/g, '');
  
  // Remove multi-line console statements (with template literals or objects)
  content = content.replace(/\s*console\.(log|warn|error)\(\s*[\s\S]*?\);?\n/g, '');
  
  // Clean up any double newlines created by removal
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  const removedChars = originalLength - content.length;
  console.log(`   Removed ${removedChars} characters`);
  
  // Write back
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`   ✅ Cleaned: ${filePath}`);
}

console.log('🧹 Removing console.log statements from test files...\n');

testFiles.forEach(removeConsoleLogs);

console.log('\n✅ Done! All console statements removed from test files.');
console.log('\n💡 Run "npm run test:unit" to verify tests still pass.');
