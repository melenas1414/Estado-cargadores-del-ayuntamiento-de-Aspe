import { createHmac, createHash, randomBytes, randomInt } from 'node:crypto';

export function generateChallengeToken(): string {
  return randomBytes(24).toString('hex');
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function generateSessionToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashSessionToken(token: string, sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update(token).digest('hex');
}

export function parseCsvSet(value: string | undefined | null): Set<string> {
  return new Set(
    String(value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );
}

export function verifyTelegramLoginHash(payload: Record<string, string>, botToken: string, hash: string): boolean {
  const secretKey = createHash('sha256').update(botToken).digest();
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('\n');

  const hmac = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return hmac === hash;
}
