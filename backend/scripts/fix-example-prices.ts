import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updatePrompt() {
  const agent = await prisma.agentConfig.findFirst({
    where: { type: 'PRODUCT_SEARCH' }
  });
  
  if (!agent) {
    console.log('❌ Agent not found');
    return;
  }
  
  // Replace the example in SCENARIO B (NO GROUPING) with correct price format
  const oldExample = `Ciao {{nameUser}}! Ecco i prodotti disponibili:

1. Burrata Pugliese - €8.20
2. Provolone Piccante - €6.80
3. Taleggio DOP - €7.50

Quale ti interessa? (scrivi il numero) 🛒`;

  const newExample = `Ciao {{nameUser}}! Ecco i prodotti disponibili:

1. Burrata Pugliese - ~€9.11~ → €8.20
2. Provolone Piccante - ~€7.56~ → €6.80
3. Taleggio DOP - ~€8.33~ → €7.50

Quale ti interessa? (scrivi il numero) 🛒`;

  const updatedPrompt = agent.systemPrompt.replace(oldExample, newExample);
  
  if (updatedPrompt !== agent.systemPrompt) {
    await prisma.agentConfig.update({
      where: { id: agent.id },
      data: { systemPrompt: updatedPrompt }
    });
    console.log('✅ Updated example in SCENARIO B with correct price format!');
  } else {
    console.log('⚠️ Example not found or already updated');
  }
  
  await prisma.$disconnect();
}

updatePrompt().catch(console.error);
