import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CommentStatus } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // AJOUTER UN COMMENTAIRE
  // ============================================
  async create(userId: string, mangaId: string, dto: CreateCommentDto) {
    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
    });
    if (!manga) {
      throw new NotFoundException('Manga non trouvé');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Commentaire parent non trouvé');
      }
      if (parent.mangaId !== mangaId) {
        throw new BadRequestException('Le commentaire parent ne correspond pas à ce manga');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        mangaId,
        chapterId: dto.chapterId || null,
        pageNumber: dto.pageNumber || null,
        parentId: dto.parentId || null,
        content: dto.content,
        status: CommentStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
            isCertified: true,
            badgeColor: true,
          },
        },
      },
    });

    await this.prisma.manga.update({
      where: { id: mangaId },
      data: { commentsCount: { increment: 1 } },
    });

    return comment;
  }

  // ============================================
  // RÉCUPÉRER LES COMMENTAIRES D'UN MANGA
  // ============================================
  async findByManga(mangaId: string, query: CommentQueryDto) {
    const { page = 1, limit = 20, sort = 'recent' } = query;
    const skip = (page - 1) * limit;

    const orderBy = sort === 'popular'
      ? { likesCount: 'desc' as const }
      : { createdAt: 'desc' as const };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          mangaId,
          parentId: null,
          status: CommentStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
              isCertified: true,
              badgeColor: true,
            },
          },
          _count: {
            select: {
              replies: {
                where: { status: CommentStatus.ACTIVE },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.comment.count({
        where: {
          mangaId,
          parentId: null,
          status: CommentStatus.ACTIVE,
        },
      }),
    ]);

    const commentIds = comments.map(c => c.id);
    const replies = await this.prisma.comment.findMany({
      where: {
        parentId: { in: commentIds },
        status: CommentStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
            isCertified: true,
            badgeColor: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const repliesByParent = replies.reduce((acc, reply) => {
      const parentId = reply.parentId!;
      if (!acc[parentId]) acc[parentId] = [];
      acc[parentId].push(reply);
      return acc;
    }, {} as Record<string, typeof replies>);

    const commentsWithReplies = comments.map(comment => ({
      ...comment,
      replies: repliesByParent[comment.id] || [],
    }));

    return {
      data: commentsWithReplies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // RÉCUPÉRER LES COMMENTAIRES D'UN CHAPITRE
  // ============================================
  async findByChapter(chapterId: string, query: CommentQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          chapterId,
          parentId: null,
          status: CommentStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
              isCertified: true,
              badgeColor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({
        where: {
          chapterId,
          parentId: null,
          status: CommentStatus.ACTIVE,
        },
      }),
    ]);

    return {
      data: comments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // METTRE À JOUR UN COMMENTAIRE
  // ============================================
  async update(userId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('Vous n\'êtes pas l\'auteur de ce commentaire');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        status: dto.status as CommentStatus | undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            avatarColor: true,
            isCertified: true,
            badgeColor: true,
          },
        },
      },
    });
  }

  // ============================================
  // SUPPRIMER UN COMMENTAIRE
  // ============================================
  async delete(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { manga: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (comment.userId !== userId && user?.role !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce commentaire');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        status: CommentStatus.DELETED,
        content: '[Commentaire supprimé]',
      },
    });

    await this.prisma.manga.update({
      where: { id: comment.mangaId },
      data: { commentsCount: { decrement: 1 } },
    });

    return { message: 'Commentaire supprimé avec succès' };
  }

  // ============================================
  // ✅ LIKER UN COMMENTAIRE - CORRIGÉ
  // ============================================
  async likeComment(userId: string, commentId: string) {
    // 1. Vérifier que le commentaire existe
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, likesCount: true },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire non trouvé');
    }

    // 2. Vérifier si l'utilisateur a déjà liké
    const existingLike = await this.prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existingLike) {
      // ✅ SUPPRIMER LE LIKE
      await this.prisma.commentLike.delete({
        where: { id: existingLike.id },
      });

      // ✅ Décrémenter le compteur et récupérer la nouvelle valeur
      const updated = await this.prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });

      return {
        liked: false,
        likesCount: updated.likesCount,
      };
    }

    // ✅ AJOUTER LE LIKE
    await this.prisma.commentLike.create({
      data: { userId, commentId },
    });

    // ✅ Incrémenter le compteur et récupérer la nouvelle valeur
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    return {
      liked: true,
      likesCount: updated.likesCount,
    };
  }
}
