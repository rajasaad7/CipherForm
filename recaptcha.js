/**
 * Google reCAPTCHA v3 for all forms (/, /cards/v2, /payments/v2).
 *
 * Exposes window.getRecaptchaToken(action) -> Promise<string>.
 * The token is sent along when requesting the email OTP and checked by
 * the send-otp function. Resolves to '' when reCAPTCHA isn't configured
 * (no RECAPTCHA_SITE_KEY on the server) or its script could not load.
 */
(function () {
    const apiBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8888/.netlify/functions'
        : '/.netlify/functions';

    // Google allows hiding the floating badge (it would cover part of the
    // embedded forms) as long as this notice is shown instead.
    const NOTICE = 'This site is protected by reCAPTCHA and the Google '
        + '<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy</a> and '
        + '<a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms of Service</a> apply.';

    const style = document.createElement('style');
    style.textContent = `
        .grecaptcha-badge { visibility: hidden; }
        .recaptcha-notice { display: none; margin-top: 10px; font-size: 11px; line-height: 1.4; text-align: center; color: #9ca3af; }
        .recaptcha-notice a { color: inherit; text-decoration: underline; }
    `;
    document.head.appendChild(style);

    let loading = null; // resolves to the site key once grecaptcha is ready, or null if disabled

    function load() {
        if (!loading) {
            loading = fetch(`${apiBase}/public-config`)
                .then((response) => response.json())
                .then((config) => {
                    const siteKey = config.recaptchaSiteKey;
                    if (!siteKey) return null;

                    return new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
                        script.async = true;
                        script.onload = () => window.grecaptcha.ready(() => {
                            document.querySelectorAll('[data-recaptcha-notice]').forEach((el) => {
                                el.innerHTML = NOTICE;
                                el.style.display = 'block';
                            });
                            resolve(siteKey);
                        });
                        script.onerror = () => reject(new Error('reCAPTCHA script failed to load'));
                        document.head.appendChild(script);
                    });
                })
                .catch((error) => {
                    console.warn('reCAPTCHA unavailable:', error.message);
                    loading = null; // allow another attempt on the next call
                    return null;
                });
        }
        return loading;
    }

    window.getRecaptchaToken = async function (action) {
        try {
            const siteKey = await load();
            if (!siteKey) return '';
            return await window.grecaptcha.execute(siteKey, { action });
        } catch (error) {
            console.warn('reCAPTCHA token error:', error);
            return '';
        }
    };

    // Warm up on page load so the token is instant when the visitor submits
    load();
})();
