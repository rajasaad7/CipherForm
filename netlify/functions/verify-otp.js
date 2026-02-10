// Use shared file-based storage (works across Netlify Functions)
const storage = require('./otp-storage');

/**
 * Normalize email (lowercase and trim)
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Verify OTP for an email address
 */
async function verifyOTP(email, inputOTP) {
  const normalizedEmail = normalizeEmail(email);
  const stored = await storage.getOTP(normalizedEmail);

  if (!stored) {
    return {
      valid: false,
      message: 'No OTP found. Please request a new OTP.'
    };
  }

  // Check expiry
  if (Date.now() > stored.expiresAt) {
    await storage.deleteOTP(normalizedEmail);
    return {
      valid: false,
      message: 'OTP has expired. Please request a new OTP.'
    };
  }

  // Check OTP match
  if (stored.otp !== inputOTP) {
    return {
      valid: false,
      message: 'Invalid OTP. Please check and try again.'
    };
  }

  // OTP is valid - clean up
  await storage.deleteOTP(normalizedEmail);

  return {
    valid: true,
    message: 'OTP verified successfully'
  };
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, otp } = JSON.parse(event.body);

    // Validate input
    if (!email || !otp) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Email and OTP are required'
        })
      };
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid OTP format. OTP must be 6 digits.'
        })
      };
    }

    // Verify OTP
    const result = await verifyOTP(email, otp);

    if (!result.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: result.message,
          valid: false
        })
      };
    }

    console.log(`OTP verified successfully for ${normalizeEmail(email)}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        valid: true,
        message: result.message
      })
    };

  } catch (error) {
    console.error('Error in verify-otp function:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'An unexpected error occurred. Please try again.'
      })
    };
  }
};
