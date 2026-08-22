import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import {
  CreateChapterDto,
  ChapterUploadUrlsDto,
  FinalizeChapterDto,
  ChapterMode,
} from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ChapterContentType } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

interface ChapterPage {
  key: string;
  order: number;
  isFree: boolean;
}

@Injectable()
export class ChaptersService {
  private supabase;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
    );
  }

  // ============================================
  // HELPER : Recherche de manga par ID OU SLUG
  // ============================================
  private async findMangaByIdOrSlug(identifier: string) {
    let manga = await this.prisma.manga.findUnique({
      where: { id: identifier },
    });

    if (!manga) {
      manga = await this.prisma.manga.findUnique({
        where: { slug: identifier },
      });
    }

    if (!manga) {
      throw new NotFoundException('Manga introuvable.');
    }

    return manga;
  }

  // ============================================
  // 1. GÉNÉRATION DES URLS D'UPLOAD
  // ============================================
  async getChapterUploadUrls(mangaId: string, dto: ChapterUploadUrlsDto) {
    const manga = await this.findMangaByIdOrSlug(mangaId);
    const realMangaId = manga.id;

    // ✅ Si filenames est fourni, utiliser la méthode alternative
    if (dto.filenames && dto.filenames.length > 0) {
      return this.generateSignedUploadUrls(realMangaId, dto.filenames);
    }

    const mode = dto.mode || ChapterMode.PHOTOS;
    const count = dto.count || 1;
    const chapterNum = dto.chapterNumber || 1;

    const files = [];
    const pad = (n: number) => String(n).padStart(3, '0');

    for (let i = 0; i < count; i++) {
      const ext = mode === ChapterMode.PDF ? 'pdf' : 'jpg';
      const key = `mangas/${realMangaId}/chapters/ch-${chapterNum}/page-${pad(i + 1)}-${Date.now()}.${ext}`;

      const { data, error } = await this.supabase.storage
        .from('chapters')
        .createSignedUploadUrl(key);

      if (error || !data) {
        throw new BadRequestException(
          `Erreur lors de la génération de l'URL pour la page ${i + 1}`,
        );
      }

      const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/chapters/${key}`;

      files.push({
        filename: `page-${pad(i + 1)}.${ext}`,
        uploadUrl: data.signedUrl,
        signedUrl: data.signedUrl,
        path: data.path,
        token: data.token,
        key: publicUrl,
      });
    }

    return {
      mode,
      files,
    };
  }

  // ============================================
  // 2. FINALISATION DU CHAPITRE (CORRIGÉ)
  // ============================================
  async finalizeChapter(mangaId: string, userId: string, dto: FinalizeChapterDto) {
    // 🔍 LOG DE DEBUG
    console.log('🔍 === FINALIZE CHAPTER DEBUG ===');
    console.log('📌 mangaId:', mangaId);
    console.log('📌 userId:', userId);
    console.log('📌 dto.number:', dto.number);
    console.log('📌 dto.mode:', dto.mode);
    console.log('📌 dto.keys:', dto.keys);
    console.log('📌 dto.keys length:', dto.keys?.length);
    console.log('📌 dto.isDraft:', dto.isDraft);
    console.log('📌 dto.keys[0] (pour PDF):', dto.keys?.[0]);
    console.log('🔍 === FIN DEBUG ===');

    const manga = await this.findMangaByIdOrSlug(mangaId);
    const realMangaId = manga.id;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (manga.authorId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga.");
    }

    const chapterNumber = Number(dto.number);
    const existing = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId: realMangaId,
          number: chapterNumber,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Le chapitre N°${chapterNumber} existe déjà.`);
    }

    let freeIndexes: number[] = [];
    if (dto.freePageIndexes) {
      try {
        freeIndexes = JSON.parse(dto.freePageIndexes);
      } catch {
        freeIndexes = [];
      }
    }

    let calculatedPrice = dto.price ?? 0;
    const isPdfMode = dto.mode === ChapterMode.PDF;

    if (!isPdfMode) {
      const totalPages = dto.keys.length;
      const paidPagesCount = totalPages - freeIndexes.length;

      if (paidPagesCount > 2) {
        throw new BadRequestException(
          `Un chapitre en mode photos ne peut contenir que 2 pages payantes maximum. (Actuellement: ${paidPagesCount})`,
        );
      }

      calculatedPrice = paidPagesCount > 0 ? paidPagesCount * 0.55 : 0;
    }

    const isDraft = dto.isDraft ?? false;

    // ===== MODE PDF =====
    if (isPdfMode) {
      // ✅ VALIDATION : Vérifier que la clé PDF existe
      if (!dto.keys || dto.keys.length === 0 || !dto.keys[0]) {
        throw new BadRequestException(
          'Aucune clé PDF fournie. Vérifie que upload-urls renvoie bien une clé.'
        );
      }

      console.log('📄 PDF Key reçu:', dto.keys[0]);
      
      return this.prisma.chapter.create({
        data: {
          mangaId: realMangaId,
          number: chapterNumber,
          title: dto.title?.trim() || null,
          contentType: ChapterContentType.PDF,
          pdfKey: dto.keys[0], // ✅ PLUS DE "|| null"
          isFree: calculatedPrice === 0,
          price: calculatedPrice,
          isDraft,
          publishedAt: !isDraft ? new Date() : null,
          pageCount: 1,
        },
      });
    }

    // ===== MODE IMAGES =====
    // ✅ VALIDATION : Vérifier que les clés existent
    if (!dto.keys || dto.keys.length === 0) {
      throw new BadRequestException(
        'Aucune image fournie. Vérifie que upload-urls renvoie bien des clés.'
      );
    }

    const pages: ChapterPage[] = dto.keys.map((key, i) => ({
      key,
      order: i + 1,
      isFree: freeIndexes.includes(i),
    }));

    return this.prisma.chapter.create({
      data: {
        mangaId: realMangaId,
        number: chapterNumber,
        title: dto.title?.trim() || null,
        contentType: ChapterContentType.IMAGES,
        pages: pages as any,
        pageCount: pages.length,
        isFree: calculatedPrice === 0,
        price: calculatedPrice,
        isDraft,
        publishedAt: !isDraft ? new Date() : null,
      },
    });
  }

  // ============================================
  // Helper : Génération d'URLs signées
  // ============================================
  async generateSignedUploadUrls(mangaId: string, filenames: string[]) {
    const results = await Promise.all(
      filenames.map(async (filename) => {
        const fileExt = filename.split('.').pop();
        const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const key = `mangas/${mangaId}/chapters/${cleanFileName}`;

        const { data, error } = await this.supabase.storage
          .from('chapters')
          .createSignedUploadUrl(key);

        if (error || !data) {
          throw new BadRequestException(`Erreur lors de la génération de l'URL pour ${filename}`);
        }

        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/chapters/${key}`;

        return {
          filename,
          uploadUrl: data.signedUrl,
          signedUrl: data.signedUrl,
          path: data.path,
          token: data.token,
          key: publicUrl,
        };
      }),
    );

    return results;
  }

  // ============================================
  // 3. CRÉATION CLASSIQUE (LEGACY)
  // ============================================
  async create(mangaId: string, userId: string, dto: CreateChapterDto) {
    if (!dto.pdfUrl && (!dto.imagesUrls || dto.imagesUrls.length === 0)) {
      throw new BadRequestException('Fournissez un fichier PDF ou au moins une image.');
    }

    const manga = await this.findMangaByIdOrSlug(mangaId);
    const realMangaId = manga.id;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (manga.authorId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException("Vous n'êtes pas l'auteur de ce manga.");
    }

    const chapterNumber = Number(dto.number);
    const existing = await this.prisma.chapter.findUnique({
      where: { mangaId_number: { mangaId: realMangaId, number: chapterNumber } },
    });

    if (existing) {
      throw new BadRequestException(`Le chapitre N°${chapterNumber} existe déjà pour ce manga.`);
    }

    const isDraft = dto.isDraft ?? false;

    if (dto.pdfUrl) {
      return this.prisma.chapter.create({
        data: {
          mangaId: realMangaId,
          number: chapterNumber,
          title: dto.title?.trim() || null,
          contentType: ChapterContentType.PDF,
          pdfKey: dto.pdfUrl,
          isFree: dto.isFree ?? true,
          isDraft,
          price: dto.isFree ? 0 : (dto.price || 0),
          coverUrl: dto.coverUrl || null,
          publishedAt: !isDraft ? new Date() : null,
          pageCount: 1,
        },
      });
    }

    let freeIndexes: number[] = [];
    if (dto.freePageIndexes) {
      try {
        freeIndexes = JSON.parse(dto.freePageIndexes);
      } catch {
        freeIndexes = [];
      }
    }

    const pages: ChapterPage[] = (dto.imagesUrls || []).map((urlOrKey, i) => ({
      key: urlOrKey,
      order: i + 1,
      isFree: freeIndexes.includes(i),
    }));

    return this.prisma.chapter.create({
      data: {
        mangaId: realMangaId,
        number: chapterNumber,
        title: dto.title?.trim() || null,
        contentType: ChapterContentType.IMAGES,
        pages: pages as any,
        pageCount: pages.length,
        isFree: dto.isFree ?? true,
        isDraft,
        price: dto.isFree ? 0 : (dto.price || 0),
        coverUrl: dto.coverUrl || null,
        publishedAt: !isDraft ? new Date() : null,
      },
    });
  }

  // ============================================
  // 4. MISE À JOUR
  // ============================================
  async update(chapterId: string, dto: UpdateChapterDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    const willBePublished = dto.isDraft === false && chapter.isDraft === true;

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        title: dto.title,
        isFree: dto.isFree,
        isDraft: dto.isDraft,
        price: dto.price,
        publishedAt: willBePublished ? new Date() : chapter.publishedAt,
      },
    });
  }

  // ============================================
  // 5. RÉCUPÉRER UN CHAPITRE PAR ID
  // ============================================
  async findOne(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    return this.attachSignedUrls(chapter);
  }

  // ============================================
  // 6. RÉCUPÉRER UN CHAPITRE PAR NUMÉRO
  // ============================================
  async findByNumber(mangaIdOrSlug: string, number: number) {
    const manga = await this.findMangaByIdOrSlug(mangaIdOrSlug);

    const chapter = await this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId: manga.id,
          number: Number(number),
        },
      },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    return this.attachSignedUrls(chapter);
  }

  // ============================================
  // 7. RÉCUPÉRER TOUS LES CHAPITRES D'UN MANGA
  // ============================================
  async findByManga(mangaIdOrSlug: string) {
    const manga = await this.findMangaByIdOrSlug(mangaIdOrSlug);

    return this.prisma.chapter.findMany({
      where: { mangaId: manga.id, isDraft: false },
      orderBy: { number: 'asc' },
    });
  }

  // ============================================
  // 8. ATTACHER LES URLS SIGNÉES
  // ============================================
  private async attachSignedUrls(chapter: any) {
    console.log('📦 AttachSignedUrls - Chapitre:', {
      id: chapter.id,
      contentType: chapter.contentType,
      pdfKey: chapter.pdfKey,
      pages: chapter.pages,
      pagesType: typeof chapter.pages,
      isArray: Array.isArray(chapter.pages),
    });

    // ===== MODE PDF =====
    if (chapter.contentType === ChapterContentType.PDF) {
      if (!chapter.pdfKey) {
        console.warn('⚠️ pdfKey est null pour le chapitre', chapter.id);
        return { ...chapter, pdfUrl: null };
      }

      try {
        const isFullUrl = chapter.pdfKey.startsWith('http://') || chapter.pdfKey.startsWith('https://');
        const pdfUrl = isFullUrl 
          ? chapter.pdfKey 
          : await this.storage.getSignedUrl(chapter.pdfKey);
        
        console.log('✅ PDF URL générée:', pdfUrl);
        return { ...chapter, pdfUrl };
      } catch (error) {
        console.error('❌ Erreur génération PDF URL:', error.message);
        return { ...chapter, pdfUrl: null };
      }
    }

    // ===== MODE IMAGES =====
    if (chapter.contentType === ChapterContentType.IMAGES) {
      if (!chapter.pages || !Array.isArray(chapter.pages) || chapter.pages.length === 0) {
        console.warn('⚠️ pages est vide ou invalide pour le chapitre', chapter.id);
        return { ...chapter, pages: [] };
      }

      try {
        const pagesWithUrls = await Promise.all(
          (chapter.pages as unknown as ChapterPage[]).map(async (page, index) => {
            if (!page.key) {
              console.warn(`⚠️ page.key manquant pour la page ${index + 1}`, page);
              return { order: page.order, isFree: page.isFree, url: null };
            }

            const isFullUrl = page.key.startsWith('http://') || page.key.startsWith('https://');
            
            try {
              const url = isFullUrl 
                ? page.key 
                : await this.storage.getSignedUrl(page.key);
              
              return {
                order: page.order,
                isFree: page.isFree,
                url: url || null,
              };
            } catch (error) {
              console.error(`❌ Erreur pour la page ${index + 1}:`, error.message);
              return { order: page.order, isFree: page.isFree, url: null };
            }
          })
        );
        
        console.log(`✅ ${pagesWithUrls.length} images URLs générées`);
        return { ...chapter, pages: pagesWithUrls };
      } catch (error) {
        console.error('❌ Erreur génération images URLs:', error.message);
        return { ...chapter, pages: [] };
      }
    }

    return chapter;
  }

  // ============================================
  // 9. SUPPRIMER UN CHAPITRE
  // ============================================
  async delete(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) throw new NotFoundException('Chapitre non trouvé.');

    if (chapter.pdfKey && !chapter.pdfKey.startsWith('http')) {
      await this.storage.delete(chapter.pdfKey);
    }

    if (Array.isArray(chapter.pages)) {
      await Promise.all(
        (chapter.pages as unknown as ChapterPage[])
          .filter((p) => p.key && !p.key.startsWith('http'))
          .map((p) => this.storage.delete(p.key)),
      );
    }

    await this.prisma.chapter.delete({
      where: { id: chapterId },
    });

    return { message: 'Chapitre supprimé avec succès.' };
  }
}
