# OTP Verification Form - Embeddable & Secure

A production-ready, embeddable contact form with SMS-based OTP verification using Brevo SMS API. Built with vanilla JavaScript and Netlify Functions for seamless serverless deployment.

## Features

- ✅ **4-Step Verification Flow**: Phone → OTP → Form → Success
- 🔒 **Secure OTP Verification**: 6-digit codes sent via Brevo SMS
- ⏱️ **Auto-Expiring OTPs**: 5-minute validity with countdown timer
- 🚫 **Rate Limiting**: Max 3 OTP attempts per hour per phone
- 📱 **Fully Responsive**: Works on desktop, tablet, and mobile
- 🎨 **Modern UI/UX**: Clean blue/white theme with smooth animations
- 🔌 **Easy Embedding**: Single-line integration for any website
- ⚡ **Serverless**: Powered by Netlify Functions (no server needed)
- 🔄 **Resend OTP**: Built-in resend functionality
- 🎯 **HubSpot Integration**: Automatic CRM sync (Forms API or Contacts API)
- 📊 **Webhook Support**: Send submissions to external services

## Live Demo

👉 [View Live Demo](#) *(Add your Netlify URL after deployment)*

## Table of Contents

- [Quick Start](#quick-start)
- [Getting Brevo API Key](#getting-brevo-api-key)
- [HubSpot Integration Setup](#hubspot-integration-setup)
- [Local Development](#local-development)
- [Deployment to Netlify](#deployment-to-netlify)
- [Embedding the Form](#embedding-the-form)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Customization](#customization)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Quick Start

### Prerequisites

- Node.js 14+ and npm
- A [Netlify](https://netlify.com) account (free tier works)
- A [Brevo](https://brevo.com) account with SMS credits

### Installation

1. **Clone or download this repository**

```bash
cd CipheForm
```

2. **Install Netlify CLI globally**

```bash
npm install -g netlify-cli
```

3. **Create `.env` file from example**

```bash
cp .env.example .env
```

4. **Add your Brevo API key to `.env`**

```env
BREVO_API_KEY=your_actual_brevo_api_key_here
BREVO_SENDER=YourAppName
```

5. **Test locally**

```bash
netlify dev
```

Visit `http://localhost:8888` to test the form.

---

## Getting Brevo API Key

### Step 1: Create Brevo Account

1. Go to [Brevo.com](https://www.brevo.com) (formerly Sendinblue)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get SMS Credits

1. Navigate to **Transactional SMS** in the dashboard
2. Purchase SMS credits (pay-as-you-go available)
3. Add credit to your account

### Step 3: Generate API Key

1. Go to **Settings** → **API Keys**
2. Click **Generate a new API key**
3. Name it (e.g., "OTP Form Production")
4. Copy the API key immediately (you won't see it again)
5. Paste it into your `.env` file

### Step 4: Configure Sender Name

1. Go to **Transactional SMS** → **Senders**
2. Add and verify your sender name/number
3. Use this name in `BREVO_SENDER` environment variable

**Important Notes:**
- Free accounts get 20 SMS credits for testing
- Production requires purchasing credits
- Some countries require sender verification
- Test with your own phone number first

---

## HubSpot Integration Setup

Form submissions are automatically sent to HubSpot CRM. **Choose ONE method:**

### Method 1: HubSpot Forms API (Recommended - Easiest)

**No API key required!** Just need Portal ID and Form GUID.

1. **Get Portal ID**: Settings → Account Setup → Hub ID
2. **Create Form**: Marketing → Forms → Create embedded form
3. **Add Fields**: firstname, lastname, email, phone, message
4. **Get Form GUID**: From form editor URL
5. **Add to `.env`**:
   ```env
   HUBSPOT_PORTAL_ID=your_portal_id
   HUBSPOT_FORM_GUID=your_form_guid
   ```

### Method 2: HubSpot Contacts API (Alternative)

**Requires Private App Access Token**

1. **Create Private App**: Settings → Integrations → Private Apps
2. **Set Scopes**: `crm.objects.contacts.write` + `crm.objects.contacts.read`
3. **Copy Access Token**
4. **Add to `.env`**:
   ```env
   HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx
   ```

📖 **[Complete HubSpot Setup Guide →](./HUBSPOT_SETUP.md)**

---

## Local Development

### Running Locally

```bash
netlify dev
```

This starts:
- Frontend server at `http://localhost:8888`
- Netlify Functions at `http://localhost:8888/.netlify/functions/`

### Testing the Form

1. Enter your phone number with country code (e.g., `+1234567890`)
2. Check your phone for the OTP code
3. Enter the 6-digit code
4. Fill out the form and submit

### Debugging

- Check browser console for frontend logs
- Check terminal for function logs
- Function outputs include OTP codes in development (remove in production!)

**Test Mode**: For testing without sending real SMS, you can temporarily modify `send-otp.js` to log the OTP instead of calling Brevo API.

---

## Deployment to Netlify

### Option 1: Deploy via Netlify CLI (Recommended)

1. **Login to Netlify**

```bash
netlify login
```

2. **Initialize the site**

```bash
netlify init
```

Follow the prompts:
- Create a new site or link to existing
- Choose your team
- Build command: (leave empty)
- Deploy directory: `.`

3. **Set environment variables**

```bash
netlify env:set BREVO_API_KEY "your_api_key_here"
netlify env:set BREVO_SENDER "YourAppName"
```

4. **Deploy**

```bash
netlify deploy --prod
```

Your site is live! Copy the URL (e.g., `https://your-site.netlify.app`)

### Option 2: Deploy via GitHub

1. Push code to GitHub
2. Go to [Netlify Dashboard](https://app.netlify.com)
3. Click **Add new site** → **Import an existing project**
4. Connect to GitHub and select your repo
5. Configure:
   - Build command: (leave empty)
   - Publish directory: `.`
6. Add environment variables in **Site settings** → **Environment variables**
7. Click **Deploy site**

### Option 3: Deploy via Netlify Drop

1. Drag and drop your project folder to [netlify.com/drop](https://app.netlify.com/drop)
2. After deployment, go to **Site settings** → **Environment variables**
3. Add your `BREVO_API_KEY` and `BREVO_SENDER`
4. Trigger a redeploy

---

## Embedding the Form

Once deployed, anyone can embed your form on their website with 2 lines of code:

### Basic Embed

```html
<div id="otp-form-embed"></div>
<script src="https://your-site.netlify.app/embed.js"></script>
```

### Custom Width/Height

```html
<div id="otp-form-embed" data-width="600px" data-height="900px"></div>
<script src="https://your-site.netlify.app/embed.js"></script>
```

### Custom Styling

```html
<div id="otp-form-embed" data-style="border: 2px solid #ccc; margin: 20px;"></div>
<script src="https://your-site.netlify.app/embed.js"></script>
```

### Listen to Form Completion (Optional)

```html
<script>
window.addEventListener('otpFormComplete', function(event) {
    console.log('Form submitted!', event.detail);
    // Redirect, show thank you message, etc.
});
</script>
```

### Direct Link

Alternatively, share the direct URL:
```
https://your-site.netlify.app
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Your Brevo API key
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxx

# Required: Sender name (must be configured in Brevo)
BREVO_SENDER=YourAppName

# HubSpot Integration (Choose ONE method)
# Method 1: HubSpot Forms API (Recommended)
HUBSPOT_PORTAL_ID=your_portal_id
HUBSPOT_FORM_GUID=your_form_guid

# Method 2: HubSpot Contacts API (Alternative)
# HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx

# Optional: Webhook to send form submissions (backup/secondary)
FORM_SUBMISSION_WEBHOOK=https://your-webhook.com/endpoint
```

### Setting Environment Variables on Netlify

**Via CLI:**
```bash
netlify env:set VARIABLE_NAME "value"
```

**Via Dashboard:**
1. Go to **Site settings** → **Environment variables**
2. Click **Add a variable**
3. Enter key and value
4. Save and redeploy

---

## Project Structure

```
CipheForm/
├── index.html              # Main form page (4-step UI)
├── styles.css              # Responsive styling
├── form.js                 # Frontend logic (OTP flow)
├── embed.js                # Embed script for clients
├── netlify.toml            # Netlify configuration
├── .env                    # Environment variables (local only)
├── .env.example            # Template for environment variables
├── README.md               # This file
└── netlify/
    └── functions/
        ├── send-otp.js     # Generate & send OTP via Brevo
        ├── verify-otp.js   # Verify OTP code
        └── submit-form.js  # Handle final form submission
```

---

## API Reference

### 1. Send OTP

**Endpoint:** `POST /.netlify/functions/send-otp`

**Request:**
```json
{
  "phone": "+1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 300
}
```

**Response (Error):**
```json
{
  "error": "Too many OTP requests. Please try again in 45 minute(s)."
}
```

### 2. Verify OTP

**Endpoint:** `POST /.netlify/functions/verify-otp`

**Request:**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "valid": true,
  "message": "OTP verified successfully"
}
```

**Response (Error):**
```json
{
  "error": "Invalid OTP. Please check and try again.",
  "valid": false
}
```

### 3. Submit Form

**Endpoint:** `POST /.netlify/functions/submit-form`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "message": "This is my message"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

## Customization

### Change Color Scheme

Edit `styles.css` - modify CSS variables:

```css
:root {
    --primary-color: #your-color;      /* Main brand color */
    --primary-hover: #darker-shade;    /* Hover state */
    --success-color: #28a745;          /* Success green */
    --error-color: #dc3545;            /* Error red */
}
```

### Modify OTP Expiry Time

Edit `netlify/functions/send-otp.js`:

```javascript
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes instead of 5
```

### Change Rate Limiting

Edit `netlify/functions/send-otp.js`:

```javascript
const MAX_ATTEMPTS = 5; // Allow 5 attempts instead of 3
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours instead of 1
```

### Add Form Fields

1. Add input field in `index.html` (Step 3)
2. Capture value in `form.js` (mainForm submit handler)
3. Validate in `netlify/functions/submit-form.js`

### Custom SMS Message

Edit `netlify/functions/send-otp.js`:

```javascript
const message = `Your verification code is ${otp}. Expires in 5 minutes.`;
```

---

## Security Considerations

### ✅ Implemented Security Features

- ✅ API keys never exposed to frontend
- ✅ CORS headers configured
- ✅ Rate limiting on OTP requests
- ✅ OTP expiry (5 minutes)
- ✅ Phone number validation
- ✅ Input sanitization
- ✅ HTTPS enforced by Netlify

### 🔒 Production Recommendations

1. **Use a Real Database for OTPs**
   - Current: In-memory storage (resets on cold starts)
   - Recommended: Redis, Netlify Blobs, or DynamoDB

2. **Add Logging & Monitoring**
   - Track failed OTP attempts
   - Monitor SMS delivery rates
   - Set up alerts for suspicious activity

3. **Implement CAPTCHA**
   - Add reCAPTCHA on phone number input
   - Prevents automated abuse

4. **Webhook Signature Verification**
   - Verify webhook requests with HMAC signatures
   - Prevent spoofing

5. **Remove Console Logs**
   - Remove OTP logging in production
   - Keep error logs only

---

## Troubleshooting

### SMS Not Received

1. **Check Phone Number Format**
   - Must include country code (e.g., `+1` for US)
   - No spaces or special characters

2. **Verify Brevo Credits**
   - Log into Brevo dashboard
   - Check SMS credits balance

3. **Check Brevo Sender Configuration**
   - Ensure sender name is verified
   - Some countries require pre-approval

4. **Review Function Logs**
   ```bash
   netlify functions:log send-otp
   ```

### "Failed to Send SMS" Error

- **Check API Key**: Ensure `BREVO_API_KEY` is correct
- **Check Brevo Status**: Visit [Brevo Status Page](https://status.brevo.com)
- **Review Rate Limits**: Brevo has API rate limits

### OTP Not Verified

- **Check Expiry**: OTP expires in 5 minutes
- **Case Sensitivity**: OTP is numeric only
- **Serverless State**: OTP storage resets on cold starts (use Redis for production)

### Form Not Embedding

- **Check iframe Sandbox**: Some CSP policies block iframes
- **CORS Issues**: Ensure your domain allows iframe embeds
- **Script Loading**: Verify embed.js loads without errors

### Local Development Issues

- **Port 8888 in Use**: Kill existing process or use different port
  ```bash
  netlify dev -p 8889
  ```

- **Functions Not Working**: Ensure `netlify.toml` is configured correctly

---

## Performance Optimization

### For High Traffic

1. **Use Redis for OTP Storage**
   - Install Redis addon on Netlify
   - Modify functions to use Redis instead of in-memory storage

2. **Add CDN Caching**
   - Cache static assets (CSS, JS)
   - Already enabled on Netlify

3. **Optimize SMS Costs**
   - Consider fallback to email OTP
   - Use voice OTP for failed SMS

### Monitoring

- **Netlify Analytics**: Enable in site settings
- **Custom Logging**: Send logs to external service (Logtail, Papertrail)
- **Error Tracking**: Integrate Sentry or similar

---

## Contributing

Feel free to fork this project and customize it for your needs. If you find bugs or have suggestions, please open an issue.

---

## License

MIT License - feel free to use this project commercially or personally.

---

## Credits

- **Built by:** [Your Name]
- **SMS Provider:** [Brevo](https://www.brevo.com)
- **Hosting:** [Netlify](https://www.netlify.com)

---

## Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review [Brevo Documentation](https://developers.brevo.com/docs)
- Check [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)

---

**Made with ❤️ using vanilla JavaScript and serverless functions**
