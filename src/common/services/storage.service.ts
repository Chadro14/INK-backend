import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(StorageService.name);

  /**
   * ✅ Un seul bucket : "chapters"
   * Tous les contenus (chapitres, couvertures, reels, avatars) vont dedans,
   * organisés par préfixe dans la clé.
   */
  public readonly buckets: Record<string, string> = {
    chapters: 'chapters',
    avatars: 'chapters',
    reels: 'chapters',
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
   * Helper : Extrait le bucket (toujours "chapters") et nettoie la clé.
   */
  private resolveBucketAndKey(key: string, defaultBucketType: string = 'chapters') {
    if (!key) {
      return { bucket: 'chapters', cleanKey: '' };
    }

    let cleanKey = key.trim();
    const bucket = 'chapters';

    // Nettoyer un éventuel préfixe "chapters/" en début de clé
    if (cleanKey.startsWith('chapters/')) {
      cleanKey = cleanKey.replace('chapters/', '');
    }

    return { bucket, cleanKey };
  }

  // ==========================================
  // MÉTHODES POUR L'UPLOAD DIRECT (FRONTEND)
  // ==========================================
  async getUploadUrl(key: string, bucketType: 'chapters' | 'avatars' | 'reels' = 'chapters') {
    if (!key) {
      throw new BadRequestException("La clé (key) du fichier est requise pour générer l'URL d'upload");
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(cleanKey);

    if (error) {
      this.logger.error(`Échec création URL upload pour ${cleanKey} dans ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(`Échec de la création de l'URL d'upload: ${error.message}`);
    }

    const uploadUrl = data.signedUrl;
    const publicUrl = this.supabase.storage.from(bucket).getPublicUrl(cleanKey).data.publicUrl;

    return {
      uploadUrl,
      key: cleanKey,
      path: data.path,
      token: data.token,
      publicUrl,
    };
  }

  getPublicUrl(key: string, bucketType: 'chapters' | 'avatars' | 'reels' = 'chapters'): string {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) return key;

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(cleanKey);
    return data.publicUrl;
  }

  // ==========================================
  // MÉTHODES BACKEND
  // ==========================================
  async upload(
    key: string,
    file: Buffer,
    mimeType: string,
    bucketType: 'chapters' | 'avatars' | 'reels' = 'chapters',
  ): Promise<string> {
    if (!key) {
      throw new BadRequestException("La clé (key) du fichier est requise pour l'upload");
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(cleanKey, file, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Échec upload de ${cleanKey} dans ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }

    return data.path;
  }

  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    bucketType: 'chapters' | 'avatars' | 'reels' = 'chapters',
  ): Promise<string> {
    if (!key) return '';

    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(cleanKey, expiresIn);

    if (error) {
      this.logger.error(`Échec génération URL signée pour ${cleanKey} dans ${bucket}: ${error.message}`);
      return this.getPublicUrl(key, bucketType);
    }

    return data.signedUrl;
  }

  async delete(
    key: string,
    bucketType: 'chapters' | 'avatars' | 'reels' = 'chapters',
  ): Promise<void> {
    if (!key) return;

    if (key.startsWith('http://') || key.startsWith('https://')) {
      return;
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([cleanKey]);

    if (error) {
      this.logger.error(`Échec suppression de ${cleanKey} depuis ${bucket}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ==========================================
  // MÉTHODE DE DIAGNOSTIC
  // ==========================================
  async testConnection() {
    try {
      const testKey = `test-${Date.now()}.txt`;
      const testBuffer = Buffer.from('Test de connexion Supabase');

      const uploadResult = await this.upload(testKey, testBuffer, 'text/plain', 'chapters');
      console.log('✅ Upload test réussi:', uploadResult);

      const signedUrl = await this.getSignedUrl(testKey);
      console.log('✅ URL signée test:', signedUrl);

      await this.delete(testKey);
      console.log('✅ Suppression test réussie');

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erreur test:', error.message);
      return { success: false, error: error.message };
    }
  }
}
