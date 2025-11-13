/**
 * Validate Agent Prompts - Constitution v1.5.0 Compliance
 *
 * This script validates that agent prompts follow Constitution rules:
 * - Principle III: No duplicate large variables ({{PRODUCTS}}, {{OFFERS}}, {{SERVICES}}, {{CATEGORIES}})
 * - Principle VIII Rule #4: Router MUST NOT have product/category data
 * - Principle VIII Rule #6: Only ONE large variable per category per agent
 *
 * Usage: npx ts-node scripts/validate-agent-prompts.ts
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

interface ValidationResult {
  agentType: string
  agentName: string
  status: "PASS" | "FAIL"
  errors: string[]
  warnings: string[]
}

// Large variables that can inject 50k+ tokens
const LARGE_VARIABLES = ["PRODUCTS", "OFFERS", "SERVICES", "CATEGORIES"]

// Variables forbidden for Router (Principle VIII Rule #4)
const ROUTER_FORBIDDEN = ["PRODUCTS", "CATEGORIES"]

/**
 * Check for duplicate large variables in prompt
 */
function checkDuplicates(prompt: string): string[] {
  const errors: string[] = []

  for (const variable of LARGE_VARIABLES) {
    const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g")
    const matches = prompt.match(regex)

    if (matches && matches.length > 1) {
      errors.push(
        `❌ Variable {{${variable}}} appears ${matches.length} times (max: 1)`
      )
    }
  }

  return errors
}

/**
 * Check Router-specific rules (MUST NOT have PRODUCTS or CATEGORIES)
 */
function checkRouterRules(prompt: string): string[] {
  const errors: string[] = []

  for (const variable of ROUTER_FORBIDDEN) {
    const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g")
    const matches = prompt.match(regex)

    if (matches && matches.length > 0) {
      errors.push(
        `❌ Router MUST NOT have {{${variable}}} variable (Principle VIII Rule #4)`
      )
    }
  }

  return errors
}

/**
 * Validate prompt file from docs/prompts/
 */
function validatePromptFile(filename: string): ValidationResult {
  const filePath = path.join(__dirname, "..", "..", "docs", "prompts", filename)

  if (!fs.existsSync(filePath)) {
    return {
      agentType: filename.replace(".md", "").toUpperCase(),
      agentName: filename.replace(".md", "").replace(/-/g, " "),
      status: "FAIL",
      errors: [`❌ Prompt file not found: ${filePath}`],
      warnings: [],
    }
  }

  const prompt = fs.readFileSync(filePath, "utf-8")
  const agentType = filename.replace("-agent.md", "").toUpperCase()
  const agentName = filename.replace(".md", "").replace(/-/g, " ")

  const errors: string[] = []
  const warnings: string[] = []

  // Check 1: Duplicate large variables (applies to ALL agents)
  errors.push(...checkDuplicates(prompt))

  // Check 2: Router-specific rules
  if (agentType === "ROUTER") {
    errors.push(...checkRouterRules(prompt))
  }

  return {
    agentType,
    agentName,
    status: errors.length > 0 ? "FAIL" : "PASS",
    errors,
    warnings,
  }
}

/**
 * Validate all prompts in database
 */
async function validateDatabasePrompts(): Promise<ValidationResult[]> {
  const agents = await prisma.agentConfig.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true, systemPrompt: true },
  })

  const results: ValidationResult[] = []

  for (const agent of agents) {
    const errors: string[] = []
    const warnings: string[] = []

    if (!agent.systemPrompt) {
      errors.push("❌ No systemPrompt defined")
    } else {
      // Check 1: Duplicate large variables
      errors.push(...checkDuplicates(agent.systemPrompt))

      // Check 2: Router-specific rules
      if (agent.type === "ROUTER") {
        errors.push(...checkRouterRules(agent.systemPrompt))
      }
    }

    results.push({
      agentType: agent.type,
      agentName: agent.name,
      status: errors.length > 0 ? "FAIL" : "PASS",
      errors,
      warnings,
    })
  }

  return results
}

/**
 * Main validation function
 */
async function main() {
  console.log(
    "\n🔍 VALIDATING AGENT PROMPTS - Constitution v1.5.0 Compliance\n"
  )
  console.log("=".repeat(80))

  // STEP 1: Validate prompt files in docs/prompts/
  console.log("\n📄 STEP 1: Validating prompt files (docs/prompts/)\n")

  const promptFiles = [
    "router-agent.md",
    "product-search-agent.md",
    "cart-management-agent.md",
    "order-tracking-agent.md",
    "customer-support-agent.md",
    "safety-translation-agent.md",
  ]

  const fileResults: ValidationResult[] = []
  for (const filename of promptFiles) {
    const result = validatePromptFile(filename)
    fileResults.push(result)

    const icon = result.status === "PASS" ? "✅" : "❌"
    console.log(`${icon} ${result.agentName} (${result.agentType})`)

    if (result.errors.length > 0) {
      result.errors.forEach((err) => console.log(`   ${err}`))
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach((warn) => console.log(`   ⚠️  ${warn}`))
    }
  }

  // STEP 2: Validate prompts in database
  console.log(
    "\n📊 STEP 2: Validating prompts in database (agentConfig table)\n"
  )

  const dbResults = await validateDatabasePrompts()

  for (const result of dbResults) {
    const icon = result.status === "PASS" ? "✅" : "❌"
    console.log(`${icon} ${result.agentName} (${result.agentType})`)

    if (result.errors.length > 0) {
      result.errors.forEach((err) => console.log(`   ${err}`))
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach((warn) => console.log(`   ⚠️  ${warn}`))
    }
  }

  // SUMMARY
  console.log("\n" + "=".repeat(80))
  console.log("\n📋 SUMMARY\n")

  const filePass = fileResults.filter((r) => r.status === "PASS").length
  const fileFail = fileResults.filter((r) => r.status === "FAIL").length
  const dbPass = dbResults.filter((r) => r.status === "PASS").length
  const dbFail = dbResults.filter((r) => r.status === "FAIL").length

  console.log(`Prompt Files: ${filePass} PASS, ${fileFail} FAIL`)
  console.log(`Database: ${dbPass} PASS, ${dbFail} FAIL`)

  const allPass = fileFail === 0 && dbFail === 0

  if (allPass) {
    console.log("\n✅ ALL VALIDATIONS PASSED - Constitution v1.5.0 Compliant\n")
    process.exit(0)
  } else {
    console.log("\n❌ VALIDATION FAILED - Please fix errors above\n")
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error("❌ Validation script error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
