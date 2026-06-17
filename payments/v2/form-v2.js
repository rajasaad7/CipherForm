/**
 * CipherBC "Get Your Payments Demo" — compact inline form (/payments/v2)
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

// ===== Custom Industry dropdown =====
const industrySelect = document.getElementById('v2-industry');
const industryValue = document.getElementById('v2-industry-value');
const industryTrigger = document.getElementById('v2-industry-trigger');
const industryText = document.getElementById('v2-industry-text');
const industryMenu = document.getElementById('v2-industry-menu');
const industryOptions = Array.from(industryMenu.querySelectorAll('.v2-select-option'));
let industryActiveIndex = -1;

function openIndustryMenu() {
    industrySelect.classList.add('open');
    industryTrigger.setAttribute('aria-expanded', 'true');
    // Highlight the currently selected (or first) option for keyboard nav
    const selectedIdx = industryOptions.findIndex(o => o.classList.contains('selected'));
    setIndustryActive(selectedIdx >= 0 ? selectedIdx : 0);
}

function closeIndustryMenu() {
    industrySelect.classList.remove('open');
    industryTrigger.setAttribute('aria-expanded', 'false');
    setIndustryActive(-1);
}

function setIndustryActive(idx) {
    industryActiveIndex = idx;
    industryOptions.forEach((o, i) => o.classList.toggle('active', i === idx));
    if (idx >= 0) industryOptions[idx].scrollIntoView({ block: 'nearest' });
}

function selectIndustry(option) {
    const value = option.dataset.value;
    industryValue.value = value;
    industryText.textContent = value;
    industryTrigger.classList.remove('is-placeholder');
    industryOptions.forEach(o => o.classList.toggle('selected', o === option));
    closeIndustryMenu();
}

industryTrigger.addEventListener('click', () => {
    if (industrySelect.classList.contains('open')) closeIndustryMenu();
    else openIndustryMenu();
});

industryOptions.forEach((option, i) => {
    option.addEventListener('click', () => selectIndustry(option));
    option.addEventListener('mousemove', () => setIndustryActive(i));
});

// Keyboard support on the trigger
industryTrigger.addEventListener('keydown', (e) => {
    const isOpen = industrySelect.classList.contains('open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { openIndustryMenu(); return; }
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        let next = industryActiveIndex + dir;
        if (next < 0) next = industryOptions.length - 1;
        if (next >= industryOptions.length) next = 0;
        setIndustryActive(next);
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isOpen) openIndustryMenu();
        else if (industryActiveIndex >= 0) selectIndustry(industryOptions[industryActiveIndex]);
    } else if (e.key === 'Escape') {
        closeIndustryMenu();
    }
});

// Close when clicking outside
document.addEventListener('click', (e) => {
    if (!industrySelect.contains(e.target)) closeIndustryMenu();
});

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
    const industry = (industryValue.value || '').trim();

    const data = {
        firstName: fullName,
        lastName: '',
        companyName: '',
        email: (emailInput.value || '').trim(),
        phone: (phoneInput.value || '').trim(),
        linkedinUrl: '',
        telegram: (telegramInput.value || '').trim(),
        industry: industry,
        // Backend + integrations expect an array; tag it as a payments lead.
        productInterest: industry ? [`Payments: ${industry}`] : [],
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
    if (!industry) {
        showError('Please select your industry.');
        industryTrigger.focus();
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

        // Determine redirect URL based on page URL (mirrors form.js exactly)
        let redirectUrl = 'https://www.cipherbc.com/cards/contact-success'; // Default
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
