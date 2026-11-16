// Use stateless HMAC-based OTP verification
const { verifyOTPToken, createVerifiedToken } = require('./otp-storage');

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
    const { email, otp, token } = JSON.parse(event.body || '{}');

    // Validate input
    if (typeof email !== 'string' || typeof otp !== 'string' || typeof token !== 'string'
        || !email || !otp || !token) {
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
    const result = verifyOTPToken(token, email, otp);

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

    console.log(`OTP verified successfully for ${result.email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        valid: true,
        message: 'OTP verified successfully',
        // Proof of verification — submit-form requires this with the lead
        verificationToken: createVerifiedToken(result.email)
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
