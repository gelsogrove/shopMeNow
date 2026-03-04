import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from "axios"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"

// ─────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────
interface StepOption {
  value: string
  label: string
  emoji?: string
}

interface StepDef {
  id: string
  icon: string
  title: string
  question: string
  type: "radio" | "textarea"
  options?: StepOption[]
}

const STEPS: StepDef[] = [
  {
    id: "stepChannel",
    icon: "📡",
    title: "Channel preference",
    question: "Which channel would you like to activate for your customers?",
    type: "radio",
    options: [
      { value: "widget", label: "Web Widget", emoji: "🌐" },
      { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
      { value: "multichannel", label: "Both (multichannel)", emoji: "🔀" },
    ],
  },
  {
    id: "stepTimeSaving",
    icon: "⏱️",
    title: "Time saving goal",
    question: "What repetitive tasks would you most like to automate? (e.g. FAQs, order tracking, bookings…)",
    type: "textarea",
  },
  {
    id: "stepEcommerce",
    icon: "🛒",
    title: "Automated sales",
    question: "Would you like the AI to handle product recommendations and orders automatically?",
    type: "radio",
    options: [
      { value: "yes", label: "Yes, absolutely!", emoji: "✅" },
      { value: "no", label: "Not right now", emoji: "⏸️" },
    ],
  },
  {
    id: "stepDocuments",
    icon: "📄",
    title: "Document management",
    question: "Do you need the AI to answer questions based on PDF documents or internal manuals?",
    type: "radio",
    options: [
      { value: "yes", label: "Yes, I have documents", emoji: "✅" },
      { value: "no", label: "Not needed", emoji: "⏸️" },
    ],
  },
  {
    id: "stepIntegration",
    icon: "🔗",
    title: "Live integrations",
    question: "Would you like to connect the AI to external systems (CRM, ERP, calendar…)?",
    type: "radio",
    options: [
      { value: "yes", label: "Yes, integration needed", emoji: "✅" },
      { value: "no", label: "No, standalone is fine", emoji: "⏸️" },
    ],
  },
  {
    id: "stepHandoff",
    icon: "🤝",
    title: "Human handoff",
    question: "When a customer needs a human agent, where should the conversation be transferred?",
    type: "radio",
    options: [
      { value: "whatsapp", label: "Directly on WhatsApp", emoji: "💬" },
      { value: "backoffice", label: "Internal backoffice panel", emoji: "🖥️" },
    ],
  },
  {
    id: "stepMarketing",
    icon: "📣",
    title: "AI Marketing",
    question: "Are you interested in using the AI for push campaigns and proactive customer re-engagement?",
    type: "radio",
    options: [
      { value: "yes", label: "Yes, I want campaigns", emoji: "✅" },
      { value: "no", label: "Not for now", emoji: "⏸️" },
    ],
  },
]

// ─────────────────────────────────────────
// Slide animation variants
// ─────────────────────────────────────────
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
}

