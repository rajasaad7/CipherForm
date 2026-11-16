// Google reCAPTCHA v3 — server-side verification helper.
//
// Enabled when RECAPTCHA_SECRET_KEY is set (pair it with
// RECAPTCHA_SITE_KEY, which public-config hands to the browser).
// With no secret configured the check is skipped, so the forms keep
// working on a deployment that hasn't been given keys yet.

const MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

/**
 * Verify a reCAPTCHA v3 token for the expected action.
 * Returns { ok: true } or { ok: false, message }.
 */
async function verifyRecaptcha(token, expectedAction, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    return { ok: true, skipped: true };
  }

  // A missing token means the request skipped the form's script — which
  // is exactly what a bot posting straight to the endpoint does.
  if (!token || typeof token !== 'string') {
    return {
      ok: false,
      message: 'Security check failed. Please refresh the page and try again (disable any ad blocker if the problem continues).'
    };
  }

  let result;
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.append('remoteip', remoteIp);

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(4000)
    });
    result = await response.json();
  } catch (error) {
    // Google unreachable: let the request through rather than lose a real
    // lead. The email OTP still has to be passed.
    console.error('reCAPTCHA verification unavailable, allowing request:', error.message);
    return { ok: true, unavailable: true };
  }

  if (!result.success) {
    console.warn('reCAPTCHA rejected token:', result['error-codes']);
    return {
      ok: false,
      message: 'Security check expired. Please try again.'
    };
  }

  if (result.action !== expectedAction || typeof result.score !== 'number' || result.score < MIN_SCORE) {
    console.warn(`reCAPTCHA blocked request: action=${result.action} score=${result.score} (min ${MIN_SCORE})`);
    return {
      ok: false,
      message: 'We could not verify that you are human. Please try again, or contact us directly if this keeps happening.'
    };
  }

  console.log(`reCAPTCHA passed: action=${result.action} score=${result.score}`);
  return { ok: true, score: result.score };
}

module.exports = { verifyRecaptcha };
