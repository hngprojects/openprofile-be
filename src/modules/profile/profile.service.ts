import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RedisService } from '../../common/redis/redis.service';
import { Profile } from './entities/profile.entity';
import { ProfileComponent } from './entities/profile-component.entity';

const CACHE_TTL_SECONDS = 60;
const MAX_COMPONENTS = 50;
const CACHE_404_TTL_SECONDS = 30;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(ProfileComponent)
    private readonly componentRepo: Repository<ProfileComponent>,
    private readonly redisService: RedisService,
  ) {}

  async getPublicProfile(username: string): Promise<{
    data: Record<string, unknown>;
    etag: string;
    fromCache: boolean;
  }> {
    const normalizedUsername = username.toLowerCase();
    const cacheKey = `profile:${normalizedUsername}`;
    const lockKey = `profile:lock:${normalizedUsername}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as Record<string, unknown>;
      // Cached 404 sentinel
      if (parsed['__notFound']) {
        throw new NotFoundException({ error: 'not_found' });
      }
      const etag = this.computeEtag(cached);
      return { data: parsed, etag, fromCache: true };
    }

    // Single-flight lock — prevents cache stampede on cold cache.
    const lockAcquired = await this.redisService.set(
      lockKey,
      '1',
      CACHE_TTL_SECONDS,
      true,
    );

    try {
      const profile = await this.profileRepo.findOne({
        where: { username: normalizedUsername, isPublished: true, deletedAt: IsNull() },
        relations: ['user'],
      });

      if (!profile) {
        // Cache the 404 to reduce DB load on repeated misses.
        await this.redisService.set(
          cacheKey,
          JSON.stringify({ __notFound: true }),
          CACHE_404_TTL_SECONDS,
        );
        throw new NotFoundException({ error: 'not_found' });
      }

      const components = await this.componentRepo.find({
        where: { profileId: profile.id, isActive: true },
        order: { displayOrder: 'ASC' },
        take: MAX_COMPONENTS,
      });

      const activeComponents = components.filter(
        (c) => c.data && Object.keys(c.data).length > 0,
      );

      const responseData = this.serialize(profile, activeComponents);
      const serialized = JSON.stringify(responseData);

      this.logger.log(`Cache miss for profile: ${normalizedUsername}`);
      await this.redisService.set(cacheKey, serialized, CACHE_TTL_SECONDS);
      const etag = this.computeEtag(serialized);

      return { data: responseData, etag, fromCache: false };
    } finally {
      if (lockAcquired) {
        await this.redisService.del(lockKey);
      }
    }
  }

  async invalidateCache(username: string): Promise<void> {
    await this.redisService.del(`profile:${username.toLowerCase()}`);
  }

  private serialize(
    profile: Profile,
    components: ProfileComponent[],
  ): Record<string, unknown> {
    return {
      username: profile.username,
      fullName: profile.user?.fullName ?? null,
      bio: profile.bio,
      photoUrl: profile.photoUrl,
      ctaLabel: profile.ctaLabel,
      ctaUrl: profile.ctaUrl,
      themeSettings: profile.themeSettings,
      components: components.map((c) => ({
        type: c.type,
        displayOrder: c.displayOrder,
        data: c.data,
      })),
    };
  }

  private computeEtag(content: string): string {
    return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
  }
}
