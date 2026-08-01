import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(StorageService.name);
  
  public readonly buckets = {
    chapters: 'chapters',
    avatars: 'avatars',
  };

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY'); 

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Les variables Supabase ne sont pas configurées.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ==========================================
  // MÉTHODES POUR L'UPLOAD DIRECT (FRONTEND)
  // ==========================================

  async getUploadUrl(key: string, bucketType: 'chapters' | 'avatars' = 'chapters') {
    const bucket = this.buckets[bucketType];
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(key);

    if (error) {
      throw new InternalServerErrorException(`Échec de la création de l'URL d'upload: ${error.message}`);
    }

    return {
      path: data.path,
      token: data.token,
    };
  }

  getPublicUrl(key: string, bucketType: 'chapters' | 'avatars' = 'chapters'): string {
    const bucket = this.buckets[bucketType];
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }

  // ==========================================
  // MÉTHODES BACKEND MANQUANTES (ERREURS VERCEL)
  // ==========================================

  async upload(key: string, file: Buffer, mimeType: string, bucketType: string = 'chapters'): Promise<string> {
    const bucket = this.buckets[bucketType] || bucketType;
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(key, file, { 
        contentType: mimeType, 
        upsert: true 
      });

    if (error) {
      this.logger.error(`Failed to upload ${key} to ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    
    return data.path;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600, bucketType: string = 'chapters'): Promise<string> {
    const bucket = this.buckets[bucketType] || bucketType;
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(key, expiresIn);

    if (error) {
      this.logger.error(`Failed to generate signed URL for ${key}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    
    return data.signedUrl;
  }

  async delete(key: string, bucketType: string = 'chapters'): Promise<void> {
    const bucket = this.buckets[bucketType] || bucketType;
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([key]);

    if (error) {
      this.logger.error(`Failed to delete ${key} from ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }
}
