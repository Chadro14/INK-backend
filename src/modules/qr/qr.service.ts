// src/modules/qr/qr.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import QRCode from 'qrcode';
import sharp from 'sharp';
import axios from 'axios';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // GÉNÉRER UN QR CODE AVEC EFFETS PREMIUM
  // ============================================
  async generateQRCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        isCertified: true,
        premiumActive: true,
        qrColor: true,
        badgeColor: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isPremium = user.premiumActive;
    const baseColor = user.qrColor || user.badgeColor || '#3B82F6';
    const baseUrl = process.env.FRONTEND_URL || 'https://ink-frontend.vercel.app';
    const qrData = `${baseUrl}/qr/${user.id}`;

    // 1. Générer le QR code en buffer
    let qrBuffer;

    if (isPremium) {
      qrBuffer = await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: 'H',
        margin: 0,
        width: 600,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const gradientColors = [
        baseColor,
        this.adjustBrightness(baseColor, 30),
        this.shiftHue(baseColor, 30),
        this.shiftHue(baseColor, -30),
      ];

      qrBuffer = await this.applyGradientToQR(qrBuffer, gradientColors);
    } else {
      qrBuffer = await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: 'H',
        margin: 0,
        width: 600,
        color: {
          dark: baseColor,
          light: '#FFFFFF',
        },
      });
    }

    // 2. Ajouter une marge blanche
    let finalQr = await sharp(qrBuffer)
      .extend({
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer();

    // 3. Ajouter l'avatar au centre
    if (user.avatarUrl) {
      try {
        const avatarResponse = await axios.get(user.avatarUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        const avatarBuffer = Buffer.from(avatarResponse.data);

        const logoSize = 80;
        const logoOffset = (600 + 80 - logoSize) / 2;

        const resizedAvatar = await sharp(avatarBuffer)
          .resize(logoSize, logoSize, { fit: 'cover' })
          .toBuffer();

        const mask = Buffer.from(
          `<svg width="${logoSize}" height="${logoSize}">
            <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="white"/>
          </svg>`
        );

        const avatarWithMask = await sharp(resizedAvatar)
          .composite([
            {
              input: await sharp(mask).png().toBuffer(),
              blend: 'dest-in',
            },
          ])
          .png()
          .toBuffer();

        const avatarWithBorder = await sharp(avatarWithMask)
          .extend({
            top: 6,
            bottom: 6,
            left: 6,
            right: 6,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .extend({
            top: 3,
            bottom: 3,
            left: 3,
            right: 3,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .toBuffer();

        finalQr = await sharp(finalQr)
          .composite([
            {
              input: avatarWithBorder,
              top: logoOffset - 9,
              left: logoOffset - 9,
            },
          ])
          .toBuffer();
      } catch (error) {
        console.warn('⚠️ Erreur ajout avatar au QR:', error.message);
      }
    }

    // 4. PREMIUM : Ajouter un effet brillant (glow)
    if (isPremium) {
      finalQr = await this.addGlowEffect(finalQr, baseColor);
    }

    const qrImage = `data:image/png;base64,${finalQr.toString('base64')}`;

    const scanCount = await this.prisma.qrScan.count({
      where: { userId },
    });

    return {
      userId: user.id,
      username: user.username,
      qrData,
      qrImage,
      scanCount,
      qrColor: baseColor,
      badgeColor: user.badgeColor,
      isPremium,
      isCertified: user.isCertified,
      avatarUrl: user.avatarUrl,
    };
  }

  // ============================================
  // 🎨 APPLIQUER UN DÉGRADÉ SUR LE QR
  // ============================================
  private async applyGradientToQR(qrBuffer: Buffer, colors: string[]): Promise<Buffer> {
    const image = sharp(qrBuffer);
    const metadata = await image.metadata();
    
    const gradientWidth = metadata.width || 600;
    const gradientHeight = metadata.height || 600;
    
    const stops = colors.map((color, i) => 
      `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${color}" />`
    ).join('');

    const gradientSvg = Buffer.from(`
      <svg width="${gradientWidth}" height="${gradientHeight}">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            ${stops}
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
    `);

    const gradientImage = await sharp(gradientSvg).png().toBuffer();

    return await sharp(qrBuffer)
      .composite([
        {
          input: gradientImage,
          blend: 'multiply',
        },
      ])
      .toBuffer();
  }

  // ============================================
  // ✨ AJOUTER UN EFFET BRILLANT (GLOW)
  // ============================================
  private async addGlowEffect(qrBuffer: Buffer, color: string): Promise<Buffer> {
    const glowSize = 20;
    const glowColor = this.hexToRgb(color);
    glowColor.a = 0.3;

    return await sharp(qrBuffer)
      .extend({
        top: glowSize,
        bottom: glowSize,
        left: glowSize,
        right: glowSize,
        background: glowColor,
      })
      .extend({
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
        background: { r: 255, g: 255, b: 255, alpha: 0.05 },
      })
      .toBuffer();
  }

  // ============================================
  // 🛠 UTILITAIRES COULEURS
  // ============================================
  private hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 1
    } : { r: 59, g: 130, b: 246, a: 1 };
  }

  private adjustBrightness(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    const r = Math.min(255, Math.max(0, rgb.r + percent));
    const g = Math.min(255, Math.max(0, rgb.g + percent));
    const b = Math.min(255, Math.max(0, rgb.b + percent));
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  private shiftHue(hex: string, degrees: number): string {
    const rgb = this.hexToRgb(hex);
    const r = Math.min(255, Math.max(0, rgb.r + degrees));
    const g = Math.min(255, Math.max(0, rgb.g - degrees));
    const b = Math.min(255, Math.max(0, rgb.b + degrees / 2));
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  // ============================================
  // METTRE À JOUR LA COULEUR DU QR
  // ============================================
  async updateQRColor(userId: string, color: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumActive: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.premiumActive) {
      throw new BadRequestException('Cette fonctionnalité est réservée aux utilisateurs Premium');
    }

    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(color)) {
      throw new BadRequestException('Couleur invalide. Utilisez un format hexadécimal (ex: #3B82F6)');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { qrColor: color },
    });
  }

  // ============================================
  // STATISTIQUES DE SCAN
  // ============================================
  async getQRStats(userId: string) {
    const [user, scans, lastScan] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      }),
      this.prisma.qrScan.count({
        where: { userId },
      }),
      this.prisma.qrScan.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      username: user.username,
      totalScans: scans,
      lastScan: lastScan?.createdAt || null,
    };
  }

  // ============================================
  // ENREGISTRER UN SCAN
  // ============================================
  async registerScan(userId: string, scannedBy?: string, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingScan = await this.prisma.qrScan.findFirst({
      where: {
        userId,
        ipAddress: ip || undefined,
        createdAt: { gte: today },
      },
    });

    if (!existingScan) {
      await this.prisma.qrScan.create({
        data: {
          userId,
          scannedBy: scannedBy || null,
          userAgent: userAgent || null,
          ipAddress: ip || null,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        steamPoints: { increment: 1 },
      },
    });

    return {
      success: true,
      message: 'Scan enregistré',
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  // ============================================
  // LISTE DES SCANS
  // ============================================
  async getUserScans(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      this.prisma.qrScan.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.qrScan.count({ where: { userId } }),
    ]);

    return {
      data: scans,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // ✅ RÉCUPÉRER LES INFOS D'UN UTILISATEUR (PUBLIC)
  // ============================================
  async getUserInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        isCertified: true,
        premiumActive: true,
        createdAt: true,
        _count: {
          select: {
            mangas: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return user;
  }
}
