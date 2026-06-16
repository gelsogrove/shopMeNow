import { useState, useEffect, type FormEvent } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { CheckCircle } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Input } from "@/components/ui/input"
import { GreenCtaButton } from "@/components/ui/green-cta-button"
import { api } from "@/services/api"

type Language = "it" | "en" | "es" | "de"

const T = {
  it: {
    seoTitle: "Contattaci - eChatbot",
    seoDesc: "Hai domande su eChatbot? Contatta il nostro team. Siamo qui per aiutarti a scegliere il piano giusto e a iniziare con il tuo chatbot WhatsApp.",
    seoKeys: "contattaci echatbot, supporto echatbot, chatbot whatsapp assistenza",
    badge: "Contatti",
    heroTitle: "Parliamo del tuo progetto",
    heroSub: "Hai domande su eChatbot? Vuoi sapere quale piano fa per te? Il nostro team risponde entro 24 ore.",
    formTitle: "Mandaci un messaggio",
    formSubtitle: "Compila il modulo e ti risponderemo al più presto.",
    name: "Nome",
    namePlaceholder: "Il tuo nome",
    surname: "Cognome",
    surnamePlaceholder: "Il tuo cognome",
    email: "Email",
    emailPlaceholder: "la.tua@email.com",
    phone: "Telefono (opzionale)",
    phonePlaceholder: "+39 000 000 0000",
    subject: "Oggetto",
    subjectPlaceholder: "Scrivi qui l'oggetto…",
    message: "Messaggio",
    messagePlaceholder: "Raccontaci il tuo caso d'uso, le tue esigenze o le tue domande...",
    send: "Invia Messaggio",
    sending: "Invio in corso...",
    successTitle: "Messaggio inviato!",
    successDesc: "Grazie per averci contattato. Ti risponderemo entro 24 ore.",
  },
  en: {
    seoTitle: "Contact Us - eChatbot",
    seoDesc: "Have questions about eChatbot? Contact our team. We're here to help you choose the right plan and get started with your WhatsApp chatbot.",
    seoKeys: "contact echatbot, echatbot support, whatsapp chatbot help",
    badge: "Contact",
    heroTitle: "Let's talk about your project",
    heroSub: "Questions about eChatbot? Want to know which plan is right for you? Our team replies within 24 hours.",
    formTitle: "Send us a message",
    formSubtitle: "Fill in the form and we'll get back to you as soon as possible.",
    name: "First Name",
    namePlaceholder: "Your first name",
    surname: "Last Name",
    surnamePlaceholder: "Your last name",
    email: "Email",
    emailPlaceholder: "your@email.com",
    phone: "Phone (optional)",
    phonePlaceholder: "+1 000 000 0000",
    subject: "Subject",
    subjectPlaceholder: "Put your subject here…",
    message: "Message",
    messagePlaceholder: "Tell us about your use case, needs, or questions...",
    send: "Send Message",
    sending: "Sending...",
    successTitle: "Message sent!",
    successDesc: "Thank you for reaching out. We'll reply within 24 hours.",
  },
  es: {
    seoTitle: "Contáctanos - eChatbot",
    seoDesc: "¿Tienes preguntas sobre eChatbot? Contacta a nuestro equipo. Estamos aquí para ayudarte a elegir el plan correcto y empezar con tu chatbot de WhatsApp.",
    seoKeys: "contactar echatbot, soporte echatbot, ayuda chatbot whatsapp",
    badge: "Contacto",
    heroTitle: "Hablemos de tu proyecto",
    heroSub: "¿Preguntas sobre eChatbot? ¿Quieres saber qué plan te conviene? Nuestro equipo responde en 24 horas.",
    formTitle: "Envíanos un mensaje",
    formSubtitle: "Rellena el formulario y te responderemos lo antes posible.",
    name: "Nombre",
    namePlaceholder: "Tu nombre",
    surname: "Apellido",
    surnamePlaceholder: "Tu apellido",
    email: "Email",
    emailPlaceholder: "tu@email.com",
    phone: "Teléfono (opcional)",
    phonePlaceholder: "+34 000 000 000",
    subject: "Asunto",
    subjectPlaceholder: "Escribe aquí el asunto…",
    message: "Mensaje",
    messagePlaceholder: "Cuéntanos tu caso de uso, tus necesidades o preguntas...",
    send: "Enviar Mensaje",
    sending: "Enviando...",
    successTitle: "¡Mensaje enviado!",
    successDesc: "Gracias por ponerte en contacto. Te responderemos en 24 horas.",
  },
  de: {
    seoTitle: "Kontakt - eChatbot",
    seoDesc: "Hast du Fragen zu eChatbot? Kontaktiere unser Team. Wir helfen dir, den richtigen Plan zu wählen und mit deinem WhatsApp-Chatbot zu starten.",
    seoKeys: "kontakt echatbot, echatbot support, whatsapp chatbot hilfe",
    badge: "Kontakt",
    heroTitle: "Sprechen wir über dein Projekt",
    heroSub: "Fragen zu eChatbot? Willst du wissen, welcher Plan zu dir passt? Unser Team antwortet innerhalb von 24 Stunden.",
    formTitle: "Schreib uns eine Nachricht",
    formSubtitle: "Fülle das Formular aus und wir melden uns so schnell wie möglich bei dir.",
    name: "Vorname",
    namePlaceholder: "Dein Vorname",
    surname: "Nachname",
    surnamePlaceholder: "Dein Nachname",
    email: "E-Mail",
    emailPlaceholder: "deine@email.com",
    phone: "Telefon (optional)",
    phonePlaceholder: "+49 000 000 0000",
    subject: "Betreff",
    subjectPlaceholder: "Gib hier den Betreff ein…",
    message: "Nachricht",
    messagePlaceholder: "Erzähl uns von deinem Anwendungsfall, deinen Anforderungen oder deinen Fragen...",
    send: "Nachricht senden",
    sending: "Wird gesendet…",
    successTitle: "Nachricht gesendet!",
    successDesc: "Danke, dass du dich gemeldet hast. Wir antworten innerhalb von 24 Stunden.",
  },
}

