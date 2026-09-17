// prisma/migrate-plans.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 Migration des plans Premium...\n');

  // MONTHLY → STANDARD
  const monthlyResult = await prisma.user.updateMany({
    where: { premiumPlan: 'MONTHLY' },
    data: { premiumPlan: 'STANDARD' },
  });
  console.log(
    `✅ ${monthlyResult.count} user(s) migré(s) : MONTHLY → STANDARD`,
  );

  // YEARLY → PREMIUM
  const yearlyResult = await prisma.user.updateMany({
    where: { premiumPlan: 'YEARLY' },
    data: { premiumPlan: 'PREMIUM' },
  });
  console.log(
    `✅ ${yearlyResult.count} user(s) migré(s) : YEARLY → PREMIUM\n`,
  );

  console.log('🎉 Migration terminée.');
  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
