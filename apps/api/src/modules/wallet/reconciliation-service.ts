import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Transaction } from '../../database/entities/transaction.entity';
import { TransactionStatus } from '../../database/enums/transaction-status.enum';
import { PurchaseService } from '../auth/purchase.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,

    private readonly purchaseService: PurchaseService,
  ) {}

  @Cron('*/1 * * * *')
  async reconcile(): Promise<void> {
    const transactions = await this.transactionRepository.find({
      where: {
        status: In([
          TransactionStatus.PENDING,
          TransactionStatus.PROCESSING,
          TransactionStatus.UNKNOWN,
        ]),
      },
      order: {
        createdAt: 'ASC',
      },
      take: 100,
    });

    for (const transaction of transactions) {
      try {
        await this.purchaseService.reconcileTransaction(transaction.id);
      } catch (error) {
        this.logger.error(
          `Reconciliation failed for ${transaction.reference}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }
  }
}
