// src/modules/qr/qr.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QrService } from './qr.service';

@Controller('qr')
export class QrController {
  constructor(private qrService: QrService) {}

  // ============================================
  // GÉNÉRER SON PROPRE QR CODE
  // ============================================
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyQR(@Request() req: any) {
    try {
      return await this.qrService.generateQRCode(req.user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la génération du QR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // GÉNÉRER LE QR CODE D'UN UTILISATEUR (PUBLIC)
  // ============================================
  @Get('user/:userId')
  async getUserQR(@Param('userId') userId: string) {
    try {
      return await this.qrService.generateQRCode(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Utilisateur non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ============================================
  // STATISTIQUES DE SCAN
  // ============================================
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: any) {
    try {
      return await this.qrService.getQRStats(req.user.id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // ENREGISTRER UN SCAN (APPELÉ PAR LE FRONTEND)
  // ============================================
  @Post('scan/:userId')
  async scanQR(
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    try {
      // Récupérer l'utilisateur connecté (si token)
      let scannedBy = null;
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          // Décoder le token pour obtenir l'ID
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          scannedBy = decoded.sub;
        } catch {
          // Token invalide, ignore
        }
      }

      return await this.qrService.registerScan(
        userId,
        scannedBy,
        req.headers['user-agent'],
        req.ip || req.connection?.remoteAddress,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de l\'enregistrement du scan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // LISTE DES SCANS (PROFIL)
  // ============================================
  @Get('scans')
  @UseGuards(JwtAuthGuard)
  async getScans(
    @Request() req: any,
    @Request() query: any,
  ) {
    try {
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      return await this.qrService.getUserScans(req.user.id, page, limit);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des scans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
