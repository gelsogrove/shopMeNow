import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"
import { HelmetProvider } from "react-helmet-async"
import { App } from "./App"
import { LanguageProvider } from "./contexts/LanguageContext"
import "./index.css"
import "./styles/custom.css"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
)
