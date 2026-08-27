// src/modules/qr/qr.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // GÉNÉRER UN QR CODE POUR UN UTILISATEUR
  // ============================================
  async generateQRCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, isCertified: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // URL du profil (frontend)
    const baseUrl = process.env.FRONTEND_URL || 'https://ink-frontend.vercel.app';
    const qrData = `${baseUrl}/qr/${user.id}`;

    // Générer le QR code en base64
    const qrImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Compter les scans
    const scanCount = await this.prisma.qrScan.count({
      where: { userId },
    });

    return {
      userId: user.id,
      username: user.username,
      qrData,
      qrImage,
      scanCount,
    };
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
  // ENREGISTRER UN SCAN (QUAND UN UTILISATEUR SCANNE)
  // ============================================
  async registerScan(userId: string, scannedBy?: string, userAgent?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Éviter les doublons de scan (même IP, même journée)
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

    // Mettre à jour le compteur de l'utilisateur (si tu veux)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        steamPoints: { increment: 1 }, // +1 point steam pour chaque scan
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
        include: {
          scannedByUser: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              isCertified: true,
            },
          },
        },
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
