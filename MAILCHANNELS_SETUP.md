# MailChannels Email Configuration

Upto platform uses **MailChannels** (not SMTP) for sending emails. MailChannels is a Cloudflare-native email service that works seamlessly with Workers.

## Setup Instructions

### 1. Get MailChannels API Key

1. Go to [MailChannels Dashboard](https://mailchannels.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the API key

### 2. Configure for Local Development

Edit `backend/wrangler.local.toml`:

```toml
[vars]
MAILCHANNELS_API_KEY = "your-api-key-here"
FRONTEND_URL = "http://localhost:3000"
FROM_EMAIL = "noreply@yourdomain.com"  # Optional, defaults to noreply@upto.app
```

### 3. Configure for Production

For production deployment, set the secret using Wrangler:

```bash
cd backend
npx wrangler secret put MAILCHANNELS_API_KEY
# Enter your API key when prompted

# Optional: Set frontend URL
npx wrangler secret put FRONTEND_URL
# Enter your production frontend URL (e.g., https://upto.app)
```

Or add to `wrangler.toml`:

```toml
[vars]
FRONTEND_URL = "https://upto.app"
FROM_EMAIL = "noreply@yourdomain.com"
```

### 4. Domain Verification (Production)

For production, you need to verify your sending domain:

1. Add DNS records to your domain:
   - **TXT record**: `_mailchannels` → (provided by MailChannels)
   - **SPF record**: `v=spf1 include:relay.mailchannels.net ~all`

2. Verify domain in MailChannels dashboard

### 5. Testing

After configuration, test the invitation system:

1. Go to Settings → Team tab
2. Enter an email address
3. Click "Send Invitation"
4. Check the email inbox (or MailChannels logs)

## Notes

- **Local Development**: MailChannels API key is optional. If not set, invitations will still be created but emails won't be sent (you'll see the invite link in the API response).
- **Production**: Always set `MAILCHANNELS_API_KEY` for email functionality.
- **Rate Limits**: MailChannels has rate limits. Check their documentation for details.
- **Free Tier**: MailChannels offers a free tier with limited sends per day.

## Alternative: Use SMTP

If you prefer SMTP instead of MailChannels, you would need to:

1. Install an SMTP library (e.g., `nodemailer`)
2. Update `backend/src/api/routes/organizations.ts` to use SMTP
3. Add SMTP configuration to `wrangler.local.toml`:
   ```toml
   SMTP_HOST = "smtp.gmail.com"
   SMTP_PORT = 587
   SMTP_USER = "your-email@gmail.com"
   SMTP_PASS = "your-app-password"
   ```

However, MailChannels is recommended for Cloudflare Workers as it's native and doesn't require additional dependencies.

