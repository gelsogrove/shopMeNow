/**
 * Unit tests for Identity Question Pattern Matching
 * 
 * Tests ONLY the regex patterns, no database or LLM calls
 */

describe("Identity Question Pattern Detection", () => {
  // Copy exact patterns from llm-router.service.ts
  const identityPatterns = [
    /\b(chi\s+sei|come\s+ti\s+chiami|qual\s+.*\s+nome|nome\s+tuo)\b/i, // IT
    /\b(who\s+are\s+you|what.*your\s+name|your\s+name\s+is)\b/i, // EN
    /\b(qui[eé]n\s+eres|c[oó]mo\s+te\s+llamas|cu[aá]l.*tu\s+nombre)\b/i, // ES
    /\b(quem\s+[eé]\s+voc[eê]|qual.*seu\s+nome|seu\s+nome\s+[eé])\b/i, // PT
  ]

  const isIdentityQuestion = (message: string): boolean => {
    const userMessage = message.toLowerCase()
    return identityPatterns.some(pattern => pattern.test(userMessage))
  }

  describe("Italian (IT) Patterns", () => {
    it("should detect 'come ti chiami?'", () => {
      expect(isIdentityQuestion("come ti chiami?")).toBe(true)
    })

    it("should detect 'Come ti chiami'", () => {
      expect(isIdentityQuestion("Come ti chiami")).toBe(true)
    })

    it("should detect 'chi sei?'", () => {
      expect(isIdentityQuestion("chi sei?")).toBe(true)
    })

    it("should detect 'Chi sei'", () => {
      expect(isIdentityQuestion("Chi sei")).toBe(true)
    })

    it("should detect 'qual è il tuo nome?'", () => {
      expect(isIdentityQuestion("qual è il tuo nome?")).toBe(true)
    })

    it("should NOT detect 'come stai?'", () => {
      expect(isIdentityQuestion("come stai?")).toBe(false)
    })

    it("should NOT detect 'ciao'", () => {
      expect(isIdentityQuestion("ciao")).toBe(false)
    })
  })

  describe("English (EN) Patterns", () => {
    it("should detect \"what's your name?\"", () => {
      expect(isIdentityQuestion("what's your name?")).toBe(true)
    })

    it("should detect 'What is your name'", () => {
      expect(isIdentityQuestion("What is your name")).toBe(true)
    })

    it("should detect 'who are you?'", () => {
      expect(isIdentityQuestion("who are you?")).toBe(true)
    })

    it("should detect 'Who are you'", () => {
      expect(isIdentityQuestion("Who are you")).toBe(true)
    })

    it("should detect 'your name is'", () => {
      expect(isIdentityQuestion("your name is")).toBe(true)
    })

    it("should NOT detect 'how are you?'", () => {
      expect(isIdentityQuestion("how are you?")).toBe(false)
    })

    it("should NOT detect 'hello'", () => {
      expect(isIdentityQuestion("hello")).toBe(false)
    })
  })

  describe("Spanish (ES) Patterns", () => {
    it("should detect 'cómo te llamas?'", () => {
      expect(isIdentityQuestion("cómo te llamas?")).toBe(true)
    })

    it("should detect 'Como te llamas'", () => {
      expect(isIdentityQuestion("Como te llamas")).toBe(true)
    })

    it("should detect 'quién eres?'", () => {
      expect(isIdentityQuestion("quién eres?")).toBe(true)
    })

    it("should detect 'Quien eres'", () => {
      expect(isIdentityQuestion("Quien eres")).toBe(true)
    })

    it("should detect 'cuál es tu nombre?'", () => {
      expect(isIdentityQuestion("cuál es tu nombre?")).toBe(true)
    })

    it("should NOT detect '¿cómo estás?'", () => {
      expect(isIdentityQuestion("¿cómo estás?")).toBe(false)
    })

    it("should NOT detect 'hola'", () => {
      expect(isIdentityQuestion("hola")).toBe(false)
    })
  })

  describe("Portuguese (PT) Patterns", () => {
    it("should detect 'qual é seu nome?'", () => {
      expect(isIdentityQuestion("qual é seu nome?")).toBe(true)
    })

    it("should detect 'Qual e seu nome'", () => {
      expect(isIdentityQuestion("Qual e seu nome")).toBe(true)
    })

    it("should detect 'quem é você?'", () => {
      expect(isIdentityQuestion("quem é você?")).toBe(true)
    })

    it("should detect 'Quem e voce'", () => {
      expect(isIdentityQuestion("Quem e voce")).toBe(true)
    })

    it("should detect 'seu nome é'", () => {
      expect(isIdentityQuestion("seu nome é")).toBe(true)
    })

    it("should NOT detect 'como você está?'", () => {
      expect(isIdentityQuestion("como você está?")).toBe(false)
    })

    it("should NOT detect 'olá'", () => {
      expect(isIdentityQuestion("olá")).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      expect(isIdentityQuestion("")).toBe(false)
    })

    it("should handle whitespace only", () => {
      expect(isIdentityQuestion("   ")).toBe(false)
    })

    it("should handle mixed case", () => {
      expect(isIdentityQuestion("CoMe Ti ChIaMi?")).toBe(true)
    })

    it("should handle extra spaces", () => {
      expect(isIdentityQuestion("come   ti   chiami")).toBe(true)
    })

    it("should handle punctuation variations", () => {
      expect(isIdentityQuestion("come ti chiami???")).toBe(true)
    })

    it("should NOT detect similar but different phrases", () => {
      expect(isIdentityQuestion("come mai?")).toBe(false)
      expect(isIdentityQuestion("chi è lui?")).toBe(false)
      expect(isIdentityQuestion("what time?")).toBe(false)
    })
  })

  describe("Response Construction Logic", () => {
    const constructIdentityResponse = (
      chatbotName: string,
      botIdentityResponse: string | null,
      customerLang: string
    ): string => {
      let identityResponse = ""
      const role = botIdentityResponse || ""

      if (customerLang === "it") {
        identityResponse = `Mi chiamo ${chatbotName}. ${role ? `Sono ${role}` : ""}`
      } else if (customerLang === "en") {
        identityResponse = `My name is ${chatbotName}. ${role ? `I am ${role}` : ""}`
      } else if (customerLang.startsWith("es")) {
        identityResponse = `Me llamo ${chatbotName}. ${role ? `Soy ${role}` : ""}`
      } else if (customerLang === "pt") {
        identityResponse = `Meu nome é ${chatbotName}. ${role ? `Sou ${role}` : ""}`
      } else {
        identityResponse = `Mi chiamo ${chatbotName}. ${role ? `Sono ${role}` : ""}`
      }

      return identityResponse.trim()
    }

    it("should construct Italian response correctly", () => {
      const response = constructIdentityResponse(
        "TestBot",
        "I help customers",
        "it"
      )
      expect(response).toBe("Mi chiamo TestBot. Sono I help customers")
    })

    it("should construct English response correctly", () => {
      const response = constructIdentityResponse(
        "TestBot",
        "I help customers",
        "en"
      )
      expect(response).toBe("My name is TestBot. I am I help customers")
    })

    it("should construct Spanish response correctly", () => {
      const response = constructIdentityResponse(
        "TestBot",
        "I help customers",
        "esp"
      )
      expect(response).toBe("Me llamo TestBot. Soy I help customers")
    })

    it("should construct Portuguese response correctly", () => {
      const response = constructIdentityResponse(
        "TestBot",
        "I help customers",
        "pt"
      )
      expect(response).toBe("Meu nome é TestBot. Sou I help customers")
    })

    it("should handle missing botIdentityResponse", () => {
      const response = constructIdentityResponse("TestBot", null, "it")
      expect(response).toBe("Mi chiamo TestBot.")
    })

    it("should handle empty botIdentityResponse", () => {
      const response = constructIdentityResponse("TestBot", "", "en")
      expect(response).toBe("My name is TestBot.")
    })

    it("should fallback to Italian for unknown language", () => {
      const response = constructIdentityResponse(
        "TestBot",
        "I help",
        "fr" // Unknown language
      )
      expect(response).toBe("Mi chiamo TestBot. Sono I help")
    })
  })
})
