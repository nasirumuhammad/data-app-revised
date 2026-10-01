import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Relation,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { Provider } from './provider.entity';
import { User } from './user.entity';

@Entity('financial_accounts')
@Index(['providerId', 'providerReference'], { unique: true })
@Index(['userId'])
export class FinancialAccount extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.financialAccounts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({ type: 'uuid' })
  providerId!: string;

  @ManyToOne(() => Provider, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'providerId' })
  provider!: Relation<Provider>;

  @Column({ type: 'varchar', nullable: true })
  accountNumber!: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bankCode!: string | null;

  @Column({ type: 'varchar', nullable: true })
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
