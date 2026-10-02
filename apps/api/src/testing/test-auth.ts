import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { AuthService } from '../modules/auth/auth.service';
import { PasswordService } from '../modules/auth/password.service';
import { TokenService } from '../modules/auth/token.service';

export const TEST_AUTH_CONFIG = {
  accessSecret: 'test-access-secret-test-access-secret-0123456789',
  refreshSecret: 'test-refresh-secret-test-refresh-secret-0123456789',
  accessTtlSeconds: 900,
  refreshTtlDays: 30,
  // Minimum cost keeps the suite fast; production uses 12.
  bcryptRounds: 4,
};

export function createAuthServices(dataSource: DataSource) {
  const tokens = new TokenService(new JwtService({}), TEST_AUTH_CONFIG);
  const passwords = new PasswordService(TEST_AUTH_CONFIG);
  const auth = new AuthService(dataSource, tokens, passwords);

  return { auth, tokens, passwords };
}

export const uniqueEmail = (prefix = 'user') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test.local`;
