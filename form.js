// Global state
const state = {
    emailVerified: false,
    otpTimerInterval: null,
    otpExpiryTime: null,
    otpToken: null // Stores the verification token from server
};

/**
 * Get UTM parameters and tracking data (for Google Sheets logging)
 */
function getTrackingData() {
    const urlParams = new URLSearchParams(window.location.search);

    // Determine if we're in an iframe
    const isInIframe = window.self !== window.top;

    let pageUrl = window.location.href;
    let referrer = document.referrer || 'Direct';

    // If in iframe, the parent page URL is in document.referrer
    if (isInIframe && document.referrer) {
        pageUrl = document.referrer; // The page where form is embedded

        // Try to get parent's referrer from URL parameter (passed by embed script)
        const parentReferrer = urlParams.get('parent_referrer');
        if (parentReferrer) {
            referrer = parentReferrer;
        } else {
            // If not available, referrer stays as 'Direct' since we can't access parent's referrer
            referrer = 'Direct (Embedded Form)';
        }
    }

    return {
        utm_source: urlParams.get('utm_source') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        utm_campaign: urlParams.get('utm_campaign') || '',
        utm_term: urlParams.get('utm_term') || '',
        utm_content: urlParams.get('utm_content') || '',
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

/**
 * Start OTP countdown timer
 */
function startOtpTimer(expiryTimeSeconds = 300) {
    // Clear existing timer
    if (state.otpTimerInterval) {
        clearInterval(state.otpTimerInterval);
    }

    state.otpExpiryTime = Date.now() + (expiryTimeSeconds * 1000);

    state.otpTimerInterval = setInterval(() => {
        const remainingMs = state.otpExpiryTime - Date.now();

        if (remainingMs <= 0) {
            clearInterval(state.otpTimerInterval);
            otpTimer.textContent = 'Code expired. Please resend.';
            otpTimer.style.color = '#ef4444';
            sendOtpBtn.textContent = 'Resend OTP';
            sendOtpBtn.disabled = false;
            return;
        }

        const minutes = Math.floor(remainingMs / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);
        otpTimer.textContent = `Code expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
        otpTimer.style.color = remainingMs < 60000 ? '#ef4444' : '#6b7280';
    }, 1000);
}

/**
 * Enable/disable Send OTP button based on email validity
 */
workEmailInput.addEventListener('input', () => {
    const email = workEmailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailRegex.test(email) && !state.emailVerified) {
        sendOtpBtn.disabled = false;
    } else {
        sendOtpBtn.disabled = true;
    }
});

/**
 * Handle Send OTP
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
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send OTP');
        }

        console.log('OTP sent successfully:', data);

        // Store verification token
        state.otpToken = data.token;

        // Show OTP verification field
        otpVerificationRow.style.display = 'flex';

        // Start timer
        startOtpTimer(data.expiresIn || 300);

        // Make email input readonly (not disabled, so FormData still includes it)
        workEmailInput.readOnly = true;
        workEmailInput.style.background = '#f3f4f6';
        sendOtpBtn.textContent = 'OTP Sent';
        sendOtpBtn.style.background = '#FFE066';

        // Focus OTP input
        otpCodeInput.focus();

        // Show success message
        verificationStatus.innerHTML = '✓ OTP sent to your email';
        verificationStatus.className = 'verification-status verified';

    } catch (error) {
        console.error('Send OTP error:', error);
        showError(error.message);
    } finally {
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

    setButtonLoading(verifyOtpBtn, true);

    if (!state.otpToken) {
        verificationStatus.textContent = 'No verification token. Please request a new OTP.';
        verificationStatus.className = 'verification-status error';
        setButtonLoading(verifyOtpBtn, false);
        return;
    }

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

        console.log('OTP verified successfully:', data);

        // Clear timer
        if (state.otpTimerInterval) {
            clearInterval(state.otpTimerInterval);
        }

        // Update state
        state.emailVerified = true;

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
        otpCodeInput.disabled = true;
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.style.background = '#FFE066';
        verifyOtpBtn.textContent = 'Verified';

        // Enable submit button
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Verify OTP error:', error);
        verificationStatus.textContent = error.message;
        verificationStatus.className = 'verification-status error';
    } finally {
        setButtonLoading(verifyOtpBtn, false);
    }
});

/**
 * Handle Form Submission
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    // Check if email is verified
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
            throw new Error(result.error || 'Failed to submit form');
        }

        console.log('Form submitted successfully:', result);

        // Determine redirect URL based on page URL
        let redirectUrl = 'https://www.cipherbc.com/cards/contact-success'; // Default

        const pageUrl = data.page_url || window.location.href;

        if (pageUrl.includes('/custody/')) {
            redirectUrl = 'https://www.cipherbc.com/custody/contact-success';
        } else if (pageUrl.includes('/cards/')) {
            redirectUrl = 'https://www.cipherbc.com/cards/contact-success';
        }

        // Redirect to success page
        window.location.href = redirectUrl;

    } catch (error) {
        console.error('Submit form error:', error);
        showError(error.message);
    } finally {
        setButtonLoading(submitBtn, false);
    }
});

/**
 * Handle Submit Another Form
 */
submitAnotherBtn.addEventListener('click', () => {
    // Reset form
    form.reset();

    // Reset state
    state.emailVerified = false;
    state.otpToken = null;
    if (state.otpTimerInterval) {
        clearInterval(state.otpTimerInterval);
    }

    // Reset UI
    workEmailInput.readOnly = false;
    workEmailInput.style.background = '';
    otpCodeInput.disabled = false;
    verifyOtpBtn.disabled = false;
    submitBtn.disabled = true;
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = 'Send OTP';
    sendOtpBtn.style.background = '';
    verifyOtpBtn.textContent = 'Verify';
    verifyOtpBtn.style.background = '';
    otpVerificationRow.style.display = 'none';
    verificationStatus.textContent = '';
    otpTimer.textContent = '';

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

    // Focus first input
    document.getElementById('firstName').focus();
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
