import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly bucket = 'chapters'; // ✅ Utiliser le bucket chapters

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

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

  async delete(key: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Échec de la suppression: ${error.message}`);
    }
  }
}