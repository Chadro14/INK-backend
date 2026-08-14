// src/modules/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ============================================
  // INSCRIPTION AVEC NOUVEAUX CHAMPS
  // ============================================
  async register(dto: RegisterDto) {
    // Vérifier que les mots de passe correspondent
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email ou nom d\'utilisateur déjà utilisé');
    }

    // Hacher le mot de passe
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // ✅ CRÉER L'UTILISATEUR AVEC LES NOUVEAUX CHAMPS
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: new Date(dto.birthDate),
        gender: dto.gender,
        avatarColor: this.generateAvatarColor(dto.username),
      },
    });

    const token = this.jwt.sign({ sub: user.id, email: user.email });

    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Bienvenue sur INKDROP',
        body: 'Commencez à lire et publier dès maintenant.',
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarColor: user.avatarColor,
        role: user.role,
      },
      token,
    };
  }

  // ============================================
  // CONNEXION (inchangée)
  // ============================================
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const token = this.jwt.sign({ sub: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isCertified: user.isCertified,
        premiumActive: user.premiumActive,
      },
      token,
    };
  }

  // ============================================
  // GÉNÉRER UNE COULEUR D'AVATAR
  // ============================================
  private generateAvatarColor(username: string): string {
    const colors = [
      '#FF6B35', '#F03E5B', '#6B46FF', '#00D4FF',
      '#10B981', '#FFE66D', '#8B5CF6', '#EC4899',
      '#F59E0B', '#3B82F6',
    ];
    const index = username.length % colors.length;
    return colors[index];
  }
}
