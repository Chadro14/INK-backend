import { Controller, Post, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { FollowService } from './follow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard)
  async follow(@Req() req: any, @Param('userId') userId: string) {
    return this.followService.follow(req.user.id, userId);
  }

  @Get('is-following/:userId')
  @UseGuards(JwtAuthGuard)
  async isFollowing(@Req() req: any, @Param('userId') userId: string) {
    return this.followService.isFollowing(req.user.id, userId);
  }

  @Get(':userId/followers')
  async getFollowers(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.followService.getFollowers(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':userId/following')
  async getFollowing(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.followService.getFollowing(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':userId/counts')
  async getCounts(@Param('userId') userId: string) {
    return this.followService.getFollowCounts(userId);
  }
}