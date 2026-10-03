import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Provider } from '../../database/entities/provider.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { TransactionAttempt } from '../../database/entities/transaction-attempt.entity';

import { ProviderModule } from '../providers/provider.module';
import { RoutingModule } from '../routing/routing.module';

import { TransactionService } from './transaction.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { PurchaseService } from '../auth/purchase.service';
import { ReconciliationService } from './reconciliation-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Provider, Transaction, TransactionAttempt]),
    ProviderModule,
    RoutingModule,
  ],

  providers: [
    WalletLedgerService,
    TransactionService,
    PurchaseService,
    ReconciliationService,
  ],

  exports: [WalletLedgerService, TransactionService, PurchaseService],
})
export class WalletModule {}
