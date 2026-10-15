/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate LinkedIn URL format
 */
function isValidLinkedInUrl(url) {
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|company)\/[\w\-]+\/?$/i;
  return linkedinRegex.test(url);
}

/**
 * Validate form data
 */
function validateFormData(data) {
  const errors = [];

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters');
  }

  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Valid email address is required');
  }

  if (!data.phone || !data.phone.trim().startsWith('+')) {
    errors.push('Phone number must start with + and include country code');
  } else if (data.phone.trim().length > 1 && data.phone.trim()[1] === '0') {
    errors.push('Invalid country code. Country codes cannot start with 0');
  } else if (data.phone.trim().length < 10) {
    errors.push('Valid phone number with country code is required');
  }

  // Validate LinkedIn URL if provided
  if (data.linkedinUrl && data.linkedinUrl.trim().length > 0) {
    if (!isValidLinkedInUrl(data.linkedinUrl.trim())) {
      errors.push('Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/yourprofile)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Send form data to the CipherBC CRM's lead-intake webhook.
 * This is the source of truth for leads.
 *
 * Auth: HMAC-SHA256 of the raw body, signed with
 * CIPHERFORM_WEBHOOK_SECRET, sent in X-CipherBC-Signature.
 *
 * Idempotent: the CRM RPC dedupes on (org, lower(email)), so a
 * resubmit of the same email returns existed=true rather than failing.
 *
 * Fire-and-forget posture: errors logged, never propagated to the
 * user. The form's success path doesn't depend on this destination.
 */
async function sendToCipherBc(data) {
  const url = process.env.CIPHERFORM_WEBHOOK_URL;
  const secret = process.env.CIPHERFORM_WEBHOOK_SECRET;

  if (!url || !secret) {
    console.log('CipherBC webhook not configured — skipping');
    return { success: true, skipped: true };
  }

  try {
    // Use Node's built-in crypto on Netlify Functions (Node runtime).
    // Browser polyfills are not needed here.
    const crypto = require('node:crypto');

    const payload = {
      // Identity
      firstName: data.firstName,
      lastName: data.lastName || '',
      fullName: [data.firstName, data.lastName].filter(Boolean).join(' '),
      company: data.companyName || '',
      email: data.email,
      phone: data.phone,
      linkedinUrl: data.linkedinUrl || '',
      telegram: data.telegram || '',
      productInterest: Array.isArray(data.productInterest)
        ? data.productInterest.join(', ')
        : (data.productInterest || ''),
      message: data.message || '',

      // Source attribution (typed, in the canonical naming the
      // CRM's RPC expects — utmSource not utm_source).
      utmSource: data.utm_source || '',
      utmMedium: data.utm_medium || '',
      utmCampaign: data.utm_campaign || '',
      utmTerm: data.utm_term || '',
      utmContent: data.utm_content || '',
      pageUrl: data.page_url || '',
      referrer: data.referrer || '',

      // Provenance
      submittedAt: data.submittedAt || new Date().toISOString(),
      source: 'cipherform'
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // There is no queue behind this call — a failed sync is a lost
    // lead until someone replays the Sheets log. The CRM can
    // 502 transiently (cold boot, upstream hiccup), so retry once
    // after a short pause. Each attempt is capped at 8s so both
    // attempts plus the pause fit inside the function's time budget.
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CipherBC-Signature': signature
          },
          body: rawBody,
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '<no-body>');
          throw new Error(`CipherBC webhook ${response.status}: ${errBody}`);
        }

        const result = await response.json().catch(() => ({}));
        console.log(
          '✓ Lead synced to CipherBC CRM',
          result.existed ? '(already existed)' : `(new id: ${result.leadId})`
        );
        return { success: true, leadId: result.leadId, existed: result.existed };
      } catch (error) {
        lastError = error;
        console.warn(`CipherBC attempt ${attempt}/2 failed:`, error.message);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    console.error('CipherBC webhook error:', lastError.message);
    // Never fail the form submission on this branch — it's auxiliary.
    return { success: false, error: lastError.message };
  } catch (error) {
    console.error('CipherBC webhook error:', error.message);
    // Never fail the form submission on this branch — it's auxiliary.
    return { success: false, error: error.message };
  }
}

/**
 * Send form data to webhook (Google Sheets) with UTM tracking
 */
async function sendToWebhook(data) {
  const webhookUrl = process.env.FORM_SUBMISSION_WEBHOOK;

  if (!webhookUrl) {
    console.log('No webhook configured - skipping webhook submission');
    return { success: true, skipped: true };
  }

  try {
    const payload = {
      // Contact Information
      firstName: data.firstName,
      lastName: data.lastName || '',
      companyName: data.companyName || '',
      email: data.email,
      phone: data.phone,
      linkedinUrl: data.linkedinUrl || '',
      telegram: data.telegram || '',
      productInterest: data.productInterest ? data.productInterest.join(', ') : '',
      message: data.message || '',

      // UTM Tracking Parameters
      utmSource: data.utm_source || '',
      utmMedium: data.utm_medium || '',
      utmCampaign: data.utm_campaign || '',
      utmTerm: data.utm_term || '',
      utmContent: data.utm_content || '',

      // Page Tracking
      pageUrl: data.page_url || '',
      referrer: data.referrer || 'Direct',

      // Metadata
      timestamp: new Date().toISOString(),
      source: 'otp-form'
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    console.log('✓ Data logged to Google Sheets with UTM tracking');
    return { success: true };
  } catch (error) {
    console.error('Webhook error:', error);
    // Don't fail the form submission if webhook fails
    return { success: false, error: error.message };
  }
}

/**
 * Lark card text is "lark_md". Strip angle brackets so user input can't
 * inject <at> / <a> tags, and collapse whitespace so the card stays tidy.
 */
function larkText(value, max = 600) {
  const text = String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Notify the BD team in Lark that a new lead has been recorded.
 *
 * Uses a Lark group "custom bot" incoming webhook. Set
 * LARK_WEBHOOK_URL (required) and LARK_WEBHOOK_SECRET (only if the bot
 * was created with "Signature verification" turned on).
 *
 * Fires after the CipherBC CRM sync so the card can deep-link to the
 * lead. If the CRM sync failed, the card still goes out but carries a
 * warning so nobody assumes the lead is in the pipeline.
 *
 * Fire-and-forget: errors logged, never propagated to the user.
 */
async function sendToLark(data, crmResult) {
  const webhookUrl = process.env.LARK_WEBHOOK_URL;
  const secret = process.env.LARK_WEBHOOK_SECRET;

  if (!webhookUrl) {
    console.log('Lark webhook not configured (missing LARK_WEBHOOK_URL) — skipping');
    return { success: true, skipped: true };
  }

  try {
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
    const company = data.companyName || '';
    const products = Array.isArray(data.productInterest)
      ? data.productInterest.join(', ')
      : (data.productInterest || '');

    // CRM deep link — base derived from the CRM webhook URL so
    // staging/prod point at the right dashboard automatically.
    let crmLeadUrl = '';
    if (crmResult && crmResult.leadId) {
      let base = 'https://crm.cipherbc.com';
      try {
        base = new URL(process.env.CIPHERFORM_WEBHOOK_URL).origin;
      } catch (_) {
        // keep default
      }
      crmLeadUrl = `${base}/dashboard/leads/${crmResult.leadId}`;
    }

    // Header colour + status line reflect what actually happened in the CRM.
    let template = 'green';
    let statusLine = '';
    if (!crmResult || crmResult.skipped) {
      template = 'orange';
      statusLine = '⚠️ CRM sync is not configured on this deployment — lead is only in the Sheets log.';
    } else if (!crmResult.success) {
      template = 'red';
      statusLine = `🚨 **CRM sync failed** — lead is NOT in the CRM yet. Replay it from the Sheets log. (${larkText(crmResult.error, 160)})`;
    } else if (crmResult.existed) {
      template = 'blue';
      statusLine = '🔁 This email already existed in the CRM — treat as a repeat enquiry from an existing lead.';
    }

    const utm = [];
    if (data.utm_source) utm.push(`source=${data.utm_source}`);
    if (data.utm_medium) utm.push(`medium=${data.utm_medium}`);
    if (data.utm_campaign) utm.push(`campaign=${data.utm_campaign}`);
    if (data.utm_term) utm.push(`term=${data.utm_term}`);
    if (data.utm_content) utm.push(`content=${data.utm_content}`);

    const field = (label, value) => ({
      is_short: true,
      text: { tag: 'lark_md', content: `**${label}**\n${larkText(value, 200)}` }
    });

    const elements = [
      {
        tag: 'div',
        fields: [
          field('Name', fullName),
          field('Company', company),
          field('Email', data.email),
          field('Phone', data.phone),
          field('Telegram / WhatsApp', data.telegram),
          field('LinkedIn', data.linkedinUrl)
        ]
      },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**Product interest**\n${larkText(products, 300)}` }
      },
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**Enquiry**\n${larkText(data.message, 800)}` }
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: [
              `Page: ${larkText(data.page_url, 160)}`,
              `Referrer: ${larkText(data.referrer, 120)}`,
              utm.length ? `UTM: ${larkText(utm.join(' · '), 240)}` : null,
              `Submitted: ${data.submittedAt || new Date().toISOString()}`
            ].filter(Boolean).join('\n')
          }
        ]
      }
    ];

    if (statusLine) {
      elements.unshift({ tag: 'div', text: { tag: 'lark_md', content: statusLine } });
    }

    if (crmLeadUrl) {
      elements.push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: 'Open lead in CRM' },
            url: crmLeadUrl
          }
        ]
      });
    }

    // @everyone in the group so every BD gets pinged.
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: '<at id=all></at> new lead — please pick it up.' }
    });

    const title = `🆕 New lead: ${larkText(fullName, 60)}${company ? ` · ${larkText(company, 60)}` : ''}`;

    const body = {
      msg_type: 'interactive',
      card: {
        config: { wide_screen_mode: true },
        header: {
          template,
          title: { tag: 'plain_text', content: title }
        },
        elements
      }
    };

    // Optional signature verification (Lark custom bot "Signature verification").
    // sign = base64( HMAC-SHA256( key = "<timestamp>\n<secret>", msg = "" ) )
    if (secret) {
      const crypto = require('node:crypto');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      body.timestamp = timestamp;
      body.sign = crypto
        .createHmac('sha256', `${timestamp}\n${secret}`)
        .update('')
        .digest('base64');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000)
    });

    const result = await response.json().catch(() => ({}));

    // New-style bots answer {code:0,msg:"success"}; legacy ones {StatusCode:0}.
    const code = result.code ?? result.StatusCode;
    if (!response.ok || (code !== undefined && code !== 0)) {
      throw new Error(`Lark webhook ${response.status}: ${JSON.stringify(result)}`);
    }

    console.log('✓ BD team notified in Lark');
    return { success: true };
  } catch (error) {
    console.error('Lark notification error:', error.message);
    // Never fail the form submission on this branch — it's auxiliary.
    return { success: false, error: error.message };
  }
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
    const formData = JSON.parse(event.body);

    console.log('Received form data:', formData);

    // Validate form data
    const validation = validateFormData(formData);

    if (!validation.valid) {
      console.error('Validation failed:', validation.errors);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed: ' + validation.errors.join(', '),
          errors: validation.errors
        })
      };
    }

    // Sanitize data
    const sanitizedData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName ? formData.lastName.trim() : '',
      companyName: formData.companyName ? formData.companyName.trim() : '',
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      linkedinUrl: formData.linkedinUrl ? formData.linkedinUrl.trim() : '',
      telegram: formData.telegram ? formData.telegram.trim() : '',
      productInterest: formData.productInterest || [],
      message: formData.message ? formData.message.trim() : '',
      submittedAt: new Date().toISOString(),

      // UTM tracking parameters
      utm_source: formData.utm_source || '',
      utm_medium: formData.utm_medium || '',
      utm_campaign: formData.utm_campaign || '',
      utm_term: formData.utm_term || '',
      utm_content: formData.utm_content || '',
      page_url: formData.page_url || '',
      referrer: formData.referrer || 'Direct'
    };

    console.log('Form submission received:', {
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName,
      email: sanitizedData.email,
      phone: sanitizedData.phone,
      companyName: sanitizedData.companyName,
      productInterest: sanitizedData.productInterest,
      timestamp: sanitizedData.submittedAt
    });

    // 1. Audit log to Google Sheets. Runs first so the log is written
    //    even if the CRM leg runs long and the function gets cut off
    //    mid-retry.
    const webhookResult = await sendToWebhook(sanitizedData);

    if (webhookResult.success && !webhookResult.skipped) {
      console.log('✓ Form data sent to webhook successfully');
    } else if (!webhookResult.skipped) {
      console.warn('Webhook submission failed, but form accepted');
    }

    // 2. Record the lead in the CipherBC CRM — the source of truth.
    const cipherBcResult = await sendToCipherBc(sanitizedData);

    if (cipherBcResult.success && !cipherBcResult.skipped) {
      console.log(
        '✓ Lead recorded in CipherBC CRM',
        cipherBcResult.existed ? '(existing)' : `(new id: ${cipherBcResult.leadId})`
      );
    } else if (!cipherBcResult.skipped) {
      console.warn('CipherBC sync failed, but form accepted:', cipherBcResult.error);
    }

    // 3. Ping the BD team in Lark now that the lead is recorded.
    const larkResult = await sendToLark(sanitizedData, cipherBcResult);

    if (!larkResult.success) {
      console.warn('Lark notification failed, but form accepted:', larkResult.error);
    }

    // Always return success to user (Sheets log records every submission for verification)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Form submitted successfully',
        data: {
          firstName: sanitizedData.firstName,
          lastName: sanitizedData.lastName,
          email: sanitizedData.email
        }
      })
    };

  } catch (error) {
    console.error('Error in submit-form function:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'An unexpected error occurred. Please try again.'
      })
    };
  }
};
