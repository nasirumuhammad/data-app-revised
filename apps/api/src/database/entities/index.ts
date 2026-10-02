import { AuthIdentity } from './auth-identity.entity';
import { FinancialAccount } from './financial-account.entity';
import { IdentityVerification } from './identity-verification.entity';
import { LedgerEntry } from './ledger-entry.entity';
import { ProviderCapabilityEntity } from './provider-capability.entity';
import { Provider } from './provider.entity';
import { RefreshToken } from './refresh-token.entity';
import { TransactionAttempt } from './transaction-attempt.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

/**
 * Every entity, registered explicitly with the application's data source.
 * `autoLoadEntities` alone is not enough: it only picks up entities that some
 * module lists in TypeOrmModule.forFeature(), so relations to any other entity
 * fail with "Entity metadata ... was not found" at startup.
 */
export const ENTITIES = [
  AuthIdentity,
  FinancialAccount,
  IdentityVerification,
  LedgerEntry,
  Provider,
  ProviderCapabilityEntity,
  RefreshToken,
  Transaction,
  TransactionAttempt,
  User,
  Wallet,
];
