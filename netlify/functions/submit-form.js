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
 * Send form data to Monday.com
 * Uses Monday.com GraphQL API to create items in a board
 * Requires MONDAY_API_TOKEN and MONDAY_BOARD_ID
 */
async function sendToMonday(data) {
  const mondayApiToken = process.env.MONDAY_API_TOKEN;
  const mondayBoardId = process.env.MONDAY_BOARD_ID;

  if (!mondayApiToken || !mondayBoardId) {
    console.log('Monday.com not configured (missing MONDAY_API_TOKEN or MONDAY_BOARD_ID) - skipping Monday submission');
    return { success: true, skipped: true };
  }

  try {
    const mondayApiUrl = 'https://api.monday.com/v2';

    // Prepare column values with fixed column IDs from board structure
    const columnValues = {};

    // Map form data to Monday.com columns using dedicated columns
    // Based on actual board structure with new columns

    // First Name & Last Name - text fields
    columnValues['first_name__1'] = data.firstName;
    columnValues['last_name__1'] = data.lastName || '';

    // Email - text field
    columnValues['email__1'] = data.email;

    // Phone - use Phone Number text field instead of Phone type field
    columnValues['phone_number__1'] = data.phone;

    // Company - Business Type field
    if (data.companyName) {
      columnValues['business_type__1'] = data.companyName;
    }

    // Enquiry - user's message
    if (data.message) {
      columnValues['enquiry__1'] = data.message;
    }

    // LinkedIn - link column type
    if (data.linkedinUrl) {
      columnValues['link_mm263t0s'] = { "url": data.linkedinUrl, "text": data.linkedinUrl };
    }

    // TG/WA - text field (dedicated column)
    if (data.telegram) {
      columnValues['text_mm26r0dm'] = data.telegram;
    }

    // Product Interest - dedicated text column
    if (data.productInterest && data.productInterest.length > 0) {
      columnValues['text_mm26k1r2'] = data.productInterest.join(', ');
    }

    // UTM Tracking - dedicated UTM column
    const utmData = [];
    if (data.utm_source) utmData.push(`Source: ${data.utm_source}`);
    if (data.utm_medium) utmData.push(`Medium: ${data.utm_medium}`);
    if (data.utm_campaign) utmData.push(`Campaign: ${data.utm_campaign}`);
    if (data.utm_term) utmData.push(`Term: ${data.utm_term}`);
    if (data.utm_content) utmData.push(`Content: ${data.utm_content}`);
    if (data.page_url) utmData.push(`Page: ${data.page_url}`);
    if (data.referrer) utmData.push(`Referrer: ${data.referrer}`);

    if (utmData.length > 0) {
      columnValues['text_mm26nn2c'] = utmData.join('\n');
    }

    // Status/Stage - set to "New"
    columnValues['status'] = { "label": "New" };

    // GraphQL mutation to create item
    const query = `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item (
        board_id: $boardId,
        item_name: $itemName,
        column_values: $columnValues
      ) {
        id
      }
    }`;

    const variables = {
      boardId: mondayBoardId,
      itemName: `${data.firstName} ${data.lastName || ''} - ${data.email}`,
      columnValues: JSON.stringify(columnValues)
    };

    const response = await fetch(mondayApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': mondayApiToken
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Monday.com API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`Monday.com GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    console.log('✓ Lead created in Monday.com successfully:', result.data.create_item.id);
    return { success: true, method: 'monday-api', itemId: result.data.create_item.id };

  } catch (error) {
    console.error('Monday.com API error:', error);

    return {
      success: false,
      error: 'Failed to create lead in Monday.com. Please try again later or contact support.'
    };
  }
}

/**
 * Send form data to webhook (Google Sheets) with UTM tracking
 */
async function sendToWebhook(data, mondayStatus = 'Pending', mondayMethod = 'Unknown') {
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

      // Monday.com Status
      mondayStatus: mondayStatus,
      mondayMethod: mondayMethod,

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

    // Send to Monday.com (primary integration)
    const mondayResult = await sendToMonday(sanitizedData);

    let mondayStatus = 'Pending';
    let mondayMethod = 'Unknown';
    if (mondayResult.success && !mondayResult.skipped) {
      console.log(`✓ Form data sent to Monday.com successfully (method: ${mondayResult.method})`);
      mondayStatus = 'Success';
      mondayMethod = mondayResult.method || 'Unknown';
    } else if (!mondayResult.skipped) {
      console.warn('Monday.com submission failed, but form accepted:', mondayResult.error);
      mondayStatus = mondayResult.error || 'Error';
    }

    // Send to webhook if configured (IMPORTANT: logs all submissions to Google Sheets)
    const webhookResult = await sendToWebhook(sanitizedData, mondayStatus, mondayMethod);

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
