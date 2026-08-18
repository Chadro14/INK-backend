// scripts/reset-password.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const email = 'studioxelira@gmail.com';
    const newPassword = 'Altesse@2026';

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingUser) {
      console.error(`❌ Utilisateur avec l'email ${email} non trouvé`);
      return;
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour l'utilisateur
    const user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hashedPassword,
        isLocked: false,
        failedLoginAttempts: 0,
      },
    });

    console.log(`✅ Mot de passe réinitialisé pour ${user.email}`);
    console.log(`📋 Nouveau mot de passe : ${newPassword}`);
    console.log(`🔓 Compte débloqué : ${!user.isLocked}`);
  } catch (error) {
    console.error('❌ Erreur :', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();