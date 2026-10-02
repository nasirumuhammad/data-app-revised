import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import {
  AuthIdentity,
  AuthProvider,
} from '../../database/entities/auth-identity.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import {
  AuthResponse,
  AuthTokens,
  RequestContext,
  UserProfile,
} from './auth.types';

const UNIQUE_VIOLATION = '23505';
const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_REFRESH_TOKEN = 'Invalid or expired refresh token';

export interface RegisterInput {
  email: string;
  password: string;
  phoneNumber?: string;
}

type RefreshOutcome =
  | { kind: 'ok'; user: User; refreshToken: string }
  | { kind: 'invalid' | 'expired' | 'reuse' | 'inactive' };

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
  ) {}

  async register(
    input: RegisterInput,
    context: RequestContext = {},
  ): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    // Hash before opening the transaction: bcrypt is slow and must not hold
    // a database connection while it runs.
    const passwordHash = await this.passwords.hash(input.password);

    let created: { user: User; refreshToken: string };

    try {
      created = await this.dataSource.transaction(async (manager) => {
        const user = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            email,
            phoneNumber: input.phoneNumber ?? null,
          }),
        );

        await manager.getRepository(AuthIdentity).save(
          manager.getRepository(AuthIdentity).create({
            userId: user.id,
            provider: AuthProvider.PASSWORD,
            providerAccountId: user.id,
            passwordHash,
          }),
        );

        // Every user gets exactly one wallet (userId is unique on wallets).
        await manager
          .getRepository(Wallet)
          .save(manager.getRepository(Wallet).create({ userId: user.id }));

        const refresh = await this.createRefreshToken(
          manager,
          user.id,
          randomUUID(),
          context,
        );

        return { user, refreshToken: refresh.token };
      });
    } catch (error) {
      if (getPgErrorCode(error) === UNIQUE_VIOLATION) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }

    return this.buildResponse(created.user, created.refreshToken);
  }

  async login(
    email: string,
    password: string,
    context: RequestContext = {},
  ): Promise<AuthResponse> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { email: normalizeEmail(email) } });

    const identity = user
      ? await this.dataSource.getRepository(AuthIdentity).findOne({
          where: { userId: user.id, provider: AuthProvider.PASSWORD },
        })
      : null;

    let valid = false;

    if (identity?.passwordHash) {
      valid = await this.passwords.verify(password, identity.passwordHash);
    } else {
      // Unknown email: do the same amount of work so timing does not reveal
      // which emails have accounts.
      await this.passwords.burn(password);
    }

    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Checked only after the password is proven, so a disabled account is not
    // revealed to someone who does not know its password.
    if (!user.isActive) {
      throw new ForbiddenException('This account is disabled');
    }

    const refresh = await this.dataSource.transaction((manager) =>
      this.createRefreshToken(manager, user.id, randomUUID(), context),
    );

    return this.buildResponse(user, refresh.token);
  }

  /**
   * Exchanges a refresh token for a new access + refresh pair and retires the
   * old one. Presenting a token that was already rotated means it leaked (or a
   * client raced itself), so the whole session family is revoked.
   */
  async refresh(
    rawToken: string,
    context: RequestContext = {},
  ): Promise<AuthResponse> {
    const hash = this.tokens.hashRefreshToken(rawToken);

    const outcome = await this.dataSource.transaction(
      async (manager): Promise<RefreshOutcome> => {
        const stored = await manager
          .getRepository(RefreshToken)
          .createQueryBuilder('token')
          .setLock('pessimistic_write')
          .where('token.tokenHash = :hash', { hash })
          .getOne();

        if (!stored) {
          return { kind: 'invalid' };
        }

        const now = new Date();

        if (stored.revokedAt) {
          await this.revokeFamily(manager, stored.familyId, now);
          return { kind: 'reuse' };
        }

        if (stored.expiresAt.getTime() <= now.getTime()) {
          return { kind: 'expired' };
        }

        const user = await manager
          .getRepository(User)
          .findOne({ where: { id: stored.userId } });

        if (!user || !user.isActive) {
          await this.revokeFamily(manager, stored.familyId, now);
          return { kind: 'inactive' };
        }

        const next = await this.createRefreshToken(
          manager,
          user.id,
          stored.familyId,
          context,
        );

        await manager
          .getRepository(RefreshToken)
          .update(stored.id, { revokedAt: now, replacedByTokenId: next.id });

        return { kind: 'ok', user, refreshToken: next.token };
      },
    );

    // Thrown after the transaction commits so a reuse revocation persists.
    if (outcome.kind !== 'ok') {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    return this.buildResponse(outcome.user, outcome.refreshToken);
  }

  /** Ends the session the token belongs to. Unknown tokens are ignored. */
  async logout(rawToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(rawToken);

    await this.dataSource.transaction(async (manager) => {
      const stored = await manager
        .getRepository(RefreshToken)
        .findOne({ where: { tokenHash: hash } });

      if (stored) {
        await this.revokeFamily(manager, stored.familyId, new Date());
      }
    });
  }

  /** Ends every session of the user (all devices). */
  async logoutAll(userId: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: RequestContext = {},
  ): Promise<AuthResponse> {
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });
    const identity = await this.dataSource.getRepository(AuthIdentity).findOne({
      where: { userId, provider: AuthProvider.PASSWORD },
    });

    if (!user || !identity?.passwordHash) {
      throw new NotFoundException(
        'Password login is not set up for this account',
      );
    }

    // 400, not 401: a 401 would make clients try to refresh their session.
    if (
      !(await this.passwords.verify(currentPassword, identity.passwordHash))
    ) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await this.passwords.hash(newPassword);

    const refresh = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(AuthIdentity)
        .update(identity.id, { passwordHash });

      // A password change signs out every device, including this one, then
      // starts a fresh session for the caller.
      await manager
        .getRepository(RefreshToken)
        .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });

      return this.createRefreshToken(manager, userId, randomUUID(), context);
    });

    return this.buildResponse(user, refresh.token);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toProfile(user);
  }

  private async createRefreshToken(
    manager: EntityManager,
    userId: string,
    familyId: string,
    context: RequestContext,
  ): Promise<{ id: string; token: string }> {
    const { token, hash } = this.tokens.generateRefreshToken();

    const saved = await manager.getRepository(RefreshToken).save(
      manager.getRepository(RefreshToken).create({
        userId,
        familyId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlMs),
        ipAddress: context.ip?.slice(0, 64) ?? null,
        userAgent: context.userAgent?.slice(0, 255) ?? null,
      }),
    );

    return { id: saved.id, token };
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
    at: Date,
  ): Promise<void> {
    await manager
      .getRepository(RefreshToken)
      .update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
  }

  private async buildResponse(
    user: User,
    refreshToken: string,
  ): Promise<AuthResponse> {
    const tokens: AuthTokens = {
      accessToken: await this.tokens.signAccessToken(user.id),
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };

    return { user: toProfile(user), tokens };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function getPgErrorCode(error: unknown): string | undefined {
  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };

  return candidate?.driverError?.code ?? candidate?.code;
}
