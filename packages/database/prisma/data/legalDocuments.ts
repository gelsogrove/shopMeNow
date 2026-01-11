/**
 * Legal Documents Data
 * Feature: Dynamic multilingual legal pages
 * 
 * Contains GDPR, Privacy Policy, Terms of Service, and Refund Policy
 * in 4 languages: IT, EN, ES, PT
 * 
 * HTML content is stored in separate files to keep this file manageable.
 */

import { readFileSync } from "fs"
import { join, resolve } from "path"

// Absolute path to legal-content directory
const contentDir = resolve(__dirname, "legal-content")

function readContent(filename: string): string {
  const fullPath = join(contentDir, filename)
  try {
    const content = readFileSync(fullPath, "utf-8").trim()
    if (content.length > 50) {
      console.log(`✅ Loaded ${filename} (${content.length} chars)`)
    }
    return content
  } catch (error) {
    console.error(`❌ Could not read ${fullPath}:`, error instanceof Error ? error.message : String(error))
    return `<h1>Content not available</h1><p>Please contact support at privacy@echatbot.ai</p>`
  }
}

export interface LegalDocumentData {
  type: "GDPR" | "PRIVACY_POLICY" | "TERMS_OF_SERVICE" | "REFUND_POLICY"
  titleIt: string
  titleEn: string
  titleEs: string
  titlePt: string
  contentIt: string
  contentEn: string
  contentEs: string
  contentPt: string
  isActive: boolean
}

export const legalDocuments: LegalDocumentData[] = [
  // ============================================================================
  // 🛡️ GDPR
  // ============================================================================
  {
    type: "GDPR",
    titleIt: "GDPR - Regolamento Generale sulla Protezione dei Dati",
    titleEn: "GDPR - General Data Protection Regulation",
    titleEs: "GDPR - Reglamento General de Protección de Datos",
    titlePt: "GDPR - Regulamento Geral de Proteção de Dados",
    contentIt: readContent("gdpr-it.html"),
    contentEn: readContent("gdpr-en.html"),
    contentEs: readContent("gdpr-es.html"),
    contentPt: readContent("gdpr-pt.html"),
    isActive: true,
  },

  // ============================================================================
  // 🔒 PRIVACY POLICY
  // ============================================================================
  {
    type: "PRIVACY_POLICY",
    titleIt: "Privacy Policy",
    titleEn: "Privacy Policy",
    titleEs: "Política de Privacidad",
    titlePt: "Política de Privacidade",
    contentIt: readContent("privacy-it.html"),
    contentEn: readContent("privacy-en.html"),
    contentEs: readContent("privacy-es.html"),
    contentPt: readContent("privacy-pt.html"),
    isActive: true,
  },

  // ============================================================================
  // 📜 TERMS OF SERVICE
  // ============================================================================
  {
    type: "TERMS_OF_SERVICE",
    titleIt: "Condizioni di Utilizzo",
    titleEn: "Terms of Service",
    titleEs: "Términos de Servicio",
    titlePt: "Termos de Serviço",
    contentIt: readContent("terms-it.html"),
    contentEn: readContent("terms-en.html"),
    contentEs: readContent("terms-es.html"),
    contentPt: readContent("terms-pt.html"),
    isActive: true,
  },

  // ============================================================================
  // 💰 REFUND POLICY
  // ============================================================================
  {
    type: "REFUND_POLICY",
    titleIt: "Politica di Rimborso",
    titleEn: "Refund & Cancellation Policy",
    titleEs: "Política de Reembolso",
    titlePt: "Política de Reembolso",
    contentIt: readContent("refund-it.html"),
    contentEn: readContent("refund-en.html"),
    contentEs: readContent("refund-es.html"),
    contentPt: readContent("refund-pt.html"),
    isActive: true,
  },
]
