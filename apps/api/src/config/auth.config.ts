import { registerAs } from '@nestjs/config';

const MIN_SECRET_LENGTH = 32;

function readSecret(name: string): string {
  const value = process.env[name];

  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be set to a random string of at least ${MIN_SECRET_LENGTH} characters ` +
        '(generate one with: openssl rand -base64 48)',
    );
  }

  return value;
}

function readInt(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return value;
}

/**
 * Evaluated while the config module loads, so a missing or weak secret stops
 * the application from booting instead of failing on the first login.
 */
export default registerAs('auth', () => {
  const accessSecret = readSecret('JWT_ACCESS_SECRET');
  const refreshSecret = readSecret('JWT_REFRESH_SECRET');

  if (accessSecret === refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    );
  }

  return {
    accessSecret,
    // Keys the HMAC that hashes refresh tokens before they are stored.
    refreshSecret,
    accessTtlSeconds: readInt('JWT_ACCESS_TTL_SECONDS', 15 * 60, 60, 24 * 3600),
    refreshTtlDays: readInt('REFRESH_TOKEN_TTL_DAYS', 30, 1, 365),
    bcryptRounds: readInt('BCRYPT_ROUNDS', 12, 4, 15),
  };
});
