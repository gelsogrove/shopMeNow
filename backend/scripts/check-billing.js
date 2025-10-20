const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBilling() {
  const billings = await prisma.billing.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      customer: {
        select: { name: true }
      }
    }
  });
  
  console.log('\n📊 Ultimi 30 record di Billing:\n');
  console.log('Data\t\t\tTipo\t\t\tImporto\tCliente\t\tDescrizione');
  console.log('='.repeat(100));
  
  billings.forEach(b => {
    const date = new Date(b.createdAt).toLocaleDateString('it-IT');
    const type = b.type.padEnd(20);
    const amount = ('€' + b.amount.toFixed(2)).padEnd(8);
    const customer = (b.customer?.name || 'N/A').padEnd(15);
    const desc = (b.description || '').substring(0, 40);
    console.log(`${date}\t${type}\t${amount}\t${customer}\t${desc}`);
  });
  
  // Totale per tipo
  const byType = {};
  const all = await prisma.billing.findMany();
  all.forEach(b => {
    const t = b.type;
    if (!byType[t]) {
      byType[t] = { count: 0, total: 0 };
    }
    byType[t].count++;
    byType[t].total += b.amount;
  });
  
  console.log('\n💰 Totali per Tipo:\n');
  console.log('Tipo\t\t\tConteggio\tTotale');
  console.log('='.repeat(60));
  Object.entries(byType).forEach(([type, data]) => {
    console.log(`${type.padEnd(20)}\t${String(data.count).padEnd(8)}\t€${data.total.toFixed(2)}`);
  });
  
  const grandTotal = all.reduce((sum, b) => sum + b.amount, 0);
  console.log('='.repeat(60));
  console.log(`TOTALE GENERALE\t\t${all.length}\t\t€${grandTotal.toFixed(2)}`);
  
  // Breakdown mensile
  const byMonth = {};
  all.forEach(b => {
    const month = new Date(b.createdAt).toISOString().substring(0, 7);
    if (!byMonth[month]) {
      byMonth[month] = { count: 0, total: 0 };
    }
    byMonth[month].count++;
    byMonth[month].total += b.amount;
  });
  
  console.log('\n📅 Breakdown Mensile:\n');
  console.log('Mese\t\tOperazioni\tTotale');
  console.log('='.repeat(50));
  Object.entries(byMonth).sort().reverse().forEach(([month, data]) => {
    console.log(`${month}\t${data.count}\t\t€${data.total.toFixed(2)}`);
  });
  
  await prisma.$disconnect();
}

checkBilling().catch(console.error);
