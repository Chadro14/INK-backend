
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  
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

  // NOUVELLE MÉTHODE AJOUTÉE ICI POUR LA COUVERTURE
  getPublicUrl(key: string, bucketType: 'chapters' | 'avatars' = 'chapters'): string {
    const bucket = this.buckets[bucketType];
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }
}
