// scripts/unlock.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'studioxelira@gmail.com';
  
  const user = await prisma.user.update({
    where: { email },
    data: {
      isLocked: false,
      failedLoginAttempts: 0,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Compte débloqué : ${user.email}`);
  console.log(`📋 Rôle : ${user.role}`);
  console.log(`📋 isLocked : ${user.isLocked}`);
  console.log(`📋 failedLoginAttempts : ${user.failedLoginAttempts}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());