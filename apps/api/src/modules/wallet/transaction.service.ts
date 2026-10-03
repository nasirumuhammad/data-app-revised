import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryDeepPartialEntity } from 'typeorm';

import { Transaction } from '../../database/entities/transaction.entity';
import { ServiceType } from '../../database/enums/service-type.enum';
import { TransactionStatus } from '../../database/enums/transaction-status.enum';
import { Wallet } from '../../database/entities/wallet.entity';

export interface CreateTransactionInput {
  userId: string;
  walletId: string;
  idempotencyKey: string;
  serviceType: ServiceType;
  amount: string;
  fee?: string;
  currency?: string;
  recipient?: string;
  productCode?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  async createOrGet(input: CreateTransactionInput): Promise<Transaction> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);

      const existing = await repository.findOne({
        where: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      if (existing) {
        this.assertSameRequest(existing, input);
        return existing;
      }

      const ownsWallet = await manager.getRepository(Wallet).exists({
        where: { id: input.walletId, userId: input.userId },
      });

      if (!ownsWallet) {
        throw new NotFoundException('Wallet not found for this user');
      }

      const reference = `TXN_${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const amount = this.normalizeMoney(input.amount);
      const fee = this.normalizeMoney(input.fee ?? '0.00');

      await repository
        .createQueryBuilder()
        .insert()
        .into(Transaction)
        .values({
          userId: input.userId,
          walletId: input.walletId,
          serviceType: input.serviceType,
          recipient: input.recipient ?? null,
          productCode: input.productCode ?? null,
          amount,
          fee,
          currency: input.currency ?? 'NGN',
          status: TransactionStatus.PENDING,
          reference,
          idempotencyKey: input.idempotencyKey,
          providerReference: null,
          completedAt: null,
          failureReason: null,
          metadata: input.metadata ?? null,
        } as QueryDeepPartialEntity<Transaction>)
        .orIgnore()
        .execute();

      const transaction = await repository.findOneOrFail({
        where: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      this.assertSameRequest(transaction, input);
      return transaction;
    });
  }

  private normalizeMoney(value: string): string {
    const raw = String(value).trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new BadRequestException('Invalid monetary value');
    }

    const [whole, fraction = ''] = raw.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');

    if (cents < 0n) {
      throw new BadRequestException('Monetary value cannot be negative');
    }

    return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
  }

  private assertSameRequest(
    transaction: Transaction,
    input: CreateTransactionInput,
  ): void {
    const same =
      transaction.walletId === input.walletId &&
      transaction.serviceType === input.serviceType &&
      transaction.recipient === (input.recipient ?? null) &&
      transaction.productCode === (input.productCode ?? null) &&
      transaction.amount === this.normalizeMoney(input.amount) &&
      transaction.fee === this.normalizeMoney(input.fee ?? '0.00') &&
      transaction.currency === (input.currency ?? 'NGN');

    if (!same) {
      throw new ConflictException(
        'Idempotency key was already used for a different transaction',
      );
    }
  }

  async claimForProcessing(
    transactionId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<Transaction | null> {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager
        .getRepository(Transaction)
        .createQueryBuilder('transaction')
        .setLock('pessimistic_write')
        .where('transaction.id = :transactionId', { transactionId })
        .andWhere('transaction.userId = :userId', { userId })
        .andWhere('transaction.idempotencyKey = :idempotencyKey', {
          idempotencyKey,
        })
        .getOne();

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        return null;
      }

      transaction.status = TransactionStatus.PROCESSING;

      return manager.getRepository(Transaction).save(transaction);
    });
  }
}
