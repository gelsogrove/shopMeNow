/**
 * 🚀 LANDING PAGE - Coming Soon Mode
 * 
 * Professional landing page with "We Are Coming Soon" message.
 * Displays when landingPageEnabled flag is TRUE.
 * 
 * Features:
 * - SEO optimized with "coming soon" meta tags
 * - Brand colors (green #16a34a)
 * - Email subscription form
 * - Social links
 * - WhatsApp contact button
 * - Fully responsive
 * 
 * @author Andrea Gelso - eChatbot
 */

import { useState } from "react"
import { Mail, MessageSquare, CheckCircle2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/lib/toast"
import { useNavigate } from "react-router-dom"

export function LandingPage() {
  const [email, setEmail] = useState("")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    
    // Simulate API call (replace with actual backend endpoint)
    setTimeout(() => {
      setIsSubscribed(true)
      setIsLoading(false)
      toast.success("Thank you! We'll notify you when we launch.")
      setEmail("")
    }, 1000)
  }

  return (
    <>
      {/* SEO Meta Tags */}
      <head>
        <title>eChatbot - Coming Soon | WhatsApp AI E-Commerce Platform</title>
        <meta name="description" content="eChatbot is launching soon! The ultimate WhatsApp AI assistant for e-commerce. Get notified when we go live." />
        <meta name="keywords" content="whatsapp chatbot, ai ecommerce, coming soon, automated sales, whatsapp business" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="eChatbot - Coming Soon" />
        <meta property="og:description" content="Revolutionary WhatsApp AI platform for e-commerce launching soon!" />
        <meta property="og:type" content="website" />
      </head>

      <div 
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
        }}
      >
        {/* Animated Background Circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-green-300 rounded-full opacity-20 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-green-400 rounded-full opacity-20 blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Header */}
        <header className="relative z-10 w-full px-6 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="eChatbot Logo" 
                className="h-14 w-14 object-contain"
              />
              <span className="text-3xl font-bold text-green-600">eChatbot</span>
            </div>

            <button
              onClick={() => navigate("/auth/login")}
              className="text-sm text-green-700 hover:text-green-800 font-medium underline-offset-4 hover:underline"
            >
              Admin Access
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-green-200">
              <Sparkles className="h-4 w-4 text-green-600 animate-pulse" />
              <span className="text-sm font-semibold text-green-700 tracking-wide">
                LAUNCHING SOON
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-tight">
              We Are
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">
                Coming Soon
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-slate-700 max-w-2xl mx-auto leading-relaxed">
              The <strong className="text-green-600">ultimate WhatsApp AI platform</strong> for e-commerce is almost ready.
              <br />
              Transform your customer experience with intelligent automation.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">AI Chatbot</h3>
                <p className="text-sm text-slate-600">
                  Intelligent conversations with customers 24/7
                </p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Auto Orders</h3>
                <p className="text-sm text-slate-600">
                  Seamless order management via WhatsApp
                </p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Analytics</h3>
                <p className="text-sm text-slate-600">
                  Real-time insights and performance tracking
                </p>
              </div>
            </div>

            {/* Email Subscription Form */}
            {!isSubscribed ? (
              <form 
                onSubmit={handleSubscribe} 
                className="max-w-md mx-auto mt-12"
              >
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-green-200 p-2">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 border-0 bg-transparent focus-visible:ring-0"
                        disabled={isLoading}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg"
                    >
                      {isLoading ? "Subscribing..." : "Notify Me"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-3">
                  Get exclusive early access when we launch. No spam, unsubscribe anytime.
                </p>
              </form>
            ) : (
              <div className="max-w-md mx-auto mt-12 bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="text-lg font-semibold text-green-900">
                  You're on the list!
                </p>
                <p className="text-sm text-green-700 mt-2">
                  We'll send you an email as soon as we launch.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 bg-white/50 backdrop-blur-sm border-t border-green-100 py-6">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} eChatbot. All rights reserved.
            </p>
            <div className="flex items-center justify-center gap-6 mt-4">
              <a 
                href="/privacy" 
                className="text-sm text-slate-600 hover:text-green-600 transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="/terms" 
                className="text-sm text-slate-600 hover:text-green-600 transition-colors"
              >
                Terms of Service
              </a>
              <a 
                href="/support" 
                className="text-sm text-slate-600 hover:text-green-600 transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>

        {/* WhatsApp Floating Button */}
        <a
          href="https://wa.me/1234567890"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform z-50 group"
          aria-label="Contact us on WhatsApp"
        >
          <MessageSquare className="h-7 w-7" fill="currentColor" />
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Chat with us!
          </span>
        </a>
      </div>
    </>
  )
}
