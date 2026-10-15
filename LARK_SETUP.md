# Lark "new lead" notification

Once a submission is recorded in the CipherBC CRM, the form posts a card
to a Lark group so every BD sees the lead immediately. The card shows
name, company, email, phone, Telegram/WhatsApp, LinkedIn, product
interest, the enquiry text, page/referrer/UTM, an **Open lead in CRM**
button, and an `@everyone` mention.

It is fire-and-forget: if Lark is down or unconfigured the form still
succeeds and the lead is still in the CRM and the Sheets log.

## Setup

### 1. Create a custom bot in the BD group

1. Open the Lark group → **Settings** (⚙) → **Bots** → **Add Bot**.
2. Choose **Custom Bot**, give it a name (e.g. `Lead Alerts`) and an
   avatar, then **Add**.
3. Copy the **Webhook URL**
   (`https://open.larksuite.com/open-apis/bot/v2/hook/<token>`).
4. Security: either
   - leave security settings off (simplest), or
   - enable **Signature verification** and copy the secret. Do **not**
     use *Custom keywords* or *IP allowlist* — the card title doesn't
     carry a fixed keyword and Netlify function IPs change.
5. **Finish**.

### 2. Add the environment variables

**Local dev** — in `.env`:

```
LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx
LARK_WEBHOOK_SECRET=              # only if Signature verification is on
```

**Production** — Netlify dashboard → Site settings → Environment variables:

- `LARK_WEBHOOK_URL`
- `LARK_WEBHOOK_SECRET` (optional)

If `LARK_WEBHOOK_URL` is missing the step silently no-ops and the log
says `Lark webhook not configured (missing LARK_WEBHOOK_URL) — skipping`.

### 3. Test

Submit a test lead. Within a couple of seconds the group should get a
green card titled `🆕 New lead: <name> · <company>` with the CRM button.

## Card colour / status line

| Header | Meaning |
|---|---|
| Green | New lead recorded in the CRM. Button links to it. |
| Blue | Email already existed in the CRM — repeat enquiry from a known lead. |
| Red | **CRM sync failed.** Lead is only in the Sheets log; replay it. |
| Orange | CRM webhook not configured on this deployment. |

## Order of operations in `submit-form`

1. Google Sheets audit log
2. CipherBC CRM (with one retry)
3. Lark notification (6s cap)

Lark runs last on purpose: it needs the CRM lead id for the deep link,
and it must never delay the audit log.

## Troubleshooting

- `Lark webhook 400 ... "code":19021` → signature mismatch. The secret in
  Netlify doesn't match the bot's, or the bot has signature verification
  off while `LARK_WEBHOOK_SECRET` is set (or vice-versa).
- `code 9499` / "keyword not found" → the bot has *Custom keywords*
  enabled. Turn it off.
- No message, no error in logs → `LARK_WEBHOOK_URL` not set on that
  environment.
