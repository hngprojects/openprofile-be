import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';
import { UserModelAction } from './actions/user.action';
import { ResetPasswordModelAction } from './actions/reset-password.action';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthProvider, User } from './entities/user.entity';
import { ResetPassword } from '../auth/entities/reset-password.entity';

const BCRYPT_ROUNDS = 10;
const NO_TRANSACTION = {
  transactionOptions: { useTransaction: false as const },
};

export const EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS';

@Injectable()
export class UsersService {
  constructor(
    private readonly userModelAction: UserModelAction,
    private readonly resetPasswordAction: ResetPasswordModelAction,
  ) {}

  async createEmailUser(dto: CreateUserDto): Promise<User> {
    const normalised = dto.email.toLowerCase();

    const existing = await this.userModelAction.findByEmail(normalised);
    if (existing) {
      throw new ConflictException({
        errorCode: EMAIL_ALREADY_EXISTS,
        message:
          'An account with this email already exists. Please log in instead.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.userModelAction.create({
      ...NO_TRANSACTION,
      createPayload: {
        email: normalised,
        password: passwordHash,
        fullName: dto.fullName,
        role: null,
        isVerified: false,
        authProvider: AuthProvider.EMAIL as AuthProvider,
        otpHash: null,
        otpExpiresAt: null,
      },
    });
  }

  async storeOtpHash(
    userId: string,
    otpHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id: userId },
      updatePayload: { otpHash, otpExpiresAt: expiresAt },
    });
  }

  async clearOtp(userId: string): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id: userId },
      updatePayload: { otpHash: null, otpExpiresAt: null, isVerified: true },
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userModelAction.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.userModelAction.create({
      ...NO_TRANSACTION,
      createPayload: {
        email: dto.email,
        password: passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
    });
  }

  findAll(pagination: PaginationDto) {
    return this.userModelAction.list({
      paginationPayload: { page: pagination.page!, limit: pagination.limit! },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModelAction.get({
      identifierOptions: { id },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModelAction.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const payload: Partial<User> = { ...dto };
    if (dto.password) {
      payload.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    const updated = await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: payload,
    });
    if (!updated) {
      throw new InternalServerErrorException('Failed to update user');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userModelAction.delete({
      ...NO_TRANSACTION,
      identifierOptions: { id },
    });
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { refreshTokenHash: hash },
    });
  }

  async setPasswordResetToken(
    id: string,
    tokenHash: string,
    expires: Date,
  ): Promise<ResetPassword> {
    return this.resetPasswordAction.create({
      transactionOptions: { useTransaction: false },
      createPayload: {
        id: uuidv7(),
        userId: id,
        tokenHash,
        expiresAt: expires,
        used: false,
      },
    });
  }

  async findByValidResetToken(
    tokenHash: string,
  ): Promise<{ user: User; resetPassword: ResetPassword } | null> {
    const resetPassword =
      await this.resetPasswordAction.findByValidToken(tokenHash);
    if (!resetPassword) return null;

    const user = await this.findOne(resetPassword.userId);
    return { user, resetPassword };
  }

  async clearPasswordResetToken(id: string): Promise<void> {
    await this.resetPasswordAction.deleteByUserId(id);
  }

  async markPasswordResetAsUsed(resetPasswordId: string): Promise<void> {
    await this.resetPasswordAction.markAsUsed(resetPasswordId);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { password: passwordHash },
    });
  }
}
