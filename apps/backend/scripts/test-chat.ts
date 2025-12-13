#!/usr/bin/env npx ts-node
/**
 * Test Chat Script - Simula messaggi WhatsApp per testare Code-First LLM
 * 
 * Usage:
 *   npx ts-node scripts/test-chat.ts "messaggio da testare"
 *   npx ts-node scripts/test-chat.ts --batch    # Esegue tutti i test predefiniti
 *   npx ts-node scripts/test-chat.ts --interactive  # Modalità interattiva
 * 
 * Default: log=true, exit-first-message=true
 * Test User: Mario Rossi (whatsapp: 3331234567)
 */

import { prisma } from '@echatbot/database'

// =================== CONFIGURAZIONE ===================
const CONFIG = {
  workspaceId: 'cmj2l7sdp0000aangfqr3pj9b', // BellItalia VIP
  customerPhone: '3331234567', // Mario Rossi
  log: true,
  exitFirstMessage: true,
}

// =================== TEST CASES ===================
const TEST_CASES = {
  // === IDENTITY ===
  identity: [
    'chi sei?',
    'chi sei ?',
    'come ti chiami?',
    'presentati',
  ],
  
  // === LOCATION ===
  location: [
    'dove siete?',
    'dove sei ?',
    'dove vi trovate?',
    'qual è il vostro indirizzo?',
  ],
  
  // === PRODUCTS/CATEGORIES ===
  products: [
    'che prodotti avete?',
    'che prodotti fornite?',
    'cosa vendete?',
    'mostrami i prodotti',
    'catalogo',
  ],
  
  // === PRODUCT SEARCH ===
  search: [
    'avete la mozzarella?',
    'cerco il salame milano',
    'hai del prosciutto?',
    'avete formaggi stagionati?',
  ],
  
  // === CART ===
  cart: [
    'aggiungi al carrello salame milano',
    'aggiungi 2 mozzarella di bufala',
    'mostra carrello',
    'vedi carrello',
    'rimuovi salame dal carrello',
    'svuota carrello',
  ],
  
  // === ORDERS ===
  orders: [
    'lista ordini',
    'i miei ordini',
    'stato ordine',
    'fattura ultimo ordine',
    'dettaglio ordine 123',
  ],
  
  // === SELECT FROM LIST ===
  selection: [
    '1',
    '3',
    '5',
  ],
  
  // === GREETINGS ===
  greetings: [
    'ciao',
    'buongiorno',
    'salve',
  ],
  
  // === HELP ===
  help: [
    'aiuto',
    'help',
    'cosa posso fare?',
  ],
}

// =================== COLORI TERMINALE ===================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// =================== FUNZIONI HELPER ===================
function log(message: string, color: string = colors.reset) {
  if (CONFIG.log) {
    console.log(`${color}${message}${colors.reset}`)
  }
}

function logSection(title: string) {
  log(`\n${'='.repeat(60)}`, colors.cyan)
  log(`  ${title}`, colors.cyan + colors.bright)
  log(`${'='.repeat(60)}`, colors.cyan)
}

function logTest(message: string, response: string, success: boolean) {
  const statusIcon = success ? '✅' : '❌'
  const statusColor = success ? colors.green : colors.red
  
  log(`\n${colors.yellow}📤 Input:${colors.reset} "${message}"`)
  log(`${statusColor}${statusIcon} Output:${colors.reset}`)
  
  // Formatta response
  const lines = response.split('\n')
  lines.forEach(line => {
    log(`   ${line}`)
  })
}

// =================== SIMULAZIONE WEBHOOK ===================
async function simulateMessage(message: string): Promise<{
  response: string
  success: boolean
  intent?: string
  error?: string
}> {
  try {
    // Trova o crea customer
    let customer = await prisma.customer.findFirst({
      where: {
        workspaceId: CONFIG.workspaceId,
        whatsappPhone: CONFIG.customerPhone,
      }
    })
    
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          workspaceId: CONFIG.workspaceId,
          whatsappPhone: CONFIG.customerPhone,
          firstName: 'Mario',
          lastName: 'Rossi',
          email: 'mario.rossi@test.com',
          preferredLanguage: 'it',
        }
      })
      log(`📱 Created test customer: Mario Rossi`, colors.magenta)
    }
    
    // Trova o crea chat session
    let session = await prisma.chatSession.findFirst({
      where: {
        workspaceId: CONFIG.workspaceId,
        customerId: customer.id,
        status: 'active',
      }
    })
    
    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          workspaceId: CONFIG.workspaceId,
          customerId: customer.id,
          status: 'active',
        }
      })
      log(`💬 Created chat session: ${session.id}`, colors.magenta)
    }
    
    // Importa dinamicamente il servizio - CORRETTO PATH E PASSA PRISMA
    const { CodeFirstLLMService } = await import('../src/application/code-first-llm/code-first-llm.service')
    
    const codeFirstLLM = new CodeFirstLLMService(prisma as any)
    
    // Processa il messaggio
    const result = await codeFirstLLM.processMessage({
      workspaceId: CONFIG.workspaceId,
      customerId: customer.id,
      message,
      customerLanguage: 'it',
    })
    
    return {
      response: result.response || result.message || '[EMPTY RESPONSE]',
      success: !result.response?.includes('[ERROR]') && !result.message?.includes('non ho capito'),
      intent: result.intent,
    }
    
  } catch (error: any) {
    return {
      response: `[ERROR] ${error.message}`,
      success: false,
      error: error.message,
    }
  }
}

