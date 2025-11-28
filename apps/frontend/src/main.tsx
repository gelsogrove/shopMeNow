import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { LanguageProvider } from "./contexts/LanguageContext"
import "./index.css"
import "./styles/custom.css"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </QueryClientProvider>
)
