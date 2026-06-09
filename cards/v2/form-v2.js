/**
 * CipherBC "Get Your Cards Demo" — compact inline form (/cards/v2)
 *
 * Submits to the same /.netlify/functions/submit-form endpoint as the
 * main form, so leads fan out to Monday.com, the CipherBC dashboard
 * webhook, and the Google Sheets webhook with UTM tracking.
 */

// ===== API base (mirrors form.js) =====
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8888/.netlify/functions'
    : '/.netlify/functions';

// ===== UTM / tracking helpers (mirrors form.js) =====
function storeUtmParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    if (utmParams.some(p => urlParams.has(p))) {
        utmParams.forEach(p => {
            const v = urlParams.get(p);
            if (v) sessionStorage.setItem(p, v);
        });
        if (!sessionStorage.getItem('landing_page_url')) {
            sessionStorage.setItem('landing_page_url', window.location.href);
        }
    }
}

function getUtmParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(p => {
        out[p] = urlParams.get(p) || sessionStorage.getItem(p) || '';
    });
    return out;
}

function getTrackingData() {
    const urlParams = new URLSearchParams(window.location.search);
    const isInIframe = window.self !== window.top;

    let pageUrl = window.location.href;
    let referrer = document.referrer || 'Direct';

    const landingPageUrl = urlParams.get('landing_page_url');
    if (landingPageUrl) {
        pageUrl = landingPageUrl;
    } else if (isInIframe) {
        const parentUrl = urlParams.get('parent_url');
        if (parentUrl) pageUrl = parentUrl;
        else if (document.referrer) pageUrl = document.referrer;
    }

    if (isInIframe) {
        const parentReferrer = urlParams.get('parent_referrer');
        referrer = parentReferrer || 'Direct (Embedded Form)';
    }

    const utm = getUtmParameters();
    return {
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
        page_url: pageUrl,
        referrer: referrer
    };
}

// ===== DOM =====
const form = document.getElementById('v2-form');
const nameInput = document.getElementById('v2-name');
const emailInput = document.getElementById('v2-email');
const phoneInput = document.getElementById('v2-phone');
const telegramInput = document.getElementById('v2-telegram');
const messageInput = document.getElementById('v2-message');
const submitBtn = document.getElementById('v2-submit');
const errorBox = document.getElementById('v2-error');

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
}
function hideError() {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
}
function setLoading(isLoading) {
    submitBtn.classList.toggle('loading', isLoading);
    submitBtn.disabled = isLoading;
}

// ===== Phone input: only + at start, then digits (mirrors form.js) =====
phoneInput.addEventListener('input', (e) => {
    const v = e.target.value;
    if (v.startsWith('+')) {
        e.target.value = '+' + v.substring(1).replace(/\D/g, '');
    } else {
        e.target.value = v.replace(/\D/g, '');
    }
});

// ===== Submit =====
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const fullName = (nameInput.value || '').trim();
    const productInterest = form.querySelector('input[name="productInterest"]:checked');

    const data = {
        firstName: fullName,
        lastName: '',
        companyName: '',
        email: (emailInput.value || '').trim(),
        phone: (phoneInput.value || '').trim(),
        linkedinUrl: '',
        telegram: (telegramInput.value || '').trim(),
        // Backend + integrations expect an array; tag it as a cards lead.
        productInterest: productInterest ? [`Cards: ${productInterest.value}`] : [],
        message: (messageInput.value || '').trim(),
        ...getTrackingData()
    };

    // ===== Client-side validation =====
    if (!data.firstName || data.firstName.length < 2) {
        showError('Please enter your name.');
        nameInput.focus();
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showError('Please enter a valid work email.');
        emailInput.focus();
        return;
    }
    if (!data.phone.startsWith('+')) {
        showError('Phone number must start with + and country code (e.g., +12025551234).');
        phoneInput.focus();
        return;
    }
    if (data.phone.length > 1 && data.phone[1] === '0') {
        showError('Invalid country code — it cannot start with 0 (e.g., use +1, not +01).');
        phoneInput.focus();
        return;
    }
    if (data.phone.length < 10) {
        showError('Please enter a valid phone number with country code.');
        phoneInput.focus();
        return;
    }
    if (!productInterest) {
        showError('Please select a product interest.');
        return;
    }

    setLoading(true);

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

        // Determine redirect URL (mirrors form.js cards behavior)
        let redirectUrl = 'https://www.cipherbc.com/cards/contact-success';
        let pageUrl;
        if (window.top !== window.self) {
            const urlParams = new URLSearchParams(window.location.search);
            pageUrl = urlParams.get('parent_url') || document.referrer || data.page_url || '';
        } else {
            pageUrl = window.location.href;
        }
        if (pageUrl.includes('/custody/')) {
            redirectUrl = 'https://www.cipherbc.com/custody/contact-success';
        } else if (pageUrl.includes('/cards/')) {
            redirectUrl = 'https://www.cipherbc.com/cards/contact-success';
        }

        if (window.top !== window.self) {
            window.top.location.href = redirectUrl;
        } else {
            window.location.href = redirectUrl;
        }
    } catch (error) {
        console.error('Submit error:', error);
        showError(error.message || 'Something went wrong. Please try again.');
        setLoading(false);
    }
});

// ===== Init =====
storeUtmParameters();
