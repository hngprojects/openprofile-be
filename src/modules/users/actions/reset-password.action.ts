import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResetPassword } from '../../auth/entities/reset-password.entity';

@Injectable()
export class ResetPasswordModelAction extends AbstractModelAction<ResetPassword> {
  constructor(
    @InjectRepository(ResetPassword)
    private readonly repo: Repository<ResetPassword>,
  ) {
    super(repo, ResetPassword);
  }

  async findByValidToken(tokenHash: string): Promise<ResetPassword | null> {
    return this.repo
      .createQueryBuilder('rp')
      .where('rp.tokenHash = :tokenHash', { tokenHash })
      .andWhere('rp.used = :used', { used: false })
      .andWhere('rp.expiresAt > CURRENT_TIMESTAMP')
      .getOne();
  }

  async findByUserId(userId: string): Promise<ResetPassword | null> {
    return this.repo
      .createQueryBuilder('rp')
      .where('rp.userId = :userId', { userId })
      .andWhere('rp.used = :used', { used: false })
      .andWhere('rp.expiresAt > CURRENT_TIMESTAMP')
      .orderBy('rp.createdAt', 'DESC')
      .getOne();
  }

  async markAsUsed(id: string): Promise<void> {
    await this.update({
      transactionOptions: { useTransaction: false },
      identifierOptions: { id },
      updatePayload: { used: true },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
