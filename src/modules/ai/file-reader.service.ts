// src/modules/ai/file-reader.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileReaderService {
  // ============================================
  // 1. LIRE UN FICHIER
  // ============================================
  async readFile(filePath: string): Promise<{
    content: string;
    fileName: string;
    fileType: string;
    lineCount: number;
    size: number;
  }> {
    try {
      const cleanPath = filePath.replace(/^\.\//, '');
      const fullPath = path.join(process.cwd(), cleanPath);

      if (!fs.existsSync(fullPath)) {
        throw new NotFoundException(`Fichier non trouvé : ${cleanPath}`);
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const stats = fs.statSync(fullPath);
      const ext = path.extname(fullPath);

      return {
        content,
        fileName: path.basename(fullPath),
        fileType: ext.substring(1) || 'txt',
        lineCount: content.split('\n').length,
        size: stats.size,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Erreur lors de la lecture du fichier : ${error.message}`);
    }
  }

  // ============================================
  // 2. ANALYSER DU CODE
  // ============================================
  async analyzeCode(filePath: string, errorMessage?: string): Promise<{
    file: string;
    issues: Array<{
      line: number;
      type: 'error' | 'warning' | 'info';
      message: string;
      suggestion?: string;
    }>;
    summary: string;
  }> {
    const file = await this.readFile(filePath);
    const lines = file.content.split('\n');
    const issues: Array<{
      line: number;
      type: 'error' | 'warning' | 'info';
      message: string;
      suggestion?: string;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (line.includes('any') && !line.includes('//') && !line.includes('*')) {
        issues.push({
          line: lineNumber,
          type: 'warning',
          message: 'Utilisation de "any" sans type. Utilisez un type spécifique.',
          suggestion: 'Remplacez "any" par le type approprié (ex: string, number, ou une interface).',
        });
      }

      if (line.includes('console.log') || line.includes('console.error')) {
        issues.push({
          line: lineNumber,
          type: 'info',
          message: 'console.log détecté. Pensez à utiliser un logger pour la production.',
          suggestion: 'Utilisez un service de logging comme @nestjs/common/Logger.',
        });
      }

      if (line.includes('@UseGuards') && !line.includes('JwtAuthGuard')) {
        issues.push({
          line: lineNumber,
          type: 'info',
          message: 'Utilisation d\'un guard sans JwtAuthGuard. Est-ce volontaire ?',
        });
      }

      if (line.includes('try {') && !lines[i + 1]?.includes('catch')) {
        issues.push({
          line: lineNumber,
          type: 'warning',
          message: 'Bloc try sans catch ou finally. Gestion d\'erreur incomplète.',
          suggestion: 'Ajoutez un bloc catch pour gérer les erreurs.',
        });
      }

      if (errorMessage) {
        const errorKeywords = errorMessage.toLowerCase().split(' ');
        for (const keyword of errorKeywords) {
          if (keyword.length > 3 && line.toLowerCase().includes(keyword)) {
            issues.push({
              line: lineNumber,
              type: 'error',
              message: `Ligne potentiellement liée à l'erreur : "${errorMessage}"`,
              suggestion: `Vérifiez cette ligne, elle pourrait être la cause de : ${errorMessage}`,
            });
            break;
          }
        }
      }
    }

    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    const infoCount = issues.filter(i => i.type === 'info').length;

    let summary = '';
    if (errorCount === 0 && warningCount === 0) {
      summary = '✅ Aucun problème majeur détecté dans ce fichier.';
    } else if (errorCount > 0) {
      summary = `⚠️ ${errorCount} erreur(s) détectée(s), ${warningCount} avertissement(s). Une correction est recommandée.`;
    } else {
      summary = `ℹ️ ${warningCount} avertissement(s), ${infoCount} suggestion(s). Le fichier est fonctionnel mais peut être amélioré.`;
    }

    return {
      file: file.fileName,
      issues,
      summary,
    };
  }

  // ============================================
  // 3. STRUCTURE DU PROJET
  // ============================================
  async analyzeProjectStructure(): Promise<{
    files: string[];
    totalFiles: number;
    structure: Record<string, any>;
  }> {
    const rootPath = process.cwd();
    const files: string[] = [];
    const structure: Record<string, any> = {};

    const scanDir = (dir: string, parent: Record<string, any>) => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        if (['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
          continue;
        }

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          parent[item] = {};
          scanDir(fullPath, parent[item]);
        } else if (stat.isFile() && /\.(ts|js|tsx|jsx|json)$/.test(item)) {
          files.push(fullPath.replace(rootPath, ''));
          const name = path.basename(item);
          if (!parent.files) parent.files = [];
          parent.files.push(name);
        }
      }
    };

    const srcPath = path.join(rootPath, 'src');
    if (fs.existsSync(srcPath)) {
      structure.src = {};
      scanDir(srcPath, structure.src);
    }

    return {
      files: files.slice(0, 50),
      totalFiles: files.length,
      structure,
    };
  }

  // ============================================
  // 4. FORMATER POUR L'IA
  // ============================================
  formatForAI(analysis: {
    file: string;
    issues: Array<{
      line: number;
      type: 'error' | 'warning' | 'info';
      message: string;
      suggestion?: string;
    }>;
    summary: string;
  }): string {
    let output = `📁 Fichier analysé : ${analysis.file}\n\n`;
    output += `📋 Résumé : ${analysis.summary}\n\n`;

    if (analysis.issues.length === 0) {
      output += '✅ Aucun problème détecté.\n';
      return output;
    }

    output += '🔍 Détail des problèmes :\n';

    for (const issue of analysis.issues) {
      const emoji = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
      output += `  ${emoji} Ligne ${issue.line} : ${issue.message}\n`;
      if (issue.suggestion) {
        output += `     → Suggestion : ${issue.suggestion}\n`;
      }
    }

    return output;
  }
}