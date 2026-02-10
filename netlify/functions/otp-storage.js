// Stateless OTP verification using HMAC signatures
// No external storage needed - all data is cryptographically signed
const crypto = require('crypto');

// Get signing secret from environment or generate one
const SECRET = process.env.OTP_SECRET || 'default-secret-change-in-production';

/**
 * Create a signed token containing OTP data
 */
function createOTPToken(email, otp, expiresAt) {
  const data = JSON.stringify({ email, otp, expiresAt });
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('hex');

  return Buffer.from(JSON.stringify({ data, signature })).toString('base64');
}

/**
 * Verify and extract OTP data from token
 */
function verifyOTPToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { data, signature } = decoded;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Parse and return data
    const otpData = JSON.parse(data);
    return { valid: true, data: otpData };
  } catch (error) {
    return { valid: false, error: 'Invalid token' };
  }
}

// In-memory rate limiting (resets when function cold-starts, which is fine)
const rateLimitStore = new Map();

function checkRateLimit(email) {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const record = rateLimitStore.get(key);

  if (!record) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 3600000 });
    return { allowed: true };
  }

  // Reset if window expired
  if (now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 3600000 });
    return { allowed: true };
  }

  // Check limit
  if (record.count >= 10) {
    const minutesLeft = Math.ceil((record.resetAt - now) / 60000);
    return {
      allowed: false,
      message: `Too many OTP requests. Please try again in ${minutesLeft} minute(s).`
    };
  }

  // Increment counter
  record.count++;
  return { allowed: true };
}

module.exports = {
  createOTPToken,
  verifyOTPToken,
  checkRateLimit
};
