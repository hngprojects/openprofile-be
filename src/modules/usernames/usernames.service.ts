import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RESERVED_USERNAMES } from './data/reserved-keywords';

// Unicode ranges to reject (homoglyph attack prevention)
/**
 * \u0400-\u04FF
    Cyrillic characters
      Example: а (Cyrillic) can look like a (English)
      \u0370-\u03FF
    Greek characters
      Example: Greek ο can look like English o
      \u4E00-\u9FFF
    Chinese/Japanese/Kanji characters
 * 
 * 
**/
const AMBIGUOUS_UNICODE_REGEX = /[\u0400-\u04FF\u0370-\u03FF\u4E00-\u9FFF]/;

// Valid username: letters, digits, single hyphens; no leading/trailing hyphens
const FORMAT_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export type UsernameCheckResult =
  | { available: true; normalizedUsername: string }
  | { available: false; reason: 'INVALID_FORMAT' | 'RESERVED' | 'TAKEN' };

@Injectable()
export class UsernamesService {
  constructor(private readonly usersService: UsersService) {}

  async check(rawUsername: string): Promise<UsernameCheckResult> {
    const normalized = rawUsername.trim().toLowerCase();

    if (AMBIGUOUS_UNICODE_REGEX.test(normalized)) {
      return { available: false, reason: 'INVALID_FORMAT' };
    }

    if (normalized.length < 3 || normalized.length > 30) {
      return { available: false, reason: 'INVALID_FORMAT' };
    }

    if (!FORMAT_REGEX.test(normalized)) {
      return { available: false, reason: 'INVALID_FORMAT' };
    }

    if (/--/.test(normalized)) {
      return { available: false, reason: 'INVALID_FORMAT' };
    }

    if (RESERVED_USERNAMES.has(normalized)) {
      // Return INVALID_FORMAT per RFC §5: do not expose that a name is reserved
      return { available: false, reason: 'INVALID_FORMAT' };
    }

    const existing = await this.usersService.findByUsername(normalized);
    if (existing) {
      return { available: false, reason: 'TAKEN' };
    }

    return { available: true, normalizedUsername: normalized };
  }
}
