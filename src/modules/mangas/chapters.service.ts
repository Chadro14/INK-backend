import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ChaptersService {
  private supabase: SupabaseClient;

  constructor(private readonly prisma: PrismaService) {
    // Initialisation de Supabase avec tes variables d'environnement
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }

  async create(
    mangaId: string,
    userId: string,
    dto: CreateChapterDto,
    pdfFile?: any,
    imageFiles?: any[],
    coverFile?: any
  ) {
    // 1. Déterminer le type de contenu
    const contentType = imageFiles && imageFiles.length > 0 ? 'IMAGES' : 'PDF';

    // 2. Récupérer et transformer les index des pages gratuites
    let freeIndexes: number[] = [];
    if (dto.freePageIndexes) {
      try {
        freeIndexes = JSON.parse(dto.freePageIndexes);
      } catch (e) {
        console.error('Erreur de parsing des freePageIndexes', e);
      }
    }

    // 3. Construction des données de pages et d'upload
    let pagesJson: any[] = [];
    let pageCount = 0;
    let pdfKey = null;
    let pdfSize = null;

    // ==========================================
    // UPLOAD DES IMAGES (BUCKET 1 : CHAPTERS1)
    // ==========================================
    if (contentType === 'IMAGES' && imageFiles) {
      pageCount = imageFiles.length;
      
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const fileName = `${mangaId}/chapitre-${dto.number}/${Date.now()}_${file.originalname}`;
        
        // Envoi vers le bucket CHAPTERS1
        const { error } = await this.supabase.storage
          .from('CHAPTERS1') 
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
          });

        if (error) {
          throw new InternalServerErrorException("Erreur lors de l'upload de l'image");
        }

        // Récupération du lien public
        const { data: publicUrlData } = this.supabase.storage
          .from('CHAPTERS1')
          .getPublicUrl(fileName);

        pagesJson.push({
          key: publicUrlData.publicUrl,
          order: i,         
          isFree: freeIndexes.includes(i), 
        });
      }
    } 
    // ==========================================
    // UPLOAD DU PDF (BUCKET 2)
    // ==========================================
    else if (contentType === 'PDF' && pdfFile) {
      pageCount = 1; 
      pdfSize = pdfFile.size;
      const fileName = `${mangaId}/chapitre-${dto.number}/${Date.now()}_${pdfFile.originalname}`;

      // ⚠️ REMPLACE 'NOM_DU_BUCKET_PDF' PAR LE VRAI NOM DE TON 2EME BUCKET
      const { error } = await this.supabase.storage
        .from('CHAPTERS1') 
        .upload(fileName, pdfFile.buffer, {
          contentType: pdfFile.mimetype,
        });

      if (error) {
        throw new InternalServerErrorException("Erreur lors de l'upload du PDF : " + error.message);
      }

      // Récupération du lien public
      const { data: publicUrlData } = this.supabase.storage
        .from('NOM_DU_BUCKET_PDF')
        .getPublicUrl(fileName);

      pdfKey = publicUrlData.publicUrl;
    }

    // 4. Enregistrement en base de données
    return this.prisma.chapter.create({
      data: {
        mangaId,
        number: Number(dto.number),
        title: dto.title,
        price: dto.price ? Number(dto.price) : null,
        isFree: dto.isFree === true || (dto.isFree as any) === 'true',
        isDraft: dto.isDraft === true || (dto.isDraft as any) === 'true',
        contentType: contentType,
        pages: pagesJson,
        pageCount,
        pdfKey,
        pdfSize,
      },
    });
  }

  async findByManga(mangaId: string) {
    return this.prisma.chapter.findMany({
      where: { mangaId },
      orderBy: { number: 'asc' },
    });
  }

  async findByNumber(mangaId: string, number: number) {
    return this.prisma.chapter.findUnique({
      where: {
        mangaId_number: {
          mangaId,
          number: Number(number),
        },
      },
    });
  }
}
