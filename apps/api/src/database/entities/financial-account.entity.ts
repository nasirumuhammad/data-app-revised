import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from './base.entity';
import { AccountStatus } from '../enums/account-status.enum';

@Entity('financial_accounts')
@Index(['providerId', 'providerReference'], { unique: true })
export class FinancialAccount extends BaseEntity {
  @Column()
  userId!: string;

  @Column()
  providerId!: string;

  @Column({ nullable: true })
  accountNumber!: string | null;

  @Column({ nullable: true })
  accountName!: string | null;

  @Column({ nullable: true })
  bankName!: string | null;

  @Column({ nullable: true })
  bankCode!: string | null;

  @Column({ nullable: true })
  providerReference!: string | null;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.PENDING,
  })
  status!: AccountStatus;

  @Column({ default: 'NGN' })
  currency!: string;
}
