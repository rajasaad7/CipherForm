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
 * Supports two methods:
 * 1. HubSpot Forms API (no API key needed, easier setup)
 * 2. HubSpot Contacts API (requires private app access token)
 */
async function sendToHubSpot(data) {
  const hubspotPortalId = process.env.HUBSPOT_PORTAL_ID;
  const hubspotFormGuid = process.env.HUBSPOT_FORM_GUID;
  const hubspotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  // Method 1: HubSpot Forms API (Recommended for simplicity)
  if (hubspotPortalId && hubspotFormGuid) {
    try {
      const formUrl = `https://api.eu1.hsforms.com/submissions/v3/integration/submit/${hubspotPortalId}/${hubspotFormGuid}`;

      const payload = {
        fields: [
          { name: 'firstname', value: data.firstName },
          { name: 'lastname', value: data.lastName || '' },
          { name: 'email', value: data.email },
          { name: 'phone', value: data.phone },
          { name: 'company', value: data.companyName || '' },
          { name: 'message', value: data.message || '' }
        ],
        context: {
          pageUri: 'https://cipherbc.com/contact',
          pageName: 'CipherBC Contact Form'
        }
      };

      // Add optional fields if present
      if (data.linkedinUrl) {
        payload.fields.push({ name: 'linkedin_url', value: data.linkedinUrl });
      }
      if (data.telegram) {
        payload.fields.push({ name: 'telegram', value: data.telegram });
      }
      if (data.productInterest && data.productInterest.length > 0) {
        payload.fields.push({ name: 'product_interest', value: data.productInterest.join(', ') });
      }

      const response = await fetch(formUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HubSpot Forms API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✓ Data sent to HubSpot Forms API successfully:', result);
      return { success: true, method: 'forms-api' };

    } catch (error) {
      console.error('HubSpot Forms API error:', error);
      return { success: false, error: error.message };
    }
  }

  // Method 2: HubSpot Contacts API (Alternative method)
  if (hubspotAccessToken) {
    try {
      const contactsUrl = 'https://api.eu1.hubapi.com/crm/v3/objects/contacts';

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
        payload.properties.product_interest = data.productInterest.join(', ');
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
      return { success: false, error: error.message };
    }
  }

  console.log('No HubSpot configuration found - skipping HubSpot submission');
  return { success: true, skipped: true };
}

/**
 * Send form data to webhook (optional)
 */
async function sendToWebhook(data) {
  const webhookUrl = process.env.FORM_SUBMISSION_WEBHOOK;

  if (!webhookUrl) {
    console.log('No webhook configured - skipping webhook submission');
    return { success: true, skipped: true };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        source: 'otp-form'
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

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
      submittedAt: new Date().toISOString()
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

    if (hubspotResult.success && !hubspotResult.skipped) {
      console.log(`✓ Form data sent to HubSpot successfully (method: ${hubspotResult.method})`);
    } else if (!hubspotResult.skipped) {
      console.warn('HubSpot submission failed, but form accepted');
    }

    // Send to webhook if configured (secondary/backup)
    const webhookResult = await sendToWebhook(sanitizedData);

    if (webhookResult.success && !webhookResult.skipped) {
      console.log('Form data sent to webhook successfully');
    } else if (!webhookResult.skipped) {
      console.warn('Webhook submission failed, but form accepted');
    }

    // Return success
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
