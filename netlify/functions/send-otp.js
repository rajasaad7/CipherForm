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

// Free / personal email providers — blocked to keep submissions B2B-only
const BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'hotmail.co.uk', 'outlook.in',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'gmx.com', 'gmx.us', 'gmx.net',
  'mail.com', 'email.com',
  'zoho.com',
  'yandex.com', 'yandex.ru',
  'qq.com', '163.com', '126.com', 'sina.com',
  'rediffmail.com',
  'fastmail.com', 'tutanota.com', 'hushmail.com',
  'inbox.com', 'mail.ru'
]);

function isFreeEmailDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

/**
 * Normalize email (lowercase and trim)
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Send Email via TrueEmailer API
 */
async function sendEmail(email, otp) {
  const apiKey = process.env.TRUEEMAILER_API_KEY;
  const senderName = process.env.TRUEEMAILER_SENDER || 'CipherBC';
  const senderEmail = process.env.TRUEEMAILER_SENDER_EMAIL || 'noreply@cipherbc.com';

  if (!apiKey) {
    throw new Error('TRUEEMAILER_API_KEY not configured');
  }

  // Abort if TrueEmailer doesn't respond within 8s (Netlify functions cap ~10s)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetch('https://app.trueemailer.com/api/webhook/email/send', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail
        },
        recipientDetails: [
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
                          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #000000; font-family: 'Courier New', monospace;">
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
        `
      })
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Email service timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('TrueEmailer API error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  // Email is already queued at this point; tolerate a non-JSON/empty body
  return await response.json().catch(() => ({ success: true }));
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

    // Block free / personal email providers — work email only
    if (isFreeEmailDomain(normalizedEmail)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Please use your work email. Free providers like Gmail, Outlook, and Yahoo are not accepted.'
        })
      };
    }

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

    // Send Email via TrueEmailer
    try {
      await sendEmail(normalizedEmail, otp);

      console.log(`OTP sent to ${normalizedEmail} (expires at ${new Date(expiresAt).toISOString()})`);

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
