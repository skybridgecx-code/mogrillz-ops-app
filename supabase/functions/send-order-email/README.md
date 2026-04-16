# Send Order Email - Supabase Edge Function

Sends branded order confirmation emails to customers after successful checkout.

## Setup

### 1. Get Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain or use the free test domain
3. Create an API key

### 2. Set Secrets in Supabase

```bash
# Set the Resend API key
supabase secrets set RESEND_API_KEY=re_your_api_key_here

# Optional: customize from address (must be verified domain)
supabase secrets set FROM_EMAIL="MoGrillz <orders@mogrillzva.com>"
