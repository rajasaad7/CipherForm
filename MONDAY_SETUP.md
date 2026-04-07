# Monday.com Integration Setup Guide

## Overview
Your form now sends lead data to Monday.com instead of HubSpot. All form fields including UTM tracking parameters are forwarded to your Monday.com board.

## Step 1: Get Your Monday.com API Token

1. Go to your Monday.com account
2. Click on your profile picture (bottom left)
3. Go to **Developers** → **My Access Tokens**
4. Click **Generate** or **Show** to create/view your API token
5. Copy the token (starts with `eyJ...`)

## Step 2: Get Your Board ID

1. Open the Monday.com board where you want to store leads
2. Look at the URL in your browser: `https://yourcompany.monday.com/boards/1234567890`
3. The number after `/boards/` is your Board ID (e.g., `1234567890`)

## Step 3: Set Up Your Board Columns

Create the following columns in your Monday.com board (column IDs should match the names below):

### Required Columns:
- `first_name` - Text
- `last_name` - Text
- `email` - Email
- `phone` - Phone
- `company` - Text
- `message` - Long Text
- `status` - Status (with "New Lead" label)

### Optional Contact Columns:
- `linkedin_url` - Link
- `telegram` - Text
- `product_interest` - Text

### UTM Tracking Columns:
- `utm_source` - Text
- `utm_medium` - Text
- `utm_campaign` - Text
- `utm_term` - Text
- `utm_content` - Text

### Page Tracking Columns:
- `page_url` - Link
- `referrer` - Text

**Note:** Monday.com will automatically match column names to IDs. If your column names are different, you'll need to update the `columnValues` object in `netlify/functions/submit-form.js` line 70-88.

## Step 4: Configure Environment Variables

Add these to your Netlify environment variables:

### For Local Development (.env file):
```
MONDAY_API_TOKEN=your_api_token_here
MONDAY_BOARD_ID=your_board_id_here
```

### For Production (Netlify Dashboard):
1. Go to **Site settings** → **Environment variables**
2. Add the following:
   - `MONDAY_API_TOKEN` = `your_api_token_here`
   - `MONDAY_BOARD_ID` = `your_board_id_here`

## Step 5: Test the Integration

1. Restart your Netlify dev server:
   ```bash
   netlify dev
   ```

2. Submit a test form entry

3. Check your Monday.com board - you should see a new item created with:
   - Item name: "FirstName LastName - email@example.com"
   - All column values populated

## Data Flow

```
Form Submission
    ↓
Monday.com (Primary) - Creates item with all data including UTM tracking
    ↓
Google Sheets (Backup) - Logs submission with Monday.com status
```

## Column Mapping Reference

| Form Field | Monday.com Column | Type |
|------------|------------------|------|
| First Name | first_name | Text |
| Last Name | last_name | Text |
| Email | email | Email |
| Phone | phone | Phone |
| Company | company | Text |
| LinkedIn | linkedin_url | Link |
| Telegram | telegram | Text |
| Product Interest | product_interest | Text |
| Message | message | Long Text |
| UTM Source | utm_source | Text |
| UTM Medium | utm_medium | Text |
| UTM Campaign | utm_campaign | Text |
| UTM Term | utm_term | Text |
| UTM Content | utm_content | Text |
| Page URL | page_url | Link |
| Referrer | referrer | Text |
| Status | status | Status |

## Troubleshooting

### Error: "Monday.com not configured"
- Make sure both `MONDAY_API_TOKEN` and `MONDAY_BOARD_ID` are set in your environment variables

### Error: "Monday.com GraphQL error"
- Check that your column IDs match exactly (case-sensitive)
- Verify your API token has write permissions
- Ensure the board ID is correct

### Leads not appearing in Monday.com
- Check Netlify function logs for error messages
- Verify your API token is active and not expired
- Confirm the board ID is correct

## Security Notes

- Never commit your API token to git
- Keep `.env` in your `.gitignore`
- Use Netlify environment variables for production
- API tokens should be kept confidential

## Need Help?

- Monday.com API Docs: https://developer.monday.com/api-reference/docs
- Your integration code: `netlify/functions/submit-form.js` (lines 57-140)
