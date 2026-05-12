import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProfileComponent } from './profile-component.entity';

export enum ProfileTemplate {
  PROFESSIONAL = 'PROFESSIONAL',
  CREATOR = 'CREATOR',
  FREELANCER = 'FREELANCER',
}

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, name: 'full_name', nullable: true })
  fullName: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 500, name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({
    type: 'enum',
    enum: ProfileTemplate,
    name: 'template_id',
    default: ProfileTemplate.PROFESSIONAL,
  })
  templateId: ProfileTemplate;

  @Column({ type: 'jsonb', name: 'theme_settings', nullable: true })
  themeSettings: Record<string, unknown> | null;

  @Column({ type: 'boolean', name: 'is_searchable', default: true })
  isSearchable: boolean;

  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', name: 'is_published', default: false })
  isPublished: boolean;

  @OneToMany(() => ProfileComponent, (component) => component.profile)
  components: ProfileComponent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
