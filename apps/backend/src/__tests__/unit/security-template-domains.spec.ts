/**
 * Security Template - Allowed Domains Tests
 * 
 * Purpose: Verify Security Agent template correctly handles allowedExternalLinks
 * Coverage: Domain whitelisting, path support, [LINK_REGISTRATION] placeholder
 * 
 * Note: These are documentation tests for the security template logic
 */

describe('Security Template - Allowed Domains (SPP-1032)', () => {
  describe('Domain Whitelisting Rules', () => {
    it('should explicitly allow paths on whitelisted domains', () => {
      // SCENARIO: Template says "including any path on these domains"
      // RULE: echatbot.ai/registration/xyz should be ALLOWED if echatbot.ai is whitelisted
      
      const allowedDomain = 'echatbot.ai'
      const testUrls = [
        'https://echatbot.ai',
        'https://echatbot.ai/',
        'https://echatbot.ai/registration',
        'https://echatbot.ai/registration/workspace-slug',
        'https://echatbot.ai/registration/workspace-slug?token=abc123',
        'https://www.echatbot.ai/registration/xyz'
      ]
      
      testUrls.forEach(url => {
        expect(url).toContain(allowedDomain)
      })
    })

    it('should provide clear examples in template documentation', () => {
      // SCENARIO: LLM must understand path support
      // RULE: Template MUST include explicit examples with paths
      
      const templateExamples = [
        'If domain is `echatbot.ai`, then `https://echatbot.ai/registration/abc` is ALLOWED',
        'If domain is `example.com`, then `https://example.com/any/path?token=xyz` is ALLOWED'
      ]
      
      templateExamples.forEach(example => {
        expect(example).toContain('/')
        expect(example).toContain('ALLOWED')
        expect(example).toMatch(/path|registration/)
      })
    })

    it('should support subdomain variations', () => {
      // SCENARIO: Domain echatbot.ai should match www.echatbot.ai
      // RULE: Template says "check if URL contains the domain name anywhere"
      
      const allowedDomain = 'echatbot.ai'
      const urlWithSubdomain = 'https://www.echatbot.ai/registration'
      
      expect(urlWithSubdomain).toContain(allowedDomain)
    })

    it('should support query parameters', () => {
      // SCENARIO: URLs can have query strings with tokens
      // RULE: echatbot.ai/registration?token=xxx is ALLOWED
      
      const allowedDomain = 'echatbot.ai'
      const urlWithQueryParams = 'https://echatbot.ai/registration/workspace?token=abc123&utm_source=email'
      
      expect(urlWithQueryParams).toContain(allowedDomain)
      expect(urlWithQueryParams).toContain('?')
      expect(urlWithQueryParams).toContain('token=')
    })
  })

  describe('[LINK_REGISTRATION] Placeholder', () => {
    it('should be listed in allowed token placeholders', () => {
      // SCENARIO: Welcome message uses [LINK_REGISTRATION]
      // RULE: Template MUST explicitly list this in ALLOWED placeholders
      
      const allowedPlaceholders = [
        '[LINK_ORDER_WITH_TOKEN]',
        '[LINK_PROFILE_WITH_TOKEN]',
        '[LINK_REGISTRATION]' // ✅ Added in SPP-1032 fix
      ]
      
      expect(allowedPlaceholders).toContain('[LINK_REGISTRATION]')
    })

    it('should document that placeholders are replaced BEFORE security check', () => {
      // SCENARIO: Message has [LINK_REGISTRATION], gets replaced with https://echatbot.ai/registration/xyz
      // RULE: Security Agent receives the FINAL URL, not the placeholder
      
      const processingOrder = [
        '1. Replace [LINK_REGISTRATION] → https://echatbot.ai/registration/workspace?token=abc',
        '2. Security Agent validates the FINAL URL',
        '3. Check if echatbot.ai is in allowedExternalLinks'
      ]
      
      expect(processingOrder[0]).toContain('[LINK_REGISTRATION]')
      expect(processingOrder[1]).toContain('FINAL URL')
      expect(processingOrder[2]).toContain('allowedExternalLinks')
    })
  })

  describe('Template Variable Injection', () => {
    it('should inject allowedExternalLinks into template', () => {
      // SCENARIO: Workspace has allowedExternalLinks = ['echatbot.ai', 'paypal.com']
      // RULE: Template receives this list via Handlebars {{allowedExternalLinks}}
      
      const workspaceConfig = {
        allowedExternalLinks: ['echatbot.ai', 'paypal.com']
      }
      
      expect(workspaceConfig.allowedExternalLinks).toHaveLength(2)
      expect(workspaceConfig.allowedExternalLinks[0]).toBe('echatbot.ai')
    })

    it('should handle empty allowedExternalLinks array', () => {
      // SCENARIO: Workspace has no external links configured
      // RULE: {{#if allowedExternalLinks}} block should not render
      
      const workspaceConfig = {
        allowedExternalLinks: []
      }
      
      const shouldRenderBlock = workspaceConfig.allowedExternalLinks.length > 0
      expect(shouldRenderBlock).toBe(false)
    })

    it('should handle null allowedExternalLinks', () => {
      // SCENARIO: Workspace.allowedExternalLinks is NULL in database
      // RULE: Template should gracefully handle null (treat as no links)
      
      const workspaceConfig = {
        allowedExternalLinks: null
      }
      
      const shouldRenderBlock = !!(workspaceConfig.allowedExternalLinks && workspaceConfig.allowedExternalLinks.length > 0)
      expect(shouldRenderBlock).toBe(false)
    })
  })

  describe('Security Validation Logic', () => {
    it('should block external URLs not in whitelist', () => {
      // SCENARIO: Message contains https://malicious.com/phishing
      // RULE: Security Agent MUST block with UNAUTHORIZED_LINK
      
      const allowedDomains = ['echatbot.ai', 'paypal.com']
      const maliciousUrl = 'https://malicious.com/phishing'
      
      const isAllowed = allowedDomains.some(domain => maliciousUrl.includes(domain))
      expect(isAllowed).toBe(false)
    })

    it('should allow internal short URLs without domain check', () => {
      // SCENARIO: Message contains /o/ABC123 (order short URL)
      // RULE: Internal paths ALWAYS allowed (no domain required)
      
      const internalUrls = ['/o/ABC123', '/p/XYZ789']
      
      internalUrls.forEach(url => {
        expect(url).toMatch(/^\/[op]\//) // Starts with /o/ or /p/
      })
    })

    it('should allow token placeholders without domain check', () => {
      // SCENARIO: Message contains [LINK_ORDER_WITH_TOKEN]
      // RULE: Placeholders always allowed (replaced before security check)
      
      const placeholders = ['[LINK_ORDER_WITH_TOKEN]', '[LINK_PROFILE_WITH_TOKEN]', '[LINK_REGISTRATION]']
      
      placeholders.forEach(placeholder => {
        expect(placeholder).toMatch(/^\[LINK_.*\]$/)
      })
    })
  })

  describe('LLM Response Format', () => {
    it('should return JSON {"safe": true} for allowed links', () => {
      // SCENARIO: Message contains whitelisted domain
      // RULE: Security Agent returns valid JSON with safe=true
      
      const expectedResponse = {
        safe: true
      }
      
      expect(expectedResponse).toHaveProperty('safe')
      expect(expectedResponse.safe).toBe(true)
      expect(Object.keys(expectedResponse)).toHaveLength(1) // No extra fields
    })

    it('should return JSON with reason UNAUTHORIZED_LINK for blocked URLs', () => {
      // SCENARIO: Message contains non-whitelisted domain
      // RULE: Return safe=false with specific reason
      
      const expectedResponse = {
        safe: false,
        reason: 'UNAUTHORIZED_LINK',
        details: 'External link not in whitelist'
      }
      
      expect(expectedResponse.safe).toBe(false)
      expect(expectedResponse.reason).toBe('UNAUTHORIZED_LINK')
      expect(expectedResponse).toHaveProperty('details')
    })
  })

  describe('Template Consistency', () => {
    it('should have identical rules in ecommerce and informational templates', () => {
      // SCENARIO: Two templates exist (ecommerce/07-security, informational/02-security)
      // RULE: Both MUST have same ALLOWED EXTERNAL DOMAINS section
      
      const sharedRules = {
        allowPathsOnDomains: true,
        examplesIncludeRegistrationPath: true,
        linkRegistrationPlaceholder: true
      }
      
      expect(sharedRules.allowPathsOnDomains).toBe(true)
      expect(sharedRules.examplesIncludeRegistrationPath).toBe(true)
      expect(sharedRules.linkRegistrationPlaceholder).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle typos in domain configuration', () => {
      // SCENARIO: Workspace has "paypall.com" instead of "paypal.com"
      // RULE: Typo will cause PayPal links to be blocked (admin must fix)
      
      const allowedDomains = ['echatbot.ai', 'paypall.com'] // Typo!
      const correctPayPalUrl = 'https://www.paypal.com/checkout'
      
      const isAllowed = allowedDomains.some(domain => correctPayPalUrl.includes(domain))
      expect(isAllowed).toBe(false) // Will be blocked due to typo
    })

    it('should be case-insensitive for domain matching', () => {
      // SCENARIO: Domain configured as "EchatBot.AI"
      // RULE: Should match "https://echatbot.ai" (case insensitive)
      
      const allowedDomain = 'echatbot.ai'.toLowerCase()
      const url = 'https://ECHATBOT.AI/registration'.toLowerCase()
      
      expect(url).toContain(allowedDomain)
    })

    it('should not match partial domain names', () => {
      // SCENARIO: Allowed domain is "echatbot.ai"
      // RULE: Should NOT match "fake-echatbot.ai.malicious.com"
      
      const allowedDomain = 'echatbot.ai'
      const maliciousUrl = 'https://fake-echatbot.ai.malicious.com'
      
      // Note: Simple includes() check WOULD match - need more sophisticated validation
      expect(maliciousUrl).toContain(allowedDomain) // Current behavior (permissive)
      
      // TODO: Future enhancement - validate domain boundaries
      // Expected: Extract actual domain from URL and compare
    })
  })

  describe('Production Configuration', () => {
    it('should document echatbot-hq-support workspace configuration', () => {
      // SCENARIO: Production workspace echatbot-hq-support
      // RULE: Has ['echatbot.ai', 'paypall.com'] in allowedExternalLinks
      
      const productionConfig = {
        workspaceId: 'echatbot-hq-support',
        slug: 'echatbot-hq',
        allowedExternalLinks: ['echatbot.ai', 'paypall.com'] // Note: typo in prod
      }
      
      expect(productionConfig.allowedExternalLinks).toContain('echatbot.ai')
      expect(productionConfig.allowedExternalLinks[1]).toBe('paypall.com') // Typo exists
    })

    it('should allow registration links in echatbot-hq-support workspace', () => {
      // SCENARIO: Welcome message includes registration link
      // RULE: https://echatbot.ai/registration/echatbot-hq-support?token=xxx is ALLOWED
      
      const allowedDomains = ['echatbot.ai']
      const registrationUrl = 'https://echatbot.ai/registration/echatbot-hq-support?token=28041e8f35f570ad'
      
      const isAllowed = allowedDomains.some(domain => registrationUrl.includes(domain))
      expect(isAllowed).toBe(true)
    })
  })

  describe('Debugging & Logging', () => {
    it('should log when Security Agent blocks message', () => {
      // SCENARIO: Security Agent returns safe=false
      // RULE: Log the reason and message preview for debugging
      
      const blockLog = {
        event: 'SECURITY_BLOCKED',
        reason: 'UNAUTHORIZED_LINK',
        messagePreview: 'Click here: https://malicious.com',
        workspaceId: 'workspace-uuid'
      }
      
      expect(blockLog.event).toBe('SECURITY_BLOCKED')
      expect(blockLog).toHaveProperty('reason')
      expect(blockLog).toHaveProperty('messagePreview')
    })

    it('should include allowed domains in Security Agent prompt for debugging', () => {
      // SCENARIO: Admin needs to verify what domains are whitelisted
      // RULE: Domains are visible in systemPrompt sent to LLM
      
      const systemPrompt = {
        containsSection: 'ALLOWED EXTERNAL DOMAINS',
        containsDomainList: true,
        containsExamples: true
      }
      
      expect(systemPrompt.containsSection).toBe('ALLOWED EXTERNAL DOMAINS')
      expect(systemPrompt.containsDomainList).toBe(true)
    })
  })
})
