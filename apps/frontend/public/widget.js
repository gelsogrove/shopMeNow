/**
 * eChatbot Widget.js
 * Standalone embeddable chat widget for websites
 *
 * Usage:
 * <script>
 *   const eChatbotConfig = {
 *     workspaceId: "your-workspace-id",
 *     position: "bottom-right",
 *     theme: "light"
 *   };
 *   const script = document.createElement("script");
 *   script.src = "https://api.echatbot.ai/widget.js";
 *   script.async = true;
 *   document.head.appendChild(script);
 * </script>
 */

(function () {
  "use strict"

  // ============================================================================
  // CONFIGURATION & CONSTANTS
  // ============================================================================

  // Auto-detect API URL based on environment
  const getDefaultApiUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api/v1'
      }
      // Production or other environments
      return `${window.location.protocol}//${hostname}/api/v1`
    }
    return 'https://api.echatbot.ai/api/v1'
  }

  const DEFAULT_API_URL = getDefaultApiUrl()
  const getDefaultAssetBase = () => {
    if (typeof document === "undefined") return ""
    const scripts = document.getElementsByTagName("script")
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].getAttribute("src") || ""
      if (src.includes("widget.js")) {
        try {
          return new URL(src, window.location.href).origin
        } catch (e) {
          return window.location.origin
        }
      }
    }
    return window.location.origin
  }
  const DEFAULT_LOGO_URL = `${getDefaultAssetBase()}/logo.png`
  const DEFAULT_PRIMARY_COLOR = "#22c55e"
  const STORAGE_KEYS = {
    VISITOR_ID: "echatbot-visitor-id",
    SESSION_ID: "echatbot-session-id",
    MESSAGES: "echatbot-messages",
  }

  // Translations for different languages
  const TRANSLATIONS = {
    it: {
      headerTitle: "Chat con noi 💬",
      placeholder: "Scrivi un messaggio...",
      welcome: "Ciao! 👋 Come posso aiutarti?",
    },
    en: {
      headerTitle: "Chat with us 💬",
      placeholder: "Type a message...",
      welcome: "Hello! 👋 How can I help you?",
    },
    es: {
      headerTitle: "Chatea con nosotros 💬",
      placeholder: "Escribe un mensaje...",
      welcome: "¡Hola! 👋 ¿Cómo puedo ayudarte?",
    },
    pt: {
      headerTitle: "Fale conosco 💬",
      placeholder: "Digite uma mensagem...",
      welcome: "Olá! 👋 Como posso ajudar?",
    },
  }

  // CSS with placeholder for dynamic colors
  const getCSS = (primaryColor) => `
    .echatbot-widget-container {
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    }

    .echatbot-widget-container.bottom-right {
      bottom: 20px;
      right: 20px;
    }

    .echatbot-widget-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(34, 197, 94, 0.6);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      padding: 0;
      overflow: hidden;
    }

    .echatbot-widget-button:hover {
      transform: scale(1.05);
      box-shadow: 0 10px 40px rgba(34, 197, 94, 0.7);
    }

    .echatbot-widget-button:active {
      transform: scale(1.15);
      transition: transform 0.1s ease;
    }

    .echatbot-widget-button img {
      width: 60px;
      height: 60px;
      object-fit: cover;
      display: block;
      border-radius: 50%;
    }
    
    .echatbot-widget-button img[src*="data:image"] {
      width: 60px;
      height: 60px;
    }

    .echatbot-widget-popup {
      position: absolute;
      width: 380px;
      height: 600px;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 50px rgba(0, 0, 0, 0.25);
      display: none;
      flex-direction: column;
      overflow: hidden;
      bottom: 0;
      right: 0;
      transform-origin: bottom right;
    }

    .echatbot-widget-popup.open {
      display: flex;
      animation: popupOpen 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes popupOpen {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .echatbot-widget-header {
      background-color: ${primaryColor};
      color: #ffffff;
      padding: 20px;
      text-align: left;
      font-size: 16px;
      font-weight: 600;
      border-bottom: 1px solid #e5e5e5;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .echatbot-widget-close {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }

    .echatbot-widget-close:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }

    .echatbot-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .echatbot-widget-message {
      display: flex;
      margin-bottom: 8px;
      animation: messageSlide 0.3s ease;
    }

    @keyframes messageSlide {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .echatbot-widget-message.user {
      justify-content: flex-end;
    }

    .echatbot-widget-message.bot {
      justify-content: flex-start;
    }

    .echatbot-widget-message-bubble {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 18px;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.4;
    }

    .echatbot-widget-message.user .echatbot-widget-message-bubble {
      background-color: ${primaryColor};
      color: #ffffff;
    }

    .echatbot-widget-message.bot .echatbot-widget-message-bubble {
      background-color: #f0f0f0;
      color: #333333;
    }

    .echatbot-widget-footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .echatbot-widget-footer-input {
      display: flex;
      gap: 8px;
    }

    .echatbot-widget-powered-by {
      text-align: center;
      font-size: 12px;
      color: #999999;
    }

    .echatbot-widget-powered-by a {
      color: ${primaryColor};
      text-decoration: none;
    }

    .echatbot-widget-powered-by a:hover {
      text-decoration: underline;
    }

    .echatbot-widget-input {
      flex: 1;
      border: 1px solid #e5e5e5;
      border-radius: 24px;
      padding: 12px 16px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      resize: none;
      min-height: 44px;
      max-height: 120px;
      overflow-y: auto;
      line-height: 1.4;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .echatbot-widget-input::-webkit-scrollbar {
      display: none;
    }

    .echatbot-widget-input:focus {
      border-color: ${primaryColor};
    }

    .echatbot-widget-input::placeholder {
      color: #999999;
    }

    .echatbot-widget-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: ${primaryColor};
      color: #ffffff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: all 0.2s;
    }

    .echatbot-widget-send-btn:hover {
      background-color: #333333;
    }

    .echatbot-widget-send-btn:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }

    .echatbot-widget-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 8px;
    }

    .echatbot-widget-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f0f0f0;
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Typing indicator with bouncing dots */
    .echatbot-widget-typing {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background-color: #f0f0f0;
      border-radius: 18px;
      width: fit-content;
      gap: 4px;
    }

    .echatbot-widget-typing-dot {
      width: 8px;
      height: 8px;
      background-color: #999;
      border-radius: 50%;
      animation: typingBounce 1.4s infinite ease-in-out both;
    }

    .echatbot-widget-typing-dot:nth-child(1) {
      animation-delay: -0.32s;
    }

    .echatbot-widget-typing-dot:nth-child(2) {
      animation-delay: -0.16s;
    }

    .echatbot-widget-typing-dot:nth-child(3) {
      animation-delay: 0s;
    }

    @keyframes typingBounce {
      0%, 80%, 100% {
        transform: scale(0.6);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Position variants */
    .echatbot-widget-container.bottom-right {
      bottom: 20px;
      right: 20px;
    }

    .echatbot-widget-container.bottom-left {
      bottom: 20px;
      left: 20px;
    }

    .echatbot-widget-container.top-right {
      top: 20px;
      right: 20px;
    }

    .echatbot-widget-container.top-left {
      top: 20px;
      left: 20px;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .echatbot-widget-popup {
        width: 100vw;
        height: 100vh;
        max-width: 100%;
        max-height: 100%;
        border-radius: 0;
      }

      .echatbot-widget-button {
        width: 56px;
        height: 56px;
      }
    }
  `

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Generate or retrieve visitor ID
   */
  function getOrCreateVisitorId() {
    let visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID)
    if (!visitorId || visitorId.startsWith("webvisitor-")) {
      visitorId = generateVisitorId()
      localStorage.setItem(STORAGE_KEYS.VISITOR_ID, visitorId)
    }
    return visitorId
  }

  /**
   * Resolve widget language from localStorage, browser, or config
   */
  function resolveLanguage(configLanguage) {
    const storedLang = localStorage.getItem("language")
    const browserLang = navigator.language
    return (storedLang || browserLang || configLanguage || "en").toLowerCase().split("-")[0]
  }

  /**
   * Generate random ID
   */
  function generateId() {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
  }

  /**
   * Generate visitor ID in backend-compatible format:
   * visitor_{timestamp}_{hash}
   */
  function generateVisitorId() {
    const timestamp = Date.now()
    const randomHash = Math.random().toString(36).substring(2, 10)
    return "visitor_" + timestamp + "_" + randomHash
  }

  /**
   * Load messages from localStorage
   */
  function loadMessages() {
    const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    return stored ? JSON.parse(stored) : []
  }

  /**
   * Save messages to localStorage
   */
  function saveMessages(messages) {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  }

  /**
   * Make API request with error handling
   */
  async function apiRequest(endpoint, method = "POST", body = null) {
    try {
      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      }

      if (body) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(endpoint, options)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("eChatbot Widget API Error:", error)
      throw error
    }
  }

  // ============================================================================
  // WIDGET CLASS
  // ============================================================================

  class eChatbotWidget {
    constructor(config) {
      const baseConfig = {
        ...config,
        workspaceId: config.workspaceId,
        position: config.position || "bottom-right",
        theme: config.theme || "light",
        apiUrl: config.apiUrl || DEFAULT_API_URL,
      }

      const resolvedLogoUrl =
        baseConfig.logoUrl && baseConfig.logoUrl.trim()
          ? baseConfig.logoUrl
          : DEFAULT_LOGO_URL

      this.config = {
        ...baseConfig,
        logoUrl: resolvedLogoUrl,
      }

      this.isOpen = false
      this.isLoading = false
      this.messages = loadMessages()
      this.visitorId = getOrCreateVisitorId()
      this.sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID) || null

      this.init()
    }

    /**
     * Initialize widget
     */
    init() {
      this.language = resolveLanguage(this.config.language)
      this.createDOM()
      this.attachEventListeners()
      this.loadStoredMessages()
      console.log("✅ eChatbot Widget initialized", {
        workspaceId: this.config.workspaceId,
        visitorId: this.visitorId,
      })
    }

    /**
     * Get default logo (data URI)
     */
    getDefaultLogo() {
      // Simple SVG circle as fallback
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23000000'/%3E%3Ctext x='50' y='60' font-size='50' fill='%23ffffff' text-anchor='middle' font-family='Arial'%3EC%3C/text%3E%3C/svg%3E`
    }

    /**
     * Create DOM elements
     */
    createDOM() {
      // Get translations for current language
      const lang = this.language || "en"
      const t = TRANSLATIONS[lang] || TRANSLATIONS.en

      // Container
      this.container = document.createElement("div")
      this.container.className = `echatbot-widget-container ${this.config.position}`
      document.body.appendChild(this.container)

      // Button
      this.button = document.createElement("button")
      this.button.className = "echatbot-widget-button"
      this.button.title = t.headerTitle
      
      // Create logo image with error handling
      const logoImg = document.createElement("img")
      logoImg.src = this.config.logoUrl
      logoImg.alt = "Chat"
      logoImg.onerror = () => {
        console.warn("Failed to load logo, using default")
        logoImg.src = this.getDefaultLogo()
      }
      this.button.appendChild(logoImg)
      
      this.container.appendChild(this.button)

      // Popup
      this.popup = document.createElement("div")
      this.popup.className = "echatbot-widget-popup"
      this.container.appendChild(this.popup)

      // Header - use custom title if provided, otherwise translated default
      const header = document.createElement("div")
      header.className = "echatbot-widget-header"
      
      const headerTitle = document.createElement("span")
      headerTitle.textContent = this.config.title || t.headerTitle
      header.appendChild(headerTitle)
      
      // Close button
      const closeButton = document.createElement("button")
      closeButton.className = "echatbot-widget-close"
      closeButton.innerHTML = "×"
      closeButton.onclick = () => this.togglePopup()
      header.appendChild(closeButton)
      
      this.popup.appendChild(header)

      // Messages container
      this.messagesContainer = document.createElement("div")
      this.messagesContainer.className = "echatbot-widget-messages"
      this.popup.appendChild(this.messagesContainer)

      // Footer
      const footer = document.createElement("div")
      footer.className = "echatbot-widget-footer"
      this.popup.appendChild(footer)

      // Input container (input + send button)
      const inputContainer = document.createElement("div")
      inputContainer.className = "echatbot-widget-footer-input"
      footer.appendChild(inputContainer)

      // Input - use translated placeholder
      this.input = document.createElement("textarea")
      this.input.className = "echatbot-widget-input"
      this.input.placeholder = t.placeholder
      this.input.rows = 1
      inputContainer.appendChild(this.input)

      // Send button
      this.sendBtn = document.createElement("button")
      this.sendBtn.className = "echatbot-widget-send-btn"
      this.sendBtn.innerHTML = "↗"
      inputContainer.appendChild(this.sendBtn)

      // Powered by link
      const poweredBy = document.createElement("div")
      poweredBy.className = "echatbot-widget-powered-by"
      poweredBy.innerHTML = 'Powered by <a href="https://www.echatbot.ai" target="_blank" rel="noopener noreferrer">echatbot.ai</a>'
      footer.appendChild(poweredBy)

      // Inject styles
      this.injectStyles()
    }

    /**
     * Inject CSS styles
     */
    injectStyles() {
      const style = document.createElement("style")
      style.textContent = getCSS(this.config.primaryColor || DEFAULT_PRIMARY_COLOR)
      document.head.appendChild(style)
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Toggle popup on button click
      this.button.addEventListener("click", () => this.togglePopup())

      // Send message on button click
      this.sendBtn.addEventListener("click", () => this.sendMessage())

      // Send message on Enter (but allow Shift+Enter for newline)
      this.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          this.sendMessage()
        }
      })

      // Auto-expand textarea
      this.input.addEventListener("input", () => {
        this.input.style.height = "auto"
        const newHeight = Math.min(Math.max(this.input.scrollHeight, 44), 120)
        this.input.style.height = newHeight + "px"
      })

      // Auto-scroll to latest message
      const observer = new MutationObserver(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
      })
      observer.observe(this.messagesContainer, { childList: true })
    }

    /**
     * Toggle popup visibility
     */
    togglePopup() {
      this.isOpen = !this.isOpen
      this.popup.classList.toggle("open", this.isOpen)
      // Hide button when popup is open
      this.button.style.display = this.isOpen ? "none" : "flex"
      if (this.isOpen) {
        this.input.focus()
      }
    }

    /**
     * Load stored messages and display them
     */
    loadStoredMessages() {
      // If no messages, show welcome message
      if (this.messages.length === 0) {
        const lang = this.language || "en"
        const t = TRANSLATIONS[lang] || TRANSLATIONS.en
        this.displayMessage({ role: "bot", content: t.welcome })
      } else {
        this.messages.forEach((msg) => this.displayMessage(msg))
      }
    }

    /**
     * Send message to API
     */
    async sendMessage() {
      const message = this.input.value.trim()

      if (!message || this.isLoading) return

      // Add user message to UI
      this.displayMessage({ role: "user", content: message })
      this.messages.push({ role: "user", content: message })
      saveMessages(this.messages)

      // Clear input
      this.input.value = ""
      this.input.style.height = "auto"
      this.sendBtn.disabled = true
      this.isLoading = true

      // Show typing indicator
      this.showTypingIndicator()

      try {
        // Resolve current language (sync UI + LLM)
        const browserLang = resolveLanguage(this.config.language)
        this.language = browserLang

        // Call widget API (correct endpoint)
        const response = await apiRequest(
          `${this.config.apiUrl}/widget/chat/${this.config.workspaceId}`,
          "POST",
          {
            visitorId: this.visitorId,
            message,
            language: browserLang,
            sessionId: this.sessionId,
          }
        )

        // Hide typing indicator
        this.hideTypingIndicator()

        if (response.success && response.response) {
          // Save session ID
          if (response.sessionId) {
            this.sessionId = response.sessionId
            localStorage.setItem(STORAGE_KEYS.SESSION_ID, this.sessionId)
          }

          // Display bot response
          this.displayMessage({ role: "bot", content: response.response })
          this.messages.push({ role: "bot", content: response.response })
          saveMessages(this.messages)
        } else {
          this.displayMessage({
            role: "bot",
            content: "Sorry, I couldn't process your message. Please try again.",
          })
        }
      } catch (error) {
        console.error("Failed to send message:", error)
        // Hide typing indicator on error too
        this.hideTypingIndicator()
        this.displayMessage({
          role: "bot",
          content:
            "Connection error. Please check your internet and try again.",
        })
      } finally {
        this.isLoading = false
        this.sendBtn.disabled = false
      }
    }

    /**
     * Show typing indicator with bouncing dots
     */
    showTypingIndicator() {
      // Remove existing typing indicator if any
      this.hideTypingIndicator()

      const typingEl = document.createElement("div")
      typingEl.className = "echatbot-widget-message bot"
      typingEl.id = "echatbot-typing-indicator"

      const typing = document.createElement("div")
      typing.className = "echatbot-widget-typing"

      // Create 3 bouncing dots
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div")
        dot.className = "echatbot-widget-typing-dot"
        typing.appendChild(dot)
      }

      typingEl.appendChild(typing)
      this.messagesContainer.appendChild(typingEl)

      // Scroll to show typing indicator
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
      const typingEl = document.getElementById("echatbot-typing-indicator")
      if (typingEl) {
        typingEl.remove()
      }
    }

    /**
     * Display message in UI
     */
    displayMessage(msg) {
      const messageEl = document.createElement("div")
      messageEl.className = `echatbot-widget-message ${msg.role}`

      const bubble = document.createElement("div")
      bubble.className = "echatbot-widget-message-bubble"
      bubble.textContent = msg.content

      messageEl.appendChild(bubble)
      this.messagesContainer.appendChild(messageEl)
    }

    /**
     * Convert visitor to customer
     */
    async convertVisitor(customerData) {
      try {
        const response = await apiRequest(
          `${this.config.apiUrl}/widget/convert-visitor`,
          "POST",
          {
            workspaceId: this.config.workspaceId,
            visitorId: this.visitorId,
            ...customerData,
          }
        )

        if (response.success) {
          // Clear visitor ID from storage
          localStorage.removeItem(STORAGE_KEYS.VISITOR_ID)
          console.log("✅ Visitor converted to customer", response.customerId)
          return response.customerId
        }
      } catch (error) {
        console.error("Failed to convert visitor:", error)
        throw error
      }
    }

    /**
     * Get stored messages (for external access)
     */
    getMessages() {
      return this.messages
    }

    /**
     * Clear chat history
     */
    clearHistory() {
      this.messages = []
      this.messagesContainer.innerHTML = ""
      saveMessages([])
    }
  }

  // ============================================================================
  // GLOBAL INITIALIZATION
  // ============================================================================

  // Expose to window
  window.eChatbotWidget = {
    init: function (config) {
      if (!config || !config.workspaceId) {
        console.error("eChatbot Widget: workspaceId is required in config")
        return
      }
      window._eChatbotWidget = new eChatbotWidget(config)
      return window._eChatbotWidget
    },
    getInstance: function () {
      return window._eChatbotWidget
    },
  }

  // Auto-initialize if window.eChatbotConfig is present
  if (window.eChatbotConfig && window.eChatbotConfig.workspaceId) {
    console.log("🚀 eChatbot Widget auto-initializing from window.eChatbotConfig")
    window.eChatbotWidget.init(window.eChatbotConfig)
  } else {
    console.log("✅ eChatbot Widget script loaded. Call eChatbotWidget.init(config) to start.")
  }
})()
