/* supertest response bodies are untyped JSON, which is the point of these tests. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  DynamicModule,
  Get,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { DataSource } from 'typeorm';

import authConfig from '../../config/auth.config';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/enums/user-role.enum';
import { TEST_AUTH_CONFIG, uniqueEmail } from '../../testing/test-auth';
import { createTestDataSource } from '../../testing/test-database';
import { AuthModule } from './auth.module';
import { AuthenticatedUser } from './auth.types';
import { CurrentUser, Public, Roles } from './decorators/auth.decorators';

jest.setTimeout(30_000);

const PASSWORD = 'correct horse 9';

// Stand-in routes that exercise the global guards the way real modules will.
@Controller('probe')
class ProbeController {
  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }

  @Get('private')
  private(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Roles(UserRole.ADMIN)
  @Get('admin')
  admin() {
    return { ok: true };
  }
}

function dataSourceModule(dataSource: DataSource): DynamicModule {
  @Module({})
  class TestDataSourceModule {}

  return {
    module: TestDataSourceModule,
    global: true,
    providers: [{ provide: DataSource, useValue: dataSource }],
    exports: [DataSource],
  };
}

async function createApp(
  dataSource: DataSource,
  options: { throttle: boolean },
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [authConfig],
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      dataSourceModule(dataSource),
      AuthModule,
    ],
    controllers: [ProbeController],
    providers: options.throttle
      ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
      : [],
  }).compile();

  const app = moduleRef.createNestApplication();
  // Same pipe as main.ts.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return app;
}

describe('auth over HTTP (real Postgres)', () => {
  const original = { ...process.env };
  let dataSource: DataSource;
  let app: INestApplication;
  const jwt = new JwtService({});

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = TEST_AUTH_CONFIG.accessSecret;
    process.env.JWT_REFRESH_SECRET = TEST_AUTH_CONFIG.refreshSecret;
    process.env.BCRYPT_ROUNDS = '4';

    dataSource = await createTestDataSource();
    app = await createApp(dataSource, { throttle: false });
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
    process.env = original;
  });

  const http = () => request(app.getHttpServer());

  async function registerUser() {
    const email = uniqueEmail();
    const res = await http()
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    return {
      email,
      user: res.body.user as { id: string; email: string },
      accessToken: res.body.tokens.accessToken as string,
      refreshToken: res.body.tokens.refreshToken as string,
    };
  }

  describe('route protection', () => {
    it('serves @Public() routes without a token', async () => {
      await http().get('/probe/open').expect(200);
    });

    it('protects every other route by default', async () => {
      await http().get('/probe/private').expect(401);
      await http().get('/auth/me').expect(401);
    });

    it('exposes the authenticated user to handlers', async () => {
      const { accessToken, user } = await registerUser();
      const res = await http()
        .get('/probe/private')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual({
        id: user.id,
        email: user.email,
        role: 'USER',
      });
    });

    it.each([
      ['no scheme', 'sometoken'],
      ['Basic scheme', 'Basic dXNlcjpwYXNz'],
      ['extra parts', 'Bearer a b'],
      ['garbage token', 'Bearer not.a.jwt'],
    ])('rejects a malformed Authorization header (%s)', async (_n, header) => {
      await http().get('/auth/me').set('Authorization', header).expect(401);
    });
  });

  describe('token forgery', () => {
    const bearer = (token: string) => `Bearer ${token}`;

    it('rejects a token signed with another secret', async () => {
      const { user } = await registerUser();
      const forged = await jwt.signAsync(
        { sub: user.id, typ: 'access' },
        {
          secret: 'attacker-secret-attacker-secret-attacker-secret',
          issuer: 'data-app-api',
          audience: 'data-app-clients',
        },
      );
      await http()
        .get('/auth/me')
        .set('Authorization', bearer(forged))
        .expect(401);
    });

    it('rejects an expired token', async () => {
      const { user } = await registerUser();
      const expired = await jwt.signAsync(
        { sub: user.id, typ: 'access' },
        {
          secret: TEST_AUTH_CONFIG.accessSecret,
          issuer: 'data-app-api',
          audience: 'data-app-clients',
          expiresIn: -10,
        },
      );
      await http()
        .get('/auth/me')
        .set('Authorization', bearer(expired))
        .expect(401);
    });

    it('rejects an unsigned token (alg: none)', async () => {
      const { user } = await registerUser();
      const b64 = (o: object) =>
        Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
        sub: user.id,
        typ: 'access',
        iss: 'data-app-api',
        aud: 'data-app-clients',
        exp: Math.floor(Date.now() / 1000) + 600,
      })}.`;
      await http()
        .get('/auth/me')
        .set('Authorization', bearer(unsigned))
        .expect(401);
    });

    it('rejects a token with the wrong audience or token type', async () => {
      const { user } = await registerUser();
      const sign = (claims: Record<string, unknown>, audience: string) =>
        jwt.signAsync(claims, {
          secret: TEST_AUTH_CONFIG.accessSecret,
          issuer: 'data-app-api',
          audience,
        });

      await http()
        .get('/auth/me')
        .set(
          'Authorization',
          bearer(await sign({ sub: user.id, typ: 'access' }, 'someone-else')),
        )
        .expect(401);
      await http()
        .get('/auth/me')
        .set(
          'Authorization',
          bearer(
            await sign({ sub: user.id, typ: 'refresh' }, 'data-app-clients'),
          ),
        )
        .expect(401);
    });

    it('rejects a refresh token used as an access token', async () => {
      const { refreshToken } = await registerUser();
      await http()
        .get('/auth/me')
        .set('Authorization', bearer(refreshToken))
        .expect(401);
    });
  });

  describe('account state is checked on every request', () => {
    it('locks out a user the moment they are disabled', async () => {
      const { accessToken, user } = await registerUser();
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await dataSource.getRepository(User).update(user.id, { isActive: false });

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('applies a role change without waiting for a new token', async () => {
      const { accessToken, user } = await registerUser();
      const auth = { Authorization: `Bearer ${accessToken}` };

      await http().get('/probe/admin').set(auth).expect(403);
      await dataSource
        .getRepository(User)
        .update(user.id, { role: UserRole.ADMIN });
      await http().get('/probe/admin').set(auth).expect(200);
    });

    it('requires authentication before role checks', async () => {
      await http().get('/probe/admin').expect(401);
    });
  });

  describe('input validation', () => {
    const register = (body: object) => http().post('/auth/register').send(body);

    it.each([
      ['invalid email', { email: 'nope', password: PASSWORD }],
      ['missing password', { email: uniqueEmail() }],
      ['password too short', { email: uniqueEmail(), password: 'short' }],
      [
        'password over 72 bytes (multi-byte)',
        { email: uniqueEmail(), password: 'é'.repeat(37) },
      ],
      [
        'invalid phone',
        { email: uniqueEmail(), password: PASSWORD, phoneNumber: '12345' },
      ],
      [
        'unknown field',
        { email: uniqueEmail(), password: PASSWORD, isAdmin: true },
      ],
      [
        'self-assigned role',
        { email: uniqueEmail(), password: PASSWORD, role: 'ADMIN' },
      ],
      ['non-string password', { email: uniqueEmail(), password: 12345678 }],
    ])('rejects %s', async (_name, body) => {
      await register(body).expect(400);
    });

    it('accepts Nigerian numbers in local and international format', async () => {
      const a = await register({
        email: uniqueEmail(),
        password: PASSWORD,
        phoneNumber: '0803 000 0000',
      }).expect(201);
      const b = await register({
        email: uniqueEmail(),
        password: PASSWORD,
        phoneNumber: '+2348030000000',
      }).expect(201);

      expect(a.body.user.phoneNumber).toBe('08030000000');
      expect(b.body.user.phoneNumber).toBe('+2348030000000');
    });

    it('never returns password hashes or token hashes', async () => {
      const email = uniqueEmail();
      const res = await register({ email, password: PASSWORD }).expect(201);
      const body = JSON.stringify(res.body);

      expect(body).not.toMatch(/passwordHash|tokenHash|\$2[aby]\$/);
      expect(Object.keys(res.body.user).sort()).toEqual([
        'createdAt',
        'email',
        'id',
        'phoneNumber',
        'role',
      ]);
    });

    it('rejects a bad refresh payload', async () => {
      await http().post('/auth/refresh').send({}).expect(400);
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: 123 })
        .expect(400);
    });
  });

  describe('login', () => {
    it('answers 401 with an identical body for a bad password and an unknown email', async () => {
      const { email } = await registerUser();

      const wrong = await http()
        .post('/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401);
      const unknown = await http()
        .post('/auth/login')
        .send({ email: uniqueEmail('ghost'), password: 'wrong' })
        .expect(401);

      expect(wrong.body).toEqual(unknown.body);
    });

    it('answers 200 with a usable session', async () => {
      const { email } = await registerUser();
      const res = await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
        .expect(200);
    });

    it('returns 403 for a disabled account with the right password only', async () => {
      const { email, user } = await registerUser();
      await dataSource.getRepository(User).update(user.id, { isActive: false });

      await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(403);
      await http()
        .post('/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401);
    });
  });

  describe('session lifecycle', () => {
    it('rotates refresh tokens and detects replay', async () => {
      const { refreshToken } = await registerUser();

      const rotated = await http()
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: rotated.body.tokens.refreshToken })
        .expect(401);
    });

    it('logs out with 204, even for an unknown token', async () => {
      const { refreshToken } = await registerUser();

      await http().post('/auth/logout').send({ refreshToken }).expect(204);
      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
      await http()
        .post('/auth/logout')
        .send({ refreshToken: 'unknown' })
        .expect(204);
    });

    it('logs out everywhere with an access token', async () => {
      const { email, accessToken, refreshToken } = await registerUser();
      const other = await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);

      await http().post('/auth/logout-all').expect(401);
      await http()
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: other.body.tokens.refreshToken })
        .expect(401);
    });

    it('changes the password and replaces the session', async () => {
      const { email, accessToken, refreshToken } = await registerUser();
      const auth = { Authorization: `Bearer ${accessToken}` };

      await http()
        .post('/auth/change-password')
        .set(auth)
        .send({ currentPassword: 'wrong', newPassword: 'a brand new pass 1' })
        .expect(400);

      const res = await http()
        .post('/auth/change-password')
        .set(auth)
        .send({ currentPassword: PASSWORD, newPassword: 'a brand new pass 1' })
        .expect(200);

      await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(401);
      await http()
        .post('/auth/login')
        .send({ email, password: 'a brand new pass 1' })
        .expect(200);
      await http().post('/auth/refresh').send({ refreshToken }).expect(401);
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
        .expect(200);
    });
  });

  describe('rate limiting', () => {
    it('answers 429 after 5 login attempts a minute from one address', async () => {
      const throttled = await createApp(dataSource, { throttle: true });

      try {
        const attempt = () =>
          request(throttled.getHttpServer())
            .post('/auth/login')
            .send({ email: uniqueEmail('brute'), password: 'guess' });

        const statuses: number[] = [];
        for (let i = 0; i < 7; i++) {
          statuses.push((await attempt()).status);
        }

        expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
      } finally {
        await throttled.close();
      }
    });
  });
});
