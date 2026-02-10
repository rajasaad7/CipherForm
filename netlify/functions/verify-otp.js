// Use stateless HMAC-based OTP verification
const { verifyOTPToken } = require('./otp-storage');

/**
 * Normalize email (lowercase and trim)
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Verify OTP using signed token
 */
function verifyOTP(email, inputOTP, token) {
  const normalizedEmail = normalizeEmail(email);

  // Verify token signature
  const tokenResult = verifyOTPToken(token);

  if (!tokenResult.valid) {
    return {
      valid: false,
      message: 'Invalid or tampered verification token. Please request a new OTP.'
    };
  }

  const { email: tokenEmail, otp: tokenOTP, expiresAt } = tokenResult.data;

  // Check email matches
  if (normalizeEmail(tokenEmail) !== normalizedEmail) {
    return {
      valid: false,
      message: 'Email mismatch. Please use the same email you requested OTP for.'
    };
  }

  // Check expiry
  if (Date.now() > expiresAt) {
    return {
      valid: false,
      message: 'OTP has expired. Please request a new OTP.'
    };
  }

  // Check OTP match
  if (tokenOTP !== inputOTP) {
    return {
      valid: false,
      message: 'Invalid OTP. Please check and try again.'
    };
  }

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
    const { email, otp, token } = JSON.parse(event.body);

    // Validate input
    if (!email || !otp || !token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Email, OTP, and verification token are required'
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

    // Verify OTP using token
    const result = verifyOTP(email, otp, token);

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
