import authConfig from './auth.config';

const STRONG_A = 'a'.repeat(40);
const STRONG_B = 'b'.repeat(40);

describe('auth config', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = STRONG_A;
    process.env.JWT_REFRESH_SECRET = STRONG_B;
    delete process.env.JWT_ACCESS_TTL_SECONDS;
    delete process.env.REFRESH_TOKEN_TTL_DAYS;
    delete process.env.BCRYPT_ROUNDS;
  });

  afterAll(() => {
    process.env = original;
  });

  it('loads secure defaults', () => {
    expect(authConfig()).toEqual({
      accessSecret: STRONG_A,
      refreshSecret: STRONG_B,
      accessTtlSeconds: 900,
      refreshTtlDays: 30,
      bcryptRounds: 12,
    });
  });

  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])(
    'refuses to start when %s is missing',
    (name) => {
      delete process.env[name];
      expect(() => authConfig()).toThrow(name);
    },
  );

  it('refuses a short secret', () => {
    process.env.JWT_ACCESS_SECRET = 'too-short';
    expect(() => authConfig()).toThrow(/at least 32/);
  });

  it('refuses identical access and refresh secrets', () => {
    process.env.JWT_REFRESH_SECRET = STRONG_A;
    expect(() => authConfig()).toThrow(/must be different/);
  });

  it.each([
    ['BCRYPT_ROUNDS', '3'],
    ['BCRYPT_ROUNDS', 'abc'],
    ['JWT_ACCESS_TTL_SECONDS', '5'],
    ['REFRESH_TOKEN_TTL_DAYS', '0'],
  ])('rejects out-of-range %s=%s', (name, value) => {
    process.env[name] = value;
    expect(() => authConfig()).toThrow(name);
  });
});
