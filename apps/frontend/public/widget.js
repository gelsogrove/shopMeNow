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

  // Auto-detect API URL based on widget.js script source
  const getDefaultApiUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api/v1'
      }
      
      // Get widget.js source URL to determine API URL
      const scripts = document.getElementsByTagName("script")
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute("src") || ""
        if (src.includes("widget.js")) {
          try {
            const widgetUrl = new URL(src, window.location.href)
            return `${widgetUrl.protocol}//${widgetUrl.host}/api/v1`
          } catch (e) {
            // Fallback to echatbot.ai if parsing fails
            return 'https://www.echatbot.ai/api/v1'
          }
        }
      }
    }
    return 'https://www.echatbot.ai/api/v1'
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
  const DEFAULT_EMBED_URL = `${getDefaultAssetBase()}/widget-embed`
  const DEFAULT_PRIMARY_COLOR = "#22c55e"
  const STORAGE_KEYS = {
    VISITOR_ID: "echatbot-visitor-id",
    SESSION_ID: "echatbot-session-id",
    MESSAGES: "echatbot-messages",
    LAST_WORKSPACE: "echatbot-last-workspace-id",
    CUSTOMER_PROFILE: "echatbot-customer-profile",
  }

  const getStorageKey = (key, workspaceId) => `${key}:${workspaceId}`

  // Translations for different languages
  const TRANSLATIONS = {
    it: {
      headerTitle: "Chat con noi 💬",
      placeholder: "Scrivi un messaggio...",
      welcome: "Ciao! 👋 Come posso aiutarti?",
      flag: "🇮🇹",
    },
    en: {
      headerTitle: "Chat with us 💬",
      placeholder: "Type a message...",
      welcome: "Hello! 👋 How can I help you?",
      flag: "🇬🇧",
    },
    es: {
      headerTitle: "Chatea con nosotros 💬",
      placeholder: "Escribe un mensaje...",
      welcome: "¡Hola! 👋 ¿Cómo puedo ayudarte?",
      flag: "🇪🇸",
    },
    pt: {
      headerTitle: "Fale conosco 💬",
      placeholder: "Digite uma mensagem...",
      welcome: "Olá! 👋 Como posso ajudar?",
      flag: "🇵🇹",
    },
  }

  // Auto-detect browser language
  const getBrowserLanguage = () => {
    const browserLang = navigator.language || navigator.userLanguage
    if (!browserLang) {
      console.warn('🌍 Browser language not detected, using EN* (default fallback)')
      return 'en*' // Asterisco indica fallback
    }
    const lang = browserLang.split('-')[0].toLowerCase()
    console.log('🌍 Browser language detected:', browserLang, '→', lang)
    return lang
  }

  // Helper function to convert hex color to rgba
  const hexToRgba = (hex, alpha = 1) => {
    // Remove # if present
    hex = hex.replace('#', '')
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // CSS with placeholder for dynamic colors
  const getCSS = (primaryColor) => {
    const pulseColor = hexToRgba(primaryColor, 0.7)
    const pulseColorTransparent = hexToRgba(primaryColor, 0)
    
    return `
    .echatbot-widget-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .echatbot-widget-overlay.visible {
      display: block;
      opacity: 1;
    }

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
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: ${primaryColor};
      background: ${primaryColor};
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      padding: 0;
      overflow: visible;
      background-image: none;
      position: relative;
    }

    /* Pallino verde status indicator */
    .echatbot-widget-status-dot {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 20px;
      height: 20px;
      background-color: #22c55e;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.5);
      z-index: 10;
    }

    .echatbot-widget-button::before,
    .echatbot-widget-button::after {
      content: none !important;
    }

    .echatbot-widget-button:hover {
      transform: scale(1.1);
    }

    .echatbot-widget-button:active {
      transform: scale(0.95);
      transition: transform 0.1s ease;
    }

    .echatbot-widget-button-icon svg {
      width: 40px !important;
      height: 40px !important;
      stroke: white !important;
      stroke-width: 1.8 !important;
      fill: none !important;
    }

    .echatbot-widget-button img {
      width: 64px;
      height: 64px;
      object-fit: cover;
      display: block;
      border-radius: 50%;
      background: transparent;
      box-shadow: none;
    }

    .echatbot-widget-button * {
      pointer-events: none;
    }

    /* Balloon sopra il cerchio */
    .echatbot-widget-balloon {
      position: absolute;
      bottom: calc(100% + 12px);
      left: 50%;
      transform: translateX(-50%);
      width: 280px;
      max-width: 90vw;
      background: white;
      border-radius: 20px;
      padding: 16px 40px 16px 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 9999;
      animation: echatbot-slide-up 0.5s ease-out;
    }

    @keyframes echatbot-slide-up {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .echatbot-widget-balloon::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -8px;
      transform: translateX(-50%) rotate(45deg);
      width: 16px;
      height: 16px;
      background: white;
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
      clip-path: polygon(0 0, 100% 0, 100% 100%);
    }

    .echatbot-widget-balloon-text {
      font-size: 14px;
      line-height: 1.4;
      font-weight: 500;
      color: #1f2937;
    }

    .echatbot-widget-balloon-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .echatbot-widget-balloon-close:hover {
      color: #374151;
      background: #f3f4f6;
    }

    .echatbot-widget-popup {
      position: absolute;
      width: 390px;
      height: 610px;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.1);
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

    .echatbot-widget-profile-badge {
      position: absolute;
      right: 48px;
      top: 50%;
      transform: translateY(-50%);
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      border: 2px solid rgba(255,255,255,0.6);
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
      padding: 0;
    }

    .echatbot-widget-profile-badge:hover {
      background: rgba(255,255,255,0.4);
    }

    .echatbot-widget-profile-popover {
      position: absolute;
      top: calc(100% + 6px);
      right: 8px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      min-width: 180px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      z-index: 9999;
      color: #1a1a1a;
    }

    .echatbot-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
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
      max-width: 85%;
      padding: 12px 14px;
      border-radius: 18px;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
    }

    .echatbot-widget-message.user .echatbot-widget-message-bubble {
      background-color: ${primaryColor};
      color: #ffffff;
      border-bottom-right-radius: 12px;
    }

    .echatbot-widget-message.bot .echatbot-widget-message-bubble {
      background-color: #ffffff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 12px;
    }

    .echatbot-widget-message-bubble a {
      color: #2563eb;
      text-decoration: underline;
      word-break: break-word;
    }

    .echatbot-widget-message-bubble img.echatbot-widget-image {
      max-width: 140px;
      height: auto;
      border-radius: 10px;
      margin: 6px 0;
      display: block;
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
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      pointer-events: auto;
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

    .echatbot-spinner {
      animation: spin 0.8s linear infinite;
      display: inline-block;
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
        width: 66px;
        height: 66px;
      }

      .echatbot-widget-footer {
        padding: 10px 12px;
      }

      .echatbot-widget-footer-input {
        gap: 6px;
      }

      .echatbot-widget-send-btn {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .echatbot-widget-input {
        font-size: 16px;
        max-height: 100px;
      }
    }
  `
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Generate or retrieve visitor ID
   */
  function getOrCreateVisitorId(workspaceId) {
    const storageKey = getStorageKey(STORAGE_KEYS.VISITOR_ID, workspaceId)
    let visitorId = localStorage.getItem(storageKey)
    if (!visitorId || visitorId.startsWith("webvisitor-")) {
      visitorId = generateVisitorId()
      localStorage.setItem(storageKey, visitorId)
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
  function loadMessages(workspaceId) {
    const stored = localStorage.getItem(
      getStorageKey(STORAGE_KEYS.MESSAGES, workspaceId)
    )
    return stored ? JSON.parse(stored) : []
  }

  /**
   * Save messages to localStorage
   */
  function saveMessages(workspaceId, messages) {
    localStorage.setItem(
      getStorageKey(STORAGE_KEYS.MESSAGES, workspaceId),
      JSON.stringify(messages)
    )
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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  function resolveImageUrl(src, apiUrl) {
    if (!src) return ""
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src
    }
    const base = apiUrl ? apiUrl.replace(/\/api\/v1$/, "") : window.location.origin
    if (src.startsWith("/")) {
      return `${base}${src}`
    }
    return `${base}/${src}`
  }

  function getIconSvg(iconName, color = "#ffffff") {
    const stroke = color
    switch ((iconName || "chat").toLowerCase()) {
      case "sparkles":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fill="${stroke}" />
  <path d="M16 38l2.5 6.5L25 47l-6.5 2-2.5 6.5L13.5 49 7 47l6.5-2L16 38Z" fill="${stroke}" />
</svg>`
      case "support":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="18" stroke="${stroke}" stroke-width="3.2" />
  <circle cx="32" cy="32" r="8" stroke="${stroke}" stroke-width="3.2" />
  <path d="M32 14v6M32 44v6M18 32h-6M52 32h-6M21 21l-4.5-4.5M47.5 47.5 43 43M21 43l-4.5 4.5M47.5 16.5 43 21" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" />
</svg>`
      case "bot":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="14" y="18" width="36" height="28" rx="8" stroke="${stroke}" stroke-width="3.2" />
  <circle cx="26" cy="32" r="3.2" fill="${stroke}" />
  <circle cx="38" cy="32" r="3.2" fill="${stroke}" />
  <path d="M32 10v6" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" />
  <path d="M22 44c3 3 17 3 20 0" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" />
</svg>`
      case "messages":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 12c0-2.2 1.8-4 4-4h24c2.2 0 4 1.8 4 4v14c0 2.2-1.8 4-4 4h-8l-6 5v-5h-10c-2.2 0-4-1.8-4-4V12Z" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" />
  <path d="M18 32h-2c-2.2 0-4 1.8-4 4v14c0 2.2 1.8 4 4 4h10v5l6-5h8c2.2 0 4-1.8 4-4v-6" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" />
  <circle cx="26" cy="19" r="2" fill="${stroke}" />
  <circle cx="32" cy="19" r="2" fill="${stroke}" />
  <circle cx="38" cy="19" r="2" fill="${stroke}" />
</svg>`
      case "mail":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="16" width="48" height="32" rx="4" stroke="${stroke}" stroke-width="3.2" />
  <path d="M8 20l24 16 24-16" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`
      case "user":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="24" r="10" stroke="${stroke}" stroke-width="3.2" />
  <path d="M12 52c0-11 9-20 20-20s20 9 20 20" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" />
</svg>`
      case "star":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8l6.5 13 14.5 2-10.5 10 2.5 14.5L32 41l-13 6.5 2.5-14.5L11 23l14.5-2L32 8Z" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" fill="${stroke}" fill-opacity="0.3" />
</svg>`
      case "heart":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 52S12 40 12 26c0-8 6-12 12-12 4 0 8 2 8 6 0-4 4-6 8-6 6 0 12 4 12 12 0 14-20 26-20 26Z" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" fill="${stroke}" fill-opacity="0.3" />
</svg>`
      case "bell":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 52c0 4.4 3.6 8 8 8s8-3.6 8-8M48 40v-12c0-8.8-7.2-16-16-16s-16 7.2-16 16v12l-4 8h40l-4-8Z" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`
      case "shield":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 8l-16 6v12c0 12 8 22 16 26 8-4 16-14 16-26V14l-16-6Z" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" fill="${stroke}" fill-opacity="0.2" />
  <path d="M24 30l6 6 10-12" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`
      case "zap":
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M36 8L16 36h16l-4 20 20-28H32l4-20Z" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" fill="${stroke}" fill-opacity="0.3" />
</svg>`
      default:
        return `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 16c0-4.4 3.6-8 8-8h20c4.4 0 8 3.6 8 8v15c0 4.4-3.6 8-8 8H29l-8 7v-7h-7c-4.4 0-8-3.6-8-8V16Z" stroke="${stroke}" stroke-width="3.2" stroke-linejoin="round" />
  <circle cx="24" cy="24" r="2.8" fill="${stroke}" />
  <circle cx="32" cy="24" r="2.8" fill="${stroke}" />
  <circle cx="40" cy="24" r="2.8" fill="${stroke}" />
</svg>`
    }
  }

  function extractImages(raw) {
    const images = []
    let text = raw

    const htmlImgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*alt="([^"]*)"?[^>]*>/gi
    text = text.replace(htmlImgRegex, (_, src, alt) => {
      const token = `__IMG_${images.length}__`
      images.push({ src, alt: alt || "" })
      return token
    })

    const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    text = text.replace(mdImgRegex, (_, alt, src) => {
      const token = `__IMG_${images.length}__`
      images.push({ src, alt: alt || "" })
      return token
    })

    return { text, images }
  }

  function renderMarkdown(content, apiUrl) {
    const { text, images } = extractImages(content || "")
    let safe = escapeHtml(text)

    safe = safe
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>")

    safe = safe.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    )

    images.forEach((img, idx) => {
      const resolved = resolveImageUrl(img.src, apiUrl)
      const alt = escapeHtml(img.alt || "")
      safe = safe.replace(
        `__IMG_${idx}__`,
        `<img src="${resolved}" alt="${alt}" class="echatbot-widget-image" />`
      )
    })

    return safe
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
          ? baseConfig.logoUrl.trim()
          : ""
      const resolvedIcon =
        baseConfig.icon && String(baseConfig.icon).trim()
          ? String(baseConfig.icon).trim()
          : "chat"

      this.config = {
        ...baseConfig,
        logoUrl: resolvedLogoUrl,
        icon: resolvedIcon,
      }

      this.isOpen = false
      this.isLoading = false
      this.storageWorkspaceId = this.config.workspaceId
      this.resetStorageIfWorkspaceChanged()
      this.messages = loadMessages(this.storageWorkspaceId)
      this.visitorId = getOrCreateVisitorId(this.storageWorkspaceId)
      
      // 🌍 Auto-detect language if not specified
      this.detectedLanguage = config.language || getBrowserLanguage()
      this.isLanguageFallback = this.detectedLanguage.includes('*')
      console.log('🌍 eChatbot Widget Language:', this.detectedLanguage, '(browser:', navigator.language, ', fallback:', this.isLanguageFallback, ')')
      this.sessionId =
        localStorage.getItem(
          getStorageKey(STORAGE_KEYS.SESSION_ID, this.storageWorkspaceId)
        ) || null

      this.init()
    }

    /**
     * Reset stored data if the widget switches to a different workspace.
     */
    resetStorageIfWorkspaceChanged() {
      const lastWorkspaceId = localStorage.getItem(STORAGE_KEYS.LAST_WORKSPACE)
      if (lastWorkspaceId && lastWorkspaceId !== this.storageWorkspaceId) {
        localStorage.removeItem(getStorageKey(STORAGE_KEYS.SESSION_ID, this.storageWorkspaceId))
        localStorage.removeItem(getStorageKey(STORAGE_KEYS.MESSAGES, this.storageWorkspaceId))
        localStorage.removeItem(getStorageKey(STORAGE_KEYS.VISITOR_ID, this.storageWorkspaceId))
      }
      localStorage.setItem(STORAGE_KEYS.LAST_WORKSPACE, this.storageWorkspaceId)
    }

    /**
     * Initialize widget
     */
    async init() {
      // 🌍 Language will be set by loadStatus() from workspace configuration
      await this.loadStatus()
      if (this.status === "disabled") {
        console.warn("eChatbot Widget disabled for workspace", {
          workspaceId: this.config.workspaceId,
        })
        return
      }
      this.createDOM()
      this.attachEventListeners()
      this.loadStoredMessages()
      if (this.status === "wip") {
        this.showWipMessage()
      }
      console.log("✅ eChatbot Widget initialized", {
        workspaceId: this.config.workspaceId,
        visitorId: this.visitorId,
      })
    }

    async loadStatus() {
      this.status = "active"
      this.wipMessage = null
      try {
        const params = new URLSearchParams()
        if (this.language) {
          params.set("language", this.language)
        }
        const endpoint = `${this.config.apiUrl}/widget/status/${this.config.workspaceId}?${params.toString()}`
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })
        if (!response.ok) {
          if (response.status === 404) {
            this.status = "disabled"
          }
          return
        }
        const data = await response.json()
        if (data && typeof data.status === "string") {
          this.status = data.status
          if (data.status === "wip" && data.wipMessage) {
            this.wipMessage = data.wipMessage
          }
          // 🌍 Use workspace configured language (overrides browser language)
          if (data.language) {
            this.language = data.language
            console.log("✅ Widget language set from workspace:", this.language)
          }
          // 🎨 Use workspace configured primaryColor (overrides config)
          if (data.primaryColor) {
            this.config.primaryColor = data.primaryColor
            console.log("✅ Widget primaryColor set from workspace:", this.config.primaryColor)
          }
          // 🎨 Use workspace configured icon (overrides config)
          if (data.icon) {
            this.config.icon = data.icon
            console.log("✅ Widget icon set from workspace:", this.config.icon)
          }
        }
      } catch (error) {
        console.warn("eChatbot Widget status check failed:", error)
      }
    }

    /**
     * Get default logo (data URI)
     */
    getDefaultLogo() {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Open chat">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#22c55e"/>
              <stop offset="100%" stop-color="#16a34a"/>
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#g)"/>
          <path d="M26 32h48c4.4 0 8 3.6 8 8v18c0 4.4-3.6 8-8 8H52l-9 8v-8H26c-4.4 0-8-3.6-8-8V40c0-4.4 3.6-8 8-8Z" fill="#ffffff"/>
          <rect x="34" y="43" width="32" height="3.5" rx="1.75" fill="#22c55e"/>
          <rect x="34" y="50" width="14" height="4" rx="2" fill="#22c55e"/>
          <rect x="50" y="50" width="16" height="4" rx="2" fill="#22c55e"/>
        </svg>
      `
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    }

    /**
     * Create DOM elements
     */
    createDOM() {
      // Get translations for current language - use detected language
      const lang = this.detectedLanguage || this.language || "en"
      const t = TRANSLATIONS[lang] || TRANSLATIONS.en

      // Overlay (for darkening background when widget is open)
      this.overlay = document.createElement("div")
      this.overlay.className = "echatbot-widget-overlay"
      this.overlay.addEventListener("click", () => {
        if (this.isOpen) {
          this.togglePopup()
        }
      })
      document.body.appendChild(this.overlay)

      // Container
      this.container = document.createElement("div")
      this.container.className = `echatbot-widget-container ${this.config.position}`
      document.body.appendChild(this.container)

      // Button
      this.button = document.createElement("button")
      this.button.className = "echatbot-widget-button"
      this.button.title = t.headerTitle

      const buildButtonGlyph = () => {
        if (this.config.logoUrl) {
          const img = document.createElement("img")
          img.src = resolveImageUrl(this.config.logoUrl, this.config.apiUrl)
          img.alt = "Open chat"
          img.style.width = "100%"
          img.style.height = "100%"
          img.style.objectFit = "cover"
          img.style.borderRadius = "50%"
          img.loading = "lazy"
          return img
        }

        const iconWrapper = document.createElement("div")
        iconWrapper.className = "echatbot-widget-button-icon"
        iconWrapper.style.width = "100%"
        iconWrapper.style.height = "100%"
        iconWrapper.style.display = "flex"
        iconWrapper.style.alignItems = "center"
        iconWrapper.style.justifyContent = "center"
        iconWrapper.style.borderRadius = "50%"
        iconWrapper.style.pointerEvents = "none"
        iconWrapper.innerHTML = getIconSvg(this.config.icon, "#ffffff")
        return iconWrapper
      }

      let isScrubbing = false
      const scrubButton = () => {
        isScrubbing = true
        while (this.button.firstChild) {
          this.button.removeChild(this.button.firstChild)
        }
        const primary = this.config.primaryColor || "#22c55e"
        this.button.style.background = primary
        this.button.style.backgroundColor = primary
        this.button.style.backgroundImage = "none"
        this.button.style.boxShadow = "0 12px 38px rgba(0,0,0,0.18)"
        this.button.style.borderColor = primary

        const glyph = buildButtonGlyph()
        if (glyph) {
          this.button.appendChild(glyph)
        }
        isScrubbing = false
      }
      scrubButton()

      const observer = new MutationObserver(() => {
        if (!isScrubbing) {
          scrubButton()
        }
      })
      observer.observe(this.button, { childList: true, subtree: true })

      // Pallino verde status indicator (aggiunto DOPO il button)
      const statusDot = document.createElement("div")
      statusDot.className = "echatbot-widget-status-dot"
      statusDot.title = "Online"
      this.button.appendChild(statusDot)

      // Balloon SOPRA il cerchio (con localStorage per chiusura permanente)
      const balloonKey = `echatbot-balloon-closed:${this.config.workspaceId}`
      const isBalloonClosed = localStorage.getItem(balloonKey) === "true"
      
      if (!isBalloonClosed) {
        const balloon = document.createElement("div")
        balloon.className = "echatbot-widget-balloon"
        
        const balloonText = document.createElement("p")
        balloonText.className = "echatbot-widget-balloon-text"
        balloonText.textContent = t.welcome || "👋 How can I help you today?"
        balloon.appendChild(balloonText)
        
        const closeBtn = document.createElement("button")
        closeBtn.className = "echatbot-widget-balloon-close"
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        closeBtn.title = "Close"
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          balloon.remove()
          localStorage.setItem(balloonKey, "true")
        })
        balloon.appendChild(closeBtn)
        
        this.container.insertBefore(balloon, this.button)
      }

      this.container.appendChild(this.button)

      // Popup
      this.popup = document.createElement("div")
      this.popup.className = "echatbot-widget-popup"
      this.container.appendChild(this.popup)

      // 🌍 Language flag indicator
      const langFlag = document.createElement("span")
      langFlag.className = "echatbot-widget-lang-flag"
      const flagText = t.flag || "🌐"
      const asterisk = this.isLanguageFallback ? "*" : ""
      langFlag.textContent = flagText + asterisk
      const langCode = this.detectedLanguage.replace('*', '').toUpperCase()
      const fallbackNote = this.isLanguageFallback ? " (default fallback)" : ""
      langFlag.title = `Language: ${langCode}${fallbackNote}`
      langFlag.style.cssText = "margin-right: 8px; font-size: 18px; cursor: help;"
      header.appendChild(langFlag)
      
      // Header - use custom title if provided, otherwise translated default
      const header = document.createElement("div")
      header.className = "echatbot-widget-header"

      const headerTitle = document.createElement("span")
      headerTitle.textContent = this.config.title || t.headerTitle
      header.appendChild(headerTitle)

      // 👤 Profile badge — shown when customer is registered
      this.profileBadge = document.createElement("button")
      this.profileBadge.className = "echatbot-widget-profile-badge"
      this.profileBadge.title = "Your profile"
      this.profileBadge.style.display = "none" // hidden until profile loaded
      this.profileBadge.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`
      this.profileBadge.onclick = (e) => {
        e.stopPropagation()
        this.toggleProfilePopover()
      }
      header.appendChild(this.profileBadge)

      // Profile popover
      this.profilePopover = document.createElement("div")
      this.profilePopover.className = "echatbot-widget-profile-popover"
      this.profilePopover.style.display = "none"
      header.appendChild(this.profilePopover)

      // Close button
      const closeButton = document.createElement("button")
      closeButton.className = "echatbot-widget-close"
      closeButton.innerHTML = "×"
      closeButton.onclick = () => this.togglePopup()
      header.appendChild(closeButton)

      this.popup.appendChild(header)

      // Load saved profile and render badge
      this.loadAndRenderProfile()

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
      this.sendBtn.type = "button"
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
      const existing = document.getElementById("echatbot-widget-styles")
      if (existing) existing.remove()
      const style = document.createElement("style")
      style.id = "echatbot-widget-styles"
      style.textContent = getCSS(this.config.primaryColor || DEFAULT_PRIMARY_COLOR)
      document.head.appendChild(style)
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Toggle popup on button click
      this.button.addEventListener("click", () => this.togglePopup())

      // Send message on button click (multiple handlers for reliability)
      this.sendBtn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.sendMessage()
      })
      
      // Fallback: also use onclick
      this.sendBtn.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.sendMessage()
      }

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
      // Toggle overlay
      this.overlay.classList.toggle("visible", this.isOpen)
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
      if (this.messages.length === 0 && this.status !== "wip") {
        const lang = this.language || "en"
        const t = TRANSLATIONS[lang] || TRANSLATIONS.en
        this.displayMessage({ role: "bot", content: t.welcome })
      } else {
        this.messages.forEach((msg) => this.displayMessage(msg))
      }
    }

    showWipMessage() {
      const lang = this.language || "en"
      const t = TRANSLATIONS[lang] || TRANSLATIONS.en
      const message = this.wipMessage || t.welcome
      const lastMessage = this.messages[this.messages.length - 1]
      if (!lastMessage || lastMessage.content !== message || lastMessage.role !== "bot") {
        this.displayMessage({ role: "bot", content: message })
        this.messages.push({ role: "bot", content: message })
        saveMessages(this.storageWorkspaceId, this.messages)
      }
      this.input.disabled = true
      this.sendBtn.disabled = true
      this.input.placeholder = "Service temporarily unavailable"
    }

    /**
     * Send message to API
     */
    async sendMessage() {
      const message = this.input.value.trim()

      if (!message || this.isLoading) return
      if (this.status === "wip") {
        this.showWipMessage()
        return
      }

      // Add user message to UI
      this.displayMessage({ role: "user", content: message })
      this.messages.push({ role: "user", content: message })
      saveMessages(this.storageWorkspaceId, this.messages)

      // Clear input
      this.input.value = ""
      this.input.style.height = "auto"
      this.sendBtn.disabled = true
      this.isLoading = true
      
      // Show loading spinner in button
      this.sendBtn.innerHTML = `<svg class="echatbot-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`

      // Show typing indicator
      this.showTypingIndicator()

      try {
        // 🌍 Use detected language (browser language or workspace default)
        const widgetLanguage = (this.detectedLanguage || this.language || "it").replace('*', '')
        console.log('🌍 Sending message with language:', widgetLanguage, '(original:', this.detectedLanguage, ')')

        // Call widget API (correct endpoint)
        const payload = {
          visitorId: this.visitorId,
          message,
          language: widgetLanguage,
        }
        if (typeof this.sessionId === "string" && this.sessionId.length > 0) {
          payload.sessionId = this.sessionId
        }

        const response = await apiRequest(
          `${this.config.apiUrl}/widget/chat/${this.config.workspaceId}`,
          "POST",
          payload
        )

        // Hide typing indicator
        this.hideTypingIndicator()

        if (response.success && response.response) {
          // Save session ID
          if (response.sessionId) {
            this.sessionId = response.sessionId
            localStorage.setItem(
              getStorageKey(STORAGE_KEYS.SESSION_ID, this.storageWorkspaceId),
              this.sessionId
            )
          }

          // 👤 Update profile badge if backend returned customer data
          if (response.customerProfile) {
            this.saveProfile(response.customerProfile)
          }

          // Display bot response
          this.displayMessage({ role: "bot", content: response.response })
          this.messages.push({ role: "bot", content: response.response })
          saveMessages(this.storageWorkspaceId, this.messages)
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
        // Restore send icon
        this.sendBtn.innerHTML = "↗"
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
      bubble.innerHTML = renderMarkdown(msg.content, this.config.apiUrl)

      messageEl.appendChild(bubble)
      this.messagesContainer.appendChild(messageEl)
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
    }

    /**
     * Load customer profile from localStorage and render the badge
     */
    loadAndRenderProfile() {
      const raw = localStorage.getItem(getStorageKey(STORAGE_KEYS.CUSTOMER_PROFILE, this.storageWorkspaceId))
      if (!raw) return
      try {
        const profile = JSON.parse(raw)
        this.renderProfileBadge(profile)
      } catch (e) {}
    }

    /**
     * Save customer profile to localStorage and update badge
     */
    saveProfile(profile) {
      if (!profile || !profile.name) return
      localStorage.setItem(
        getStorageKey(STORAGE_KEYS.CUSTOMER_PROFILE, this.storageWorkspaceId),
        JSON.stringify(profile)
      )
      this.renderProfileBadge(profile)
    }

    /**
     * Render profile badge in header with customer initials
     */
    renderProfileBadge(profile) {
      if (!this.profileBadge || !profile || !profile.name) return
      const initials = profile.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
      this.profileBadge.innerHTML = `<span style="font-size:11px;font-weight:700;letter-spacing:0.5px;">${initials}</span>`
      this.profileBadge.style.display = "flex"
      this.profileBadge.title = profile.name

      // Build popover content
      if (this.profilePopover) {
        const emailLine = profile.email ? `<div style="font-size:11px;color:#888;margin-top:2px;">${profile.email}</div>` : ""
        const phoneLine = profile.phone ? `<div style="font-size:11px;color:#888;">${profile.phone}</div>` : ""
        const statusBadge = profile.isActive
          ? `<span style="font-size:10px;background:#dcfce7;color:#16a34a;padding:1px 6px;border-radius:10px;font-weight:600;">✓ Registered</span>`
          : `<span style="font-size:10px;background:#fef9c3;color:#b45309;padding:1px 6px;border-radius:10px;font-weight:600;">Guest</span>`
        this.profilePopover.innerHTML = `
          <div style="font-weight:600;font-size:13px;">${profile.name}</div>
          ${emailLine}${phoneLine}
          <div style="margin-top:6px;">${statusBadge}</div>
        `
      }
    }

    /**
     * Toggle profile popover visibility
     */
    toggleProfilePopover() {
      if (!this.profilePopover) return
      const isVisible = this.profilePopover.style.display !== "none"
      this.profilePopover.style.display = isVisible ? "none" : "block"
      // Close on outside click
      if (!isVisible) {
        const closeHandler = (e) => {
          if (!this.profilePopover.contains(e.target) && e.target !== this.profileBadge) {
            this.profilePopover.style.display = "none"
            document.removeEventListener("click", closeHandler)
          }
        }
        setTimeout(() => document.addEventListener("click", closeHandler), 0)
      }
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
          localStorage.removeItem(
            getStorageKey(STORAGE_KEYS.VISITOR_ID, this.storageWorkspaceId)
          )
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
      saveMessages(this.storageWorkspaceId, [])
    }
  }

  // ============================================================================
  // IFRAME WIDGET (React-based UI)
  // ============================================================================

  class eChatbotIframeWidget {
    constructor(config) {
      const baseConfig = {
        ...config,
        workspaceId: config.workspaceId,
        position: config.position || "bottom-right",
        apiUrl: config.apiUrl || DEFAULT_API_URL,
        embedUrl: config.embedUrl || DEFAULT_EMBED_URL,
      }

      this.config = baseConfig
      this.isOpen = false
      this.container = null
      this.iframe = null
      this.handleMessage = this.handleMessage.bind(this)

      this.init()
    }

    init() {
      this.createDOM()
      window.addEventListener("message", this.handleMessage)
    }

    buildIframeSrc() {
      const params = new URLSearchParams()
      params.set("workspaceId", this.config.workspaceId)
      if (this.config.title) params.set("title", this.config.title)
      if (this.config.logoUrl) params.set("logoUrl", this.config.logoUrl)
      if (this.config.language) params.set("language", this.config.language)
      if (this.config.primaryColor) params.set("primaryColor", this.config.primaryColor)
      if (this.config.icon) params.set("icon", this.config.icon)
      if (this.config.apiUrl) params.set("apiUrl", this.config.apiUrl)
      return `${this.config.embedUrl}?${params.toString()}`
    }

    createDOM() {
      this.container = document.createElement("div")
      this.container.className = `echatbot-widget-container ${this.config.position}`
      document.body.appendChild(this.container)

      this.iframe = document.createElement("iframe")
      this.iframe.id = "echatbot-iframe"
      this.iframe.src = this.buildIframeSrc()
      this.iframe.title = "eChatbot Widget"
      this.iframe.allow = "clipboard-write"
      this.iframe.style.border = "none"
      this.iframe.style.background = "transparent"
      this.iframe.style.overflow = "hidden"
      this.iframe.style.width = "100px"
      this.iframe.style.height = "100px"
      this.iframe.style.borderRadius = "0"
      this.iframe.style.boxShadow = "none"
      this.iframe.style.transition = "width 0.2s ease, height 0.2s ease"

      this.container.appendChild(this.iframe)
      this.injectStyles()
    }

    injectStyles() {
      const existing = document.getElementById("echatbot-widget-styles")
      if (existing) existing.remove()
      const style = document.createElement("style")
      style.id = "echatbot-widget-styles"
      style.textContent = getCSS(this.config.primaryColor || DEFAULT_PRIMARY_COLOR)
      document.head.appendChild(style)
    }

    handleMessage(event) {
      if (!event || !event.data || event.data.type !== "echatbot-widget-toggle") {
        return
      }

      this.isOpen = !!event.data.open
      if (!this.iframe) return

      if (this.isOpen) {
        this.iframe.style.width = "430px"
        this.iframe.style.height = "690px"
        this.iframe.style.borderRadius = "24px"
        this.iframe.style.boxShadow = "none"
      } else {
        this.iframe.style.width = "100px"
        this.iframe.style.height = "100px"
        this.iframe.style.borderRadius = "0"
        this.iframe.style.boxShadow = "none"
      }
    }

    destroy() {
      window.removeEventListener("message", this.handleMessage)
      if (this.container) {
        this.container.remove()
      }
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
      const renderMode = config.renderMode || "iframe"
      if (renderMode === "legacy") {
        window._eChatbotWidget = new eChatbotWidget(config)
      } else {
        window._eChatbotWidget = new eChatbotIframeWidget(config)
      }
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