// =================== ESECUZIONE TEST ===================
async function runSingleTest(message: string) {
  logSection(`Testing Single Message`)
  const result = await simulateMessage(message)
  logTest(message, result.response, result.success)
  
  if (result.intent) {
    log(`   ${colors.blue}Intent: ${result.intent}${colors.reset}`)
  }
  
  if (CONFIG.exitFirstMessage) {
    await prisma.$disconnect()
    process.exit(result.success ? 0 : 1)
  }
}

async function runBatchTests() {
  logSection(`Running All Test Cases`)
  
  let passed = 0
  let failed = 0
  const failures: { category: string; message: string; error: string }[] = []
  
  for (const [category, messages] of Object.entries(TEST_CASES)) {
    log(`\n${colors.bright}📁 Category: ${category.toUpperCase()}${colors.reset}`)
    
    for (const message of messages) {
      const result = await simulateMessage(message)
      
      if (result.success) {
        passed++
        log(`  ${colors.green}✅ "${message}"${colors.reset}`)
      } else {
        failed++
        log(`  ${colors.red}❌ "${message}"${colors.reset}`)
        failures.push({
          category,
          message,
          error: result.response,
        })
      }
      
      // Breve pausa tra test
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // Summary
  logSection(`Test Summary`)
  log(`${colors.green}✅ Passed: ${passed}${colors.reset}`)
  log(`${colors.red}❌ Failed: ${failed}${colors.reset}`)
  log(`📊 Total: ${passed + failed}`)
  log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  
  if (failures.length > 0) {
    logSection(`Failed Tests`)
    failures.forEach(f => {
      log(`${colors.red}[${f.category}] "${f.message}"${colors.reset}`)
      log(`   Error: ${f.error}`)
    })
  }
  
  await prisma.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

async function runInteractive() {
  const readline = await import('readline')
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  
  logSection(`Interactive Mode`)
  log(`Type a message and press Enter. Type 'exit' to quit.`)
  log(`Test user: Mario Rossi (${CONFIG.customerPhone})`)
  log(`Workspace: ${CONFIG.workspaceId}`)
  
  const prompt = () => {
    rl.question(`\n${colors.cyan}You: ${colors.reset}`, async (input) => {
      if (input.toLowerCase() === 'exit') {
        log(`\n${colors.yellow}Goodbye!${colors.reset}`)
        await prisma.$disconnect()
        rl.close()
        process.exit(0)
      }
      
      const result = await simulateMessage(input)
      log(`${colors.green}Bot: ${colors.reset}${result.response}`)
      
      if (result.intent) {
        log(`${colors.blue}[Intent: ${result.intent}]${colors.reset}`)
      }
      
      prompt()
    })
  }
  
  prompt()
}

// =================== MAIN ===================
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--batch')) {
    await runBatchTests()
  } else if (args.includes('--interactive') || args.includes('-i')) {
    await runInteractive()
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    // Single message test
    await runSingleTest(args.join(' '))
  } else {
    // Show help
    console.log(`
${colors.cyan}Test Chat Script - Code-First LLM Tester${colors.reset}

${colors.bright}Usage:${colors.reset}
  npx ts-node scripts/test-chat.ts "messaggio"     Test single message
  npx ts-node scripts/test-chat.ts --batch         Run all test cases
  npx ts-node scripts/test-chat.ts --interactive   Interactive mode

${colors.bright}Examples:${colors.reset}
  npx ts-node scripts/test-chat.ts "chi sei?"
  npx ts-node scripts/test-chat.ts "che prodotti avete?"
  npx ts-node scripts/test-chat.ts "aggiungi al carrello salame"

${colors.bright}Test Categories:${colors.reset}
  - identity: chi sei?, come ti chiami?
  - location: dove siete?, indirizzo
  - products: catalogo, prodotti
  - search: avete X?, cerco Y
  - cart: aggiungi, rimuovi, mostra carrello
  - orders: lista ordini, fattura
  - selection: 1, 2, 3 (from list)
  - greetings: ciao, buongiorno
  - help: aiuto, cosa posso fare?
`)
    await prisma.$disconnect()
    process.exit(0)
  }
}

main().catch(async (error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error)
  await prisma.$disconnect()
  process.exit(1)
})
