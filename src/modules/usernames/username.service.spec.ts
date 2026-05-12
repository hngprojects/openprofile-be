import { Test, TestingModule } from '@nestjs/testing';
import { UsernamesService } from './usernames.service';
import { UsersService } from '../users/users.service';

const mockUsersService = {
  findByUsername: jest.fn(),
};

describe('UsernamesService', () => {
  let service: UsernamesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsernamesService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<UsernamesService>(UsernamesService);
    mockUsersService.findByUsername.mockReset();
  });

  describe('normalization', () => {
    it('trims and lowercases before checking', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);
      const result = await service.check('  John-Doe  ');
      expect(result).toMatchObject({ available: true, normalizedUsername: 'john-doe' });
    });
  });

  describe('format validation', () => {
    const invalid = [
      'ab',            
      'a'.repeat(31),
      '-starts',       
      'ends-',         
      'con--secutive', 
      'has space',     
      'has_underscore',
      'Ωmega',         
    ];

    it.each(invalid)('rejects "%s" as INVALID_FORMAT', async (username) => {
      const result = await service.check(username);
      expect(result).toEqual({ available: false, reason: 'INVALID_FORMAT' });
    });

    it('accepts valid usernames', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);
      const result = await service.check('valid-user123');
      expect(result).toMatchObject({ available: true });
    });
  });

  describe('reserved keywords', () => {
    it('returns INVALID_FORMAT for reserved names (not RESERVED, per RFC §5)', async () => {
      const result = await service.check('admin');
      expect(result).toEqual({ available: false, reason: 'INVALID_FORMAT' });
      expect(mockUsersService.findByUsername).not.toHaveBeenCalled();
    });
  });

  describe('database check', () => {
    it('returns TAKEN when username exists in DB', async () => {
      mockUsersService.findByUsername.mockResolvedValue({ id: '1', username: 'taken-user' });
      const result = await service.check('taken-user');
      expect(result).toEqual({ available: false, reason: 'TAKEN' });
    });

    it('returns available when username is free', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);
      const result = await service.check('free-user');
      expect(result).toMatchObject({ available: true, normalizedUsername: 'free-user' });
    });
  });
});
