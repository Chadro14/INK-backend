import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly bucket = 'chapters'; // Utilisation du bucket chapters existant

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ============================================
  // UPLOAD UN FICHIER
  // ============================================
  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(key, buffer, { contentType });

    if (error) {
      throw new Error(`Échec de l'upload: ${error.message}`);
    }

    // Récupérer l'URL publique
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(key);

    return data.publicUrl;
  }

  // ============================================
  // SUPPRIMER UN FICHIER
  // ============================================
  async delete(key: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Échec de la suppression: ${error.message}`);
    }
  }

  // ============================================
  // OBTENIR UNE URL SIGNÉE
  // ============================================
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Impossible de générer l'URL signée: ${error?.message}`);
    }

    return data.signedUrl;
  }
}