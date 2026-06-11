import { useState, useEffect, type FormEvent } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { motion } from "framer-motion"
import { Mail, MapPin, Send, CheckCircle } from "lucide-react"
import { SEO } from "@/components/SEO"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/services/api"

type Language = "it" | "en" | "es" | "pt"

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
    captchaError: "Completa la verifica di sicurezza.",
    infoEmail: "echatbotai@gmail.com",
    infoPhone: "+34 602 119 358",
    infoLocation: "Italia",
    info1Title: "Email",
    info2Title: "WhatsApp",
    info3Title: "Sede",
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
    captchaError: "Please complete the security check.",
    infoEmail: "echatbotai@gmail.com",
    infoPhone: "+34 602 119 358",
    infoLocation: "Italy",
    info1Title: "Email",
    info2Title: "WhatsApp",
    info3Title: "Location",
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
    captchaError: "Por favor completa la verificación de seguridad.",
    infoEmail: "echatbotai@gmail.com",
    infoPhone: "+34 602 119 358",
    infoLocation: "Italia",
    info1Title: "Email",
    info2Title: "WhatsApp",
    info3Title: "Ubicación",
  },
  pt: {
    seoTitle: "Contacte-nos - eChatbot",
    seoDesc: "Tem perguntas sobre o eChatbot? Contacte a nossa equipa. Estamos aqui para ajudá-lo a escolher o plano certo e começar com o seu chatbot WhatsApp.",
    seoKeys: "contactar echatbot, suporte echatbot, ajuda chatbot whatsapp",
    badge: "Contacto",
    heroTitle: "Vamos falar sobre o seu projeto",
    heroSub: "Perguntas sobre o eChatbot? Quer saber qual plano é o certo para si? A nossa equipa responde em 24 horas.",
    formTitle: "Envie-nos uma mensagem",
    formSubtitle: "Preencha o formulário e entraremos em contacto o mais brevemente possível.",
    name: "Nome",
    namePlaceholder: "O seu nome",
    surname: "Apelido",
    surnamePlaceholder: "O seu apelido",
    email: "Email",
    emailPlaceholder: "o.seu@email.com",
    phone: "Telefone (opcional)",
    phonePlaceholder: "+351 000 000 000",
    subject: "Assunto",
    subjectPlaceholder: "Coloque aqui o assunto…",
    message: "Mensagem",
    messagePlaceholder: "Conte-nos o seu caso de uso, necessidades ou perguntas...",
    send: "Enviar Mensagem",
    sending: "A enviar...",
    successTitle: "Mensagem enviada!",
    successDesc: "Obrigado por entrar em contacto. Responderemos em 24 horas.",
    captchaError: "Por favor complete a verificação de segurança.",
    infoEmail: "echatbotai@gmail.com",
    infoPhone: "+34 602 119 358",
    infoLocation: "Itália",
    info1Title: "Email",
    info2Title: "WhatsApp",
    info3Title: "Localização",
  },
}

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""

export function ContactPage() {
  const { language } = useLanguage()
  const t = T[language]

  const [name, setName] = useState("")
  const [surname, setSurname] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)

    // reCAPTCHA callback
    ;(window as any).onRecaptchaSuccess = (token: string) => {
      setCaptchaToken(token)
      setError("")
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim() || name.trim().length < 2) { setError("Please enter your name."); return }
    if (!surname.trim() || surname.trim().length < 2) { setError("Please enter your surname."); return }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Please enter a valid email."); return }
    if (phone.trim() && !/^[+()0-9\s.-]{7,20}$/.test(phone.trim())) { setError("Please enter a valid phone number."); return }
    if (!captchaToken) { setError(t.captchaError); return }
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
        captchaToken,
        website: honeypot,
      })
      setSuccess(true)
      setName(""); setSurname(""); setEmail(""); setPhone("")
      setSubject(""); setMessage(""); setCaptchaToken(""); setHoneypot("")
      ;(window as any).grecaptcha?.reset?.()
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
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

              {/* Info Cards */}
              <div className="lg:col-span-2 flex flex-col gap-6 justify-start">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="rounded-2xl overflow-hidden shadow-xl mb-8">
                    <img src="/team.png" alt="Contact us" style={{ filter: "grayscale(1) sepia(1) hue-rotate(75deg) saturate(0.9) brightness(1.15)" }} className="w-full h-[400px] object-cover" />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                      <div className="w-10 h-10 bg-green-400/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t.info1Title}</p>
                        <p className="text-white font-medium">{t.infoEmail}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-3">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-slate-900/50 backdrop-blur rounded-3xl p-8 shadow-2xl border border-white/10"
                >
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

                      {/* reCAPTCHA */}
                      <div>
                        {recaptchaSiteKey ? (
                          <div
                            className="g-recaptcha"
                            data-sitekey={recaptchaSiteKey}
                            data-callback="onRecaptchaSuccess"
                          />
                        ) : (
                          <p className="text-sm text-red-600">{t.captchaError}</p>
                        )}
                      </div>

                      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                      <div className="flex justify-center pt-2">
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="px-10 py-6 text-base font-semibold rounded-full bg-[#25D366] hover:bg-[#1fb855] text-white shadow-lg shadow-green-500/20 flex items-center gap-2"
                        >
                          <Send className="h-5 w-5" />
                          {submitting ? t.sending : t.send}
                        </Button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter language={language} />
    </div>
  )
}
