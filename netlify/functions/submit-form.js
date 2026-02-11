/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Send form data to HubSpot
 * Uses HubSpot Contacts API to create contacts directly in CRM
 * Requires HUBSPOT_ACCESS_TOKEN from private app
 */
async function sendToHubSpot(data) {
  const hubspotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!hubspotAccessToken) {
    console.log('HUBSPOT_ACCESS_TOKEN not configured - skipping HubSpot submission');
    return { success: true, skipped: true };
  }

  try {
    const contactsUrl = 'https://api.hubapi.com/crm/v3/objects/contacts';

    const payload = {
      properties: {
        firstname: data.firstName,
        lastname: data.lastName || data.firstName,
        email: data.email,
        phone: data.phone,
        company: data.companyName || '',
        message: data.message || '',
        hs_lead_status: 'NEW',
        lifecyclestage: 'lead'
      }
    };

    // Add optional fields if present
    if (data.linkedinUrl) {
      payload.properties.linkedin_url = data.linkedinUrl;
    }
    if (data.telegram) {
      payload.properties.telegram = data.telegram;
    }
    if (data.productInterest && data.productInterest.length > 0) {
      // HubSpot multiple checkbox properties require semicolon separator
      payload.properties.product_interest = data.productInterest.join(';');
    }

    const response = await fetch(contactsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hubspotAccessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HubSpot Contacts API error: ${errorData.message || response.status}`);
    }

    const result = await response.json();
    console.log('✓ Contact created in HubSpot successfully:', result.id);
    return { success: true, method: 'contacts-api', contactId: result.id };

  } catch (error) {
    console.error('HubSpot Contacts API error:', error);

    // Check if it's a duplicate contact error
    if (error.message && error.message.includes('already exists')) {
      return {
        success: false,
        error: 'This email is already registered in our system. Please use a different email address or contact support.'
      };
    }

    return {
      success: false,
      error: 'Failed to create contact in HubSpot. Please try again later or contact support.'
    };
  }
}

/**
 * Send form data to webhook (Google Sheets) with UTM tracking
 */
async function sendToWebhook(data, hubspotStatus = 'Pending', hubspotMethod = 'Unknown') {
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

      // HubSpot Status
      hubspotStatus: hubspotStatus,
      hubspotMethod: hubspotMethod,

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

      // UTM tracking parameters (for Google Sheets only)
      utm_source: formData.utm_source || '',
      utm_medium: formData.utm_medium || '',
      utm_campaign: formData.utm_campaign || '',
      utm_term: formData.utm_term || '',
      utm_content: formData.utm_content || '',
      page_url: formData.page_url || '',
      referrer: formData.referrer || 'Direct'
    };

    // Log submission (in production, save to database)
    console.log('Form submission received:', {
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName,
      email: sanitizedData.email,
      phone: sanitizedData.phone,
      companyName: sanitizedData.companyName,
      productInterest: sanitizedData.productInterest,
      timestamp: sanitizedData.submittedAt
    });

    // Send to HubSpot (primary integration)
    const hubspotResult = await sendToHubSpot(sanitizedData);

    let hubspotStatus = 'Pending';
    let hubspotMethod = 'Unknown';
    if (hubspotResult.success && !hubspotResult.skipped) {
      console.log(`✓ Form data sent to HubSpot successfully (method: ${hubspotResult.method})`);
      hubspotStatus = 'Success';
      hubspotMethod = hubspotResult.method || 'Unknown';
    } else if (!hubspotResult.skipped) {
      console.warn('HubSpot submission failed, but form accepted:', hubspotResult.error);
      // Check if it's a duplicate error
      if (hubspotResult.error && hubspotResult.error.includes('already exists')) {
        hubspotStatus = 'Duplicate';
      } else {
        hubspotStatus = hubspotResult.error || 'Error';
      }
    }

    // Send to webhook if configured (IMPORTANT: logs all submissions to Google Sheets)
    const webhookResult = await sendToWebhook(sanitizedData, hubspotStatus, hubspotMethod);

    if (webhookResult.success && !webhookResult.skipped) {
      console.log('✓ Form data sent to webhook successfully');
    } else if (!webhookResult.skipped) {
      console.warn('Webhook submission failed, but form accepted');
    }

    // Always return success to user (webhook will log all submissions for verification)
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
