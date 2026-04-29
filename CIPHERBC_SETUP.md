# CipherBC dashboard integration

The form already sends submissions to **Monday.com** (sales-ops pipeline)
and **Google Sheets** (audit log). This third destination, the **CipherBC
dashboard**, is the BD outbound-engagement tracker — every form submission
becomes a lead in `app.saad.guru`'s leads pipeline so BDs can run
outreach against it and managers can track open / click / reply rates
per lead source.

The three destinations are independent: any one can fail without breaking
the others or the user-visible form.

## Setup

### 1. Get the webhook secret

The HMAC secret was generated when the integration was wired. It lives
in the dashboard's `.env.local` as `CIPHERFORM_WEBHOOK_SECRET`. The
form needs the same secret as `CIPHERFORM_WEBHOOK_SECRET`.

Ask whoever runs the dashboard, or regenerate with `openssl rand -base64 32`
and update both sides simultaneously.

### 2. Add to Netlify environment variables

**For local dev** — add to `.env`:

```
CIPHERFORM_WEBHOOK_URL=https://app.saad.guru/api/leads/webhook
CIPHERFORM_WEBHOOK_SECRET=<the same secret as on the dashboard side>
```

**For production** — Netlify dashboard → Site settings → Environment variables:

- `CIPHERFORM_WEBHOOK_URL` = `https://app.saad.guru/api/leads/webhook`
- `CIPHERFORM_WEBHOOK_SECRET` = (paste the same secret used on the
  dashboard)

If either is missing, the integration silently no-ops (form keeps
working, leads just don't sync). Logs will say
`CipherBC webhook not configured — skipping`.

### 3. Test it

Submit a test entry. Then in `app.saad.guru/dashboard/leads`:

- Should appear in the list with status `new`, source `cipherform` (or
  whatever `utm_source` you submitted with).
- Open the detail view — should show telegram, product interest,
  landing page, full UTM breakdown, and the original submission
  timestamp distinct from the import timestamp.

## What the dashboard receives

```json
{
  "firstName": "Dana",
  "lastName": "Hasan",
  "fullName": "Dana Hasan",
  "company": "Marshall University",
  "email": "hasan6@marshall.edu",
  "phone": "+15189018720",
  "linkedinUrl": "",
  "telegram": "",
  "productInterest": "Flexify MPC Wallet, Wallet as a Service, ...",
  "message": "I need a virtual card which has money in it ...",
  "utmSource": "adwords",
  "utmMedium": "ppc",
  "utmCampaign": "Website Prospecting Search #2",
  "utmTerm": "",
  "utmContent": "",
  "pageUrl": "https://www.cipherbc.com/card/schedule-a-demo",
  "referrer": "https://www.google.com/",
  "submittedAt": "2026-02-11T21:01:45.375Z",
  "source": "cipherform",
  "mondayItemId": "8123456789"
}
```

Signed with HMAC-SHA256 of the raw body using the shared secret,
header `X-CipherBC-Signature: <hex digest>`.

## Idempotency

Re-submitting the same email is safe — the dashboard returns
`existed: true` and quietly enriches any missing fields on the
existing lead row. It will NOT overwrite an admin's edits; only
NULL fields get filled.

## Failure modes

- **Bad signature** → dashboard returns 401. Means the secrets don't
  match. The form proceeds anyway (Monday + Sheets succeed).
- **Dashboard down / unreachable** → the form's other destinations
  succeed, the user sees success, the lead is later not in CipherBC.
  No automatic retry. If this becomes a real reliability concern,
  the form's Google Sheets log can be replayed manually into the
  dashboard via CSV import.
- **Lead already exists** → returns 200 with `existed: true`. Not an
  error.

## Why three destinations

| Destination | Purpose |
|---|---|
| Monday.com | Sales pipeline / qualification ops |
| Google Sheets | Audit log of every submission attempt |
| CipherBC dashboard | BD outbound-engagement tracking + ad-source attribution analytics |

They serve different jobs. None replaces the others.
