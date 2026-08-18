// scripts/reset-password.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'studioxelira@gmail.com';
  const newPassword = 'Altesse@2026'; // Ton nouveau mot de passe
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const user = await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hashedPassword,
      isLocked: false,
      failedLoginAttempts: 0,
    },
  });

  console.log(`✅ Mot de passe réinitialisé pour ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());