import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"
import { HelmetProvider } from "react-helmet-async"
import { App } from "./App"
import { LanguageProvider } from "./contexts/LanguageContext"
import "./index.css"
import "./styles/custom.css"

const queryClient = new QueryClient()

// Prevent pinch-to-zoom and double-tap zoom on Android Chrome (ignores user-scalable=no since 2023)
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault()
}, { passive: false })

let _lastTap = 0
document.addEventListener('touchend', (e) => {
  const now = Date.now()
  if (now - _lastTap < 300) e.preventDefault()
  _lastTap = now
}, { passive: false })

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
)
