import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;

  // ✅ Buckets séparés
  private readonly buckets = {
    chapters: 'chapters',    // Pour les mangas (PDF, photos)
    avatars: 'CHAPTERS1',    // Pour les avatars
  };

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get('SUPABASE_URL');
    const supabaseKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ============================================
  // UPLOAD GÉNÉRIQUE
  // ============================================
  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
    bucketType: 'chapters' | 'avatars' = 'chapters'
  ): Promise<string> {
    const bucket = this.buckets[bucketType];
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(key, buffer, { contentType });

    if (error) {
      throw new Error(`Échec de l'upload: ${error.message}`);
    }

    return key;
  }

  // ============================================
  // URL SIGNÉE
  // ============================================
  async getSignedUrl(
    key: string,
    expiresInSeconds = 3600,
    bucketType: 'chapters' | 'avatars' = 'chapters'
  ): Promise<string> {
    const bucket = this.buckets[bucketType];
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Impossible de générer l'URL signée: ${error?.message}`);
    }

    return data.signedUrl;
  }

  // ============================================
  // URL D'UPLOAD DIRECT
  // ============================================
  async getUploadUrl(
    key: string,
    bucketType: 'chapters' | 'avatars' = 'chapters'
  ): Promise<string> {
    const bucket = this.buckets[bucketType];
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(key);

    if (error || !data) {
      throw new Error(`Impossible de générer l'URL d'upload: ${error?.message}`);
    }

    return data.signedUrl;
  }

  // ============================================
  // SUPPRESSION
  // ============================================
  async delete(
    key: string,
    bucketType: 'chapters' | 'avatars' = 'chapters'
  ): Promise<void> {
    const bucket = this.buckets[bucketType];
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Échec de la suppression: ${error.message}`);
    }
  }
}
