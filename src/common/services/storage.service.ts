import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly bucket = 'chapters';

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  async uploadPdf(
    file: Express.Multer.File,
    mangaId: string,
    chapterNumber: number,
  ): Promise<string> {
    const key = `${mangaId}/chapter-${chapterNumber}-${Date.now()}.pdf`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(key, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new Error(`Échec de l'upload PDF: ${error.message}`);
    }

    return key;
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Impossible de générer l'URL signée: ${error?.message}`);
    }

    return data.signedUrl;
  }

  async deletePdf(key: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Échec de la suppression: ${error.message}`);
    }
  }
}