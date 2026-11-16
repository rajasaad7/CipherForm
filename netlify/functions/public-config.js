// Public, non-secret settings the forms need in the browser.
// The reCAPTCHA *site* key is meant to be public; the secret key never
// leaves the server.
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only advertise the site key when the server can actually verify tokens
  const enabled = Boolean(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      recaptchaSiteKey: enabled ? process.env.RECAPTCHA_SITE_KEY : ''
    })
  };
};
