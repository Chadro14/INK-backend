// src/modules/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { SecurityService } from '../security/security.service';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private securityService: SecurityService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email ou nom d\'utilisateur déjà utilisé');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: new Date(dto.birthDate),
        gender: dto.gender,
        mobileNumber: dto.mobileNumber,
        avatarColor: this.generateAvatarColor(dto.username),
      },
    });

    const token = this.jwt.sign({ sub: user.id, email: user.email });

    try {
      await this.emailService.sendWelcomeEmail(user.email, user.username);
    } catch (error) {
      console.error('❌ Erreur envoi email de bienvenue:', error);
    }

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

  async login(dto: LoginDto, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.isLocked) {
      throw new UnauthorizedException(
        'Compte verrouillé. Utilisez "Mot de passe oublié" pour le déverrouiller.'
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      // ✅ CORRECTION : PASSER L'IP
      await this.securityService.handleFailedLogin(dto.email, ip);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    await this.securityService.handleSuccessfulLogin(user.id, ip);

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

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        avatarColor: true,
        bio: true,
        role: true,
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
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

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
