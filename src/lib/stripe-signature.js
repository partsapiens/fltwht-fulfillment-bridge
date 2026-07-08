import crypto from 'node:crypto';

export function parseStripeSignatureHeader(header = '') {
  const entries = header.split(',').map((part) => part.trim()).filter(Boolean);
  const parsed = { timestamp: null, signatures: [] };
  for (const entry of entries) {
    const [key, value] = entry.split('=');
    if (key === 't') parsed.timestamp = Number(value);
    if (key === 'v1' && value) parsed.signatures.push(value);
  }
  return parsed;
}

export function computeStripeSignature({ payload, timestamp, secret }) {
  const signedPayload = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
}

export function verifyStripeSignature({ payload, signatureHeader, secret, toleranceSeconds = 300, nowMs = Date.now() }) {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) throw new Error('invalid_stripe_signature_header');
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) throw new Error('stripe_signature_timestamp_out_of_tolerance');
  const expected = computeStripeSignature({ payload, timestamp: parsed.timestamp, secret });
  const matches = parsed.signatures.some((candidate) => {
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!matches) throw new Error('stripe_signature_verification_failed');
  return { ok: true, timestamp: parsed.timestamp };
}
