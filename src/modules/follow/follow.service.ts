import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FollowService {
  constructor(private prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Vous ne pouvez pas vous suivre vous-même');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
    });
    if (!target) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existing) {
      await this.prisma.userFollow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });
      return { following: false };
    }

    await this.prisma.userFollow.create({
      data: { followerId, followingId },
    });

    // ✅ Notification sans emojis
    await this.prisma.notification.create({
      data: {
        userId: followingId,
        type: 'NEW_SUBSCRIBER',
        title: 'Nouvel abonné',
        body: `${followerId} a commencé à vous suivre`,
        metadata: { followerId },
      },
    });

    return { following: true };
  }

  async isFollowing(followerId: string, followingId: string) {
    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });
    return { following: !!existing };
  }

  async getFollowers(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      this.prisma.userFollow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
              isCertified: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userFollow.count({ where: { followingId: userId } }),
    ]);

    return {
      data: followers.map((f) => f.follower),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      this.prisma.userFollow.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              avatarColor: true,
              isCertified: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userFollow.count({ where: { followerId: userId } }),
    ]);

    return {
      data: following.map((f) => f.following),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowCounts(userId: string) {
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.userFollow.count({ where: { followingId: userId } }),
      this.prisma.userFollow.count({ where: { followerId: userId } }),
    ]);
    return { followersCount, followingCount };
  }
}