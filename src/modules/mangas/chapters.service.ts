import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/services/storage.service';
// ⚠️ Si tu utilises Prisma ou TypeORM, n'oublie pas de laisser ton import ici (ex: import { PrismaService } from '../prisma/prisma.service';)

@Injectable()
export class ChaptersService {
  constructor(
    private readonly storageService: StorageService,
    // ⚠️ Laisse l'injection de ta base de données ici si tu l'avais (ex: private readonly prisma: PrismaService)
  ) {}

  // ============================================
  // GÉNÉRER LES URLS D'UPLOAD DIRECT
  // ============================================
  async getUploadUrls(mangaId: string, filenames: string[]) {
    const instructions = [];
    
    for (const filename of filenames) {
      // 1. Extraire l'extension et créer un nom de fichier unique
      const extension = filename.split('.').pop();
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const key = `manga-${mangaId}/${uniqueSuffix}.${extension}`;

      // 2. Demander l'autorisation d'upload à Supabase
      const uploadData = await this.storageService.getUploadUrl(key, 'chapters');

      // 3. Préparer la réponse pour le frontend
      instructions.push({
        filename,                  // Nom original (pour que le frontend reconnaisse son fichier)
        key,                       // Chemin final dans Supabase (qu'on sauvera en BDD plus tard)
        uploadUrl: uploadData.signedUrl,
        token: uploadData.token,   // Le jeton de sécurité
        path: uploadData.path
      });
    }
    
    return instructions;
  }

  // ---------------------------------------------------------
  // ⚠️ GARDE TES AUTRES MÉTHODES EXISTANTES CI-DESSOUS
  // (ex: createChapter, getChapters, etc.)
  // ---------------------------------------------------------
}
