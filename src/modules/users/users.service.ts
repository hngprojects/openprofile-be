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

import { User } from './entities/user.entity';
import { ResetPassword } from '../auth/entities/reset-password.entity';

const BCRYPT_ROUNDS = 10;

const NO_TRANSACTION = {
  transactionOptions: { useTransaction: false as const },
};

@Injectable()
export class UsersService {
  constructor(
    private readonly userModelAction: UserModelAction,
    private readonly resetPasswordAction: ResetPasswordModelAction,
  ) {}

  // =========================
  // CREATE USER
  // =========================
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

  // =========================
  // 🔥 SET OTP (FIXED)
  // =========================
  async setOtp(
    userId: string,
    otp: string,
    otpExpiresAt: Date,
  ): Promise<void> {
    const updated = await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id: userId },
      updatePayload: {
        otp,
        otpExpiresAt,
      },
    });

    if (!updated) {
      throw new InternalServerErrorException('Failed to set OTP');
    }
  }

  // =========================
  // LIST USERS
  // =========================
  findAll(pagination: PaginationDto) {
    return this.userModelAction.list({
      paginationPayload: {
        page: pagination.page!,
        limit: pagination.limit!,
      },
      order: { createdAt: 'DESC' },
    });
  }

  // =========================
  // FIND USER BY ID
  // =========================
  async findOne(id: string): Promise<User> {
    const user = await this.userModelAction.get({
      identifierOptions: { id },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  // =========================
  // FIND BY EMAIL
  // =========================
  findByEmail(email: string): Promise<User | null> {
    return this.userModelAction.findByEmail(email);
  }

  // =========================
  // UPDATE USER
  // =========================
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

  // =========================
  // DELETE USER
  // =========================
  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.userModelAction.delete({
      ...NO_TRANSACTION,
      identifierOptions: { id },
    });
  }

  // =========================
  // REFRESH TOKEN
  // =========================
  async setRefreshTokenHash(
    id: string,
    hash: string | null,
  ): Promise<void> {
    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: { refreshTokenHash: hash },
    });
  }

  // =========================
  // PASSWORD RESET TOKEN
  // =========================
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

  async markPasswordResetAsUsed(
    resetPasswordId: string,
  ): Promise<void> {
    await this.resetPasswordAction.markAsUsed(resetPasswordId);
  }

  // =========================
  // UPDATE PASSWORD
  // =========================
  async updatePassword(
    id: string,
    newPassword: string,
  ): Promise<void> {
    const passwordHash = await bcrypt.hash(
      newPassword,
      BCRYPT_ROUNDS,
    );

    await this.userModelAction.update({
      ...NO_TRANSACTION,
      identifierOptions: { id },
      updatePayload: {
        password: passwordHash,
      },
    });
  }
}