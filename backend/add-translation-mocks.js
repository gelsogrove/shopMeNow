#!/usr/bin/env node
/**
 * Script to add mocks to all translation security tests
 * This prevents real API calls and saves money!
 */

const fs = require("fs")
const path = require("path")

const testFile = path.join(
  __dirname,
  "src/__tests__/unit/translation-security.service.spec.ts"
)
let content = fs.readFileSync(testFile, "utf-8")

console.log("🔧 Adding mocks to translation security tests...\n")

// Test patterns to update
const testsToUpdate = [
  {
    name: "should block English profanity",
    input: "Fuck you asshole bitch",
    response:
      "I'm sorry, I can't help you with that. How can I assist you with our products?",
    blocked: true,
    reason: "profanity",
    assertion: "I'm sorry",
  },
  {
    name: "should block Portuguese profanity",
    input: "Vai tomar no cu seu filho da puta",
    response:
      "Desculpe, não posso ajudar com isso. Como posso ajudá-lo com nossos produtos?",
    blocked: true,
    reason: "profanity",
    assertion: "Desculpe",
  },
  {
    name: "should block spam content",
    input: "Click here for free Bitcoin! Subscribe now and win!",
    response:
      "I'm sorry, I can't help you with that. How can I assist you with our products?",
    blocked: true,
    reason: "spam",
    assertion: "I'm sorry",
  },
  {
    name: "should block phishing attempts",
    input: "Verifica tu cuenta bancaria aquí: http://fake-bank.ru/phishing",
    response:
      "Lo siento, no puedo ayudarte con eso. ¿Cómo puedo ayudarte con nuestros productos?",
    blocked: true,
    reason: "phishing",
    assertion: "Lo siento",
  },
  {
    name: "should block adult content",
    input: "Check out my OnlyFans for hot girls xxx webcam",
    response:
      "I'm sorry, I can't help you with that. How can I assist you with our products?",
    blocked: true,
    reason: "adult",
    assertion: "I'm sorry",
  },
]

console.log(`📝 Found ${testsToUpdate.length} tests to update\n`)
console.log(
  "✅ Script ready - manual implementation recommended for precision\n"
)
console.log("Use this pattern for each test:\n")
console.log(`
    it("test name", async () => {
      // MOCK: Block/Allow response
      mockLLMResponse(
        "translated text",
        true, // blocked
        "profanity" // reason
      )

      const result = await translationSecurityService.processResponse(...)

      expect(result.blocked).toBe(true)
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    })
`)

process.exit(0)
