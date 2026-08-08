import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(StorageService.name);

  public readonly buckets: Record<string, string> = {
    chapters: 'chapters',
    avatars: 'avatars',
  };

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Les variables Supabase ne sont pas configurées.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Helper : Nettoie la clé et extrait le bon bucket si la clé contient un préfixe de bucket.
   */
  private resolveBucketAndKey(key: string, defaultBucketType: string = 'chapters') {
    if (!key) return { bucket: this.buckets[defaultBucketType] || defaultBucketType, cleanKey: '' };

    let cleanKey = key.trim();
    let bucket = this.buckets[defaultBucketType] || defaultBucketType;

    // Si la clé commence déjà par un des buckets connus (ex: "avatars/user/..." ou "chapters/mangas/...")
    for (const [_, bucketName] of Object.entries(this.buckets)) {
      if (cleanKey.startsWith(`${bucketName}/`)) {
        bucket = bucketName;
        cleanKey = cleanKey.replace(`${bucketName}/`, '');
        break;
      }
    }

    return { bucket, cleanKey };
  }

  // ==========================================
  // MÉTHODES POUR L'UPLOAD DIRECT (FRONTEND)
  // ==========================================
  async getUploadUrl(key: string, bucketType: 'chapters' | 'avatars' = 'chapters') {
    if (!key) {
      throw new BadRequestException("La clé (key) du fichier est requise pour générer l'URL d'upload");
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(cleanKey);

    if (error) {
      throw new InternalServerErrorException(`Échec de la création de l'URL d'upload: ${error.message}`);
    }

    return {
      path: data.path,
      token: data.token,
    };
  }

  getPublicUrl(key: string, bucketType: 'chapters' | 'avatars' = 'chapters'): string {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) return key;

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(cleanKey);
    return data.publicUrl;
  }

  // ==========================================
  // MÉTHODES BACKEND
  // ==========================================
  async upload(key: string, file: Buffer, mimeType: string, bucketType: string = 'chapters'): Promise<string> {
    if (!key) {
      throw new BadRequestException('La clé (key) du fichier est requise pour l\'upload');
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(cleanKey, file, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Échec de l'upload de ${cleanKey} dans le bucket ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    return data.path;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600, bucketType: string = 'chapters'): Promise<string> {
    if (!key) return '';

    // Si c'est déjà une URL HTTP/HTTPS complète, inutile de la re-signer
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(cleanKey, expiresIn);

    if (error) {
      this.logger.error(`Échec de la génération de l'URL signée pour ${cleanKey} dans ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    return data.signedUrl;
  }

  async delete(key: string, bucketType: string = 'chapters'): Promise<void> {
    if (!key) return;

    // Si c'est une URL complète, pas de suppression directe par clé simple
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return;
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([cleanKey]);

    if (error) {
      this.logger.error(`Échec de la suppression de ${cleanKey} depuis ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }
}