// ─────────────────────────────────────────
// Main component
// ─────────────────────────────────────────
export default function QuestionnairePage() {
  // Current view: "intro" | "steps" | "contact" | "success"
  const [view, setView] = useState<"intro" | "steps" | "contact" | "success">("intro")
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)

  // Step answers keyed by stepId
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Contact fields
  const [contact, setContact] = useState({ fullName: "", email: "", phone: "", company: "" })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const totalSteps = STEPS.length
  const step = STEPS[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100

  // ─── Navigation ───────────────────────────
  function handleNext() {
    if (currentStep < totalSteps - 1) {
      setDirection(1)
      setCurrentStep((s) => s + 1)
    } else {
      // After last step → contact form
      setView("contact")
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((s) => s - 1)
    } else {
      setView("intro")
    }
  }

  function handleAnswer(stepId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [stepId]: value }))
  }

  // ─── Submit ───────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contact.fullName.trim() || !contact.email.trim()) return

    setIsSubmitting(true)
    setSubmitError("")

    try {
      await axios.post(`${API_BASE}/questionnaire`, {
        ...contact,
        ...answers,
      })
      setView("success")
    } catch {
      setSubmitError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceed = step && (step.type === "textarea"
    ? (answers[step.id] || "").trim().length > 0
    : !!answers[step.id])

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(to bottom right, rgba(248,250,252,0.95), rgba(240,253,244,0.9))",
      }}
    >
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="eChatbot" className="w-10 h-10" />
            <span className="text-xl font-bold text-green-600">eChatbot</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-slate-600 hover:text-green-600 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4 py-12">
        <div className="w-full max-w-lg">
          {/* ── INTRO ── */}
          {view === "intro" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl p-8 text-center"
            >
              <div className="text-6xl mb-4">🚀</div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">
                Discover your perfect AI setup
              </h1>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Answer 7 quick questions and we'll show you exactly how eChatbot can transform your business.
                It takes less than 3 minutes.
              </p>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-10 py-6 text-lg rounded-xl shadow-lg"
                onClick={() => {
                  setView("steps")
                  setCurrentStep(0)
                }}
              >
                Start the questionnaire →
              </Button>
            </motion.div>
          )}

          {/* ── STEPS ── */}
          {view === "steps" && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Progress bar */}
              <div className="h-1.5 bg-slate-100">
                <motion.div
                  className="h-full bg-green-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="p-8">
                {/* Step counter */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Step {currentStep + 1} of {totalSteps}
                  </span>
                  <div className="flex gap-1">
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-6 rounded-full transition-colors ${
                          i <= currentStep ? "bg-green-500" : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25 }}
                  >
                    {/* Icon + Title */}
                    <div className="text-5xl mb-3">{step.icon}</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">{step.title}</h2>
                    <p className="text-slate-500 mb-6 text-sm leading-relaxed">{step.question}</p>

                    {/* Options */}
                    {step.type === "radio" && step.options && (
                      <div className="space-y-3">
                        {step.options.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleAnswer(step.id, opt.value)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                              answers[step.id] === opt.value
                                ? "border-green-500 bg-green-50 text-green-800"
                                : "border-slate-200 hover:border-green-300 text-slate-700"
                            }`}
                          >
                            <span className="text-xl">{opt.emoji}</span>
                            <span className="font-medium">{opt.label}</span>
                            {answers[step.id] === opt.value && (
                              <span className="ml-auto text-green-600">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {step.type === "textarea" && (
                      <textarea
                        rows={4}
                        placeholder="Type your answer here…"
                        value={answers[step.id] || ""}
                        onChange={(e) => handleAnswer(step.id, e.target.value)}
                        className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:border-green-500 focus:outline-none resize-none transition-colors"
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Nav buttons */}
                <div className="flex gap-3 mt-8">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="flex-2 bg-green-600 hover:bg-green-700 text-white px-8 disabled:opacity-40"
                  >
                    {currentStep < totalSteps - 1 ? "Next →" : "Almost done →"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── CONTACT FORM ── */}
          {view === "contact" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-5xl mb-3">👤</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Almost there!</h2>
              <p className="text-slate-500 mb-6 text-sm">
                Leave your details and we'll get back to you with a personalised proposal.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <Input
                    placeholder="John Smith"
                    value={contact.fullName}
                    onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                    required
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    required
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    placeholder="+39 333 1234567"
                    value={contact.phone}
                    onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Company
                  </label>
                  <Input
                    placeholder="Acme Inc."
                    value={contact.company}
                    onChange={(e) => setContact((c) => ({ ...c, company: e.target.value }))}
                    className="border-slate-200 focus:border-green-500"
                  />
                </div>

                {submitError && (
                  <p className="text-red-500 text-sm">{submitError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setView("steps")}
                    className="flex-1 border-slate-200 text-slate-600"
                  >
                    ← Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !contact.fullName.trim() || !contact.email.trim()}
                    className="flex-2 bg-green-600 hover:bg-green-700 text-white px-8 disabled:opacity-40"
                  >
                    {isSubmitting ? "Sending…" : "Submit →"}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── SUCCESS ── */}
          {view === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl p-10 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <span className="text-4xl">✅</span>
              </motion.div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank you!</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                We've received your questionnaire. Our team will review your profile and contact you shortly
                with a personalised AI setup proposal.
              </p>
              <Link to="/">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8">
                  Back to homepage
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
