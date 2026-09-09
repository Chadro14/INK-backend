import { Reel, ReelStatus, User } from '@prisma/client';

export class ReelResponseDto {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  authorId: string;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
    avatarColor: string | null;
    isCertified: boolean;
    badgeColor: string | null;
  };
  musicTitle: string | null;
  musicArtist: string | null;
  status: ReelStatus;
  isFeatured: boolean;
  isPrivate: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export class ReelFeedResponseDto {
  reels: ReelResponseDto[];
  total: number;
  page: number;
  lastPage: number;
}
