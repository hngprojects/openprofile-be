import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('waitList')
export class WaitList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: false })
  emailSent: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
