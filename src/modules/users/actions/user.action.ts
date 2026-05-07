import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserModelAction extends AbstractModelAction<User> {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {
    super(repo, User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.get({ identifierOptions: { email } });
  }

  async findByValidResetToken(tokenHash: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.password_reset_token_hash = :tokenHash', { tokenHash })
      .andWhere('user.password_reset_expires > :now', { now: new Date() })
      .getOne();
  }
}
