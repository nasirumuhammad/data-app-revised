import { Module } from '@nestjs/common';
import { WalletLedgerService } from './wallet-ledger.service';
import { TransactionService } from './transaction.service';

@Module({
  providers: [WalletLedgerService, TransactionService],
  exports: [WalletLedgerService, TransactionService],
})
export class WalletModule {}
