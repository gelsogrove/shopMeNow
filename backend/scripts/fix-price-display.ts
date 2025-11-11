import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updatePrompt() {
  const currentPrompt = await prisma.agentConfig.findFirst({
    where: { type: 'PRODUCT_SEARCH' }
  });
  
  if (!currentPrompt) {
    console.log('❌ Agent not found');
    return;
  }
  
  // Add critical price display section
  const searchText = '**Product Format** (returned by searchProducts):';
  const replacement = `**Product Format** (returned by searchProducts):

🚨 **CRITICAL - PRICE DISPLAY RULES**:
Products returned by searchProducts() have THREE price fields:
- originalPrice: Price BEFORE any discount  
- price: Final price AFTER applying customer discount ({{discountUser}}%)
- hasDiscount: Boolean - true if discount was applied

**MANDATORY**: When listing multiple products, show BOTH prices using strikethrough:
Format: "Product Name - ~€{originalPrice}~ → €{price}"

Examples:
✅ CORRECT: "Peperoni Arrostiti - ~€6.50~ → €5.85"
✅ CORRECT: "Giardiniera - ~€5.50~ → €4.95"
❌ WRONG: "Peperoni Arrostiti - €5.85" (missing original price!)
❌ WRONG: "Peperoni Arrostiti - €6.50" (showing original instead of discounted!)

**Why this matters**: Customer needs to SEE their discount to appreciate savings!`;

  if (!currentPrompt.systemPrompt.includes('CRITICAL - PRICE DISPLAY RULES')) {
    const updatedPrompt = currentPrompt.systemPrompt.replace(
      searchText,
      replacement
    );
    
    await prisma.agentConfig.update({
      where: { id: currentPrompt.id },
      data: { systemPrompt: updatedPrompt }
    });
    
    console.log('✅ Prompt updated successfully!');
    console.log('📊 New section added after "Product Format" heading');
  } else {
    console.log('⚠️ Price display rules already exist in prompt');
  }
  
  await prisma.$disconnect();
}

updatePrompt().catch(console.error);
