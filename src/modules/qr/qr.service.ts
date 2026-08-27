// src/modules/qr/qr.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import QRCode from 'qrcode';
import * as sharp from 'sharp';
import axios from 'axios';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // GÉNÉRER UN QR CODE AVEC AVATAR AU CENTRE
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

    // Utiliser la couleur QR ou la couleur du badge
    const qrColor = user.qrColor || user.badgeColor || '#3B82F6';
    const baseUrl = process.env.FRONTEND_URL || 'https://ink-frontend.vercel.app';
    const qrData = `${baseUrl}/qr/${user.id}`;

    // 1. Générer le QR code en buffer
    const qrBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 600,
      color: {
        dark: qrColor,
        light: '#FFFFFF',
      },
    });

    // 2. Ajouter une marge blanche autour du QR
    let finalQr = await sharp(qrBuffer)
      .extend({
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer();

    // 3. Ajouter l'avatar au centre (si disponible)
    if (user.avatarUrl) {
      try {
        // Télécharger l'avatar
        const avatarResponse = await axios.get(user.avatarUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        const avatarBuffer = Buffer.from(avatarResponse.data);

        // Taille du logo
        const logoSize = 80;
        const logoOffset = (600 + 80 - logoSize) / 2; // QR size + margins

        // Redimensionner l'avatar
        const resizedAvatar = await sharp(avatarBuffer)
          .resize(logoSize, logoSize, { fit: 'cover' })
          .toBuffer();

        // Créer un masque circulaire
        const mask = Buffer.from(
          `<svg width="${logoSize}" height="${logoSize}">
            <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize/2}" fill="white"/>
          </svg>`
        );

        // Appliquer le masque circulaire
        const avatarWithMask = await sharp(resizedAvatar)
          .composite([
            {
              input: await sharp(mask).png().toBuffer(),
              blend: 'dest-in',
            },
          ])
          .png()
          .toBuffer();

        // Ajouter une bordure blanche autour de l'avatar
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

        // Insérer l'avatar au centre du QR
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
        // Si l'avatar ne peut pas être chargé, on garde le QR sans logo
      }
    }

    // 4. Ajouter un cadre inférieur avec le nom d'utilisateur
    // (Cette partie est complexe avec sharp, on va la faire côté frontend)

    // 5. Convertir en base64
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
      qrColor,
      isPremium: user.premiumActive,
      isCertified: user.isCertified,
      avatarUrl: user.avatarUrl,
    };
  }

  // ============================================
  // METTRE À JOUR LA COULEUR DU QR (PREMIUM UNIQUEMENT)
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
  // RÉCUPÉRER LES STATISTIQUES DE SCAN
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
  // OBTENIR LES SCANS D'UN UTILISATEUR
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
}
