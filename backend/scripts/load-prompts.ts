import fs from "fs"
import path from "path"

// Leggi tutti i file prompt
const promptsDir = path.join(__dirname, "../docs/prompts")

const prompts = {
  router: fs.readFileSync(
    path.join(promptsDir, "router-agent-NEW.md"),
    "utf-8"
  ),
  productSearch: fs.readFileSync(
    path.join(promptsDir, "product-search-agent.md"),
    "utf-8"
  ),
  cartManagement: fs.readFileSync(
    path.join(promptsDir, "cart-management-agent.md"),
    "utf-8"
  ),
  orderTracking: fs.readFileSync(
    path.join(promptsDir, "order-tracking-agent.md"),
    "utf-8"
  ),
  customerSupport: fs.readFileSync(
    path.join(promptsDir, "customer-support-agent.md"),
    "utf-8"
  ),
  safetyTranslation: fs.readFileSync(
    path.join(promptsDir, "safety-translation-agent.md"),
    "utf-8"
  ),
}

console.log("✅ Tutti i prompt caricati:")
console.log(`  - Router: ${prompts.router.length} caratteri`)
console.log(`  - Product Search: ${prompts.productSearch.length} caratteri`)
console.log(`  - Cart Management: ${prompts.cartManagement.length} caratteri`)
console.log(`  - Order Tracking: ${prompts.orderTracking.length} caratteri`)
console.log(`  - Customer Support: ${prompts.customerSupport.length} caratteri`)
console.log(
  `  - Safety & Translation: ${prompts.safetyTranslation.length} caratteri`
)

// Esporta per uso in update script
export { prompts }
