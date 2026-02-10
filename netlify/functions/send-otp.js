// Use stateless HMAC-based OTP storage
const { createOTPToken, checkRateLimit } = require('./otp-storage');

// Configuration
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a random 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize email (lowercase and trim)
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Send Email via Brevo API
 */
async function sendEmail(email, otp) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER || 'CipherBC';
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@cipherbc.com';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: email
        }
      ],
      subject: `Your verification code is ${otp}`,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Verify Your Email</h1>
                      <p style="margin: 0 0 30px; color: #6b7280; font-size: 16px; line-height: 1.5;">
                        Use the verification code below to complete your form submission:
                      </p>
                      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb; font-family: 'Courier New', monospace;">
                          ${otp}
                        </div>
                      </div>
                      <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
                        This code will expire in <strong>5 minutes</strong>. Do not share this code with anyone.
                      </p>
                      <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
                        If you didn't request this code, please ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                        © ${new Date().getFullYear()} ${senderName}. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      textContent: `Your verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Brevo API error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  return await response.json();
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
    const { email } = JSON.parse(event.body);

    // Validate email
    if (!email || !isValidEmail(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid email address'
        })
      };
    }

    const normalizedEmail = normalizeEmail(email);

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(normalizedEmail);
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: rateLimitCheck.message })
      };
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Create signed token (stateless - no storage needed)
    const token = createOTPToken(normalizedEmail, otp, expiresAt);

    // Send Email via Brevo
    try {
      await sendEmail(normalizedEmail, otp);

      console.log(`OTP sent to ${normalizedEmail}: ${otp} (expires at ${new Date(expiresAt).toISOString()})`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'OTP sent to your email',
          token: token, // Client must send this back for verification
          expiresIn: OTP_EXPIRY_MS / 1000 // seconds
        })
      };
    } catch (emailError) {
      console.error('Email sending error:', emailError);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to send email. Please try again.'
        })
      };
    }

  } catch (error) {
    console.error('Error in send-otp function:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'An unexpected error occurred. Please try again.'
      })
    };
  }
};
