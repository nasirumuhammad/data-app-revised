import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { LedgerEntryType } from '../../database/enums/ledger-entry-type.enum';
import { WalletStatus } from '../../database/enums/wallet-status.enum';
import {
  WalletMutationInput,
  WalletMutationResult,
  WalletMutationType,
  WalletReversalInput,
} from './wallet-ledger.types';

@Injectable()
export class WalletLedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async debit(input: WalletMutationInput): Promise<WalletMutationResult> {
    return this.mutate(input, LedgerEntryType.DEBIT);
  }

  async credit(input: WalletMutationInput): Promise<WalletMutationResult> {
    return this.mutate(input, LedgerEntryType.CREDIT);
  }

  /**
   * Refunds the DEBIT recorded for this transaction (e.g. the provider
   * definitively failed). Idempotent: reversing twice returns the first
   * reversal. Allowed on suspended wallets, because the money is owed back.
   */
  async reverse(input: WalletReversalInput): Promise<WalletMutationResult> {
    return this.mutate(input, LedgerEntryType.REVERSAL);
  }

  private async mutate(
    input: WalletReversalInput & { amount?: string | number },
    type: WalletMutationType,
  ): Promise<WalletMutationResult> {
    const requestedAmount =
      type === LedgerEntryType.REVERSAL
        ? null
        : this.parseAmount(input.amount ?? '');

    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.getAndValidateTransaction(manager, input);

      // The unique (transactionId, type) index makes the operation idempotent
      // even if two identical requests arrive concurrently.
      const existingEntry = await manager.getRepository(LedgerEntry).findOne({
        where: {
          transactionId: transaction.id,
          type,
        },
      });

      if (existingEntry) {
        return this.toResult(existingEntry, true);
      }

      // This is the critical concurrency boundary. Every balance mutation
      // locks the wallet row for the duration of this DB transaction.
      const wallet = await manager
        .getRepository(Wallet)
        .createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.id = :walletId', { walletId: input.walletId })
        .getOne();

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.userId !== input.userId) {
        throw new ConflictException('Wallet does not belong to this user');
      }

      if (wallet.currency !== (input.currency ?? wallet.currency)) {
        throw new BadRequestException('Wallet currency does not match');
      }

      const allowedStatuses =
        type === LedgerEntryType.REVERSAL
          ? [WalletStatus.ACTIVE, WalletStatus.SUSPENDED]
          : [WalletStatus.ACTIVE];

      if (!allowedStatuses.includes(wallet.status)) {
        throw new ConflictException('Wallet is not active');
      }

      // Re-check after acquiring the row lock. Another request for the same
      // transaction may have committed while we were waiting for the lock.
      const committedEntry = await manager.getRepository(LedgerEntry).findOne({
        where: { transactionId: transaction.id, type },
      });

      if (committedEntry) {
        return this.toResult(committedEntry, true);
      }

      let amount: bigint;

      if (requestedAmount !== null) {
        amount = requestedAmount;
      } else {
        const debit = await manager.getRepository(LedgerEntry).findOne({
          where: { transactionId: transaction.id, type: LedgerEntryType.DEBIT },
        });

        if (!debit) {
          throw new ConflictException('Transaction has no debit to reverse');
        }

        amount = this.toCents(debit.amount);
      }

      const balanceBefore = this.toCents(wallet.balance);
      const balanceAfter =
        type === LedgerEntryType.DEBIT
          ? balanceBefore - amount
          : balanceBefore + amount;

      if (type === LedgerEntryType.DEBIT && balanceAfter < 0) {
        throw new ConflictException('Insufficient wallet balance');
      }

      const availableBefore = this.toCents(wallet.availableBalance);
      const availableAfter =
        availableBefore + (type === LedgerEntryType.DEBIT ? -amount : amount);

      if (availableAfter < 0) {
        throw new ConflictException('Insufficient available wallet balance');
      }

      wallet.balance = this.fromCents(balanceAfter);
      wallet.availableBalance = this.fromCents(availableAfter);

      await manager.getRepository(Wallet).save(wallet);

      const entry = manager.getRepository(LedgerEntry).create({
        walletId: wallet.id,
        type,
        amount: this.fromCents(amount),
        balanceBefore: this.fromCents(balanceBefore),
        balanceAfter: this.fromCents(balanceAfter),
        transactionId: transaction.id,
        reference: input.reference ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
      });

      const saved = await manager.getRepository(LedgerEntry).save(entry);
      return this.toResult(saved, false);
    });
  }

  private async getAndValidateTransaction(
    manager: EntityManager,
    input: WalletReversalInput,
  ): Promise<Transaction> {
    const transaction = await manager.getRepository(Transaction).findOne({
      where: {
        id: input.transactionId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        'Transaction not found or idempotency key does not match',
      );
    }

    if (transaction.walletId !== input.walletId) {
      throw new ConflictException('Transaction wallet does not match');
    }

    return transaction;
  }

  private parseAmount(value: string | number): bigint {
    const raw = String(value).trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new BadRequestException('Amount must be a positive monetary value');
    }

    const [whole, fraction = ''] = raw.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');

    if (cents <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    return cents;
  }

  private toCents(value: string): bigint {
    const raw = value.trim();
    const [whole, fraction = ''] = raw.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  }

  private fromCents(value: bigint): string {
    const sign = value < 0n ? '-' : '';
    const absolute = value < 0n ? -value : value;
    return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
  }

  private toResult(
    entry: LedgerEntry,
    idempotent: boolean,
  ): WalletMutationResult {
    return {
      ledgerEntryId: entry.id,
      transactionId: entry.transactionId!,
      walletId: entry.walletId,
      type: entry.type as WalletMutationType,
      amount: entry.amount,
      balanceBefore: entry.balanceBefore,
      balanceAfter: entry.balanceAfter,
      idempotent,
    };
  }
}
