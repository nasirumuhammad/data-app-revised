import { Column, Entity, OneToMany, OneToOne, Relation } from 'typeorm';

import { BaseEntity } from './base.entity';
import { UserRole } from '../enums/user-role.enum';
import { AuthIdentity } from './auth-identity.entity';
import { FinancialAccount } from './financial-account.entity';
import { IdentityVerification } from './identity-verification.entity';
import { Transaction } from './transaction.entity';
import { Wallet } from './wallet.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber!: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => AuthIdentity, (identity) => identity.user)
  authIdentities!: Relation<AuthIdentity[]>;

  @OneToMany(() => IdentityVerification, (verification) => verification.user)
  identityVerifications!: Relation<IdentityVerification[]>;

  @OneToMany(() => FinancialAccount, (account) => account.user)
  financialAccounts!: Relation<FinancialAccount[]>;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet!: Relation<Wallet>;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions!: Relation<Transaction[]>;
}
