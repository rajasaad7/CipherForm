/**
 * Email OTP step for the compact v2 forms (/cards/v2, /payments/v2).
 *
 * Flow: the visitor fills the form and presses submit -> a 6-digit code
 * is emailed -> this panel replaces the form and asks for the code ->
 * once verify-otp accepts it, `onVerified(verificationToken)` runs and
 * the page submits the lead with that token. submit-form rejects leads
 * without it.
 *
 * Usage:
 *   const otpStep = createOtpStep({ apiBase, form, mount, onVerified });
 *   await otpStep.start(email);   // throws if the code could not be sent
 */
(function () {
    const RESEND_COOLDOWN_SECONDS = 30;

    const CSS = `
        .otp-step { display: none; text-align: center; padding: 8px 0 4px; }
        .otp-step h2 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
        .otp-step-text { font-size: 14px; color: var(--text-muted, #6b7280); margin-bottom: 16px; overflow-wrap: anywhere; }
        .otp-step-text strong { color: var(--text, #1a1a1a); font-weight: 600; }
        .otp-step-code {
            display: block; width: 100%; max-width: 240px; margin: 0 auto 14px;
            padding: 14px 12px; font-family: inherit; font-size: 24px; font-weight: 600;
            letter-spacing: 8px; text-align: center; color: var(--text, #1a1a1a);
            background: var(--field-bg, #f4f4f5); border: 1px solid var(--field-border, #e7e7ea);
            border-radius: 12px; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .otp-step-code::placeholder { color: #c4c4cc; }
        .otp-step-code:focus {
            outline: none; background: #fff; border-color: var(--yellow, #F5E050);
            box-shadow: 0 0 0 3px rgba(245, 224, 80, 0.35);
        }
        .otp-step-error { text-align: left; }
        .otp-step-info { min-height: 18px; margin-top: 12px; font-size: 13px; color: var(--text-muted, #6b7280); }
        .otp-step-links { margin-top: 6px; font-size: 13px; color: var(--text-muted, #6b7280); }
        .otp-step-links button {
            padding: 4px 2px; font: inherit; font-weight: 600; color: var(--text, #1a1a1a);
            background: none; border: none; text-decoration: underline; cursor: pointer;
        }
        .otp-step-links button:disabled { font-weight: 400; color: #9ca3af; text-decoration: none; cursor: default; }
    `;

    function createOtpStep({ apiBase, form, mount, onVerified }) {
        if (!document.getElementById('otp-step-styles')) {
            const style = document.createElement('style');
            style.id = 'otp-step-styles';
            style.textContent = CSS;
            document.head.appendChild(style);
        }

        mount.classList.add('otp-step');
        mount.innerHTML = `
            <h2>Verify your email</h2>
            <p class="otp-step-text">Enter the 6-digit code we sent to <strong data-otp="email"></strong></p>
            <div class="v2-error otp-step-error" data-otp="error" role="alert"></div>
            <input type="text" class="otp-step-code" data-otp="code" inputmode="numeric"
                   autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="Verification code">
            <button type="button" class="v2-submit" data-otp="verify">
                <span class="v2-submit-text">Verify &amp; Submit</span>
                <span class="v2-loader"></span>
            </button>
            <p class="otp-step-info" data-otp="info"></p>
            <p class="otp-step-links">
                <button type="button" data-otp="resend">Resend code</button>
                &nbsp;·&nbsp;
                <button type="button" data-otp="change">Change email</button>
            </p>
        `;

        const el = (name) => mount.querySelector(`[data-otp="${name}"]`);
        const emailEl = el('email');
        const errorEl = el('error');
        const codeInput = el('code');
        const verifyBtn = el('verify');
        const infoEl = el('info');
        const resendBtn = el('resend');
        const changeBtn = el('change');

        let email = '';
        let otpToken = null;   // pairs with the emailed code
        let proof = null;      // verification token, once the code is accepted
        let cooldownTimer = null;

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
        function hideError() {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        function setLoading(isLoading) {
            verifyBtn.classList.toggle('loading', isLoading);
            verifyBtn.disabled = isLoading;
        }

        function startCooldown() {
            clearInterval(cooldownTimer);
            const resendAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
            const tick = () => {
                const left = Math.ceil((resendAt - Date.now()) / 1000);
                if (left > 0) {
                    resendBtn.disabled = true;
                    resendBtn.textContent = `Resend code in ${left}s`;
                } else {
                    clearInterval(cooldownTimer);
                    resendBtn.disabled = false;
                    resendBtn.textContent = 'Resend code';
                }
            };
            tick();
            cooldownTimer = setInterval(tick, 1000);
        }

        async function sendCode(targetEmail) {
            const response = await fetch(`${apiBase}/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Could not send the verification code. Please try again.');
            }
            email = targetEmail;
            otpToken = data.token;
            proof = null;
        }

        function show() {
            emailEl.textContent = email;
            codeInput.value = '';
            infoEl.textContent = 'The code expires in 5 minutes. Check your spam folder if you don\'t see it.';
            hideError();
            setLoading(false);
            startCooldown();
            form.style.display = 'none';
            mount.style.display = 'block';
            codeInput.focus();
        }

        function hide() {
            clearInterval(cooldownTimer);
            mount.style.display = 'none';
            form.style.display = '';
        }

        async function verify() {
            hideError();

            setLoading(true);
            try {
                if (!proof) {
                    const code = codeInput.value.trim();
                    if (!/^\d{6}$/.test(code)) {
                        throw new Error('Please enter the 6-digit code from the email.');
                    }
                    const response = await fetch(`${apiBase}/verify-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, otp: code, token: otpToken })
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data.error || 'Invalid code. Please check and try again.');
                    }
                    proof = data.verificationToken;
                }

                // Page submits the lead; the button stays in its loading
                // state while the success redirect happens.
                await onVerified(proof);
            } catch (error) {
                if (error.code === 'EMAIL_NOT_VERIFIED') {
                    proof = null;
                    codeInput.value = '';
                }
                showError(error.message || 'Something went wrong. Please try again.');
                setLoading(false);
            }
        }

        codeInput.addEventListener('input', () => {
            codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
        });
        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                verify();
            }
        });
        verifyBtn.addEventListener('click', verify);

        resendBtn.addEventListener('click', async () => {
            hideError();
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending…';
            try {
                await sendCode(email);
                codeInput.value = '';
                infoEl.textContent = 'A new code is on its way. Earlier codes still work until they expire.';
                codeInput.focus();
            } catch (error) {
                showError(error.message);
            }
            startCooldown();
        });

        changeBtn.addEventListener('click', hide);

        return {
            /**
             * Begin verification for `targetEmail`. Resolves once the code
             * panel is showing (or, if this email was already verified in
             * this session, once the lead has been submitted). Rejects if
             * the code could not be sent, so the caller can show the error
             * on the form.
             */
            async start(targetEmail) {
                if (proof && email === targetEmail) {
                    try {
                        await onVerified(proof);
                        return;
                    } catch (error) {
                        if (error.code !== 'EMAIL_NOT_VERIFIED') throw error;
                        proof = null; // proof expired — fall through and send a fresh code
                    }
                }
                await sendCode(targetEmail);
                show();
            }
        };
    }

    window.createOtpStep = createOtpStep;
})();
