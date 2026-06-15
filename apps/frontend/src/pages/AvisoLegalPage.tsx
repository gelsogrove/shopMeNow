import { useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"

type Language = "it" | "en" | "es" | "de"

// ---------------------------------------------------------------------------
// LEGAL NOTICE ("Aviso Legal" / "Legal Notice") — STATIC public page.
//
// The bracketed tokens below ([LEGAL NAME], [VAT/TAX ID], [REGISTERED ADDRESS],
// [CONTACT EMAIL], [SUPERVISORY AUTHORITY], [JURISDICTION COURTS]) are
// placeholders. They MUST be replaced with the real legal data of the entity
// operating echatbot.ai before publishing, and the final text should be
// reviewed by a lawyer. Do not invent these values.
// ---------------------------------------------------------------------------

const LAST_UPDATED = "2026-06-15"

type Section = { heading: string; body: string[] }

type Copy = {
  seoTitle: string
  seoDesc: string
  badge: string
  title: string
  lastUpdated: string
  intro: string
  sections: Section[]
  privacyLinkLabel: string
}

const T: Record<Language, Copy> = {
  it: {
    seoTitle: "Aviso Legal - eChatbot",
    seoDesc:
      "Note legali di eChatbot.AI: dati identificativi del titolare, condizioni d'uso, proprietà intellettuale, responsabilità e legge applicabile.",
    badge: "Note Legali",
    title: "Aviso Legal",
    lastUpdated: "Ultimo aggiornamento",
    intro:
      "Le presenti note legali disciplinano l'accesso e l'utilizzo del sito web e dei servizi di eChatbot.AI, inclusa l'assistenza fornita tramite WhatsApp.",
    privacyLinkLabel: "Consulta la nostra Privacy Policy",
    sections: [
      {
        heading: "1. Dati identificativi del titolare",
        body: [
          "Denominazione: [LEGAL NAME]",
          "Partita IVA / Codice fiscale: [VAT/TAX ID]",
          "Sede legale: [REGISTERED ADDRESS]",
          "Email di contatto: [CONTACT EMAIL]",
        ],
      },
      {
        heading: "2. Oggetto e condizioni d'uso",
        body: [
          "L'accesso al sito e l'uso dei servizi attribuisce la qualifica di utente e implica l'accettazione integrale delle presenti note legali.",
          "L'utente si impegna a utilizzare il sito e i servizi in conformità alla legge, al buon costume e alle presenti condizioni, astenendosi da qualsiasi uso illecito o lesivo di diritti di terzi.",
        ],
      },
      {
        heading: "3. Proprietà intellettuale e industriale",
        body: [
          "Tutti i contenuti del sito (testi, grafica, loghi, software, marchi) sono di proprietà del titolare o dei rispettivi titolari di diritti e sono protetti dalla normativa vigente.",
          "È vietata la riproduzione, distribuzione o trasformazione dei contenuti senza autorizzazione scritta del titolare.",
        ],
      },
      {
        heading: "4. Responsabilità",
        body: [
          "Il titolare non garantisce la disponibilità continua e ininterrotta del sito e non risponde dei danni derivanti da malfunzionamenti, interruzioni o errori, salvo nei limiti previsti dalla legge.",
          "I contenuti hanno finalità informativa e possono essere modificati o aggiornati in qualsiasi momento.",
        ],
      },
      {
        heading: "5. Collegamenti (link)",
        body: [
          "Il sito può contenere collegamenti a siti di terzi. Il titolare non è responsabile dei contenuti o delle politiche privacy di tali siti.",
        ],
      },
      {
        heading: "6. Protezione dei dati personali",
        body: [
          "Il trattamento dei dati personali è disciplinato dalla nostra Privacy Policy, in conformità al Regolamento (UE) 2016/679 (GDPR).",
        ],
      },
      {
        heading: "7. Trattamento dei dati tramite WhatsApp",
        body: [
          "Quando l'utente contatta il servizio tramite WhatsApp, i dati forniti vengono trattati per gestire la richiesta sulla base del consenso espresso dall'utente.",
          "WhatsApp è un servizio fornito da WhatsApp LLC; l'invio di un messaggio implica l'utilizzo della relativa infrastruttura di messaggistica.",
          "L'utente può esercitare in qualsiasi momento i diritti previsti dal GDPR scrivendo a [CONTACT EMAIL] e può presentare reclamo all'autorità di controllo competente ([SUPERVISORY AUTHORITY]).",
        ],
      },
      {
        heading: "8. Legge applicabile e foro competente",
        body: [
          "Le presenti note legali sono regolate dalla legge applicabile presso la sede del titolare. Per ogni controversia sarà competente il foro di [JURISDICTION COURTS], salvo diversa disposizione inderogabile di legge.",
        ],
      },
      {
        heading: "9. Modifiche",
        body: [
          "Il titolare si riserva il diritto di modificare le presenti note legali in qualsiasi momento. Le modifiche avranno effetto dalla loro pubblicazione sul sito.",
        ],
      },
    ],
  },
  en: {
    seoTitle: "Legal Notice - eChatbot",
    seoDesc:
      "eChatbot.AI legal notice: identity of the operator, terms of use, intellectual property, liability and applicable law.",
    badge: "Legal Notice",
    title: "Legal Notice",
    lastUpdated: "Last updated",
    intro:
      "This legal notice governs access to and use of the eChatbot.AI website and services, including support provided through WhatsApp.",
    privacyLinkLabel: "Read our Privacy Policy",
    sections: [
      {
        heading: "1. Operator identification",
        body: [
          "Legal name: [LEGAL NAME]",
          "VAT / Tax ID: [VAT/TAX ID]",
          "Registered address: [REGISTERED ADDRESS]",
          "Contact email: [CONTACT EMAIL]",
        ],
      },
      {
        heading: "2. Purpose and terms of use",
        body: [
          "Accessing the site and using the services grants user status and implies full acceptance of this legal notice.",
          "The user agrees to use the site and services in compliance with the law, public order and these terms, refraining from any unlawful use or use that harms the rights of third parties.",
        ],
      },
      {
        heading: "3. Intellectual and industrial property",
        body: [
          "All site content (text, graphics, logos, software, trademarks) belongs to the operator or its respective rights holders and is protected by applicable law.",
          "Reproduction, distribution or transformation of the content without the operator's written authorization is prohibited.",
        ],
      },
      {
        heading: "4. Liability",
        body: [
          "The operator does not guarantee continuous, uninterrupted availability of the site and is not liable for damages arising from malfunctions, interruptions or errors, except as required by law.",
          "Content is provided for informational purposes and may be modified or updated at any time.",
        ],
      },
      {
        heading: "5. Links",
        body: [
          "The site may contain links to third-party sites. The operator is not responsible for the content or privacy practices of those sites.",
        ],
      },
      {
        heading: "6. Personal data protection",
        body: [
          "The processing of personal data is governed by our Privacy Policy, in accordance with Regulation (EU) 2016/679 (GDPR).",
        ],
      },
      {
        heading: "7. Data processing through WhatsApp",
        body: [
          "When the user contacts the service through WhatsApp, the data provided is processed to handle the request on the basis of the user's consent.",
          "WhatsApp is a service provided by WhatsApp LLC; sending a message implies the use of its messaging infrastructure.",
          "The user may exercise their GDPR rights at any time by writing to [CONTACT EMAIL] and may lodge a complaint with the competent supervisory authority ([SUPERVISORY AUTHORITY]).",
        ],
      },
      {
        heading: "8. Applicable law and jurisdiction",
        body: [
          "This legal notice is governed by the law applicable at the operator's place of establishment. Any dispute shall be subject to the courts of [JURISDICTION COURTS], unless otherwise mandatorily provided by law.",
        ],
      },
      {
        heading: "9. Changes",
        body: [
          "The operator reserves the right to modify this legal notice at any time. Changes take effect upon their publication on the site.",
        ],
      },
    ],
  },
  es: {
    seoTitle: "Aviso Legal - eChatbot",
    seoDesc:
      "Aviso legal de eChatbot.AI: datos identificativos del titular, condiciones de uso, propiedad intelectual, responsabilidad y legislación aplicable.",
    badge: "Aviso Legal",
    title: "Aviso Legal",
    lastUpdated: "Última actualización",
    intro:
      "El presente aviso legal regula el acceso y el uso del sitio web y los servicios de eChatbot.AI, incluida la atención prestada a través de WhatsApp.",
    privacyLinkLabel: "Consulta nuestra Política de Privacidad",
    sections: [
      {
        heading: "1. Datos identificativos del titular",
        body: [
          "Denominación: [LEGAL NAME]",
          "NIF / CIF: [VAT/TAX ID]",
          "Domicilio social: [REGISTERED ADDRESS]",
          "Correo de contacto: [CONTACT EMAIL]",
        ],
      },
      {
        heading: "2. Objeto y condiciones de uso",
        body: [
          "El acceso al sitio y el uso de los servicios atribuye la condición de usuario e implica la aceptación íntegra del presente aviso legal.",
          "El usuario se compromete a utilizar el sitio y los servicios conforme a la ley, el orden público y las presentes condiciones, absteniéndose de cualquier uso ilícito o lesivo de derechos de terceros.",
        ],
      },
      {
        heading: "3. Propiedad intelectual e industrial",
        body: [
          "Todos los contenidos del sitio (textos, gráficos, logotipos, software, marcas) son propiedad del titular o de sus respectivos titulares de derechos y están protegidos por la normativa vigente.",
          "Queda prohibida la reproducción, distribución o transformación de los contenidos sin autorización escrita del titular.",
        ],
      },
      {
        heading: "4. Responsabilidad",
        body: [
          "El titular no garantiza la disponibilidad continua e ininterrumpida del sitio y no responde de los daños derivados de fallos, interrupciones o errores, salvo en los límites previstos por la ley.",
          "Los contenidos tienen finalidad informativa y pueden ser modificados o actualizados en cualquier momento.",
        ],
      },
      {
        heading: "5. Enlaces",
        body: [
          "El sitio puede contener enlaces a sitios de terceros. El titular no se responsabiliza de los contenidos ni de las políticas de privacidad de dichos sitios.",
        ],
      },
      {
        heading: "6. Protección de datos personales",
        body: [
          "El tratamiento de los datos personales se rige por nuestra Política de Privacidad, de conformidad con el Reglamento (UE) 2016/679 (RGPD).",
        ],
      },
      {
        heading: "7. Tratamiento de datos a través de WhatsApp",
        body: [
          "Cuando el usuario contacta con el servicio a través de WhatsApp, los datos facilitados se tratan para gestionar la solicitud sobre la base del consentimiento del usuario.",
          "WhatsApp es un servicio prestado por WhatsApp LLC; el envío de un mensaje implica el uso de su infraestructura de mensajería.",
          "El usuario puede ejercer en cualquier momento sus derechos del RGPD escribiendo a [CONTACT EMAIL] y puede presentar una reclamación ante la autoridad de control competente ([SUPERVISORY AUTHORITY]).",
        ],
      },
      {
        heading: "8. Legislación aplicable y jurisdicción",
        body: [
          "El presente aviso legal se rige por la legislación aplicable en el domicilio del titular. Para cualquier controversia serán competentes los juzgados y tribunales de [JURISDICTION COURTS], salvo disposición legal imperativa en contrario.",
        ],
      },
      {
        heading: "9. Modificaciones",
        body: [
          "El titular se reserva el derecho de modificar el presente aviso legal en cualquier momento. Las modificaciones surtirán efecto desde su publicación en el sitio.",
        ],
      },
    ],
  },
  de: {
    seoTitle: "Impressum / Rechtliche Hinweise - eChatbot",
    seoDesc:
      "Rechtliche Hinweise von eChatbot.AI: Angaben zum Betreiber, Nutzungsbedingungen, geistiges Eigentum, Haftung und anwendbares Recht.",
    badge: "Rechtliche Hinweise",
    title: "Rechtliche Hinweise",
    lastUpdated: "Zuletzt aktualisiert",
    intro:
      "Diese rechtlichen Hinweise regeln den Zugang zu und die Nutzung der Website und Dienste von eChatbot.AI, einschließlich des über WhatsApp angebotenen Supports.",
    privacyLinkLabel: "Lesen Sie unsere Datenschutzerklärung",
    sections: [
      {
        heading: "1. Angaben zum Betreiber",
        body: [
          "Name: [LEGAL NAME]",
          "USt-IdNr. / Steuernummer: [VAT/TAX ID]",
          "Geschäftssitz: [REGISTERED ADDRESS]",
          "Kontakt-E-Mail: [CONTACT EMAIL]",
        ],
      },
      {
        heading: "2. Zweck und Nutzungsbedingungen",
        body: [
          "Der Zugang zur Website und die Nutzung der Dienste begründen den Nutzerstatus und bedeuten die vollständige Annahme dieser rechtlichen Hinweise.",
          "Der Nutzer verpflichtet sich, die Website und die Dienste im Einklang mit dem Gesetz, der öffentlichen Ordnung und diesen Bedingungen zu nutzen und jede rechtswidrige oder die Rechte Dritter verletzende Nutzung zu unterlassen.",
        ],
      },
      {
        heading: "3. Geistiges und gewerbliches Eigentum",
        body: [
          "Alle Inhalte der Website (Texte, Grafiken, Logos, Software, Marken) gehören dem Betreiber oder den jeweiligen Rechteinhabern und sind durch geltendes Recht geschützt.",
          "Die Vervielfältigung, Verbreitung oder Bearbeitung der Inhalte ohne schriftliche Genehmigung des Betreibers ist untersagt.",
        ],
      },
      {
        heading: "4. Haftung",
        body: [
          "Der Betreiber garantiert keine durchgehende, ununterbrochene Verfügbarkeit der Website und haftet nicht für Schäden aus Störungen, Unterbrechungen oder Fehlern, außer im gesetzlich vorgeschriebenen Umfang.",
          "Die Inhalte dienen Informationszwecken und können jederzeit geändert oder aktualisiert werden.",
        ],
      },
      {
        heading: "5. Links",
        body: [
          "Die Website kann Links zu Websites Dritter enthalten. Der Betreiber ist nicht für die Inhalte oder Datenschutzpraktiken dieser Websites verantwortlich.",
        ],
      },
      {
        heading: "6. Schutz personenbezogener Daten",
        body: [
          "Die Verarbeitung personenbezogener Daten richtet sich nach unserer Datenschutzerklärung gemäß der Verordnung (EU) 2016/679 (DSGVO).",
        ],
      },
      {
        heading: "7. Datenverarbeitung über WhatsApp",
        body: [
          "Wenn der Nutzer den Dienst über WhatsApp kontaktiert, werden die übermittelten Daten auf Grundlage der Einwilligung des Nutzers zur Bearbeitung der Anfrage verarbeitet.",
          "WhatsApp ist ein Dienst von WhatsApp LLC; das Senden einer Nachricht setzt die Nutzung dessen Messaging-Infrastruktur voraus.",
          "Der Nutzer kann seine DSGVO-Rechte jederzeit per E-Mail an [CONTACT EMAIL] ausüben und Beschwerde bei der zuständigen Aufsichtsbehörde ([SUPERVISORY AUTHORITY]) einlegen.",
        ],
      },
      {
        heading: "8. Anwendbares Recht und Gerichtsstand",
        body: [
          "Diese rechtlichen Hinweise unterliegen dem am Sitz des Betreibers anwendbaren Recht. Für Streitigkeiten sind die Gerichte von [JURISDICTION COURTS] zuständig, sofern nicht zwingend gesetzlich anders vorgeschrieben.",
        ],
      },
      {
        heading: "9. Änderungen",
        body: [
          "Der Betreiber behält sich das Recht vor, diese rechtlichen Hinweise jederzeit zu ändern. Änderungen werden mit ihrer Veröffentlichung auf der Website wirksam.",
        ],
      },
    ],
  },
}

export function AvisoLegalPage() {
  const { language } = useLanguage()
  const t = T[language as Language] ?? T.en

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} url="/aviso-legal" lang={language} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-20 pb-8">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block bg-green-400/10 text-green-300 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                {t.badge}
              </span>
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">{t.title}</h1>
              <p className="text-sm text-slate-500">
                {t.lastUpdated}: {LAST_UPDATED}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Content */}
        <section className="pb-20">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <p className="text-lg text-slate-300 leading-relaxed mb-10">{t.intro}</p>

            <div className="space-y-8">
              {t.sections.map((section) => (
                <div key={section.heading}>
                  <h2 className="text-xl font-semibold text-white mb-3">{section.heading}</h2>
                  {section.body.map((paragraph, i) => (
                    <p key={i} className="text-slate-400 leading-relaxed mb-2">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-white/10">
              <Link to="/privacy" className="text-green-400 hover:text-green-300 transition-colors font-medium">
                {t.privacyLinkLabel} →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
