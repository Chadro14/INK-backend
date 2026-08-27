// src/modules/qr/qr.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import QRCode from 'qrcode';

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

    const baseUrl = process.env.FRONTEND_URL || 'https://ink-frontend.vercel.app';
    const qrData = `${baseUrl}/qr/${user.id}`;

    const qrImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

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
