import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Entity('users')
export class User {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false, name: 'is_verified' })
  isVerified: boolean;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false, name: 'onboarding_complete' })
  onboardingComplete: boolean;

  @ApiProperty({ enum: AuthProvider, default: AuthProvider.LOCAL })
  @Column({ type: 'varchar', length: 32, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  @Exclude()
  @Column({ type: 'varchar', length: 45, nullable: true, name: 'last_login_ip' })
  lastLoginIp: string | null;

  @Exclude()
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'refresh_token_hash',
  })
  refreshTokenHash: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
