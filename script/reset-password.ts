// scripts/reset-password.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'studioxelira@gmail.com';
  const newPassword = 'Altesse@2026'; // 👈 CHANGE CE MOT DE PASSE SI TU VEUX

  console.log(`🔐 Réinitialisation du mot de passe pour ${email}...`);

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hashedPassword,
      isLocked: false,
      failedLoginAttempts: 0,
      role: 'ADMIN', // 👈 TU DEVIENS ADMIN
    },
  });

  console.log(`✅ Mot de passe réinitialisé avec succès !`);
  console.log(`📧 Email : ${user.email}`);
  console.log(`🔑 Nouveau mot de passe : ${newPassword}`);
  console.log(`👑 Rôle : ${user.role}`);
  console.log(`🔓 Compte débloqué : ${!user.isLocked}`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });