
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly bucket = 'chapters';

  constructor() {
    // 🔥 SOLUTION TEMPORAIRE : valeurs en dur pour contourner l'erreur Vercel
    const supabaseUrl = process.env.SUPABASE_URL || 'https://slbosebjvnotrifwhbrl.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYm9zZWJqdm5vdHJpZndoYnJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI2Mjk1NSwiZXhwIjoyMDk4ODM4OTU1fQ.wZxt0jNCKZ12ZrQxAn6DeSyMaknbGvQMU-h4scJUTfs';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ============================================
  // UPLOAD GÉNÉRIQUE (pour les PDF et couvertures)
  // ============================================
  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(key, buffer, { contentType });

    if (error) {
      throw new Error(`Échec de l'upload: ${error.message}`);
    }

    return key;
  }

  // ============================================
  // URL SIGNÉE
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

  // ============================================
  // SUPPRESSION GÉNÉRIQUE
  // ============================================
  async delete(key: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Échec de la suppression: ${error.message}`);
    }
  }
}