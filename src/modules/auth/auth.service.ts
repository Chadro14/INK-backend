import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
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

  async register(dto: RegisterDto) {
    // Vérifier si l'email existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email ou nom d\'utilisateur déjà utilisé');
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        mobileNumber: dto.mobileNumber,
        avatarColor: this.generateAvatarColor(dto.username),
      },
    });

    // Générer le token
    const token = this.jwt.sign({ sub: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarColor: user.avatarColor,
        role: user.role,
      },
      token,
    };
  }

  async login(dto: LoginDto) {
    // Trouver l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Générer le token
    const token = this.jwt.sign({ sub: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isCertified: user.isCertified,
        premiumActive: user.premiumActive,
      },
      token,
    };
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