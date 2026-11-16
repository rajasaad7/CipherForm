// Global state
const state = {
    emailVerified: false,
    otpTimerInterval: null,
    otpExpiryTime: null,
    otpToken: null, // Pairs with the emailed code (from send-otp)
    verificationToken: null // Proof of verification (from verify-otp), sent with the lead
};

/**
 * Store UTM parameters in sessionStorage for cross-page tracking
 */
function storeUtmParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

    // Check if any UTM parameters exist in current URL
    const hasUtm = utmParams.some(param => urlParams.has(param));

    if (hasUtm) {
        // Store each UTM parameter
        utmParams.forEach(param => {
            const value = urlParams.get(param);
            if (value) {
                sessionStorage.setItem(param, value);
            }
        });

        // Store landing page URL
        if (!sessionStorage.getItem('landing_page_url')) {
            sessionStorage.setItem('landing_page_url', window.location.href);
        }

        console.log('UTM parameters stored:', {
            utm_source: sessionStorage.getItem('utm_source'),
            utm_medium: sessionStorage.getItem('utm_medium'),
            utm_campaign: sessionStorage.getItem('utm_campaign')
        });
    }
}

/**
 * Get UTM parameters from URL or sessionStorage (for cross-page tracking)
 */
function getUtmParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {};

    // Priority: URL params > sessionStorage
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
        utmParams[param] = urlParams.get(param) || sessionStorage.getItem(param) || '';
    });

    return utmParams;
}

/**
 * Get UTM parameters and tracking data (for Google Sheets logging)
 */
function getTrackingData() {
    const urlParams = new URLSearchParams(window.location.search);

    // Determine if we're in an iframe
    const isInIframe = window.self !== window.top;

    let pageUrl = window.location.href;
    let referrer = document.referrer || 'Direct';

    // Priority 1: Use landing_page_url from URL parameter (passed by embed script from parent's sessionStorage)
    const landingPageUrl = urlParams.get('landing_page_url');
    if (landingPageUrl) {
        pageUrl = landingPageUrl;
    } else if (isInIframe) {
        // Priority 2: If in iframe, get parent page URL from URL parameter (passed by embed script)
        const parentUrl = urlParams.get('parent_url');
        if (parentUrl) {
            pageUrl = parentUrl;
        } else if (document.referrer) {
            // Fallback to document.referrer
            pageUrl = document.referrer;
        }
    }

    // Get referrer
    if (isInIframe) {
        // Try to get parent's referrer from URL parameter (passed by embed script)
        const parentReferrer = urlParams.get('parent_referrer');
        if (parentReferrer) {
            referrer = parentReferrer;
        } else {
            // If not available, referrer stays as 'Direct' since we can't access parent's referrer
            referrer = 'Direct (Embedded Form)';
        }
    }

    // Get UTM parameters (from URL or sessionStorage)
    const utmParams = getUtmParameters();

    return {
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign,
        utm_term: utmParams.utm_term,
        utm_content: utmParams.utm_content,
        page_url: pageUrl,
        referrer: referrer
    };
}

// API Configuration
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8888/.netlify/functions'
    : '/.netlify/functions';

// DOM Elements
const form = document.getElementById('contact-form');
const workEmailInput = document.getElementById('workEmail');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const otpVerificationRow = document.getElementById('otpVerificationRow');
const otpCodeInput = document.getElementById('otpCode');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const verificationStatus = document.getElementById('verificationStatus');
const otpTimer = document.getElementById('otpTimer');
const changeEmailBtn = document.getElementById('changeEmailBtn');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const successMessage = document.getElementById('successMessage');
const submitAnotherBtn = document.getElementById('submitAnotherBtn');
const phoneNumberInput = document.getElementById('phoneNumber');

/**
 * Show error message
 */
function showError(message) {
    formError.textContent = message;
    formError.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
    formError.textContent = '';
    formError.style.display = 'none';
}

