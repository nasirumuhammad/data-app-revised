import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { TransactionAttemptStatus } from '../enums/transaction-attempt-status.enum';

@Entity('transaction_attempts')
@Index(['transactionId', 'attemptNumber'], { unique: true })
export class TransactionAttempt extends BaseEntity {
  @Column()
  transactionId!: string;

  @Column()
  providerId!: string;

  @Column()
  attemptNumber!: number;

  @Column({
    type: 'enum',
    enum: TransactionAttemptStatus,
    default: TransactionAttemptStatus.PENDING,
  })
  status!: TransactionAttemptStatus;

  @Column({ nullable: true })
  providerReference!: string | null;

  @Column({ nullable: true })
  errorCode!: string | null;

  @Column({ nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload!: Record<string, unknown> | null;

  @Column({ nullable: true })
  startedAt!: Date | null;

  @Column({ nullable: true })
  completedAt!: Date | null;
}
