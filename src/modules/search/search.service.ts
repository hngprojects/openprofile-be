import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async searchProfiles(q?: string) {
    const sanitized = q
      ?.trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ');

    if (!sanitized || sanitized.length < 2) {
      throw new BadRequestException(
        'Please enter at least 2 characters to search.',
      );
    }
    type SearchProfileRow = {
  username: string;
  fullName: string;
  bio: string | null;
  photoUrl: string | null;
  isVerified: boolean;
};

    const results = await this.userRepository
      .createQueryBuilder('u')
      .where('u.is_published = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere('(u.full_name % :q OR u.username % :q)')
      .select([
        'u.username AS username',
        'u.full_name AS "fullName"',
        'u.bio AS bio',
        'u.photo_url AS "photoUrl"',
        'u.is_verified AS "isVerified"',
      ])
      .orderBy(
        'CASE WHEN lower(u.username) = lower(:q) THEN 1 ELSE 0 END',
        'DESC',
      )
      .addOrderBy(
        `GREATEST(
          similarity(u.full_name, :q),
          similarity(u.username, :q)
        )`,
        'DESC',
      )
      .setParameters({
        q: sanitized,
      })
      .limit(20)
      .getRawMany<SearchProfileRow>();


    return {
      results: results.map((user) => ({
        username: user.username,
        fullName: user.fullName,
        bio: user.bio?.slice(0, 120) ?? '',
        photoUrl: user.photoUrl,
        isVerified: user.isVerified,
      })),
      total: results.length,
    };
  }
}
