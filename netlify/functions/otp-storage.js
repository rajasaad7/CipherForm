// Stateless email verification using HMAC-signed tokens.
// No external storage needed — the server signs what it hands out and
// re-checks the signature when it comes back.
//
// Two tokens are involved:
//   1. OTP token      — issued by send-otp. Binds (email, expiry, code)
//                       WITHOUT containing the code, so reading the token
//                       in the browser does not reveal it.
//   2. Verified token — issued by verify-otp once the code is correct.
//                       submit-form refuses any lead that doesn't carry
//                       one for the submitted email.
const crypto = require('crypto');

const VERIFIED_TTL_MS = 2 * 60 * 60 * 1000; // time allowed to finish the form after verifying
const MAX_OTP_ATTEMPTS = 5;                 // wrong codes allowed per OTP token
const MAX_SUBMITS_PER_VERIFICATION = 3;     // leaves room for a retry after a network blip

/**
 * Signing secret. OTP_SECRET if set; otherwise derived from the
 * TrueEmailer API key, which is always present wherever OTP emails can
 * be sent. There is deliberately no hard-coded fallback.
 */
function getSecret() {
  if (process.env.OTP_SECRET) return process.env.OTP_SECRET;
  if (process.env.TRUEEMAILER_API_KEY) {
    return crypto
      .createHmac('sha256', process.env.TRUEEMAILER_API_KEY)
      .update('cipherform-otp-signing-key')
      .digest('hex');
  }
  throw new Error('No signing secret: set OTP_SECRET or TRUEEMAILER_API_KEY');
}

function sign(...parts) {
  return crypto.createHmac('sha256', getSecret()).update(parts.join('|')).digest('hex');
}

function signaturesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function encode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function decode(token) {
  try {
    const obj = JSON.parse(Buffer.from(String(token), 'base64url').toString());
    return obj && typeof obj === 'object' ? obj : null;
  } catch (_) {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

/**
 * Best-effort in-memory counters. They reset when the function
 * cold-starts and aren't shared between instances, which is acceptable
 * for throttling abuse without adding a database.
 */
const counters = new Map();

function hit(key, max, windowMs) {
  const now = Date.now();

  if (counters.size > 5000) {
    for (const [k, record] of counters) {
      if (now > record.resetAt) counters.delete(k);
    }
  }

  const record = counters.get(key);
  if (!record || now > record.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= max) {
    return { allowed: false, minutesLeft: Math.ceil((record.resetAt - now) / 60000) };
  }
  record.count++;
  return { allowed: true };
}

/**
 * Limit OTP emails per recipient and per requesting IP.
 */
function checkRateLimit(email, ip) {
  const HOUR = 60 * 60 * 1000;
  const checks = [hit(`email:${normalizeEmail(email)}`, 10, HOUR)];
  if (ip) checks.push(hit(`ip:${ip}`, 30, HOUR));

  const blocked = checks.find((c) => !c.allowed);
  if (blocked) {
    return {
      allowed: false,
      message: `Too many OTP requests. Please try again in ${blocked.minutesLeft} minute(s).`
    };
  }
  return { allowed: true };
}

/**
 * Create the token returned to the browser alongside the emailed code.
 */
function createOTPToken(email, otp, expiresAt) {
  const e = normalizeEmail(email);
  const n = crypto.randomBytes(12).toString('hex');
  return encode({ e, x: expiresAt, n, s: sign('otp', e, expiresAt, n, otp) });
}

/**
 * Check a submitted code against its OTP token.
 */
function verifyOTPToken(token, email, otp) {
  const t = decode(token);
  if (!t || !t.e || !t.x || !t.n || !t.s) {
    return { valid: false, message: 'Invalid verification token. Please request a new OTP.' };
  }
  if (t.e !== normalizeEmail(email)) {
    return { valid: false, message: 'Email mismatch. Please use the same email you requested OTP for.' };
  }
  if (Date.now() > Number(t.x)) {
    return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
  }

  const attemptsKey = `attempts:${t.n}`;
  const attempts = counters.get(attemptsKey);
  if (attempts && attempts.count >= MAX_OTP_ATTEMPTS) {
    return { valid: false, message: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  if (!signaturesMatch(t.s, sign('otp', t.e, t.x, t.n, String(otp)))) {
    hit(attemptsKey, MAX_OTP_ATTEMPTS, Math.max(Number(t.x) - Date.now(), 1000));
    return { valid: false, message: 'Invalid OTP. Please check and try again.' };
  }

  return { valid: true, email: t.e };
}

/**
 * Create the proof-of-verification the browser must send with the lead.
 */
function createVerifiedToken(email) {
  const e = normalizeEmail(email);
  const x = Date.now() + VERIFIED_TTL_MS;
  const n = crypto.randomBytes(12).toString('hex');
  return encode({ e, x, n, s: sign('verified', e, x, n) });
}

/**
 * Check that a lead's email was verified. Each proof is accepted for a
 * small number of submissions so one verification can't be replayed
 * into a flood of leads.
 */
function checkVerifiedToken(token, email) {
  const t = decode(token);
  if (!t || !t.e || !t.x || !t.n || !t.s) return { valid: false };
  if (!signaturesMatch(t.s, sign('verified', t.e, t.x, t.n))) return { valid: false };
  if (t.e !== normalizeEmail(email)) return { valid: false };
  if (Date.now() > Number(t.x)) return { valid: false, expired: true };

  const use = hit(`used:${t.n}`, MAX_SUBMITS_PER_VERIFICATION, VERIFIED_TTL_MS);
  if (!use.allowed) return { valid: false, expired: true };

  return { valid: true };
}

module.exports = {
  normalizeEmail,
  generateOTP,
  checkRateLimit,
  createOTPToken,
  verifyOTPToken,
  createVerifiedToken,
  checkVerifiedToken
};