/**
 * Set button loading state
 */
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Seconds before another code can be requested
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Start the OTP countdown: code expiry + resend cooldown
 */
function startOtpTimer(expiryTimeSeconds = 300) {
    // Clear existing timer
    if (state.otpTimerInterval) {
        clearInterval(state.otpTimerInterval);
    }

    state.otpExpiryTime = Date.now() + (expiryTimeSeconds * 1000);
    const resendAt = Date.now() + (RESEND_COOLDOWN_SECONDS * 1000);

    sendOtpBtn.disabled = true;

    const tick = () => {
        const now = Date.now();
        const remainingMs = state.otpExpiryTime - now;
        const resendInMs = resendAt - now;

        if (resendInMs > 0) {
            sendOtpBtn.textContent = `Resend in ${Math.ceil(resendInMs / 1000)}s`;
        } else {
            sendOtpBtn.textContent = 'Resend OTP';
            sendOtpBtn.disabled = false;
        }

        if (remainingMs <= 0) {
            clearInterval(state.otpTimerInterval);
            otpTimer.textContent = 'Code expired. Please resend.';
            otpTimer.style.color = '#ef4444';
            return;
        }

        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        otpTimer.textContent = `Code expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        otpTimer.style.color = remainingMs < 60000 ? '#ef4444' : '#6b7280';
    };

    tick();
    state.otpTimerInterval = setInterval(tick, 1000);
}

/**
 * Enable/disable Send OTP button based on email validity
 */
function updateSendOtpButton() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const formatValid = emailRegex.test(workEmailInput.value.trim());
    sendOtpBtn.disabled = !(formatValid && !state.emailVerified);
}

workEmailInput.addEventListener('input', updateSendOtpButton);

/**
 * Put the email + OTP fields back to their unverified starting state
 */
function resetEmailVerification() {
    if (state.otpTimerInterval) {
        clearInterval(state.otpTimerInterval);
    }

    state.emailVerified = false;
    state.otpToken = null;
    state.verificationToken = null;

    workEmailInput.readOnly = false;
    workEmailInput.style.background = '';

    otpVerificationRow.style.display = 'none';
    otpCodeInput.value = '';
    otpCodeInput.disabled = false;
    verifyOtpBtn.classList.remove('loading');
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.textContent = 'Verify';
    verifyOtpBtn.style.background = '';
    verificationStatus.textContent = '';
    verificationStatus.className = 'verification-status';
    otpTimer.textContent = '';

    sendOtpBtn.classList.remove('loading');
    sendOtpBtn.textContent = 'Send OTP';
    updateSendOtpButton();

    submitBtn.disabled = true;
}

/**
 * Handle Send OTP (and Resend OTP)
 */
sendOtpBtn.addEventListener('click', async () => {
    hideError();
    const email = workEmailInput.value.trim();

    if (!email) {
        showError('Please enter your email address');
        return;
    }

    setButtonLoading(sendOtpBtn, true);

    try {
        const response = await fetch(`${API_BASE}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, recaptchaToken: await getRecaptchaToken('send_otp') })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send OTP');
        }

        // Store the token that pairs with the emailed code
        state.otpToken = data.token;

        // Show OTP verification field
        otpVerificationRow.style.display = 'flex';
        otpCodeInput.value = '';

        // Lock the email (readonly, not disabled, so FormData still includes it)
        workEmailInput.readOnly = true;
        workEmailInput.style.background = '#f3f4f6';

        // Remove the spinner, then start the timer (keeps the button
        // disabled until the resend cooldown passes)
        sendOtpBtn.classList.remove('loading');
        startOtpTimer(data.expiresIn || 300);

        // Focus OTP input
        otpCodeInput.focus();

        // Show success message
        verificationStatus.innerHTML = '✓ OTP sent to your email';
        verificationStatus.className = 'verification-status verified';

    } catch (error) {
        console.error('Send OTP error:', error);
        showError(error.message);
        // Only re-enable button on error
        setButtonLoading(sendOtpBtn, false);
    }
});

