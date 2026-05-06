import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { WaitList } from '../entities/waitList.entity';

@Injectable()
export class WaitListModelAction {
  constructor(
    @InjectRepository(WaitList)
    private readonly waitListRepository: Repository<WaitList>,
  ) {}

  async create(email: string): Promise<WaitList> {
    const existing = await this.waitListRepository.findOne({
      where: { email },
    });
    if (existing) {
      throw new Error('Email already in waitList');
    }
    const waitListEntry = this.waitListRepository.create({ email });
    return this.waitListRepository.save(waitListEntry);
  }

  async findByEmail(email: string): Promise<WaitList | null> {
    return this.waitListRepository.findOne({ where: { email } });
  }

  async getAll(page: number = 1, limit: number = 10): Promise<{
    data: WaitList[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const [data, total] = await this.waitListRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markEmailSent(id: string): Promise<WaitList> {
    await this.waitListRepository.update(id, { emailSent: true });
    const updated = await this.waitListRepository.findOne({ where: { id } });
    if (!updated) throw new Error('Failed to update waitList entry');
    return updated;
  }
}
