# HubSpot Integration Setup Guide

This form automatically sends submissions to HubSpot. Choose **ONE** method below:

## 🎯 Method 1: HubSpot Forms API (Recommended)

**✅ Easiest setup - No API key required**

### Step 1: Get Your HubSpot Portal ID

1. Log in to [HubSpot](https://app.hubspot.com)
2. Click on **Settings** (gear icon in top right)
3. Navigate to **Account Setup** → **Account Defaults**
4. Find your **Hub ID** (also called Portal ID)
5. Copy this number (e.g., `12345678`)

### Step 2: Create a Form in HubSpot

1. Go to **Marketing** → **Forms**
2. Click **Create form** → **Embedded form**
3. Add the following fields to your form:
   - **First Name** (required)
   - **Last Name** (required)
   - **Email** (required)
   - **Phone Number** (required)
   - **Message** (optional - create custom property if needed)

4. Configure form settings:
   - Name: "OTP Form Submissions" (or any name)
   - Follow-up email: Optional
   - Create list: Optional (e.g., "OTP Form Leads")

5. Click **Publish** (you don't need to embed it)

### Step 3: Get Form GUID

1. After creating the form, click on it to edit
2. Look at the URL in your browser:
   ```
   https://app.hubspot.com/forms/12345678/editor/abc123de-4567-89fg-hijk-lmnopqrstuv/
                                              ^^^^^^^^
                                              Portal ID
                                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                         Form GUID
   ```
3. Copy the Form GUID (the long string after `/editor/`)

### Step 4: Add to Environment Variables

Add to your `.env` file:
```env
HUBSPOT_PORTAL_ID=12345678
HUBSPOT_FORM_GUID=abc123de-4567-89fg-hijk-lmnopqrstuv
```

### Step 5: Deploy to Netlify

```bash
netlify env:set HUBSPOT_PORTAL_ID "your_portal_id"
netlify env:set HUBSPOT_FORM_GUID "your_form_guid"
netlify deploy --prod
```

### ✅ Done!

Test by submitting the form. Check HubSpot **Contacts** → **Forms** to see submissions.

---

## 🔑 Method 2: HubSpot Contacts API (Alternative)

**⚠️ Requires private app - More setup but more flexible**

### Step 1: Create a Private App

1. Log in to [HubSpot](https://app.hubspot.com)
2. Go to **Settings** → **Integrations** → **Private Apps**
3. Click **Create a private app**
4. Name it: "OTP Form Integration"
5. Add description: "Receives contact submissions from OTP verification form"

### Step 2: Set Scopes

Under the **Scopes** tab, select:
- ✅ `crm.objects.contacts.write`
- ✅ `crm.objects.contacts.read`

### Step 3: Create & Copy Access Token

1. Click **Create app**
2. Copy the **Access Token** (starts with `pat-na1-`)
3. ⚠️ **Save it securely** - you won't see it again!

### Step 4: Add to Environment Variables

Add to your `.env` file:
```env
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Step 5: (Optional) Create Custom Property for Message

1. Go to **Settings** → **Properties**
2. Select **Contact properties**
3. Click **Create property**
4. Configure:
   - **Label**: "Message"
   - **Internal name**: `message`
   - **Field type**: Multi-line text
   - **Group**: Contact information
5. Click **Create**

### Step 6: Deploy to Netlify

```bash
netlify env:set HUBSPOT_ACCESS_TOKEN "your_access_token"
netlify deploy --prod
```

### ✅ Done!

Test by submitting the form. Check HubSpot **Contacts** to see new leads.

---

## 📊 What Data Gets Sent?

| Form Field | HubSpot Property |
|-----------|-----------------|
| Name (Full) | `firstname` + `lastname` |
| Email | `email` |
| Phone | `phone` |
| Message | `message` (custom property) |

**Additional Properties Set:**
- `lifecyclestage`: "lead"
- `hs_lead_status`: "NEW"

---

## 🔍 Troubleshooting

### Form submissions not appearing in HubSpot

1. **Check Netlify Function Logs**
   ```bash
   netlify functions:log submit-form
   ```

2. **Verify Environment Variables**
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Ensure `HUBSPOT_PORTAL_ID` and `HUBSPOT_FORM_GUID` are set (Method 1)
   - OR `HUBSPOT_ACCESS_TOKEN` is set (Method 2)

3. **Check HubSpot Form Fields**
   - Ensure your HubSpot form has `firstname`, `lastname`, `email`, `phone` fields
   - Field internal names must match exactly

4. **Review HubSpot Logs**
   - Go to **Settings** → **Integrations** → **Private Apps**
   - Click on your app → **Logs** tab

### Error: "HubSpot Forms API error: 400"

**Cause**: Form fields don't match or form GUID is incorrect

**Fix**:
- Double-check your Form GUID
- Ensure form has all required fields
- Check field internal names in HubSpot

### Error: "HubSpot Contacts API error: 401"

**Cause**: Invalid or expired access token

**Fix**:
- Regenerate access token in HubSpot
- Update `HUBSPOT_ACCESS_TOKEN` in Netlify
- Redeploy

### Contacts created but missing "Message" field

**Cause**: Custom `message` property not created in HubSpot

**Fix**:
- Create custom property in HubSpot (see Method 2, Step 5)
- OR remove message from payload in `submit-form.js`

---

## 🎨 Customization

### Add More Fields

**1. Update HTML** (`index.html`):
```html
<div class="form-group">
    <label for="company">Company Name</label>
    <input type="text" id="company" name="company">
</div>
```

**2. Update JavaScript** (`form.js`):
```javascript
const formData = {
    // ... existing fields
    company: document.getElementById('company').value.trim()
};
```

**3. Update Function** (`netlify/functions/submit-form.js`):

For Forms API (Method 1):
```javascript
fields: [
    // ... existing fields
    { name: 'company', value: data.company }
]
```

For Contacts API (Method 2):
```javascript
properties: {
    // ... existing properties
    company: data.company
}
```

**4. Create Property in HubSpot** (if custom field)

---

## 🔐 Security Notes

- ✅ HubSpot credentials never exposed to frontend
- ✅ All API calls made server-side via Netlify Functions
- ✅ Form submissions validated before sending
- ✅ HTTPS enforced by Netlify

---

## 📞 Support

- [HubSpot API Documentation](https://developers.hubspot.com/docs/api/overview)
- [HubSpot Forms API](https://developers.hubspot.com/docs/api/marketing/forms)
- [HubSpot Contacts API](https://developers.hubspot.com/docs/api/crm/contacts)
- [HubSpot Community](https://community.hubspot.com/)

---

**Made with ❤️ | Powered by Brevo SMS + HubSpot**
