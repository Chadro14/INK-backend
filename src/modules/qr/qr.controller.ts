// src/modules/qr/qr.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  UseGuards,
  Req,
  Request,
  Body,
  HttpException,
  HttpStatus,
  BadRequestException,
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
  // ✅ RÉCUPÉRER LES INFOS D'UN UTILISATEUR POUR LE SCAN
  // ============================================
  @Get(':userId')
  async getUserInfo(@Param('userId') userId: string) {
    try {
      const user = await this.qrService.getUserInfo(userId);
      if (!user) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }
      return user;
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
  // ✅ METTRE À JOUR LA COULEUR DU QR (PREMIUM UNIQUEMENT)
  // ============================================
  @Put('color')
  @UseGuards(JwtAuthGuard)
  async updateQRColor(@Request() req: any, @Body() body: { color: string }) {
    try {
      if (!body.color) {
        throw new BadRequestException('Couleur requise');
      }
      const result = await this.qrService.updateQRColor(req.user.id, body.color);
      return {
        success: true,
        message: 'Couleur du QR mise à jour',
        qrColor: result.qrColor,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la mise à jour de la couleur',
        error.status || HttpStatus.BAD_REQUEST,
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      return await this.qrService.getUserScans(req.user.id, pageNum, limitNum);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des scans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
