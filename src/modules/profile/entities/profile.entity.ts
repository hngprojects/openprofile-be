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

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 500, name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'varchar', length: 100, name: 'cta_label', nullable: true })
  ctaLabel: string | null;

  @Column({ type: 'varchar', length: 500, name: 'cta_url', nullable: true })
  ctaUrl: string | null;

  @Column({ type: 'jsonb', name: 'theme_settings', nullable: true })
  themeSettings: Record<string, unknown> | null;

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
