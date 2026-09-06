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
  // MÉTHODES POUR L'UPLOAD DIRECT (FRONTEND) - CORRIGÉ ✅
  // ==========================================
  async getUploadUrl(key: string, bucketType: 'chapters' | 'avatars' = 'chapters') {
    if (!key) {
      throw new BadRequestException("La clé (key) du fichier est requise pour générer l'URL d'upload");
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    // ✅ Obtenir l'URL d'upload signée
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(cleanKey);

    if (error) {
      throw new InternalServerErrorException(`Échec de la création de l'URL d'upload: ${error.message}`);
    }

    // ✅ Retourner l'URL complète + la clé
    const uploadUrl = data.signedUrl;
    const publicUrl = `${this.supabase.storage.from(bucket).getPublicUrl(cleanKey).data.publicUrl}`;

    return {
      uploadUrl,      // ✅ URL pour faire le PUT
      key: cleanKey,  // ✅ Clé pour finaliser
      path: data.path,
      token: data.token,
      publicUrl,      // ✅ URL publique
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

    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    const { bucket, cleanKey } = this.resolveBucketAndKey(key, bucketType);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(cleanKey, expiresIn);

    if (error) {
      this.logger.error(`Échec de la génération de l'URL signée pour ${cleanKey} dans ${bucket}: ${error.message}`);
      // ✅ En cas d'erreur, retourner l'URL publique
      return this.getPublicUrl(key, bucketType as any);
    }

    return data.signedUrl;
  }

  async delete(key: string, bucketType: string = 'chapters'): Promise<void> {
    if (!key) return;

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