/**
 * Handle OTP input formatting
 */
otpCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
});

/**
 * Handle phone number input - only allow + at start and numbers
 */
phoneNumberInput.addEventListener('input', (e) => {
    let value = e.target.value;

    // Remove all non-digit characters except + at the start
    if (value.startsWith('+')) {
        e.target.value = '+' + value.substring(1).replace(/\D/g, '');
    } else {
        // If doesn't start with +, remove all non-digits
        e.target.value = value.replace(/\D/g, '');
    }
});

phoneNumberInput.addEventListener('keydown', (e) => {
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
        return;
    }

    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // Only allow + if field is empty or cursor is at position 0 and no + exists
    if (e.key === '+') {
        if (value === '' || (cursorPosition === 0 && !value.startsWith('+'))) {
            return;
        }
        e.preventDefault();
        return;
    }

    // Only allow digits after validation
    if (e.key < '0' || e.key > '9') {
        e.preventDefault();
    }
});

/**
 * Handle Verify OTP
 */
verifyOtpBtn.addEventListener('click', async () => {
    hideError();
    const email = workEmailInput.value.trim();
    const otp = otpCodeInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
        verificationStatus.textContent = 'Invalid OTP format';
        verificationStatus.className = 'verification-status error';
        return;
    }

    if (!state.otpToken) {
        verificationStatus.textContent = 'No verification token. Please request a new OTP.';
        verificationStatus.className = 'verification-status error';
        return;
    }

    setButtonLoading(verifyOtpBtn, true);

    try {
        const response = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, token: state.otpToken })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Invalid OTP');
        }

        // Clear timer
        if (state.otpTimerInterval) {
            clearInterval(state.otpTimerInterval);
        }

        // Update state
        state.emailVerified = true;
        state.verificationToken = data.verificationToken;

        // Show success with green tick icon
        verificationStatus.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 6px;">
                <circle cx="10" cy="10" r="10" fill="#10b981"/>
                <path d="M6 10L8.5 12.5L14 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Email verified!
        `;
        verificationStatus.className = 'verification-status verified';
        otpTimer.textContent = '';

        // Disable OTP fields
        verifyOtpBtn.classList.remove('loading');
        otpCodeInput.disabled = true;
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.style.background = '#FFE066';
        verifyOtpBtn.textContent = 'Verified';
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = 'Verified';

        // Enable submit button
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Verify OTP error:', error);
        verificationStatus.textContent = error.message;
        verificationStatus.className = 'verification-status error';
        setButtonLoading(verifyOtpBtn, false);
    }
});

/**
 * Enter in the OTP field verifies the code
 */
otpCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        verifyOtpBtn.click();
    }
});

/**
 * Let the user correct a mistyped email (drops any verification in progress)
 */
changeEmailBtn.addEventListener('click', () => {
    hideError();
    resetEmailVerification();
    workEmailInput.focus();
});

/**
 * Handle Form Submission
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    if (!state.emailVerified) {
        showError('Please verify your email address first');
        return;
    }

    // Collect form data
    const formData = new FormData(form);

    // Get all product interests
    const productInterest = [];
    formData.getAll('productInterest').forEach(value => {
        productInterest.push(value);
    });

    // Get tracking data
    const trackingData = getTrackingData();

    const data = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        companyName: formData.get('companyName'),
        email: formData.get('workEmail'),
        phone: formData.get('phoneNumber'),
        linkedinUrl: formData.get('linkedinUrl'),
        telegram: formData.get('telegram'),
        productInterest: productInterest,
        message: formData.get('message'),
        verificationToken: state.verificationToken, // Proof the email passed OTP (checked server-side)
        ...trackingData // Include UTM params and tracking data
    };

    // Basic validation
    if (!data.firstName || data.firstName.trim().length < 2) {
        showError('Please enter your first name');
        return;
    }

    // Validate phone number format
    if (!data.phone || !data.phone.startsWith('+')) {
        showError('Phone number must start with + followed by country code (e.g., +12025551234)');
        return;
    }

    // Check if country code starts with 0 (invalid)
    if (data.phone.length > 1 && data.phone[1] === '0') {
        showError('Invalid country code. Country codes cannot start with 0 (e.g., use +1, not +01)');
        return;
    }

    if (data.phone.length < 10) {
        showError('Please enter a valid phone number with country code');
        return;
    }

    // Validate LinkedIn URL if provided
    if (data.linkedinUrl && data.linkedinUrl.trim().length > 0) {
        const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w\-]+\/?$/i;
        if (!linkedinRegex.test(data.linkedinUrl.trim())) {
            showError('Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/yourprofile)');
            return;
        }
    }

    setButtonLoading(submitBtn, true);

    try {
        const response = await fetch(`${API_BASE}/submit-form`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            const submitError = new Error(result.error || 'Failed to submit form');
            submitError.code = result.code;
            throw submitError;
        }

        console.log('Form submitted successfully:', result);

        // Determine redirect URL based on page URL
        let redirectUrl = 'https://www.cipherbc.com/cards/contact-success'; // Default
        let pageUrl;

        // Get the correct page URL
        if (window.top !== window.self) {
            // In iframe - use parent_url parameter (most reliable) or fallback
            const urlParams = new URLSearchParams(window.location.search);
            const parentUrl = urlParams.get('parent_url');
            pageUrl = parentUrl || document.referrer || data.page_url || '';
        } else {
            // Direct access - use current URL
            pageUrl = window.location.href;
        }

        console.log('Page URL for redirect:', pageUrl);

        if (pageUrl.includes('/custody/')) {
            redirectUrl = 'https://www.cipherbc.com/custody/contact-success';
        } else if (pageUrl.includes('/cards/')) {
            redirectUrl = 'https://www.cipherbc.com/cards/contact-success';
        }

        console.log('Redirecting to:', redirectUrl);

        // Redirect parent window (or self if not in iframe)
        if (window.top !== window.self) {
            // We're in an iframe, redirect the parent
            window.top.location.href = redirectUrl;
        } else {
            // Direct access, redirect normally
            window.location.href = redirectUrl;
        }

    } catch (error) {
        console.error('Submit form error:', error);
        // Server no longer accepts our proof of verification — start over
        if (error.code === 'EMAIL_NOT_VERIFIED') {
            resetEmailVerification();
        }
        showError(error.message);
    } finally {
        setButtonLoading(submitBtn, false);
        submitBtn.disabled = !state.emailVerified;
    }
});

/**
 * Handle Submit Another Form
 */
submitAnotherBtn.addEventListener('click', () => {
    // Reset form
    form.reset();

    // Reset state + OTP UI: the next submission must verify its email again
    resetEmailVerification();

    // Show form
    form.style.display = 'block';
    successMessage.style.display = 'none';

    // Focus first input
    document.getElementById('firstName').focus();
});

/**
 * Handle message character counter
 */
const messageInput = document.getElementById('message');
const charCount = document.getElementById('charCount');

messageInput.addEventListener('input', () => {
    const count = messageInput.value.length;
    charCount.textContent = `${count} of 500`;

    // Change color when approaching limit
    if (count > 450) {
        charCount.style.color = '#ef4444'; // Red
    } else if (count > 400) {
        charCount.style.color = '#f59e0b'; // Orange
    } else {
        charCount.style.color = '#6b7280'; // Gray
    }
});

/**
 * Initialize form
 */
function init() {
    console.log('Contact Form initialized');
    console.log('API Base:', API_BASE);

    // Store UTM parameters if present in URL
    storeUtmParameters();

    // Focus first input
    document.getElementById('firstName').focus();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