export function ContactPage() {
  const { language } = useLanguage()
  const t = T[language]

  const [name, setName] = useState("")
  const [surname, setSurname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim() || name.trim().length < 2) { setError("Please enter your name."); return }
    if (!surname.trim() || surname.trim().length < 2) { setError("Please enter your surname."); return }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Please enter a valid email."); return }
    if (phone.trim() && !/^[+()0-9\s.-]{7,20}$/.test(phone.trim())) { setError("Please enter a valid phone number."); return }
    if (!subject.trim() || subject.trim().length < 3) { setError("Please enter a subject."); return }
    if (!message.trim() || message.trim().length < 10) { setError("Please enter a longer message."); return }

    setSubmitting(true)
    try {
      await api.post("/contact", {
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        title: subject.trim(),
        message: message.trim(),
        phone: phone.trim() || undefined,
        website: honeypot,
      })
      setSuccess(true)
      setName(""); setSurname(""); setEmail(""); setPhone("")
      setSubject(""); setMessage(""); setHoneypot("")
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send message. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-200">
      <SEO title={t.seoTitle} description={t.seoDesc} keywords={t.seoKeys} url="/contact" lang={language} serviceType="WhatsApp AI Chatbot Demo & Contact" />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="pt-20 pb-12">
          <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block bg-green-400/10 text-green-300 text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                {t.badge}
              </span>
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                {t.heroTitle}
              </h1>
              <p className="text-xl text-slate-400 leading-relaxed">
                {t.heroSub}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 shadow-2xl backdrop-blur"
            >
              {/* Photo */}
              <div className="relative lg:col-span-2 min-h-[280px]">
                <img src="/team.png" alt="Contact us" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070d18]/70 via-transparent to-transparent" />
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-3 p-8 lg:p-10">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white">{t.formTitle}</h2>
                    <p className="text-slate-400 mt-2">{t.formSubtitle}</p>
                  </div>

                  {success ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-400/10 p-10 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10">
                        <CheckCircle className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h3 className="text-2xl font-semibold text-white">{t.successTitle}</h3>
                      <p className="mt-2 text-slate-400">{t.successDesc}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-300" htmlFor="c-name">{t.name}</label>
                          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className="h-11 bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-300" htmlFor="c-surname">{t.surname}</label>
                          <Input id="c-surname" value={surname} onChange={(e) => setSurname(e.target.value)} placeholder={t.surnamePlaceholder} className="h-11 bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500" required />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300" htmlFor="c-email">{t.email}</label>
                        <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} className="h-11 bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500" required />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300" htmlFor="c-subject">{t.subject}</label>
                        <Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.subjectPlaceholder} className="h-11 bg-slate-900/60 border-white/10 text-slate-100 placeholder:text-slate-500" required />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300" htmlFor="c-message">{t.message}</label>
                        <textarea
                          id="c-message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder={t.messagePlaceholder}
                          required
                          className="min-h-[140px] w-full rounded-md border border-white/10 bg-slate-900/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                        />
                      </div>

                      {/* Honeypot */}
                      <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" tabIndex={-1} />

                      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                      <div className="flex justify-center pt-2">
                        <GreenCtaButton
                          type="submit"
                          disabled={submitting}
                          icon="📩"
                          size="md"
                        >
                          {submitting ? t.sending : t.send}
                        </GreenCtaButton>
                      </div>
                    </form>
                  )}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
