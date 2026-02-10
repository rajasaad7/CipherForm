// Global state
const state = {
    emailVerified: false,
    otpTimerInterval: null,
    otpExpiryTime: null
};

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

        // Show OTP verification field
        otpVerificationRow.style.display = 'flex';

        // Start timer
        startOtpTimer(data.expiresIn || 300);

        // Make email input readonly (not disabled, so FormData still includes it)
        workEmailInput.readOnly = true;
        workEmailInput.style.background = '#f3f4f6';
        sendOtpBtn.textContent = 'OTP Sent ✓';
        sendOtpBtn.style.background = '#10b981';

        // Focus OTP input
        otpCodeInput.focus();

        // Show success message
        verificationStatus.textContent = '✓ OTP sent to your email';
        verificationStatus.className = 'verification-status verified';

        setTimeout(() => {
            verificationStatus.textContent = '';
        }, 3000);

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
 * Handle phone number input - ensure it starts with +
 */
phoneNumberInput.addEventListener('input', (e) => {
    let value = e.target.value;

    // If user is typing and doesn't have +, add it
    if (value && !value.startsWith('+')) {
        e.target.value = '+' + value.replace(/[^\d]/g, '');
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

    // Ensure that it's a number or + at the beginning
    const value = e.target.value;
    if (value === '' && e.key === '+') {
        return; // Allow + at the beginning
    }

    // After +, only allow digits
    if ((e.key < '0' || e.key > '9') && e.key !== '+') {
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
        verificationStatus.textContent = '✗ Invalid OTP format';
        verificationStatus.className = 'verification-status error';
        return;
    }

    setButtonLoading(verifyOtpBtn, true);

    try {
        const response = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
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

        // Show success
        verificationStatus.textContent = '✓ Email verified!';
        verificationStatus.className = 'verification-status verified';
        otpTimer.textContent = '';

        // Disable OTP fields
        otpCodeInput.disabled = true;
        verifyOtpBtn.disabled = true;
        verifyOtpBtn.style.background = '#10b981';
        verifyOtpBtn.textContent = 'Verified ✓';

        // Enable submit button
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Verify OTP error:', error);
        verificationStatus.textContent = '✗ ' + error.message;
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

    const data = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        companyName: formData.get('companyName'),
        email: formData.get('workEmail'),
        phone: formData.get('phoneNumber'),
        linkedinUrl: formData.get('linkedinUrl'),
        telegram: formData.get('telegram'),
        productInterest: productInterest,
        message: formData.get('message')
    };

    // Basic validation
    if (!data.firstName || data.firstName.trim().length < 2) {
        showError('Please enter your first name');
        return;
    }

    // Validate phone number format
    if (!data.phone || !data.phone.startsWith('+')) {
        showError('Phone number must start with + followed by country code (e.g., +971501234567)');
        return;
    }

    if (data.phone.length < 10) {
        showError('Please enter a valid phone number with country code');
        return;
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

        // Redirect to success page
        window.location.href = 'https://www.cipherbc.com/card/contact-success';

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
