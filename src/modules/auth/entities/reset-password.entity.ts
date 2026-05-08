import { BeforeInsert, Column, Entity, PrimaryColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class ResetPassword {
  @PrimaryColumn('uuid')
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column()
  userId!: string;

  @ApiProperty({ description: 'SHA256 hash of the reset token', maxLength: 64 })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @BeforeInsert()
  generateId() {
    this.id = uuidv7();
  }
}
