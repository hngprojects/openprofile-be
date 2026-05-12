import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser} from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateProfileDto } from './dto/create-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new profile for the authenticated user' })
  async createProfile(
    @Body() createProfileDto: CreateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profileService.createProfile(createProfileDto, user);
  }
}