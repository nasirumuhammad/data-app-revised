import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { ServiceType } from '../enums/service-type.enum';

@Entity('transactions')
@Index(['userId', 'createdAt'])
@Index(['reference'], { unique: true })
export class Transaction extends BaseEntity {
  @Column()
  userId!: string;

  @Column({
    type: 'enum',
    enum: ServiceType,
  })
  serviceType!: ServiceType;

  @Column({
    type: 'decimal',
    precision: 19,
    scale: 2,
  })
  amount!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({ unique: true })
  reference!: string;

  @Column({ nullable: true })
  providerReference!: string | null;

  @Column({ nullable: true })
  completedAt!: Date | null;

  @Column({ nullable: true })
  failureReason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
