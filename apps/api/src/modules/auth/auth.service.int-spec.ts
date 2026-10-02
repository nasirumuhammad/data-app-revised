import { HttpException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import { AuthIdentity } from '../../database/entities/auth-identity.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { createTestDataSource } from '../../testing/test-database';
import { createAuthServices, uniqueEmail } from '../../testing/test-auth';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

jest.setTimeout(30_000);

const PASSWORD = 'correct horse 9';

/** Resolves with the rejection, and fails the test if the call succeeds. */
const failure = (promise: Promise<unknown>): Promise<HttpException> =>
  promise.then(
    () => {
      throw new Error('Expected the call to be rejected');
    },
    (error: HttpException) => error,
  );

describe('AuthService (real Postgres)', () => {
  let dataSource: DataSource;
  let auth: AuthService;
  let tokens: TokenService;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    ({ auth, tokens } = createAuthServices(dataSource));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const tokenRow = (rawToken: string) =>
    dataSource
      .getRepository(RefreshToken)
      .findOneByOrFail({ tokenHash: tokens.hashRefreshToken(rawToken) });

  const familyRows = (familyId: string) =>
    dataSource.getRepository(RefreshToken).findBy({ familyId });

  async function registerUser() {
    const email = uniqueEmail();
    const result = await auth.register({ email, password: PASSWORD });
    return { email, ...result };
  }

  describe('register', () => {
    it('creates the user, password identity, wallet and session together', async () => {
      const { user, tokens: issued } = await registerUser();

      const identity = await dataSource
        .getRepository(AuthIdentity)
        .findOneByOrFail({ userId: user.id });
      const wallet = await dataSource
        .getRepository(Wallet)
        .findOneByOrFail({ userId: user.id });

      expect(identity.passwordHash).toMatch(/^\$2[aby]\$04\$/);
      expect(identity.passwordHash).not.toContain(PASSWORD);
      expect(wallet).toMatchObject({ balance: '0.00', currency: 'NGN' });
      expect(user.role).toBe('USER');
      expect(issued.expiresIn).toBe(900);
      expect(await tokenRow(issued.refreshToken)).toMatchObject({
        userId: user.id,
        revokedAt: null,
      });
    });

    it('never stores the raw refresh token', async () => {
      const { user, tokens: issued } = await registerUser();
      const rows = await dataSource
        .getRepository(RefreshToken)
        .findBy({ userId: user.id });

      expect(rows.map((r) => r.tokenHash)).not.toContain(issued.refreshToken);
      expect(rows[0].tokenHash).toHaveLength(64);
    });

    it('normalizes the email and rejects case-variant duplicates', async () => {
      const email = uniqueEmail('Mixed');
      const first = await auth.register({
        email: `  ${email.toUpperCase()} `,
        password: PASSWORD,
      });

      expect(first.user.email).toBe(email.toLowerCase());
      await expect(
        auth.register({ email, password: PASSWORD }),
      ).rejects.toThrow(/already exists/);
    });

    it('leaves no partial rows when the email is taken', async () => {
      const { email } = await registerUser();
      const before = await dataSource.getRepository(Wallet).count();

      await expect(
        auth.register({ email, password: PASSWORD }),
      ).rejects.toThrow();

      expect(await dataSource.getRepository(Wallet).count()).toBe(before);
      expect(await dataSource.getRepository(User).countBy({ email })).toBe(1);
    });

    it('creates exactly one account when the same email races', async () => {
      const email = uniqueEmail('race');

      const outcomes = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          auth.register({ email, password: PASSWORD }),
        ),
      );

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      expect(await dataSource.getRepository(User).countBy({ email })).toBe(1);
      const user = await dataSource
        .getRepository(User)
        .findOneByOrFail({ email });
      expect(
        await dataSource.getRepository(Wallet).countBy({ userId: user.id }),
      ).toBe(1);
    });
  });

  describe('login', () => {
    it('returns tokens for correct credentials, any email casing', async () => {
      const { email, user } = await registerUser();
      const result = await auth.login(email.toUpperCase(), PASSWORD);

      expect(result.user.id).toBe(user.id);
      await expect(
        tokens.verifyAccessToken(result.tokens.accessToken),
      ).resolves.toBe(user.id);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const { email } = await registerUser();

      const wrongPassword = await failure(auth.login(email, 'nope'));
      const unknownEmail = await failure(
        auth.login(uniqueEmail('ghost'), PASSWORD),
      );

      expect(wrongPassword.getStatus()).toBe(401);
      expect(unknownEmail.getStatus()).toBe(401);
      expect(wrongPassword.message).toBe(unknownEmail.message);
    });

    it('starts a separate session family per login', async () => {
      const { email } = await registerUser();
      const a = await auth.login(email, PASSWORD);
      const b = await auth.login(email, PASSWORD);

      const rowA = await tokenRow(a.tokens.refreshToken);
      const rowB = await tokenRow(b.tokens.refreshToken);
      expect(rowA.familyId).not.toBe(rowB.familyId);
    });

    it('rejects a disabled account only when the password is right', async () => {
      const { email, user } = await registerUser();
      await dataSource.getRepository(User).update(user.id, { isActive: false });

      await expect(auth.login(email, PASSWORD)).rejects.toThrow(/disabled/);
      await expect(auth.login(email, 'wrong')).rejects.toThrow(
        /Invalid email or password/,
      );
    });
  });

  describe('refresh', () => {
    it('rotates: the old token is retired and the new one stays in the family', async () => {
      const { tokens: first } = await registerUser();
      const next = await auth.refresh(first.refreshToken);

      expect(next.tokens.refreshToken).not.toBe(first.refreshToken);

      const oldRow = await tokenRow(first.refreshToken);
      const newRow = await tokenRow(next.tokens.refreshToken);
      expect(oldRow.revokedAt).not.toBeNull();
      expect(oldRow.replacedByTokenId).toBe(newRow.id);
      expect(newRow.familyId).toBe(oldRow.familyId);
      expect(newRow.revokedAt).toBeNull();
    });

    it('keeps working down a chain of rotations', async () => {
      let current = (await registerUser()).tokens;
      for (let i = 0; i < 4; i++) {
        current = (await auth.refresh(current.refreshToken)).tokens;
      }
      await expect(auth.refresh(current.refreshToken)).resolves.toBeDefined();
    });

    it('treats a replayed token as theft and revokes the whole family', async () => {
      const { tokens: first } = await registerUser();
      const next = await auth.refresh(first.refreshToken);

      await expect(auth.refresh(first.refreshToken)).rejects.toThrow(
        /Invalid or expired/,
      );

      // The legitimate newest token is dead too.
      await expect(auth.refresh(next.tokens.refreshToken)).rejects.toThrow();
      const familyId = (await tokenRow(first.refreshToken)).familyId;
      const rows = await familyRows(familyId);
      expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it("does not touch the user's other devices when one session is replayed", async () => {
      const { email } = await registerUser();
      const phone = await auth.login(email, PASSWORD);
      const laptop = await auth.login(email, PASSWORD);

      const rotated = await auth.refresh(phone.tokens.refreshToken);
      await expect(auth.refresh(phone.tokens.refreshToken)).rejects.toThrow();

      expect(rotated).toBeDefined();
      await expect(
        auth.refresh(laptop.tokens.refreshToken),
      ).resolves.toBeDefined();
    });

    it('lets exactly one of several simultaneous refreshes through', async () => {
      const { tokens: first } = await registerUser();

      const outcomes = await Promise.allSettled(
        Array.from({ length: 5 }, () => auth.refresh(first.refreshToken)),
      );

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    });

    it('rejects an expired token without revoking it', async () => {
      const { tokens: first } = await registerUser();
      const row = await tokenRow(first.refreshToken);
      await dataSource
        .getRepository(RefreshToken)
        .update(row.id, { expiresAt: new Date(Date.now() - 1000) });

      await expect(auth.refresh(first.refreshToken)).rejects.toThrow(
        /Invalid or expired/,
      );
      expect((await tokenRow(first.refreshToken)).revokedAt).toBeNull();
    });

    it('rejects unknown tokens', async () => {
      await expect(auth.refresh('not-a-real-token')).rejects.toThrow(
        /Invalid or expired/,
      );
    });

    it('refuses and revokes when the account was disabled', async () => {
      const { user, tokens: first } = await registerUser();
      await dataSource.getRepository(User).update(user.id, { isActive: false });

      await expect(auth.refresh(first.refreshToken)).rejects.toThrow();
      expect((await tokenRow(first.refreshToken)).revokedAt).not.toBeNull();
    });
  });

  describe('logout', () => {
    it('ends only the session it was called for', async () => {
      const { email } = await registerUser();
      const phone = await auth.login(email, PASSWORD);
      const laptop = await auth.login(email, PASSWORD);

      await auth.logout(phone.tokens.refreshToken);

      await expect(auth.refresh(phone.tokens.refreshToken)).rejects.toThrow();
      await expect(
        auth.refresh(laptop.tokens.refreshToken),
      ).resolves.toBeDefined();
    });

    it('is a no-op for unknown tokens', async () => {
      await expect(auth.logout('garbage')).resolves.toBeUndefined();
    });

    it('logoutAll ends every session of the user', async () => {
      const { email, user } = await registerUser();
      const a = await auth.login(email, PASSWORD);
      const b = await auth.login(email, PASSWORD);

      await auth.logoutAll(user.id);

      await expect(auth.refresh(a.tokens.refreshToken)).rejects.toThrow();
      await expect(auth.refresh(b.tokens.refreshToken)).rejects.toThrow();
      expect(
        await dataSource
          .getRepository(RefreshToken)
          .countBy({ userId: user.id, revokedAt: IsNull() }),
      ).toBe(0);
    });
  });

  describe('changePassword', () => {
    it('swaps the password, signs out every device and returns a fresh session', async () => {
      const { email, user, tokens: oldSession } = await registerUser();
      const otherDevice = await auth.login(email, PASSWORD);

      const result = await auth.changePassword(
        user.id,
        PASSWORD,
        'a brand new pass 1',
      );

      await expect(auth.login(email, PASSWORD)).rejects.toThrow();
      await expect(
        auth.login(email, 'a brand new pass 1'),
      ).resolves.toBeDefined();
      await expect(auth.refresh(oldSession.refreshToken)).rejects.toThrow();
      await expect(
        auth.refresh(otherDevice.tokens.refreshToken),
      ).rejects.toThrow();
      await expect(
        auth.refresh(result.tokens.refreshToken),
      ).resolves.toBeDefined();
    });

    it('requires the current password and a different new one', async () => {
      const { user } = await registerUser();

      await expect(
        auth.changePassword(user.id, 'wrong password', 'a brand new pass 1'),
      ).rejects.toThrow(/Current password is incorrect/);
      await expect(
        auth.changePassword(user.id, PASSWORD, PASSWORD),
      ).rejects.toThrow(/different/);
    });
  });
});
