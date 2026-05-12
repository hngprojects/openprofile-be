import {
  ConflictException,
  Injectable
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from './dto/create-profile.dto';
import { Profile } from './entities/profile.entity';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
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

    // Step 2 - check if username is already taken
    const existingUsername = await this.profileRepository.findOne({
      where: { username: createProfileDto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Step 3 - create and save the profile
    const profile = this.profileRepository.create({
      userId: user.sub,
      username: createProfileDto.username.toLowerCase(),
      fullName: createProfileDto.fullName,
      bio: createProfileDto.bio,
      photoUrl: createProfileDto.photoUrl,
    });

    const savedProfile = await this.profileRepository.save(profile);

    // Step 4 - return saved profile
    return savedProfile;
  }
}