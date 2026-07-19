import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CertifyUserDto } from './dto/certify-user.dto';
import { ModerateContentDto } from './dto/moderate-content.dto';
import { UserFilterDto } from './dto/user-filter.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getUsers(@Req() req: any, @Query() filter: UserFilterDto) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getUsers(filter);
  }

  @Post('certify')
  @UseGuards(JwtAuthGuard)
  async certifyUser(@Req() req: any, @Body() dto: CertifyUserDto) {
    return this.adminService.certifyUser(req.user.id, dto);
  }

  @Post('moderate')
  @UseGuards(JwtAuthGuard)
  async moderateContent(@Req() req: any, @Body() dto: ModerateContentDto) {
    return this.adminService.moderateContent(req.user.id, dto);
  }

  @Post('suspend/:userId')
  @UseGuards(JwtAuthGuard)
  async suspendUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.suspendUser(req.user.id, userId, reason);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any) {
    return this.adminService.getStats(req.user.id);
  }
}