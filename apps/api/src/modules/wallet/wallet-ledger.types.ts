import { LedgerEntryType } from '../../database/enums/ledger-entry-type.enum';

export interface WalletMutationInput {
  userId: string;
  walletId: string;
  transactionId: string;
  idempotencyKey: string;
  amount: string | number;
  currency?: string;
  reference?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A reversal refunds the original DEBIT of a transaction. The amount is taken
 * from that ledger entry, never from the caller, so a refund can neither be
 * larger nor smaller than what was charged.
 */
export type WalletReversalInput = Omit<WalletMutationInput, 'amount'>;

export type WalletMutationType =
  LedgerEntryType.CREDIT | LedgerEntryType.DEBIT | LedgerEntryType.REVERSAL;

export interface WalletMutationResult {
  ledgerEntryId: string;
  transactionId: string;
  walletId: string;
  type: WalletMutationType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  idempotent: boolean;
}
