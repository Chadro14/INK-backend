// scripts/migrate-slugs.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateSlug(title: string): Promise<string> {
  return title
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('🔄 Migration des slugs en cours...');

  // Récupérer tous les mangas sans slug
  const mangas = await prisma.manga.findMany({
    where: { slug: null },
    select: { id: true, title: true },
  });

  console.log(`📊 ${mangas.length} mangas à migrer.`);

  let updated = 0;
  let errors = 0;

  for (const manga of mangas) {
    try {
      let slug = await generateSlug(manga.title);
      
      // Vérifier si le slug existe déjà
      let existing = await prisma.manga.findFirst({
        where: { slug },
        select: { id: true },
      });

      let counter = 1;
      while (existing) {
        const testSlug = `${slug}-${counter}`;
        existing = await prisma.manga.findFirst({
          where: { slug: testSlug },
          select: { id: true },
        });
        if (!existing) {
          slug = testSlug;
          break;
        }
        counter++;
      }

      await prisma.manga.update({
        where: { id: manga.id },
        data: { slug },
      });

      updated++;
      console.log(`✅ ${manga.title} → ${slug}`);
    } catch (error) {
      errors++;
      console.error(`❌ Erreur pour ${manga.title}:`, error.message);
    }
  }

  console.log(`✅ ${updated} mangas migrés, ${errors} erreurs.`);

  // Vérifier les doublons
  const duplicates = await prisma.$queryRaw`
    SELECT slug, COUNT(*) FROM "Manga" 
    WHERE slug IS NOT NULL 
    GROUP BY slug 
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length > 0) {
    console.warn('⚠️ Doublons détectés:', duplicates);
  } else {
    console.log('✅ Aucun doublon détecté.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
