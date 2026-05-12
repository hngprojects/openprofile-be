import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProfileDto } from './dto/create-profile.dto';
import { PublishProfileDto } from './dto/publish-profile.dto';

import { Profile } from './entities/profile.entity';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

import { UsernamesService } from '../usernames/usernames.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,

    private readonly usernamesService: UsernamesService,
  ) {}

  async createProfile(
    createProfileDto: CreateProfileDto,
    user: AuthenticatedUser,
  ): Promise<Profile> {
    // Step 1 - check if user already has a profile
    const existingProfile = await this.profileRepository.findOne({
      where: { userId: user.sub },
    });

    if (existingProfile) {
      throw new ConflictException('User already has a profile');
    }

    // Step 2 - validate username
    const usernameCheck = await this.usernamesService.check(
      createProfileDto.username,
    );

    if (!usernameCheck.available) {
      if (usernameCheck.reason === 'TAKEN') {
        throw new ConflictException('Username already taken');
      }

      throw new UnprocessableEntityException(
        'Username must be 3-30 characters, use only letters, numbers, and hyphens, and must not start, end, or contain consecutive hyphens.',
      );
    }

    // Step 3 - create profile
    const profile = this.profileRepository.create({
      userId: user.sub,
      username: usernameCheck.normalizedUsername,
      fullName: createProfileDto.fullName,
      bio: createProfileDto.bio,
      photoUrl: createProfileDto.photoUrl,
    });

    const savedProfile = await this.profileRepository.save(profile);

    // Step 4 - return profile
    return savedProfile;
  }

  async publishProfile(
    publishProfileDto: PublishProfileDto,
    user: AuthenticatedUser,
  ) {
    const profile = await this.profileRepository.findOne({
      where: { userId: user.sub },
    });

    // profile does not exist
    if (!profile) {
      throw new NotFoundException(
        'Complete your profile setup before publishing.',
      );
    }

    const { action } = publishProfileDto;

    // publish profile
    if (action === 'publish') {
      // validate publish requirements
      if (!profile.fullName || !profile.username) {
        throw new BadRequestException({
          errorCode: 'PUBLISH_REQUIREMENTS_NOT_MET',
          message:
            'Your profile needs a fullName and username before it can be published.',
        });
      }

      // idempotent publish
      if (!profile.isPublished) {
        profile.isPublished = true;
        profile.publishedAt = new Date();

        await this.profileRepository.save(profile);
      }

      return {
        status: 'success',
        message: 'Your profile is now live.',
        profileUrl: `openprofile.com/${profile.username}`,
      };
    }

    // unpublish profile
    if (action === 'unpublish') {
      // idempotent unpublish
      if (profile.isPublished) {
        profile.isPublished = false;

        await this.profileRepository.save(profile);
      }

      return {
        status: 'success',
        message:
          'Your profile has been unpublished. It is no longer visible to the public.',
      };
    }

    // fallback safeguard
    throw new BadRequestException(
      'Action must be either publish or unpublish.',
    );
  }
}